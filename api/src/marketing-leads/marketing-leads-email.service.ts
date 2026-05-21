import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreateMarketingLeadDto } from './dto/create-marketing-lead.dto';
import {
  MARKETING_LEAD_CONFIRMATION_TEMPLATE,
  MARKETING_LEAD_NOTIFICATION_TEMPLATE
} from './email-templates/generated-email-templates';

type ResendMailConfig = {
  apiKey: string;
  from: string;
  to: string;
  logoUrl: string;
  timeoutMs: number;
};

type EmailSendError = Error & {
  status?: number;
  body?: string;
};

export type MarketingLeadEmailDeliveryResult = {
  internalEmailSent: boolean;
  confirmationEmailSent: boolean;
  errorMessage?: string;
};

@Injectable()
export class MarketingLeadsEmailService {
  private readonly logger = new Logger(MarketingLeadsEmailService.name);
  private readonly resendConfig: ResendMailConfig | null;

  constructor(private readonly configService: ConfigService) {
    this.resendConfig = this.readResendConfig();
  }

  async sendLeadNotification(
    id: string,
    dto: CreateMarketingLeadDto,
    ipAddress: string | undefined
  ): Promise<MarketingLeadEmailDeliveryResult> {
    const subject = `Novi SURP kontakt zahtev - ${dto.agencyName}`;
    const text = this.buildTextBody(id, dto, ipAddress);
    const html = this.buildHtmlBody(id, dto, ipAddress);

    if (!this.resendConfig) {
      const message = 'Marketing lead email is not configured. Lead was logged but no notification email was sent.';
      this.logger.warn({
        event: 'marketing_lead_email_not_configured',
        id,
        message
      });
      return {
        internalEmailSent: false,
        confirmationEmailSent: false,
        errorMessage: message
      };
    }

    try {
      await this.sendWithResend({
        config: this.resendConfig,
        to: this.resendConfig.to,
        replyTo: dto.email,
        subject,
        text,
        html
      });
      const confirmationResult = await this.sendLeadConfirmation(id, this.resendConfig, dto);

      return {
        internalEmailSent: true,
        confirmationEmailSent: confirmationResult.sent,
        errorMessage: confirmationResult.errorMessage
      };
    } catch (error) {
      const emailError = error as EmailSendError;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error({
        event: 'marketing_lead_email_failed',
        id,
        provider: 'resend',
        message,
        status: emailError.status,
        stack: error instanceof Error ? error.stack : undefined
      });
      return {
        internalEmailSent: false,
        confirmationEmailSent: false,
        errorMessage: message
      };
    }
  }

  private async sendLeadConfirmation(
    id: string,
    config: ResendMailConfig,
    dto: CreateMarketingLeadDto
  ): Promise<{ sent: boolean; errorMessage?: string }> {
    try {
      await this.sendWithResend({
        config,
        to: dto.email,
        replyTo: config.to,
        subject: 'Primili smo vas SURP zahtev',
        text: this.buildConfirmationTextBody(dto),
        html: this.buildConfirmationHtmlBody(dto)
      });
      return { sent: true };
    } catch (error) {
      const emailError = error as EmailSendError;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error({
        event: 'marketing_lead_confirmation_email_failed',
        id,
        provider: 'resend',
        message,
        status: emailError.status,
        stack: error instanceof Error ? error.stack : undefined
      });
      return { sent: false, errorMessage: message };
    }
  }

  private async sendWithResend({
    config,
    to,
    replyTo,
    subject,
    text,
    html
  }: {
    config: ResendMailConfig;
    to: string;
    replyTo: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: config.from,
          to: [to],
          reply_to: replyTo,
          subject,
          text,
          html
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const body = await response.text();
        const error = new Error(`Resend email API request failed with status ${response.status}.`) as EmailSendError;
        error.status = response.status;
        error.body = body;
        throw error;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  private readResendConfig(): ResendMailConfig | null {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    const from = this.configService.get<string>('RESEND_FROM');
    const to = this.configService.get<string>('MARKETING_LEADS_EMAIL_TO');

    if (!apiKey || !from || !to) {
      return null;
    }

    return {
      apiKey,
      from,
      to,
      logoUrl: this.configService.get<string>('MARKETING_EMAIL_LOGO_URL') ?? 'https://surp.rs/logo.jpg',
      timeoutMs: this.configService.get<number>('EMAIL_TIMEOUT_MS') ?? 10000
    };
  }

  private buildTextBody(id: string, dto: CreateMarketingLeadDto, ipAddress: string | undefined): string {
    return [
      'Novi SURP kontakt zahtev',
      '',
      `Lead ID: ${id}`,
      `Ime i prezime: ${dto.name}`,
      `Email: ${dto.email}`,
      `Naziv agencije: ${dto.agencyName}`,
      `Telefon: ${dto.phone || '-'}`,
      `Broj polazaka dnevno: ${dto.departuresPerDay}`,
      `IP adresa: ${ipAddress ?? 'unknown'}`,
      '',
      'Poruka:',
      dto.message?.trim() || '-'
    ].join('\n');
  }

  private buildHtmlBody(id: string, dto: CreateMarketingLeadDto, ipAddress: string | undefined): string {
    return renderEmailTemplate(MARKETING_LEAD_NOTIFICATION_TEMPLATE, {
      LEAD_ID: escapeHtml(id),
      LOGO_URL: escapeHtml(this.resendConfig?.logoUrl ?? 'https://surp.rs/logo.jpg'),
      NAME: escapeHtml(dto.name),
      EMAIL: escapeHtml(dto.email),
      AGENCY_NAME: escapeHtml(dto.agencyName),
      PHONE: escapeHtml(dto.phone || '-'),
      DEPARTURES_PER_DAY: escapeHtml(dto.departuresPerDay),
      IP_ADDRESS: escapeHtml(ipAddress ?? 'unknown'),
      MESSAGE_HTML: escapeHtml(dto.message?.trim() || '-').replace(/\n/g, '<br>')
    });
  }

  private buildConfirmationTextBody(dto: CreateMarketingLeadDto): string {
    return [
      `Zdravo ${dto.name},`,
      '',
      'Hvala na interesovanju za SURP i poslatom zahtevu.',
      'Primili smo podatke o vasoj agenciji i javicemo se uskoro sa odgovorom i narednim koracima.',
      '',
      'Ako zelite da dopunite zahtev, samo odgovorite na ovaj email.',
      '',
      'SURP tim'
    ].join('\n');
  }

  private buildConfirmationHtmlBody(dto: CreateMarketingLeadDto): string {
    return renderEmailTemplate(MARKETING_LEAD_CONFIRMATION_TEMPLATE, {
      NAME: escapeHtml(dto.name),
      LOGO_URL: escapeHtml(this.resendConfig?.logoUrl ?? 'https://surp.rs/logo.jpg')
    });
  }
}

function renderEmailTemplate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (html, [key, value]) => html.replaceAll(`@@${key}@@`, value),
    template
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreateMarketingLeadDto } from './dto/create-marketing-lead.dto';

type ResendMailConfig = {
  apiKey: string;
  from: string;
  to: string;
  timeoutMs: number;
};

type EmailSendError = Error & {
  status?: number;
  body?: string;
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
  ): Promise<void> {
    const subject = `Novi SURP demo zahtev - ${dto.agencyName}`;
    const text = this.buildTextBody(id, dto, ipAddress);
    const html = this.buildHtmlBody(id, dto, ipAddress);

    if (!this.resendConfig) {
      const message = 'Marketing lead email is not configured. Lead was logged but no notification email was sent.';
      const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

      if (isProduction) {
        this.logger.error({
          event: 'marketing_lead_email_not_configured',
          message
        });
        throw new InternalServerErrorException('Demo zahtev nije poslat. Pokusajte ponovo kasnije.');
      }

      this.logger.warn(message);
      return;
    }

    try {
      await this.sendWithResend(this.resendConfig, dto.email, subject, text, html);
    } catch (error) {
      const emailError = error as EmailSendError;
      this.logger.error({
        event: 'marketing_lead_email_failed',
        provider: 'resend',
        message: error instanceof Error ? error.message : String(error),
        status: emailError.status,
        body: emailError.body,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new InternalServerErrorException('Demo zahtev nije poslat. Pokusajte ponovo kasnije.');
    }
  }

  private async sendWithResend(
    config: ResendMailConfig,
    replyTo: string,
    subject: string,
    text: string,
    html: string
  ): Promise<void> {
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
          to: [config.to],
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
      timeoutMs: this.configService.get<number>('EMAIL_TIMEOUT_MS') ?? 10000
    };
  }

  private buildTextBody(id: string, dto: CreateMarketingLeadDto, ipAddress: string | undefined): string {
    return [
      'Novi SURP demo zahtev',
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
    const fields = [
      ['Lead ID', id],
      ['Ime i prezime', dto.name],
      ['Email', dto.email],
      ['Naziv agencije', dto.agencyName],
      ['Telefon', dto.phone || '-'],
      ['Broj polazaka dnevno', dto.departuresPerDay],
      ['IP adresa', ipAddress ?? 'unknown']
    ];

    return `
      <h2>Novi SURP demo zahtev</h2>
      <table cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
        <tbody>
          ${fields
            .map(
              ([label, value]) => `
                <tr>
                  <th align="left" style="border: 1px solid #e5e7eb; background: #f8fafc;">${escapeHtml(label)}</th>
                  <td style="border: 1px solid #e5e7eb;">${escapeHtml(value)}</td>
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
      <h3>Poruka</h3>
      <p>${escapeHtml(dto.message?.trim() || '-').replace(/\n/g, '<br>')}</p>
    `;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

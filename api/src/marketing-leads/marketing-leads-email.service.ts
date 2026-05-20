import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import { CreateMarketingLeadDto } from './dto/create-marketing-lead.dto';

type MarketingLeadsMailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  to: string;
};

@Injectable()
export class MarketingLeadsEmailService {
  private readonly logger = new Logger(MarketingLeadsEmailService.name);
  private readonly mailConfig = this.readMailConfig();
  private readonly transporter: Transporter | null = this.mailConfig
    ? nodemailer.createTransport({
        host: this.mailConfig.host,
        port: this.mailConfig.port,
        secure: this.mailConfig.secure,
        auth: {
          user: this.mailConfig.user,
          pass: this.mailConfig.password
        }
      })
    : null;

  constructor(private readonly configService: ConfigService) {}

  async sendLeadNotification(
    id: string,
    dto: CreateMarketingLeadDto,
    ipAddress: string | undefined
  ): Promise<void> {
    if (!this.transporter || !this.mailConfig) {
      this.logger.warn('Marketing lead email is not configured. Lead was logged but no notification email was sent.');
      return;
    }

    const subject = `Novi SURP demo zahtev - ${dto.agencyName}`;

    try {
      await this.transporter.sendMail({
        from: this.mailConfig.from,
        to: this.mailConfig.to,
        replyTo: dto.email,
        subject,
        text: this.buildTextBody(id, dto, ipAddress),
        html: this.buildHtmlBody(id, dto, ipAddress)
      });
    } catch (error) {
      this.logger.error(
        'Failed to send marketing lead notification email.',
        error instanceof Error ? error.stack : String(error)
      );
      throw new InternalServerErrorException('Demo zahtev nije poslat. Pokusajte ponovo kasnije.');
    }
  }

  private readMailConfig(): MarketingLeadsMailConfig | null {
    const host = this.configService.get<string>('SMTP_HOST');
    const user = this.configService.get<string>('SMTP_USER');
    const password = this.configService.get<string>('SMTP_PASSWORD');
    const from = this.configService.get<string>('SMTP_FROM');
    const to = this.configService.get<string>('MARKETING_LEADS_EMAIL_TO');

    if (!host || !user || !password || !from || !to) {
      return null;
    }

    return {
      host,
      port: this.configService.get<number>('SMTP_PORT') ?? 465,
      secure: this.configService.get<boolean>('SMTP_SECURE') ?? true,
      user,
      password,
      from,
      to
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

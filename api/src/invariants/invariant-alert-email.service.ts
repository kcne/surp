import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InvariantResultDto } from './dto/invariant.response.dto';

@Injectable()
export class InvariantAlertEmailService {
  private readonly logger = new Logger(InvariantAlertEmailService.name);

  constructor(private readonly config: ConfigService) {}

  async send(tenantName: string, recipients: string[], results: InvariantResultDto[]): Promise<boolean> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('RESEND_FROM');
    if (!apiKey || !from || recipients.length === 0) {
      this.logger.warn({ event: 'invariant_alert_email_skipped', tenantName, recipientCount: recipients.length });
      return false;
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.get<number>('EMAIL_TIMEOUT_MS', 10000)
    );

    try {
      const lines = results.map((result) => `${result.title}: ${result.violationCount}`);
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: recipients,
          subject: `SURP upozorenje o podacima - ${tenantName}`,
          text: [
            `Dnevna provera za ${tenantName} pronasla je novu promenu:`,
            '',
            ...lines,
            '',
            'Detalji su otvoreni kao BUG tiket u SURP-u.'
          ].join('\n'),
          html: `<p>Dnevna provera za <strong>${escapeHtml(tenantName)}</strong> pronasla je novu promenu:</p><ul>${results
            .map((result) => `<li>${escapeHtml(result.title)}: ${result.violationCount}</li>`)
            .join('')}</ul><p>Detalji su otvoreni kao BUG tiket u SURP-u.</p>`
        }),
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`Resend email API request failed with status ${response.status}`);
      return true;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

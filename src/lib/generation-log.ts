import { db } from '@/lib/db';
import { sendEmail } from '@/lib/resend';

export type GenerationType =
  | 'parse-cv'
  | 'analyze-job'
  | 'restructure-cv'
  | 'score-cv'
  | 'enhance-achievements'
  | 'generate-cover-letter'
  | 'generate-pdf'
  | 'generate-cover-letter-pdf';

interface LogParams {
  type: GenerationType;
  success: boolean;
  model?: string | null;
  errorMessage?: string | null;
  durationMs?: number;
  ip?: string | null;
}

/**
 * Records one generation attempt (success or failure) for the admin
 * dashboard, and - only on failure - fires a real-time alert email to the
 * admin. Never throws: a logging/email hiccup must not break the actual
 * user-facing request it's instrumenting.
 */
export async function logGenerationEvent(params: LogParams): Promise<void> {
  try {
    await db.generationEvent.create({
      data: {
        type: params.type,
        success: params.success,
        model: params.model ?? null,
        // Truncated so one huge stack trace can't bloat the table.
        errorMessage: params.errorMessage ? params.errorMessage.substring(0, 500) : null,
        durationMs: params.durationMs ?? null,
        ip: params.ip ?? null,
      },
    });
  } catch (err) {
    console.warn('[generation-log] Failed to record event:', err instanceof Error ? err.message : err);
  }

  if (!params.success) {
    void sendFailureAlert(params).catch((err) => {
      console.warn('[generation-log] Failed to send failure alert email:', err instanceof Error ? err.message : err);
    });
  }
}

async function sendFailureAlert(params: LogParams): Promise<void> {
  const adminEmail = process.env.ADMIN_ALERT_EMAIL;
  if (!adminEmail) return;

  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'medium' });

  const result = await sendEmail({
    to: adminEmail,
    subject: `CV Builder failure: ${params.type}`,
    html: `
      <div style="font-family: sans-serif; font-size: 14px; color: #1e1e1e;">
        <h2 style="margin: 0 0 12px;">Generation failure</h2>
        <table cellpadding="6" style="border-collapse: collapse;">
          <tr><td style="color: #666;">Type</td><td><strong>${escapeHtml(params.type)}</strong></td></tr>
          <tr><td style="color: #666;">Model</td><td>${escapeHtml(params.model || 'n/a')}</td></tr>
          <tr><td style="color: #666;">Duration</td><td>${params.durationMs ? `${params.durationMs}ms` : 'n/a'}</td></tr>
          <tr><td style="color: #666;">IP</td><td>${escapeHtml(params.ip || 'unknown')}</td></tr>
          <tr><td style="color: #666;">Time (UTC)</td><td>${timestamp}</td></tr>
        </table>
        <p style="margin-top: 16px; color: #666;">Error</p>
        <pre style="background: #f5f5f5; padding: 12px; border-radius: 6px; white-space: pre-wrap; font-size: 12px;">${escapeHtml(params.errorMessage || 'No error message captured')}</pre>
      </div>
    `,
  });

  if (!result.sent) {
    console.warn('[generation-log] Resend send failed:', result.error);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

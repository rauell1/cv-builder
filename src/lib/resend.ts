/**
 * Minimal Resend client - a single POST to their REST API, no SDK dependency
 * (matches how NVIDIA/Gemini are called directly in ai-provider.ts).
 */

const RESEND_API_URL = 'https://api.resend.com/emails';

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    return { sent: false, error: 'RESEND_API_KEY or RESEND_FROM_EMAIL is not configured' };
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: params.subject,
        html: params.html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { sent: false, error: `Resend HTTP ${res.status}: ${errText.substring(0, 300)}` };
    }

    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : String(err) };
  }
}

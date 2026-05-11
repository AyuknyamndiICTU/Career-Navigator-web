type BrevoSendEmailPayload = {
  sender: { email: string; name?: string };
  to: Array<{ email: string }>;
  subject: string;
  textContent?: string;
  htmlContent?: string;
};

export class BrevoEmailer {
  async sendOtpEmail(params: {
    apiKey: string;
    senderEmail: string;
    toEmail: string;
    otpCode: string;
  }): Promise<void> {
    const { apiKey, senderEmail, toEmail, otpCode } = params;

    const url = 'https://api.brevo.com/v3/smtp/email';

    const payload: BrevoSendEmailPayload = {
      sender: { email: senderEmail, name: 'Career Navigator' },
      to: [{ email: toEmail }],
      subject: 'Your verification code',
      textContent: `Your Career Navigator verification code is: ${otpCode}`,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      throw new Error(
        `Brevo email send failed (HTTP ${res.status}): ${bodyText}`,
      );
    }
  }
}

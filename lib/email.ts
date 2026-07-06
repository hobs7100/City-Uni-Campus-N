const RESEND_API_URL = "https://api.resend.com/emails";
const FROM_ADDRESS = "City College (UNIVERSITY CAMPUS) <noreply@nxsebk.com>";

interface SendResult {
  success: boolean;
  error?: string;
}

async function sendEmail(to: string, subject: string, html: string): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[email] RESEND_API_KEY is not configured; skipping send.");
    return { success: false, error: "Email service is not configured." };
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[email] Resend send failed (${res.status}): ${body}`);
      return { success: false, error: `Failed to send email (status ${res.status}).` };
    }

    return { success: true };
  } catch (err) {
    console.error("[email] Resend send threw an error:", err);
    return { success: false, error: "Failed to send email due to a network error." };
  }
}

function wrapEmail(bodyHtml: string): string {
  return `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; color: #1e293b;">
    <div style="background: linear-gradient(135deg, #4338ca, #0891b2); padding: 24px 32px; border-radius: 12px 12px 0 0;">
      <h1 style="color: #ffffff; font-size: 18px; margin: 0;">City College</h1>
      <p style="color: #e0e7ff; font-size: 13px; margin: 4px 0 0;">University Campus</p>
    </div>
    <div style="border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; padding: 32px;">
      ${bodyHtml}
      <p style="font-size: 12px; color: #94a3b8; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
        This is an automated message from City College (University Campus). Please do not reply to this email.
      </p>
    </div>
  </div>`;
}

function passwordBlock(password: string): string {
  return `
    <div style="background: #f1f5f9; border-radius: 8px; padding: 16px 20px; margin: 20px 0;">
      <p style="font-size: 12px; color: #64748b; margin: 0 0 4px;">Your password</p>
      <p style="font-size: 20px; font-weight: 700; letter-spacing: 1px; margin: 0; color: #0f172a;">${password}</p>
    </div>
    <p style="font-size: 14px; line-height: 1.6; margin: 0 0 8px;">
      For your security, you can change this password at any time after logging in by using your current password in the
      <strong>Profile</strong> section.
    </p>`;
}

export async function sendWelcomeEmail(params: {
  to: string;
  name: string;
  password: string;
}): Promise<SendResult> {
  const { to, name, password } = params;
  const html = wrapEmail(`
    <h2 style="font-size: 18px; margin: 0 0 12px;">Welcome to City College, ${escapeHtml(name)}!</h2>
    <p style="font-size: 14px; line-height: 1.6; margin: 0 0 8px;">
      An account has been created for you on the City College Campus Management System. You can log in using the
      credentials below:
    </p>
    <p style="font-size: 14px; line-height: 1.6; margin: 12px 0 0;">
      <strong>Email:</strong> ${escapeHtml(to)}
    </p>
    ${passwordBlock(password)}
  `);
  return sendEmail(to, "Welcome to City College — Your Account Details", html);
}

export async function sendPasswordResetEmail(params: {
  to: string;
  name: string;
  password: string;
}): Promise<SendResult> {
  const { to, name, password } = params;
  const html = wrapEmail(`
    <h2 style="font-size: 18px; margin: 0 0 12px;">Password Reset, ${escapeHtml(name)}</h2>
    <p style="font-size: 14px; line-height: 1.6; margin: 0 0 8px;">
      Your password for the City College Campus Management System has been reset by an administrator. Your new
      password is below:
    </p>
    ${passwordBlock(password)}
  `);
  return sendEmail(to, "City College — Your Password Has Been Reset", html);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

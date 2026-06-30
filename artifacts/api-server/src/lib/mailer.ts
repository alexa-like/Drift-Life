import nodemailer from "nodemailer";
import { logger } from "./logger";

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env["GMAIL_USER"],
        pass: process.env["GMAIL_PASS"],
      },
    });
  }
  return transporter;
}

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function buildHtml(otp: string, subject: string): string {
  return `
    <div style="background:#0a0a0f;color:#e2e8f0;font-family:monospace;padding:32px;border-radius:8px;max-width:400px">
      <h2 style="color:#00d4ff;margin:0 0 8px">DRIFTLIFE</h2>
      <p style="margin:0 0 4px;color:#94a3b8;font-size:11px">NEW VANTA / 2047</p>
      <hr style="border:none;border-top:1px solid #1e1e2e;margin:16px 0"/>
      <p style="margin:0 0 24px;color:#94a3b8">${subject === "Password Reset" ? "Your password reset code:" : "Your verification code:"}</p>
      <div style="background:#111118;border:1px solid #1e1e2e;border-radius:6px;padding:24px;text-align:center">
        <span style="font-size:36px;letter-spacing:8px;color:#00d4ff;font-weight:bold">${otp}</span>
      </div>
      <p style="margin:24px 0 0;color:#64748b;font-size:12px">Expires in ${subject === "Password Reset" ? "30" : "10"} minutes. Do not share this code.</p>
    </div>
  `;
}

// Brevo sends over HTTPS (port 443), which works on hosts that block SMTP ports (e.g. Render).
// Preferred path whenever BREVO_API_KEY is configured.
async function sendViaBrevo(to: string, otp: string, subject: string): Promise<void> {
  const apiKey = process.env["BREVO_API_KEY"];
  const fromEmail = process.env["GMAIL_USER"] || "no-reply@driftlife.app";
  const subjectLine = subject === "Password Reset"
    ? "DriftLife — Password Reset Code"
    : "DriftLife — Your verification code";

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "api-key": apiKey as string,
    },
    body: JSON.stringify({
      sender: { name: "DriftLife", email: fromEmail },
      to: [{ email: to }],
      subject: subjectLine,
      htmlContent: buildHtml(otp, subject),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Brevo send failed: ${res.status} ${body}`);
  }
}

// Gmail SMTP fallback — works on hosts that don't block outbound SMTP ports (e.g. Replit dev).
async function sendViaGmail(to: string, otp: string, subject: string): Promise<void> {
  const from = process.env["GMAIL_USER"];
  const subjectLine = subject === "Password Reset"
    ? "DriftLife — Password Reset Code"
    : "DriftLife — Your verification code";
  await getTransporter().sendMail({
    from: `"DriftLife" <${from}>`,
    to,
    subject: subjectLine,
    html: buildHtml(otp, subject),
  });
}

export async function sendOtpEmail(to: string, otp: string, subject = "Verification Code"): Promise<void> {
  try {
    if (process.env["BREVO_API_KEY"]) {
      await sendViaBrevo(to, otp, subject);
    } else if (process.env["GMAIL_USER"] && process.env["GMAIL_PASS"]) {
      await sendViaGmail(to, otp, subject);
    } else {
      throw new Error("No email provider configured (set BREVO_API_KEY or GMAIL_USER/GMAIL_PASS)");
    }
    logger.info({ to }, "Email sent");
  } catch (err) {
    logger.error({ err, to }, "Failed to send email");
    throw err;
  }
}

export async function sendOtp(to: string, otp: string, subject?: string): Promise<void> {
  return sendOtpEmail(to, otp, subject);
}

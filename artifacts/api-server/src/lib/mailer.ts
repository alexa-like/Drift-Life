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

export async function sendOtpEmail(to: string, otp: string, subject = "Verification Code"): Promise<void> {
  const from = process.env["GMAIL_USER"];
  const subjectLine = subject === "Password Reset"
    ? "DriftLife — Password Reset Code"
    : "DriftLife — Your verification code";
  try {
    await getTransporter().sendMail({
      from: `"DriftLife" <${from}>`,
      to,
      subject: subjectLine,
      html: `
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
      `,
    });
    logger.info({ to }, "Email sent");
  } catch (err) {
    logger.error({ err, to }, "Failed to send email");
    throw err;
  }
}

export async function sendOtp(to: string, otp: string, subject?: string): Promise<void> {
  return sendOtpEmail(to, otp, subject);
}

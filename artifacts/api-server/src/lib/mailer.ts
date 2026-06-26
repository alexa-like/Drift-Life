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

export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  const from = process.env["GMAIL_USER"];
  try {
    await getTransporter().sendMail({
      from: `"DriftLife" <${from}>`,
      to,
      subject: "DriftLife — Your verification code",
      html: `
        <div style="background:#0a0a0f;color:#e2e8f0;font-family:monospace;padding:32px;border-radius:8px;max-width:400px">
          <h2 style="color:#00d4ff;margin:0 0 16px">DriftLife</h2>
          <p style="margin:0 0 24px;color:#94a3b8">New Vanta, 2047. Your verification code:</p>
          <div style="background:#111118;border:1px solid #1e1e2e;border-radius:6px;padding:24px;text-align:center">
            <span style="font-size:36px;letter-spacing:8px;color:#00d4ff;font-weight:bold">${otp}</span>
          </div>
          <p style="margin:24px 0 0;color:#64748b;font-size:12px">Expires in 10 minutes. Do not share this code.</p>
        </div>
      `,
    });
    logger.info({ to }, "OTP email sent");
  } catch (err) {
    logger.error({ err, to }, "Failed to send OTP email");
    throw err;
  }
}

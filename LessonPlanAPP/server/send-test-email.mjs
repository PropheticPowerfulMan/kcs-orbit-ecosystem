import "dotenv/config";
import nodemailer from "nodemailer";
import { recoveryEmail } from "./emailTemplate.mjs";

const recipient = String(process.argv[2] || "").trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
  throw new Error("Usage: npm run send:test -- user@example.com");
}

const required = [
  "APP_URL", "LWS_SMTP_HOST", "LWS_SMTP_USER", "LWS_SMTP_PASSWORD",
  "MAIL_FROM_ADDRESS", "PUBLIC_LOGO_URL"
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error("Missing environment variables: " + missing.join(", "));

const transporter = nodemailer.createTransport({
  host: process.env.LWS_SMTP_HOST,
  port: Number(process.env.LWS_SMTP_PORT || 465),
  secure: String(process.env.LWS_SMTP_SECURE || "true") === "true",
  auth: { user: process.env.LWS_SMTP_USER, pass: process.env.LWS_SMTP_PASSWORD },
  disableFileAccess: true,
  disableUrlAccess: true
});

await transporter.verify();
const appUrl = process.env.APP_URL.replace(/\/$/, "");
const message = recoveryEmail({
  actionLink: appUrl + "/#/login?email_preview=1",
  logoUrl: process.env.PUBLIC_LOGO_URL
});
const result = await transporter.sendMail({
  from: '"' + (process.env.MAIL_FROM_NAME || "KCS EduPlanner") + '" <' + process.env.MAIL_FROM_ADDRESS + '>',
  to: recipient,
  replyTo: process.env.MAIL_REPLY_TO || process.env.MAIL_FROM_ADDRESS,
  ...message
});
console.log("Test email sent to " + recipient + " with id " + result.messageId);
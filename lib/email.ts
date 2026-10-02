import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import nodemailer from 'nodemailer';

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// 1. AWS SES SDK Client using AWS Access Key ID & Secret Access Key
function getSESClient(): SESClient | null {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-south-1';

  const isConfigured =
    accessKeyId &&
    secretAccessKey &&
    accessKeyId !== 'placeholder' &&
    secretAccessKey !== 'placeholder' &&
    !accessKeyId.startsWith('YOUR_');

  if (!isConfigured) {
    return null;
  }

  return new SESClient({
    region,
    credentials: {
      accessKeyId: accessKeyId.trim(),
      secretAccessKey: secretAccessKey.trim(),
    },
  });
}

// 2. SMTP Transporter fallback (if SMTP credentials are provided instead)
function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  const isConfigured =
    host &&
    user &&
    pass &&
    user !== 'placeholder' &&
    pass !== 'placeholder' &&
    !user.startsWith('YOUR_');

  if (!isConfigured) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });
}

export async function sendEmail({ to, subject, html, text }: SendMailOptions) {
  const from =
    process.env.AWS_SES_FROM_EMAIL ||
    process.env.SMTP_FROM ||
    'VTGST Platform <no-reply@vtgst.com>';

  // Primary: AWS SES SDK with Access Key & Secret
  const sesClient = getSESClient();
  if (sesClient) {
    try {
      const command = new SendEmailCommand({
        Source: from,
        Destination: {
          ToAddresses: [to],
        },
        Message: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: html,
              Charset: 'UTF-8',
            },
            Text: {
              Data: text || html.replace(/<[^>]*>?/gm, ''),
              Charset: 'UTF-8',
            },
          },
        },
      });

      const response = await sesClient.send(command);
      console.log(`[AWS SES SUCCESS] Email sent to ${to}. MessageId: ${response.MessageId}`);
      return { success: true, messageId: response.MessageId };
    } catch (err: any) {
      console.error('[AWS SES ERROR] Failed to send email via AWS SES SDK:', err);
      throw new Error(err.message || 'Failed to send email via Amazon SES');
    }
  }

  // Fallback: SMTP Transporter
  const transporter = getTransporter();
  if (transporter) {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text: text || html.replace(/<[^>]*>?/gm, ''),
      html,
    });
    console.log(`[SMTP SUCCESS] Email sent to ${to}. MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  }

  // Local/Dev Simulation fallback
  console.warn(`[EMAIL NOTICE - NO AWS CREDENTIALS SET] Dispatched email to ${to}:`);
  console.log(`Subject: ${subject}`);
  console.log(`Body:\n${text || html}`);
  return { success: true, simulated: true };
}

export async function sendPasswordResetEmail({
  to,
  name,
  resetUrl,
  expiresInMinutes = 60,
}: {
  to: string;
  name: string;
  resetUrl: string;
  expiresInMinutes?: number;
}) {
  const subject = 'Reset Your VTGST Account Password';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="560px" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); overflow: hidden;">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 32px 30px; text-align: center;">
              <div style="display: inline-block; background-color: #ffffff; width: 44px; height: 44px; line-height: 44px; border-radius: 12px; font-weight: 900; font-size: 20px; color: #0284c7; margin-bottom: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">VT</div>
              <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">VTGST Platform</h1>
              <p style="color: #bae6fd; margin: 4px 0 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">Security & Authentication</p>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 36px 32px;">
              <h2 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 12px 0;">Password Reset Request</h2>
              <p style="font-size: 14px; line-height: 22px; color: #475569; margin: 0 0 20px 0;">
                Hello <strong>${name}</strong>,<br>
                We received a request to reset the password for your VTGST account associated with <strong>${to}</strong>.
              </p>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 10px rgba(2, 132, 199, 0.35);">
                  Reset Password Now →
                </a>
              </div>

              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; margin: 24px 0;">
                <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 18px;">
                  ⏳ <strong>Important:</strong> This password reset link will expire in <strong>${expiresInMinutes} minutes</strong>.
                </p>
              </div>

              <p style="font-size: 12px; color: #64748b; line-height: 18px; margin: 0 0 12px 0;">
                If the button above does not work, copy and paste the following URL into your browser:
              </p>
              <p style="font-size: 11px; color: #0284c7; word-break: break-all; background-color: #f0f9ff; padding: 10px; border-radius: 6px; border: 1px dashed #bae6fd; margin: 0 0 24px 0;">
                ${resetUrl}
              </p>

              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;">

              <p style="font-size: 12px; color: #94a3b8; line-height: 18px; margin: 0;">
                🛡️ If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f1f5f9; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="font-size: 11px; color: #64748b; margin: 0;">
                © 2026 Viver Technologies. All rights reserved.<br>
                Next-Gen GST Invoicing & Retail POS ERP
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return sendEmail({
    to,
    subject,
    html,
  });
}

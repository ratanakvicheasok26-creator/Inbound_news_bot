import { Resend } from "resend"

const RESEND_API_KEY = process.env.RESEND_API_KEY || ""
const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "Inbound Reports <onboarding@resend.dev>"
const SITE_NAME = "Inbound Reports"

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

function isDevFallback(): boolean {
  return !resend
}

function logDevEmail(type: string, to: string, url: string) {
  console.log(`\n[Email Dev Fallback] ${type}`)
  console.log(`  To: ${to}`)
  console.log(`  Link: ${url}\n`)
}

function emailShell(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${SITE_NAME}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 12px;text-align:center;border-bottom:1px solid #f4f4f5;">
              <p style="margin:0;font-size:20px;font-weight:700;color:#18181b;letter-spacing:-0.02em;">${SITE_NAME}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#fafafa;border-top:1px solid #f4f4f5;">
              <p style="margin:0;font-size:12px;color:#71717a;line-height:1.5;">
                If you did not request this, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function ctaButton(href: string, label: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px auto;">
  <tr>
    <td style="border-radius:8px;background:#e53e3e;">
      <a href="${href}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${label}</a>
    </td>
  </tr>
</table>`
}

function urlFallback(url: string): string {
  return `<p style="margin:24px 0 0;font-size:13px;color:#71717a;line-height:1.6;">
    Or copy and paste this link into your browser:<br />
    <a href="${url}" style="color:#e53e3e;word-break:break-all;">${url}</a>
  </p>`
}

function passwordResetHtml(resetUrl: string): string {
  return emailShell(`
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#18181b;">Reset your password</h1>
    <p style="margin:0 0 8px;font-size:15px;color:#3f3f46;line-height:1.6;">
      We received a request to reset the password for your ${SITE_NAME} account.
    </p>
    <p style="margin:0;font-size:14px;color:#71717a;line-height:1.6;">
      Click the button below to choose a new password. This link expires in <strong>1 hour</strong>.
    </p>
    ${ctaButton(resetUrl, "Reset password")}
    ${urlFallback(resetUrl)}
  `)
}

function verificationHtml(verifyUrl: string, displayName?: string): string {
  const greeting = displayName ? `Hi ${displayName},` : "Hi there,"
  return emailShell(`
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#18181b;">Verify your email</h1>
    <p style="margin:0 0 8px;font-size:15px;color:#3f3f46;line-height:1.6;">${greeting}</p>
    <p style="margin:0;font-size:14px;color:#71717a;line-height:1.6;">
      Thanks for signing up for ${SITE_NAME}. Confirm your email address to activate your account.
      This link expires in <strong>24 hours</strong>.
    </p>
    ${ctaButton(verifyUrl, "Verify email")}
    ${urlFallback(verifyUrl)}
  `)
}

export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  if (isDevFallback()) {
    logDevEmail("Password reset", email, resetUrl)
    return { ok: true }
  }

  const subject = `Reset your ${SITE_NAME} password`
  const text = `Reset your password for ${SITE_NAME}.\n\nClick this link to choose a new password (expires in 1 hour):\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email.`

  try {
    const { error } = await resend!.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject,
      html: passwordResetHtml(resetUrl),
      text,
    })

    if (error) {
      console.error("[Email] Resend error:", error)
      return { ok: false, error: "Failed to send email" }
    }

    return { ok: true }
  } catch (e) {
    console.error("[Email] Resend fetch error:", e)
    return { ok: false, error: "Failed to send email" }
  }
}

export async function sendVerificationEmail(
  email: string,
  verifyUrl: string,
  displayName?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (isDevFallback()) {
    logDevEmail("Email verification", email, verifyUrl)
    return { ok: true }
  }

  const subject = `Verify your ${SITE_NAME} email`
  const greeting = displayName ? `Hi ${displayName},` : "Hi there,"
  const text = `${greeting}\n\nVerify your email for ${SITE_NAME} (expires in 24 hours):\n${verifyUrl}\n\nIf you did not request this, you can safely ignore this email.`

  try {
    const { error } = await resend!.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject,
      html: verificationHtml(verifyUrl, displayName),
      text,
    })

    if (error) {
      console.error("[Email] Resend error:", error)
      return { ok: false, error: "Failed to send email" }
    }

    return { ok: true }
  } catch (e) {
    console.error("[Email] Resend fetch error:", e)
    return { ok: false, error: "Failed to send email" }
  }
}

function otpHtml(otp: string, displayName?: string): string {
  const greeting = displayName ? `Hi ${displayName},` : "Hi there,"
  return emailShell(`
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#18181b;">Verify your email</h1>
    <p style="margin:0 0 8px;font-size:15px;color:#3f3f46;line-height:1.6;">${greeting}</p>
    <p style="margin:0 0 20px;font-size:14px;color:#71717a;line-height:1.6;">
      Welcome to ${SITE_NAME}. Your 6-digit verification code is:
    </p>
    <div style="background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;padding:16px;margin:0 0 20px;text-align:center;">
      <span style="font-size:32px;font-weight:700;font-family:monospace;letter-spacing:6px;color:#e53e3e;">${otp}</span>
    </div>
    <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;">
      Enter this code on the website to verify your email. This code expires in <strong>10 minutes</strong>.
    </p>
  `)
}

export async function sendOtpEmail(
  email: string,
  otp: string,
  displayName?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (isDevFallback()) {
    logDevEmail("OTP verification", email, `Code: ${otp}`)
    return { ok: true }
  }

  const subject = `Your ${SITE_NAME} verification code`
  const greeting = displayName ? `Hi ${displayName},` : "Hi there,"
  const text = `${greeting}\n\nYour ${SITE_NAME} verification code is: ${otp}\n\nEnter this code on the website to verify your email. This code expires in 10 minutes.\n\nIf you did not request this, you can safely ignore this email.`

  try {
    const { error } = await resend!.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject,
      html: otpHtml(otp, displayName),
      text,
    })

    if (error) {
      console.error("[Email] Resend OTP error:", error)
      return { ok: false, error: "Failed to send email" }
    }

    return { ok: true }
  } catch (e) {
    console.error("[Email] Resend OTP fetch error:", e)
    return { ok: false, error: "Failed to send email" }
  }
}

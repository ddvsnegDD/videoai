import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.mail.ru';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || SMTP_USER || 'noreply@ddvideoai.ru';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    requireTLS: SMTP_PORT === 587,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

export async function sendOTPEmail(to, code) {
  if (!SMTP_USER || !SMTP_PASS) {
    console.warn('SMTP_USER/SMTP_PASS not set — logging OTP to console');
    console.log(`[OTP] ${to} → ${code}`);
    return { ok: true, mock: true };
  }

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:'Inter',system-ui,-apple-system,sans-serif;background:#F8FAF9;">
  <div style="max-width:480px;margin:40px auto;padding:0 16px;">
    <div style="background:#FFFFFF;border-radius:20px;padding:40px 32px;border:1px solid #E0E5E2;">
      <div style="text-align:center;margin-bottom:32px;">
        <div style="display:inline-flex;align-items:center;gap:8px;">
          <div style="width:32px;height:32px;border-radius:9px;background:linear-gradient(135deg,#10B981,#059669);display:inline-block;"></div>
          <span style="font-family:'Manrope',sans-serif;font-weight:800;font-size:1.2rem;color:#0A1F16;">Video<span style="color:#10B981;">AI</span></span>
        </div>
      </div>
      <h1 style="font-family:'Manrope',sans-serif;font-size:1.5rem;font-weight:700;text-align:center;color:#0A1F16;margin:0 0 8px;">Ваш код входа</h1>
      <p style="text-align:center;color:#6B7F74;font-size:0.9375rem;margin:0 0 28px;">Введите этот код в форме авторизации</p>
      <div style="background:#F0F2F0;border-radius:14px;padding:20px;text-align:center;margin-bottom:28px;">
        <span style="font-family:'Manrope',monospace;font-size:2.25rem;font-weight:800;letter-spacing:0.3em;color:#0A1F16;">${code}</span>
      </div>
      <p style="text-align:center;color:#94A29A;font-size:0.8125rem;margin:0;">Код действителен 10 минут. Если вы не запрашивали вход — просто проигнорируйте это письмо.</p>
    </div>
    <p style="text-align:center;color:#94A29A;font-size:0.75rem;margin-top:24px;">&copy; ${new Date().getFullYear()} VideoAI</p>
  </div>
</body>
</html>`.trim();

  try {
    await getTransporter().sendMail({
      from: `"VideoAI" <${EMAIL_FROM}>`,
      to,
      subject: `${code} — код входа в VideoAI`,
      html,
    });
    return { ok: true };
  } catch (err) {
    console.error('SMTP error:', err);
    throw new Error('Failed to send email');
  }
}

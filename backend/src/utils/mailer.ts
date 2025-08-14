import nodemailer from "nodemailer";

type SendOpts = { to: string; subject: string; html: string; text?: string };

let transporter: nodemailer.Transporter | null = null;

async function buildTransport() {
  if (transporter) return transporter;

  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_SECURE,
    NODE_ENV,
  } = process.env;

  if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
    const secure = String(SMTP_SECURE ?? "").toLowerCase() === "true";
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure, // true: 465, false: 587
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      logger: true, // <-- logs
      debug: true,  // <-- logs verbosos
    });
  } else {
    // Fallback local de pruebas: Ethereal (NO llega a correo real)
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
      logger: true,
      debug: true,
    });
    if (NODE_ENV !== "production") {
      console.warn("[mailer] Usando Ethereal (solo pruebas).");
    }
  }

  // Verifica conexión
  try {
    await transporter.verify();
    console.log("[mailer] Conexión SMTP OK");
  } catch (e) {
    console.error("[mailer] Falla en verify()", e);
  }

  return transporter;
}

export async function sendResetEmail(to: string, resetLink: string) {
  const t = await buildTransport();

  const mail: SendOpts = {
    to,
    subject: "Recupera tu contraseña",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.4">
        <h2>Recupera tu contraseña</h2>
        <p>Haz clic en el siguiente botón para restablecer tu contraseña (válido por 1 hora):</p>
        <p>
          <a href="${resetLink}" 
             style="display:inline-block;background:#6d28d9;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">
            Restablecer contraseña
          </a>
        </p>
        <p>O copia y pega este enlace en tu navegador:</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
      </div>`,
    text: `Recupera tu contraseña: ${resetLink}`,
  };

  const info = await t.sendMail({
    from: process.env.MAIL_FROM || "No Reply <no-reply@example.com>",
    ...mail,
  });

  console.log("[mailer] messageId:", info.messageId);
  const previewUrl = (nodemailer as any).getTestMessageUrl?.(info);
  if (previewUrl) {
    console.log("[mailer] Preview Ethereal:", previewUrl);
  }
  return { messageId: info.messageId, previewUrl };
}

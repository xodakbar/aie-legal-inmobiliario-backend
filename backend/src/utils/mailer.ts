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
      logger: true,
      debug: true,
    });
  } else {
    // Fallback de pruebas: Ethereal (NO entrega a correos reales)
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

  try {
    await transporter.verify();
    console.log("[mailer] Conexión SMTP OK");
  } catch (e) {
    console.error("[mailer] Falla en verify()", e);
  }

  return transporter;
}

/* -----------------------------------------
   Helpers comunes
------------------------------------------*/
function getFromHeader(): string {
  // siempre la misma casilla para evitar "Relaying disallowed"
  const fallback = process.env.SMTP_USER || "no-reply@example.com";
  const display = process.env.MAIL_FROM?.includes("<")
    ? process.env.MAIL_FROM
    : `A&E Inmobiliario <${fallback}>`;
  return display!;
}

function getEnvelopeFrom(): string {
  // envelope MAIL FROM debe ser la misma cuenta autenticada
  return process.env.SMTP_USER!;
}

const escapeHtml = (s: string) => String(s).replace(/[<>]/g, (c) => ({ "<": "&lt;", ">": "&gt;" }[c]!));

/* -----------------------------------------
   Emails de recuperación de contraseña
------------------------------------------*/
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
    from: getFromHeader(),              // header From visible
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    replyTo: process.env.SMTP_USER,     // opcional
    envelope: { from: getEnvelopeFrom(), to: mail.to }, // MAIL FROM real = contacto
  });

  console.log("[mailer] reset messageId:", info.messageId);
  const previewUrl = (nodemailer as any).getTestMessageUrl?.(info);
  if (previewUrl) console.log("[mailer] Preview Ethereal:", previewUrl);
  return { messageId: info.messageId, previewUrl };
}

/* -----------------------------------------
   Email del formulario de contacto
------------------------------------------*/
export async function sendContactEmail({
  nombre,
  email,
  mensaje,
}: { nombre: string; email: string; mensaje: string }) {
  const t = await buildTransport();

  const to = process.env.CONTACT_TO || process.env.SMTP_USER!;
  const safeNombre = escapeHtml(nombre);
  const safeEmail  = escapeHtml(email);
  const safeMsg    = escapeHtml(mensaje);

  const info = await t.sendMail({
    from: getFromHeader(),                         // header From = contacto oficial
    to,
    subject: `Contacto web: ${safeNombre}`,
    replyTo: email,                                // responderás directo al visitante
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2>Nuevo contacto desde la web</h2>
        <p><b>Nombre:</b> ${safeNombre}</p>
        <p><b>Email:</b> ${safeEmail}</p>
        <p><b>Mensaje:</b></p>
        <div style="white-space:pre-wrap;border:1px solid #eee;padding:12px;border-radius:8px">
          ${safeMsg}
        </div>
      </div>
    `,
    text: `Nombre: ${nombre}\nEmail: ${email}\n\nMensaje:\n${mensaje}`,
    envelope: { from: getEnvelopeFrom(), to },     // MAIL FROM real = contacto
  });

  console.log("[mailer] contact messageId:", info.messageId);
  const previewUrl = (nodemailer as any).getTestMessageUrl?.(info);
  if (previewUrl) console.log("[mailer] Contact Preview Ethereal:", previewUrl);
  return { messageId: info.messageId, previewUrl };
}

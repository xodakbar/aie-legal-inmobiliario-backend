// src/utils/mailer.ts
import nodemailer from "nodemailer";
import sgMail from "@sendgrid/mail";

type SendOpts = { to: string; subject: string; html: string; text?: string };

let transporter: nodemailer.Transporter | null = null;

/* -----------------------------------------
   TRANSPORT SMTP con fallback 465 -> 587
------------------------------------------*/
async function tryCreateTransport({
  host,
  port,
  secure,
}: { host: string; port: number; secure: boolean }) {
  const t = nodemailer.createTransport({
    host,
    port,
    secure,                 // 465:true | 587:false
    requireTLS: !secure,    // fuerza STARTTLS cuando secure=false
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
    logger: true,
    debug: true,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
    tls: { servername: host },
  });
  await t.verify(); // lanza si no conecta/autentica
  return t;
}

async function buildTransport() {
  if (transporter) return transporter;

  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    NODE_ENV,
  } = process.env;

  if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
    const port = Number(SMTP_PORT);
    const secure = port === 465;

    try {
      console.log(`[mailer] Intentando SMTP ${SMTP_HOST}:${port} secure=${secure}`);
      transporter = await tryCreateTransport({ host: SMTP_HOST, port, secure });
      console.log("[mailer] Conexión SMTP OK");
    } catch (errFirst: any) {
      console.error("[mailer] Falla verify() primer intento:", errFirst?.code || errFirst?.message);

      // Fallback automático si el primer intento fue 465
      if (port === 465) {
        try {
          console.log("[mailer] Reintentando con 587 + STARTTLS…");
          transporter = await tryCreateTransport({ host: SMTP_HOST, port: 587, secure: false });
          console.log("[mailer] Conexión SMTP OK con 587/STARTTLS");
        } catch (errSecond: any) {
          console.error("[mailer] Falla también en 587:", errSecond?.code || errSecond?.message);
          throw errSecond;
        }
      } else {
        throw errFirst;
      }
    }
  } else {
    // En producción evitamos Ethereal para no “creer” que envía
    if (NODE_ENV === "production") {
      throw new Error("Faltan variables SMTP en producción (no uso Ethereal).");
    }
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
      logger: true,
      debug: true,
    });
    console.warn("[mailer] Usando Ethereal (solo pruebas).");
    await transporter.verify();
  }

  return transporter!;
}

/* -----------------------------------------
   Helpers comunes
------------------------------------------*/
function getFromHeader(): string {
  // Remitente visible. Usa MAIL_FROM si viene con "Nombre <mail>"
  const fallback = process.env.SMTP_USER || "no-reply@example.com";
  const display = process.env.MAIL_FROM?.includes("<")
    ? process.env.MAIL_FROM
    : `A&E Inmobiliario <${fallback}>`;
  return display!;
}

function getEnvelopeFrom(): string {
  // MAIL FROM real = cuenta autenticada (para evitar relaying)
  return process.env.SMTP_USER || (process.env.MAIL_FROM?.match(/<([^>]+)>/)?.[1] ?? "no-reply@example.com");
}

const escapeHtml = (s: string) =>
  String(s).replace(/[<>]/g, (c) => ({ "<": "&lt;", ">": "&gt;" }[c]!));

/* -----------------------------------------
   Envío unificado (provider switch)
------------------------------------------*/
async function sendViaSMTP(mail: SendOpts) {
  const t = await buildTransport();
  try {
    const info = await t.sendMail({
      from: getFromHeader(), // header From visible
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      replyTo: process.env.SMTP_USER, // responde a Zoho si quieres
      envelope: { from: getEnvelopeFrom(), to: mail.to }, // MAIL FROM real
    });
    console.log("[mailer] SMTP sent messageId:", info.messageId);
    const previewUrl = (nodemailer as any).getTestMessageUrl?.(info);
    if (previewUrl) console.log("[mailer] Preview Ethereal:", previewUrl);
    return { messageId: info.messageId, previewUrl };
  } catch (err) {
    console.error("[mailer] sendMail SMTP error:", err);
    throw err;
  }
}

async function sendViaSendGrid(mail: SendOpts) {
  if (!process.env.SENDGRID_API_KEY) {
    throw new Error("Falta SENDGRID_API_KEY");
  }
  if (!process.env.MAIL_FROM) {
    throw new Error("Falta MAIL_FROM (ej: \"A&E Inmobiliario <contacto@tu-dominio.cl>\")");
  }

  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  try {
    const [resp] = await sgMail.send({
      to: mail.to,
      from: process.env.MAIL_FROM, // debe ser tu dominio autenticado en SendGrid
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      replyTo: process.env.SMTP_USER || process.env.MAIL_FROM, // respuestas a tu buzón (Zoho)
    });
    console.log("[mailer] SendGrid status:", resp.statusCode);
    return { messageId: resp.headers["x-message-id"] || "sendgrid", previewUrl: undefined };
  } catch (err) {
    console.error("[mailer] SendGrid error:", err);
    throw err;
  }
}

async function sendCore(mail: SendOpts) {
  const provider = (process.env.MAIL_PROVIDER || "smtp").toLowerCase();
  if (provider === "sendgrid") return sendViaSendGrid(mail);
  return sendViaSMTP(mail);
}

/* -----------------------------------------
   Emails de recuperación de contraseña
------------------------------------------*/
export async function sendResetEmail(to: string, resetLink: string) {
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
  return sendCore(mail);
}

/* -----------------------------------------
   Email del formulario de contacto
------------------------------------------*/
export async function sendContactEmail({
  nombre,
  email,
  mensaje,
}: { nombre: string; email: string; mensaje: string }) {
  const to = process.env.CONTACT_TO || process.env.SMTP_USER || email;

  const safeNombre = escapeHtml(nombre);
  const safeEmail  = escapeHtml(email);
  const safeMsg    = escapeHtml(mensaje);

  const mail: SendOpts = {
    to,
    subject: `Contacto web: ${safeNombre}`,
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
  };

  // Para “responder” al visitante, el Reply-To debe apuntar a su email
  if ((process.env.MAIL_PROVIDER || "smtp").toLowerCase() === "sendgrid") {
    // SendGrid maneja replyTo en el payload
    return sendViaSendGrid({ ...mail, text: mail.text });
  } else {
    // SMTP usa replyTo en sendMail(); lo setea sendViaSMTP
    return sendViaSMTP(mail);
  }
}

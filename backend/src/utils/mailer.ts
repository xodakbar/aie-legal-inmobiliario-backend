import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // true si usas 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

export async function sendResetEmail(to: string, resetLink: string) {
  const info = await transporter.sendMail({
    from: `"Conecta al Toque" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Recupera tu contraseña',
    html: `
      <p>Hola,</p>
      <p>Has solicitado restablecer tu contraseña. Haz clic en el siguiente enlace (válido por 1 hora):</p>
      <p><a href="${resetLink}">${resetLink}</a></p>
      <p>Si no fuiste tú, simplemente ignora este correo.</p>
    `
  });
  console.log('Reset email sent:', info.messageId);
}

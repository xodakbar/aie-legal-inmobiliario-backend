// src/scripts/test-mail.ts
import { sendResetEmail } from "../utils/mailer"; // ajusta la ruta según tu proyecto

async function main() {
  const to = process.env.TEST_TO || "tu-correo-personal@ejemplo.com";

  // Usa tu dominio correcto (sin el typo del log anterior)
  const FRONTEND_URL = process.env.FRONTEND_URL || "https://ayelegaleinmobiliario.cl";
  const resetLink = `${FRONTEND_URL.replace(/\/$/, "")}/reset-password?token=TEST_TOKEN_${Date.now()}`;

  console.log("[test-mail] Enviando a:", to);
  console.log("[test-mail] resetLink:", resetLink);

  try {
    const resp = await sendResetEmail(to, resetLink);
    console.log("✅ Envío OK:", resp);
  } catch (err) {
    console.error("❌ Error enviando:", err);
    process.exitCode = 1;
  }
}

main();

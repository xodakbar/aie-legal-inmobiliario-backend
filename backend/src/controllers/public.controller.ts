import { Request, Response } from "express";
import { sendContactEmail } from "../utils/mailer";

const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function contact(req: Request, res: Response) {
  const { nombre = "", email = "", mensaje = "" } = req.body || {};
  if (!nombre.trim() || !emailRx.test(email) || !mensaje.trim()) {
    return res.status(400).json({ error: "Datos inválidos" });
  }
  try {
    const r = await sendContactEmail({
      nombre: nombre.trim(),
      email: email.trim(),
      mensaje: mensaje.trim(),
    });
    return res.json({ ok: true, previewUrl: r?.previewUrl });
  } catch (e: any) {
    console.error("[contact] ERROR:", e?.message || e);
    return res.status(500).json({ error: "MAILER_ERROR", detail: e?.message });
  }
}

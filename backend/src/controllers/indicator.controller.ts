import { Request, Response } from 'express';
import { fetchUf, parseNumberLikeCL, clpToUf, ufToClp } from '../services/uf.service';

export const getUfRate = async (_req: Request, res: Response) => {
  try {
    const { uf, dateISO, source } = await fetchUf();
    res.json({ ufRate: uf, dateISO, source });
  } catch (err: any) {
    // Fallback: si hubo error y no hay caché, 502
    console.error('getUfRate error:', err?.message || err);
    res.status(502).json({ error: 'No se pudo obtener la UF' });
  }
};

// GET /api/indicators/convert?from=clp&to=uf&amount=5000000
// GET /api/indicators/convert?from=uf&to=clp&amount=120.5
export const convertAmount = async (req: Request, res: Response) => {
  try {
    const from = String(req.query.from ?? '').toLowerCase();
    const to   = String(req.query.to ?? '').toLowerCase();
    const amount = parseNumberLikeCL(req.query.amount);

    if (!amount || amount <= 0) return res.status(400).json({ error: 'amount inválido' });
    if (!['clp','uf'].includes(from) || !['clp','uf'].includes(to) || from === to) {
      return res.status(400).json({ error: 'par de conversión inválido' });
    }

    const { uf, dateISO, source } = await fetchUf();

    const result = (from === 'clp' && to === 'uf')
      ? clpToUf(amount, uf)
      : ufToClp(amount, uf);

    res.json({
      from, to, amount,
      ufRate: uf,
      dateISO,
      result,
      source
    });
  } catch (err: any) {
    console.error('convertAmount error:', err?.message || err);
    res.status(500).json({ error: 'Error al convertir' });
  }
};

import axios from 'axios';

export type UfFetch = { uf: number; dateISO: string; source: 'cache' | 'env' | 'external'; stale?: boolean };

type UfCache = { value: number; fetchedAt: number; dateISO: string };
let UF_CACHE: UfCache | null = null;

const TTL_MS = (Number(process.env.UF_CACHE_MINUTES ?? 60)) * 60_000;

export function parseNumberLikeCL(v: unknown): number {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').trim();
  const normalized = s.replace(/\./g, '').replace(',', '.'); // 36.123,45 -> 36123.45
  const n = Number(normalized);
  if (!Number.isFinite(n)) throw new Error('Valor numérico inválido');
  return n;
}

export async function fetchUf(): Promise<UfFetch> {
  // 1) Caché vigente
  if (UF_CACHE && Date.now() - UF_CACHE.fetchedAt < TTL_MS) {
    return { uf: UF_CACHE.value, dateISO: UF_CACHE.dateISO, source: 'cache' };
  }

  // 2) ENV fijo (contingencia)
  if (process.env.UF_FIXED_VALUE) {
    const uf = parseNumberLikeCL(process.env.UF_FIXED_VALUE);
    const dateISO = new Date().toISOString().slice(0, 10);
    UF_CACHE = { value: uf, fetchedAt: Date.now(), dateISO };
    return { uf, dateISO, source: 'env' };
  }

  // 3) API externa configurable
  const url = process.env.UF_SOURCE_URL || 'https://mindicador.cl/api/uf';
  const { data } = await axios.get(url, { timeout: 10_000 });

  // mindicador: data.serie[0].valor y .fecha
  const serie = Array.isArray(data?.serie) ? data.serie : [];
  if (!serie.length) throw new Error('Respuesta UF sin datos');

  const uf = parseNumberLikeCL(serie[0].valor);
  const dateISO = new Date(serie[0].fecha ?? Date.now()).toISOString().slice(0, 10);

  UF_CACHE = { value: uf, fetchedAt: Date.now(), dateISO };
  return { uf, dateISO, source: 'external' };
}

// Helpers de conversión
export function clpToUf(clp: number, ufRate: number) {
  return clp / ufRate;
}
export function ufToClp(uf: number, ufRate: number) {
  return uf * ufRate;
}

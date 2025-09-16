// src/utils/youtube.ts
export function normalizeYouTubeUrl(input?: string | null): string | null {
  if (!input) return null;
  const t = input.trim();
  if (!t) return null;

  // patrones comunes
  const re = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&\s]+)/i,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^?\s]+)/i,
    /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^?\s]+)/i,
    /^([a-zA-Z0-9_-]{11})$/ // solo ID
  ];

  for (const r of re) {
    const m = t.match(r);
    if (m && m[1]) return `https://www.youtube.com/watch?v=${m[1]}`;
  }
  return null; // inválida
}

export function extractYouTubeId(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/) || url.match(/embed\/([a-zA-Z0-9_-]{11})/) || url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  return m?.[1] ?? (url.match(/^([a-zA-Z0-9_-]{11})$/)?.[1] ?? null);
}

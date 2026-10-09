/**
 * Pede uma versão maior do MESMO ficheiro quando o URL traz um token de redimensionamento.
 * Não troca a imagem por outra. Se o rendition maior falhar, o componente volta ao URL original.
 */

const RASTER_EXT = "(?:jpe?g|png|webp|gif|avif)";

function bumpWidthParam(url: string, target: number): string {
  return url.replace(
    /([?&])(w|width|imwidth|maxwidth|im_w)=(\d{2,4})\b/gi,
    (full, sep: string, key: string, raw: string) => {
      const n = Number(raw);
      if (!Number.isFinite(n) || n >= target || n < 40) return full;
      return `${sep}${key}=${target}`;
    },
  );
}

/** Shopify: `foto_300x300.jpg` ou `foto_300x.jpg` → `foto_1400x.jpg`. */
function upgradeShopifySize(url: string): string {
  return url.replace(
    new RegExp(`_(\\d{2,4})x(\\d{2,4})?(?=\\.${RASTER_EXT}(?:\\?|#|$))`, "i"),
    (full, wRaw: string) => {
      const w = Number(wRaw);
      if (!Number.isFinite(w) || w >= 1000 || w < 40) return full;
      return "_1400x";
    },
  );
}

/** WordPress: `foto-300x200.jpg` → `foto.jpg` (original), só quando o recorte é pequeno. */
function upgradeWordPressSize(url: string): string {
  return url.replace(
    new RegExp(`-(\\d{2,4})x(\\d{2,4})(?=\\.${RASTER_EXT}(?:\\?|#|$))`, "i"),
    (full, wRaw: string, hRaw: string) => {
      const w = Number(wRaw);
      const h = Number(hRaw);
      if (!Number.isFinite(w) || !Number.isFinite(h)) return full;
      if (w >= 1000 || h >= 1000) return full;
      if (w < 48 && h < 48) return full;
      return "";
    },
  );
}

/** Cloudinary: `w_200` / `h_200` dentro do segmento de transformação. */
function upgradeCloudinary(url: string): string {
  if (!/res\.cloudinary\.com/i.test(url) || !/\/upload\//i.test(url)) return url;
  return url.replace(/\/upload\/([^/]+)\//i, (full, transforms: string) => {
    if (!/\bw_\d+\b/i.test(transforms)) return full;
    let next = transforms.replace(/\bw_(\d+)\b/gi, (token, nRaw: string) => {
      const n = Number(nRaw);
      if (!Number.isFinite(n) || n >= 1000) return token;
      return "w_1400";
    });
    next = next.replace(/\bh_(\d+)\b/gi, (token, nRaw: string) => {
      const n = Number(nRaw);
      if (!Number.isFinite(n) || n >= 1000) return token;
      return "h_1400";
    });
    if (!/\bc_limit\b/i.test(next) && /\bw_1400\b/.test(next)) {
      next = `${next},c_limit`;
    }
    return `/upload/${next}/`;
  });
}

export function upgradePresellImageDisplayUrl(url: string): string {
  const raw = url.trim();
  if (!raw || raw.startsWith("data:") || raw.startsWith("blob:")) return raw;
  let next = upgradeCloudinary(raw);
  next = upgradeShopifySize(next);
  next = upgradeWordPressSize(next);
  next = bumpWidthParam(next, 1400);
  return next;
}

/** Primeiro o rendition maior; depois o URL guardado, se for diferente. */
export function presellImageDisplayCandidates(url: string): string[] {
  const raw = url.trim();
  if (!raw) return [];
  const upgraded = upgradePresellImageDisplayUrl(raw);
  if (upgraded && upgraded !== raw) return [upgraded, raw];
  return [raw];
}

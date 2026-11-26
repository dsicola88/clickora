/**
 * Política de host para presells PÚBLICAS (sem Prisma/JWT — importável em qualquer lado).
 *
 * Arquitectura:
 * - O domínio principal da plataforma (`dclickora.com` / `www.dclickora.com`) é o SaaS e o site
 *   institucional. NÃO serve presells públicas (conteúdo/espelhos de terceiros) a ninguém.
 *   Só o próprio dono autenticado vê um preview privado (ver `presellHostAccess.ts`).
 * - Presells públicas só saem por (a) domínio personalizado verificado do assinante ou
 *   (b) um domínio técnico isolado dedicado a páginas publicadas, configurado em `PUBLIC_PRESELL_HOST`.
 */

const PLATFORM_MAIN_HOSTS = new Set(["dclickora.com", "www.dclickora.com"]);

/** `dclickora.com` / `www.dclickora.com` (sem porta, minúsculas). Não inclui localhost nem *.vercel.app. */
export function isPlatformMainHostname(hostname: string | null | undefined): boolean {
  if (!hostname) return false;
  let h = hostname.trim().toLowerCase().split(":")[0] ?? "";
  while (h.endsWith(".")) h = h.slice(0, -1);
  return PLATFORM_MAIN_HOSTS.has(h);
}

/**
 * Hostname do domínio técnico isolado (`PUBLIC_PRESELL_HOST`), normalizado.
 * Aceita `pages.exemplo.com` ou `https://pages.exemplo.com/`. Ignora valores inválidos e
 * qualquer host da plataforma principal (isso anularia o isolamento).
 */
export function getPublicPresellHost(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = (env.PUBLIC_PRESELL_HOST ?? "").trim();
  if (!raw) return null;
  try {
    const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
    const host = u.hostname.toLowerCase();
    if (!host || !host.includes(".")) return null;
    if (isPlatformMainHostname(host)) return null;
    return host;
  } catch {
    return null;
  }
}

/** `https://<PUBLIC_PRESELL_HOST>` ou `null` quando não configurado. */
export function getPublicPresellOrigin(env: NodeJS.ProcessEnv = process.env): string | null {
  const host = getPublicPresellHost(env);
  return host ? `https://${host}` : null;
}

/** Mensagem para o utilizador quando não há onde publicar. */
export const PUBLIC_DOMAIN_REQUIRED_MESSAGE =
  "Para publicar esta página, conecte um domínio próprio verificado. O domínio principal da plataforma não serve presells públicas.";

import { Prisma } from "@prisma/client";

/**
 * Keyword do clique; macros literais → bucket «(sem keyword)» (igual aos relatórios).
 * Extraído de analytics.controller — contrato SQL estável.
 */
export function sqlClickKeywordBucket(alias: string): Prisma.Sql {
  if (!/^[a-z]+$/.test(alias)) throw new Error("alias de SQL inválido");
  const meta = Prisma.raw(`${alias}.metadata`);
  return Prisma.sql`COALESCE(
    NULLIF(
      CASE
        WHEN TRIM(COALESCE(${meta}->>'utm_term', '')) ~ '^\\{[a-zA-Z0-9_.]+\\}$' THEN NULL
        WHEN TRIM(COALESCE(${meta}->>'utm_term', '')) ~ '^\\{\\{[a-zA-Z0-9_.]+\\}\\}$' THEN NULL
        WHEN TRIM(COALESCE(${meta}->>'utm_term', '')) ~* '^%7B[a-zA-Z0-9_.]+%7D$' THEN NULL
        ELSE TRIM(${meta}->>'utm_term')
      END,
      ''
    ),
    '(sem keyword)'
  )`;
}

/**
 * Data/hora em UTC para importação por cliques (GCLID), formato aceite pelo assistente de ficheiros do Google Ads
 * (ex.: yyyy-MM-dd HH:mm:ss+0000). Ver https://support.google.com/google-ads/answer/7014069
 */
export function formatGoogleAdsOfflineImportCellTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+0000`;
}

/** Valor numérico até 2 casas decimais, como na documentação de «Conversion Value». */
export function roundGoogleAdsOfflineImportValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

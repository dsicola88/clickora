import { Prisma } from "@prisma/client";
import { CDN77_EDGE_PREFIXES } from "./cdn77Edges";
import { fastlyPrefixBounds } from "./fastlyEdges";

function prefixBounds(base: number, bits: number): readonly [number, number] {
  const start = base >>> 0;
  const size = 2 ** (32 - bits);
  return [start, (start + size - 1) >>> 0] as const;
}

const EDGE_BOUNDS: ReadonlyArray<readonly [number, number]> = [
  ...CDN77_EDGE_PREFIXES.map(([base, bits]) => prefixBounds(base, bits)),
  ...fastlyPrefixBounds(),
];

/**
 * País para agrupar no relatório.
 * Nó CDN77 ou Fastly sem país enviado pela CDN: vazio.
 * País calculado pela CDN77 (country_source) mantém-se.
 * Não se usa o país que a base geográfica gravou no nó.
 */
export function sqlVisitorCountry(alias: string): Prisma.Sql {
  if (!/^[a-z]+$/.test(alias)) throw new Error("alias de SQL inválido");
  const ip = Prisma.raw(`${alias}.ip_address`);
  const country = Prisma.raw(`${alias}.country`);
  const meta = Prisma.raw(`${alias}.metadata`);
  const ipNorm = Prisma.sql`regexp_replace(COALESCE(${ip}, ''), '^::ffff:', '', 'i')`;
  const ipInt = Prisma.sql`(
    split_part(${ipNorm}, '.', 1)::bigint * 16777216
    + split_part(${ipNorm}, '.', 2)::bigint * 65536
    + split_part(${ipNorm}, '.', 3)::bigint * 256
    + split_part(${ipNorm}, '.', 4)::bigint
  )`;
  const edge = Prisma.join(
    EDGE_BOUNDS.map(
      ([start, end]) => Prisma.sql`(${ipInt} BETWEEN ${Prisma.raw(String(start))} AND ${Prisma.raw(String(end))})`,
    ),
    " OR ",
  );
  return Prisma.sql`CASE
    WHEN COALESCE(${meta}->>'country_source', '') = 'cdn77' THEN NULLIF(UPPER(TRIM(${country})), '')
    WHEN ${ipNorm} ~ '^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}$' AND (${edge}) THEN NULL
    ELSE NULLIF(UPPER(TRIM(${country})), '')
  END`;
}

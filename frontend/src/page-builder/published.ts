import type { PageDocument } from "./types";

/**
 * Registo local do page-builder standalone (sales page / builde-dpa).
 * A API Clickora não expõe `/api/pages` — a publicação real de landers
 * passa por `/presells` (fluxo PresellBuilderEmbed). Este módulo só
 * persiste no localStorage do browser.
 */

const KEY = "builde-dpa:published:v1";

export interface PublishedPage {
  slug: string;
  title: string;
  doc: PageDocument;
  publishedAt: number;
}

type Registry = Record<string, PublishedPage>;

function loadLocal(): Registry {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Registry;
  } catch {
    return {};
  }
}

function saveLocal(reg: Registry) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(reg));
  } catch {
    /* ignore */
  }
}

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "pagina"
  );
}

export async function publishPage(slug: string, doc: PageDocument): Promise<PublishedPage> {
  const entry: PublishedPage = {
    slug,
    title: doc.name,
    doc,
    publishedAt: Date.now(),
  };
  const reg = loadLocal();
  reg[slug] = entry;
  saveLocal(reg);
  return entry;
}

export async function getPublishedPage(slug: string): Promise<PublishedPage | null> {
  return loadLocal()[slug] ?? null;
}

export async function listPublishedPages(): Promise<PublishedPage[]> {
  return Object.values(loadLocal()).sort((a, b) => b.publishedAt - a.publishedAt);
}

export async function unpublishPage(slug: string): Promise<void> {
  const reg = loadLocal();
  delete reg[slug];
  saveLocal(reg);
}

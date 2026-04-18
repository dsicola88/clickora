import type { PageDocument } from "./types";

/**
 * Páginas publicadas — persistidas no servidor Express via API REST.
 * Em caso de falha de rede, faz fallback para localStorage para não perder trabalho.
 */

const KEY = "builde-dpa:published:v1";
const API_BASE = "/api/pages";

export interface PublishedPage {
  slug: string;
  title: string;
  doc: PageDocument;
  publishedAt: number;
}

type Registry = Record<string, PublishedPage>;

// ---------- Fallback local (offline) ----------
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

// ---------- Slug ----------
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

// ---------- API ----------
export async function publishPage(slug: string, doc: PageDocument): Promise<PublishedPage> {
  const entry: PublishedPage = {
    slug,
    title: doc.name,
    doc,
    publishedAt: Date.now(),
  };
  // mirror local primeiro (instantâneo / offline-first)
  const reg = loadLocal();
  reg[slug] = entry;
  saveLocal(reg);
  // tenta persistir no backend
  try {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(slug)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as PublishedPage;
  } catch (err) {
    console.warn("[publishPage] backend offline, salvo apenas localmente:", err);
    return entry;
  }
}

export async function getPublishedPage(slug: string): Promise<PublishedPage | null> {
  // tenta backend primeiro
  try {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(slug)}`);
    if (res.status === 404) {
      // confere local antes de desistir
      return loadLocal()[slug] ?? null;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as PublishedPage;
  } catch (err) {
    console.warn("[getPublishedPage] backend indisponível, usando localStorage:", err);
    return loadLocal()[slug] ?? null;
  }
}

export async function listPublishedPages(): Promise<PublishedPage[]> {
  try {
    const res = await fetch(API_BASE);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as PublishedPage[];
    return data.sort((a, b) => b.publishedAt - a.publishedAt);
  } catch (err) {
    console.warn("[listPublishedPages] backend indisponível, usando localStorage:", err);
    return Object.values(loadLocal()).sort((a, b) => b.publishedAt - a.publishedAt);
  }
}

export async function unpublishPage(slug: string): Promise<void> {
  const reg = loadLocal();
  delete reg[slug];
  saveLocal(reg);
  try {
    await fetch(`${API_BASE}/${encodeURIComponent(slug)}`, { method: "DELETE" });
  } catch {
    /* ignore */
  }
}

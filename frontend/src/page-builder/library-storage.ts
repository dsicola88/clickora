import { nanoid } from "nanoid";
import type { PageDocument } from "./types";

const INDEX_KEY = "clickora:page-builder:library-index:v2";
const DOC_PREFIX = "clickora:page-builder:lib:";

export interface LibraryEntryMeta {
  id: string;
  name: string;
  updatedAt: number;
}

interface IndexFile {
  version: 2;
  entries: LibraryEntryMeta[];
}

function readIndex(): IndexFile {
  if (typeof window === "undefined") return { version: 2, entries: [] };
  try {
    const raw = window.localStorage.getItem(INDEX_KEY);
    if (!raw) return { version: 2, entries: [] };
    const p = JSON.parse(raw) as Partial<IndexFile>;
    if (p?.version !== 2 || !Array.isArray(p.entries)) return { version: 2, entries: [] };
    return { version: 2, entries: p.entries.filter((e) => e && typeof e.id === "string") };
  } catch {
    return { version: 2, entries: [] };
  }
}

function writeIndex(entries: LibraryEntryMeta[]) {
  if (typeof window === "undefined") return;
  try {
    const sorted = [...entries].sort((a, b) => b.updatedAt - a.updatedAt);
    window.localStorage.setItem(INDEX_KEY, JSON.stringify({ version: 2, entries: sorted }));
  } catch {
    /* quota */
  }
}

export function listLibraryMetas(): LibraryEntryMeta[] {
  return readIndex().entries;
}

export function getLibraryDoc(id: string): PageDocument | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DOC_PREFIX + id);
    if (!raw) return null;
    return JSON.parse(raw) as PageDocument;
  } catch {
    return null;
  }
}

/** Cria uma nova entrada na biblioteca com cópia do documento atual. */
export function createLibraryEntry(name: string, doc: PageDocument): string {
  const id = `lib_${nanoid(10)}`;
  const copy: PageDocument = JSON.parse(JSON.stringify(doc));
  copy.updatedAt = Date.now();
  try {
    window.localStorage.setItem(DOC_PREFIX + id, JSON.stringify(copy));
  } catch {
    throw new Error("Armazenamento cheio ou indisponível. Liberte entradas antigas na biblioteca.");
  }
  const idx = readIndex();
  const meta: LibraryEntryMeta = {
    id,
    name: name.trim() || copy.name || "Página sem título",
    updatedAt: copy.updatedAt,
  };
  writeIndex([meta, ...idx.entries.filter((e) => e.id !== id)]);
  return id;
}

/** Atualiza o ficheiro da biblioteca (sincronização contínua). */
export function syncLibraryDocument(id: string, doc: PageDocument, nameFromDoc?: boolean): void {
  if (typeof window === "undefined") return;
  const copy: PageDocument = JSON.parse(JSON.stringify(doc));
  copy.updatedAt = Date.now();
  try {
    window.localStorage.setItem(DOC_PREFIX + id, JSON.stringify(copy));
  } catch {
    return;
  }
  const idx = readIndex();
  const i = idx.entries.findIndex((e) => e.id === id);
  const prev = i >= 0 ? idx.entries[i] : { id, name: doc.name, updatedAt: copy.updatedAt };
  const nextMeta: LibraryEntryMeta = {
    id,
    name: nameFromDoc ? doc.name.trim() || prev.name : prev.name,
    updatedAt: copy.updatedAt,
  };
  const rest = idx.entries.filter((e) => e.id !== id);
  writeIndex([nextMeta, ...rest]);
}

export function deleteLibraryEntry(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DOC_PREFIX + id);
  } catch {
    /* ignore */
  }
  const idx = readIndex();
  writeIndex(idx.entries.filter((e) => e.id !== id));
}

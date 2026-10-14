/** Venda ainda “ao vivo”: o aviso sonoro não toca uma comissão antiga ao reabrir a página. */
export const SALE_CHIME_FRESH_MS = 3 * 60 * 1000;

const PREF_KEY = "dclickora-sale-chime";
const SOUND_KEY = "dclickora-sale-chime-sound";
const CLAIM_KEY = "dclickora-sale-chime-last";

export const SALE_CHIMES = [
  { id: "kaching", label: "Ka-ching", hint: "Caixa registadora" },
  { id: "chaching", label: "Cha-ching", hint: "Mais agudo e curto" },
  { id: "moedas", label: "Moedas", hint: "Moedas na gaveta" },
  { id: "sino", label: "Sino de venda", hint: "Três notas de venda fechada" },
] as const;

export type SaleChimeId = (typeof SALE_CHIMES)[number]["id"];

export function parseSaleChimeId(value: string | null | undefined): SaleChimeId | null {
  if (value === "kaching" || value === "chaching" || value === "moedas" || value === "sino") return value;
  return null;
}

export function saleChimeSound(): SaleChimeId {
  try {
    return parseSaleChimeId(localStorage.getItem(SOUND_KEY)) ?? "kaching";
  } catch {
    return "kaching";
  }
}

export function setSaleChimeSound(id: string): void {
  const parsed = parseSaleChimeId(id);
  if (!parsed) return;
  try {
    if (localStorage.getItem(SOUND_KEY) !== parsed) localStorage.setItem(SOUND_KEY, parsed);
  } catch {
    /* armazenamento bloqueado */
  }
}

/** Neste aparelho ainda sem escolha, usa o som guardado na conta. */
export function adoptServerSaleChime(id: string | null | undefined): void {
  try {
    if (localStorage.getItem(SOUND_KEY)) return;
  } catch {
    return;
  }
  const parsed = parseSaleChimeId(id);
  if (parsed) setSaleChimeSound(parsed);
}

export function saleChimeId(id: string): string {
  return id.replace(/^sale-/, "").trim();
}

export function saleChimeEnabled(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSaleChimeEnabled(on: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, on ? "on" : "off");
  } catch {
    /* armazenamento bloqueado */
  }
  window.dispatchEvent(new Event("dclickora-sale-chime-pref"));
}

/** Só a primeira janela aberta reclama o som desta venda. */
export function claimSaleChime(id: string): boolean {
  const key = saleChimeId(id);
  if (!key) return false;
  try {
    if (localStorage.getItem(CLAIM_KEY) === key) return false;
    localStorage.setItem(CLAIM_KEY, key);
    return true;
  } catch {
    return true;
  }
}

export function isFreshSale(createdAt: string, nowMs: number): boolean {
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t)) return false;
  const age = nowMs - t;
  return age >= -15_000 && age <= SALE_CHIME_FRESH_MS;
}

/**
 * A primeira leitura só marca a venda já existente.
 * As seguintes tocam se o id mudou e a venda acabou de entrar.
 */
export function nextSaleChimeAction(input: {
  primed: boolean;
  previousId: string | null;
  nextId: string | null;
  createdAt: string | null;
  nowMs: number;
  enabled: boolean;
}): { primed: boolean; previousId: string | null; play: boolean } {
  if (!input.nextId) {
    return { primed: input.primed, previousId: input.previousId, play: false };
  }
  const nextId = saleChimeId(input.nextId);
  if (!input.primed) {
    return { primed: true, previousId: nextId, play: false };
  }
  if (!input.enabled || input.previousId === nextId) {
    return { primed: true, previousId: nextId, play: false };
  }
  const fresh = input.createdAt ? isFreshSale(input.createdAt, input.nowMs) : false;
  return { primed: true, previousId: nextId, play: fresh };
}

let audioCtx: AudioContext | null = null;
let pendingId: SaleChimeId | null = null;

function audioContext(): AudioContext | null {
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  return audioCtx;
}

function bell(
  ctx: AudioContext,
  master: GainNode,
  freq: number,
  start: number,
  dur: number,
  peak: number,
  type: OscillatorType = "triangle",
): void {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now + start);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now + start);
  gain.gain.exponentialRampToValueAtTime(peak, now + start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
  osc.connect(gain);
  gain.connect(master);
  osc.start(now + start);
  osc.stop(now + start + dur + 0.03);
}

function drawerClick(ctx: AudioContext, master: GainNode, start: number): void {
  const now = ctx.currentTime;
  const clickLen = Math.floor(ctx.sampleRate * 0.03);
  const buffer = ctx.createBuffer(1, clickLen, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < clickLen; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / clickLen);
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.0001, now + start);
  noiseGain.gain.exponentialRampToValueAtTime(0.26, now + start + 0.004);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + start + 0.05);
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 1400;
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(master);
  noise.start(now + start);
  noise.stop(now + start + 0.06);
}

function startChime(ctx: AudioContext, id: SaleChimeId): void {
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.9, now);
  master.connect(ctx.destination);

  if (id === "chaching") {
    drawerClick(ctx, master, 0);
    drawerClick(ctx, master, 0.11);
    bell(ctx, master, 988, 0.01, 0.16, 0.48);
    bell(ctx, master, 1568, 0.12, 0.22, 0.4);
    bell(ctx, master, 2093, 0.14, 0.16, 0.18, "sine");
    return;
  }

  if (id === "moedas") {
    const notes = [1568, 2093, 1760, 2349, 1976, 2637];
    notes.forEach((freq, i) => bell(ctx, master, freq, 0.045 * i, 0.11, 0.2, "sine"));
    return;
  }

  if (id === "sino") {
    bell(ctx, master, 523.25, 0, 0.42, 0.34);
    bell(ctx, master, 659.25, 0.16, 0.42, 0.3);
    bell(ctx, master, 783.99, 0.32, 0.48, 0.28);
    bell(ctx, master, 1046.5, 0.48, 0.55, 0.2, "sine");
    return;
  }

  drawerClick(ctx, master, 0);
  bell(ctx, master, 880, 0.02, 0.32, 0.42);
  bell(ctx, master, 1320, 0.1, 0.4, 0.36);
  bell(ctx, master, 1760, 0.18, 0.28, 0.16);
}

export function installSaleChimeUnlock(): () => void {
  const unlock = () => {
    const ctx = audioContext();
    if (!ctx) return;
    void ctx.resume().then(() => {
      if (pendingId && ctx.state === "running") {
        const id = pendingId;
        pendingId = null;
        startChime(ctx, id);
      }
    });
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
  return () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
}

/** Toca o som escolhido. O browser só deixa sair depois de um clique na página. */
export async function playSaleChime(id?: SaleChimeId): Promise<boolean> {
  const sound = id ?? saleChimeSound();
  const ctx = audioContext();
  if (!ctx) return false;
  if (ctx.state !== "running") {
    pendingId = sound;
    try {
      await ctx.resume();
    } catch {
      return false;
    }
  }
  if (ctx.state !== "running") return false;
  pendingId = null;
  startChime(ctx, sound);
  return true;
}

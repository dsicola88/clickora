import { createRoot } from "react-dom/client";
import { startPublicPresellPrefetchFromLocation } from "@/lib/publicPresellEarlyPrefetch";
import { initFrontendSentry } from "@/lib/sentryInit";
import App from "./App.tsx";
import "./index.css";

void initFrontendSentry();
startPublicPresellPrefetchFromLocation();

/** Restaura tema claro/escuro da app (Configurações) antes do 1.º paint. */
try {
  const t = localStorage.getItem("clickora:app-theme");
  if (t === "dark") document.documentElement.classList.add("dark");
  else if (t === "light") document.documentElement.classList.remove("dark");
} catch {
  /* ignore */
}

/** Idioma do painel (en / pt / pt-BR) antes do 1.º paint. */
try {
  const raw = localStorage.getItem("clickora:app-locale");
  const lang =
    raw === "en" || (raw && raw.toLowerCase().startsWith("en"))
      ? "en"
      : raw === "pt-BR" || raw === "pt_BR"
        ? "pt-BR"
        : raw === "pt" || (raw && raw.toLowerCase().startsWith("pt"))
          ? "pt-PT"
          : typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("en")
            ? "en"
            : typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("pt-br")
              ? "pt-BR"
              : "pt-PT";
  document.documentElement.lang = lang;
} catch {
  /* ignore */
}

createRoot(document.getElementById("root")!).render(<App />);

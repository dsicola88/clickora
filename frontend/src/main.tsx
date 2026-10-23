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

createRoot(document.getElementById("root")!).render(<App />);

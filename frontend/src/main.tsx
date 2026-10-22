import { createRoot } from "react-dom/client";
import { startPublicPresellPrefetchFromLocation } from "@/lib/publicPresellEarlyPrefetch";
import App from "./App.tsx";
import "./index.css";

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

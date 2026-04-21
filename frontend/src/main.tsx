import { createRoot } from "react-dom/client";
import { startPublicPresellPrefetchFromLocation } from "@/lib/publicPresellEarlyPrefetch";
import App from "./App.tsx";
import "./index.css";

startPublicPresellPrefetchFromLocation();

createRoot(document.getElementById("root")!).render(<App />);

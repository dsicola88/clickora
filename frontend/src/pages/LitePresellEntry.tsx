import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { getResolvedPublicApiBaseUrl } from "@/config/publicApiUrl";
import { isPresellUuidParam } from "@/lib/publicPresellOrigin";

/**
 * Dev: `/l/:id` → HTML estático no API (com spa_origin para redirects correctos).
 * Em produção Vercel, o rewrite em vercel.json serve o HTML antes da SPA; se a SPA chegar aqui,
 * segue para `/p/:id` na mesma origem.
 */
export default function LitePresellEntry() {
  const { id = "" } = useParams();

  useEffect(() => {
    const param = id.trim();
    const host = window.location.hostname;
    const isLocalDev = host === "localhost" || host === "127.0.0.1";
    /** gclid / wbraid / gad_source / UTMs da chegada seguem no salto. */
    const landing = new URLSearchParams(window.location.search);
    landing.delete("spa_origin");
    landing.delete("visitor_host");
    // Fora de dev nunca saltar por JS para outro domínio (API): fica na mesma origem.
    if (!param || !isPresellUuidParam(param) || !isLocalDev) {
      const qs = landing.toString();
      window.location.replace(`/p/${encodeURIComponent(param || "")}${qs ? `?${qs}` : ""}`);
      return;
    }
    const base = getResolvedPublicApiBaseUrl().replace(/\/+$/, "");
    landing.set("spa_origin", window.location.origin);
    window.location.replace(
      `${base}/public/presells/id/${encodeURIComponent(param)}/html?${landing.toString()}`,
    );
  }, [id]);

  return (
    <p style={{ fontFamily: "system-ui", padding: 24, color: "#444" }}>
      A carregar página leve…
    </p>
  );
}

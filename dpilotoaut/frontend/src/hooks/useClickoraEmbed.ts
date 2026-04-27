import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

const STORAGE_KEY = "clickora_embed_v1";

function isInsideIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Modo embutido no Clickora: sem sidebar próprio do Dpiloto; `clickora_embed=1` na URL ou sessão após primeiro carregamento.
 */
export function useClickoraEmbed(): boolean {
  const search = useRouterState({ select: (s) => s.location.search });
  const [embed, setEmbed] = useState(false);

  useEffect(() => {
    const iframe = isInsideIframe();
    const sp = new URLSearchParams(search);
    if (sp.get("clickora_embed") === "1") {
      sessionStorage.setItem(STORAGE_KEY, "1");
    }
    if (!iframe) {
      sessionStorage.removeItem(STORAGE_KEY);
      setEmbed(false);
      return;
    }
    const fromStorage = sessionStorage.getItem(STORAGE_KEY) === "1";
    const fromUrl = sp.get("clickora_embed") === "1";
    setEmbed(fromStorage || fromUrl);
  }, [search]);

  return embed;
}

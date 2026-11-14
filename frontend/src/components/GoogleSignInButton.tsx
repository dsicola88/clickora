import { useEffect, useRef, useState } from "react";
import { useAuth, type SignInResult } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { authService } from "@/services/authService";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (credential: { credential: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, opts: Record<string, unknown>) => void;
          cancel: () => void;
        };
      };
    };
  }
}

type Props = {
  onSuccess: () => void;
  /** Quando a conta tem MFA — o ecrã de login deve mostrar o formulário TOTP. */
  onMfaRequired?: (mfa: NonNullable<SignInResult["mfa"]>) => void;
  /** Notifica o ecrã de auth se o botão Google está disponível (para o separador «ou e-mail»). */
  onAvailabilityChange?: (enabled: boolean) => void;
};

const GSI_SCRIPT = "https://accounts.google.com/gsi/client";

export function GoogleSignInButton({ onSuccess, onMfaRequired, onAvailabilityChange }: Props) {
  const { t } = useAppLocale();
  const { signInWithGoogle } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState<string | null>(
    () => import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || null,
  );

  useEffect(() => {
    let cancelled = false;
    const viteId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
    if (viteId) {
      setClientId(viteId);
      onAvailabilityChange?.(true);
      return;
    }
    void authService.getGoogleConfig().then((cfg) => {
      if (cancelled) return;
      const id = cfg.client_id?.trim() || null;
      setClientId(id);
      onAvailabilityChange?.(Boolean(id));
    });
    return () => {
      cancelled = true;
    };
  }, [onAvailabilityChange]);

  useEffect(() => {
    if (!clientId || !containerRef.current) return;

    const el = containerRef.current;
    let cancelled = false;

    if (!document.querySelector(`script[src="${GSI_SCRIPT}"]`)) {
      const s = document.createElement("script");
      s.src = GSI_SCRIPT;
      s.async = true;
      s.defer = true;
      document.body.appendChild(s);
    }

    const render = () => {
      if (cancelled || !window.google || !el) return;
      el.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: { credential: string }) => {
          const result = await signInWithGoogle(response.credential);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          if (result.mfa) {
            toast.message(t("auth.mfaContinue"));
            onMfaRequired?.(result.mfa);
            return;
          }
          toast.success(t("auth.ssoSuccess"));
          onSuccess();
        },
      });
      /** GIS exige largura em px — «100%» deixa o botão desalinhado à esquerda. */
      const width = Math.max(240, Math.min(Math.floor(el.getBoundingClientRect().width || 360), 400));
      window.google.accounts.id.renderButton(el, {
        theme: "outline",
        size: "large",
        width,
        text: "continue_with",
        locale: "pt",
        shape: "rectangular",
      });
    };

    const poll = window.setInterval(() => {
      if (cancelled) return;
      if (window.google) {
        window.clearInterval(poll);
        render();
      }
    }, 50);

    const timeout = window.setTimeout(() => window.clearInterval(poll), 15000);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      window.clearTimeout(timeout);
      window.google?.accounts.id.cancel();
      el.innerHTML = "";
    };
  }, [clientId, onMfaRequired, onSuccess, signInWithGoogle, t]);

  if (!clientId) {
    return null;
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-2">
      <div
        ref={containerRef}
        className="flex min-h-[44px] w-full items-center justify-center overflow-hidden [&>div]:mx-auto"
      />
      <p className="max-w-[22rem] text-center text-[11px] leading-snug text-muted-foreground">
        {t("auth.googleHint")}
      </p>
    </div>
  );
}

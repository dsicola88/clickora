import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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
};

const GSI_SCRIPT = "https://accounts.google.com/gsi/client";

export function GoogleSignInButton({ onSuccess }: Props) {
  const { signInWithGoogle } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();

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
          const { error } = await signInWithGoogle(response.credential);
          if (error) {
            toast.error(error);
            return;
          }
          toast.success("Login com Google realizado!");
          onSuccess();
        },
      });
      window.google.accounts.id.renderButton(el, {
        theme: "outline",
        size: "large",
        width: "100%",
        text: "continue_with",
        locale: "pt",
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
  }, [clientId, onSuccess, signInWithGoogle]);

  if (!clientId) {
    return null;
  }

  return (
    <div className="w-full">
      <div ref={containerRef} className="flex min-h-[44px] justify-center [&>div]:!w-full" />
      <p className="mt-2 text-center text-[11px] text-muted-foreground leading-snug">
        Só para quem já tem conta nesta app com o <strong className="text-foreground/80">mesmo e-mail</strong> e{" "}
        <strong className="text-foreground/80">senha</strong> registados. O Google não substitui a assinatura nem cria conta nova.
      </p>
    </div>
  );
}

import { Mail, MessageCircle, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePublicSupportContacts } from "@/hooks/usePublicSupportContacts";
import { supportMailto, supportTel } from "@/lib/siteLegal";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  title?: string;
  compact?: boolean;
};

/**
 * Contactos oficiais — vêm da API (configurados pelo superadmin).
 * Se ainda não houver dados, mostra aviso sem inventar contactos.
 */
export function SupportContactsCard({
  className,
  title = "Suporte",
  compact = false,
}: Props) {
  const { data, isLoading, isError } = usePublicSupportContacts();
  const email = data?.support_email ?? null;
  const phone = data?.support_phone ?? null;
  const phoneDisplay = data?.support_phone_display || phone;
  const wa = data?.support_whatsapp_url;
  const mailto = supportMailto(email);
  const tel = supportTel(phone);
  const configured = Boolean(email || phone);

  return (
    <Card className={cn("border-border/70 bg-card", className)}>
      <CardContent className={cn(compact ? "p-4 space-y-3" : "p-5 space-y-4")}>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Dúvidas de conta, domínio, aviso de venda ou anúncios.
          </p>
        </div>

        {isLoading && !configured ? (
          <p className="text-xs text-muted-foreground">A carregar contactos…</p>
        ) : null}

        {isError && !configured ? (
          <p className="text-xs text-amber-800 dark:text-amber-200">
            Não foi possível carregar os contactos. Tente mais tarde.
          </p>
        ) : null}

        {!isLoading && !configured ? (
          <p className="text-xs text-muted-foreground rounded-md border border-dashed border-border/70 bg-muted/20 px-3 py-2">
            Contactos ainda não configurados. O superadmin define-os em Admin → Marca.
          </p>
        ) : null}

        {configured ? (
          <ul className="space-y-2.5">
            {email && mailto ? (
              <li className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Mail className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Email</p>
                  <a
                    href={mailto}
                    className="text-sm font-medium text-foreground break-all hover:text-primary underline-offset-2 hover:underline"
                  >
                    {email}
                  </a>
                </div>
                <Button variant="outline" size="sm" className="shrink-0" asChild>
                  <a href={mailto}>Enviar email</a>
                </Button>
              </li>
            ) : null}

            {phone && phoneDisplay ? (
              <li className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-700 dark:text-emerald-400">
                  <Phone className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Telefone</p>
                  {tel ? (
                    <a
                      href={tel}
                      className="text-sm font-medium text-foreground hover:text-primary underline-offset-2 hover:underline"
                    >
                      {phoneDisplay}
                    </a>
                  ) : (
                    <span className="text-sm font-medium text-foreground">{phoneDisplay}</span>
                  )}
                </div>
                {wa ? (
                  <Button variant="outline" size="sm" className="shrink-0 gap-1.5" asChild>
                    <a href={wa} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                      WhatsApp
                    </a>
                  </Button>
                ) : null}
              </li>
            ) : null}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}

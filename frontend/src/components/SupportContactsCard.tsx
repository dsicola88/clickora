import { Mail, MessageCircle, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  SITE_SUPPORT_EMAIL,
  SITE_SUPPORT_MAILTO,
  SITE_SUPPORT_PHONE_DISPLAY,
  SITE_SUPPORT_TEL,
  SITE_SUPPORT_WHATSAPP,
} from "@/lib/siteLegal";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** Título curto do bloco. */
  title?: string;
  compact?: boolean;
};

/**
 * Contactos oficiais de suporte — email + telefone/WhatsApp.
 */
export function SupportContactsCard({
  className,
  title = "Suporte",
  compact = false,
}: Props) {
  return (
    <Card className={cn("border-border/70 bg-card", className)}>
      <CardContent className={cn(compact ? "p-4 space-y-3" : "p-5 space-y-4")}>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Dúvidas de conta, domínio, aviso de venda ou anúncios — responda por email ou WhatsApp.
          </p>
        </div>

        <ul className="space-y-2.5">
          <li className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Mail className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Email</p>
              <a
                href={SITE_SUPPORT_MAILTO}
                className="text-sm font-medium text-foreground break-all hover:text-primary underline-offset-2 hover:underline"
              >
                {SITE_SUPPORT_EMAIL}
              </a>
            </div>
            <Button variant="outline" size="sm" className="shrink-0" asChild>
              <a href={SITE_SUPPORT_MAILTO}>Enviar email</a>
            </Button>
          </li>

          <li className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-700 dark:text-emerald-400">
              <Phone className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Telefone</p>
              <a
                href={SITE_SUPPORT_TEL}
                className="text-sm font-medium text-foreground hover:text-primary underline-offset-2 hover:underline"
              >
                {SITE_SUPPORT_PHONE_DISPLAY}
              </a>
            </div>
            <Button variant="outline" size="sm" className="shrink-0 gap-1.5" asChild>
              <a href={SITE_SUPPORT_WHATSAPP} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                WhatsApp
              </a>
            </Button>
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}

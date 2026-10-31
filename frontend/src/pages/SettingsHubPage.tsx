import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Globe } from "lucide-react";
import { PRO_PAGE_SHELL, ProPageHeader, ProPanel } from "@/components/enterprise/ProShell";
import { EnterpriseApiKeysPanel } from "@/components/settings/EnterpriseApiKeysPanel";
import { EnterpriseTenantBrandingPanel } from "@/components/settings/EnterpriseTenantBrandingPanel";
import { TrackPathStatus } from "@/components/TrackPathStatus";
import { BrandKitProCard } from "@/components/BrandKitProCard";
import { LocaleSwitcher } from "@/i18n/LocaleSwitcher";
import { useAppLocale } from "@/i18n/AppLocaleProvider";

/**
 * Configurações: domínio, API keys, white-label, idioma e atalhos avançados.
 */
export default function SettingsHubPage() {
  const [params] = useSearchParams();
  const highlightAdv = params.get("avancado") === "1";
  const { t } = useAppLocale();

  const advancedLinks = [
    { to: "/tracking/rotadores", label: t("nav.rotators") },
    { to: "/tracking/tools", label: t("nav.diagnostics") },
    { to: "/tracking/blacklist", label: t("nav.ipProtections") },
    { to: "/tracking/logs", label: t("nav.logs") },
    { to: "/tracking/url-builder", label: t("nav.urlBuilder") },
    { to: "/agency", label: t("nav.agency") },
    { to: "/aulas", label: t("nav.lessons") },
    { to: "/ajuda", label: t("nav.help") },
  ] as const;

  return (
    <div className={PRO_PAGE_SHELL}>
      <ProPageHeader title={t("pages.settings.title")} subtitle={t("pages.settings.subtitle")} />

      <ProPanel title={t("pages.settings.languageSection")} description={t("language.hint")}>
        <div className="px-4 pb-4 max-w-md">
          <LocaleSwitcher />
        </div>
      </ProPanel>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Link
          to="/tracking/settings-legacy"
          className="group flex h-full items-start gap-4 rounded-lg border border-border/70 bg-card p-5 transition-colors hover:border-primary/40"
        >
          <div className="rounded-md bg-primary/10 p-2.5">
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-sm">{t("pages.settings.domain")}</h2>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {t("pages.settings.domainDesc")}
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
              {t("pages.settings.configureDomain")}{" "}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </Link>

        <div className="min-w-0">
          <EnterpriseApiKeysPanel />
        </div>
      </div>

      <TrackPathStatus className="mb-2" />

      <div className="min-w-0 space-y-4">
        <EnterpriseTenantBrandingPanel />
        <BrandKitProCard />
      </div>

      <ProPanel
        title={t("pages.settings.advanced")}
        description={t("pages.settings.advancedDesc")}
        className={highlightAdv ? "border-primary/50" : undefined}
      >
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 px-4 pb-4">
          {advancedLinks.map((x) => (
            <Button key={x.to} variant="outline" className="justify-start h-9 text-xs" asChild>
              <Link to={x.to}>{x.label}</Link>
            </Button>
          ))}
        </div>
      </ProPanel>
    </div>
  );
}

import type { LandingProductDemo } from "@/lib/plansLandingExtras";

/**
 * Janela do produto no primeiro ecrã. Os textos vêm da landing e o superadmin
 * pode esconder a secção. Não representam um cliente nem uma previsão de vendas.
 */
export function SalesProductDemo({ demo }: { demo: LandingProductDemo }) {
  const nav = demo.nav_items.filter((item) => item.trim());
  const keywords = demo.keywords.filter((item) => item.trim());
  const rows = demo.rows.filter((row) => row.label.trim() || row.value.trim());
  const hasBody = Boolean(
    demo.offer_name?.trim() ||
      nav.length ||
      demo.presell_note?.trim() ||
      keywords.length ||
      demo.ad_title?.trim() ||
      rows.length,
  );
  if (!hasBody && !demo.caption?.trim()) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c1218] text-white shadow-2xl">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" aria-hidden />
        <p className="ml-2 text-xs font-medium tracking-wide text-white/60">Clickora</p>
      </div>
      {hasBody ? (
        <div className="grid sm:grid-cols-[9.5rem_minmax(0,1fr)]">
          {nav.length ? (
            <div className="hidden border-r border-white/10 px-3 py-4 text-xs text-white/55 sm:block">
              {demo.offer_name?.trim() ? (
                <p className="mb-2 font-semibold text-emerald-300">{demo.offer_name}</p>
              ) : null}
              {nav.map((item, index) => (
                <p key={item} className={index === 0 ? "rounded-md bg-white/10 px-2 py-1.5 text-white" : "px-2 py-1.5"}>
                  {item}
                </p>
              ))}
            </div>
          ) : null}
          <div className="space-y-4 p-4">
            {demo.offer_name?.trim() || demo.presell_note?.trim() ? (
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-white/45">{nav[0] || "Presell"}</p>
                  {demo.offer_name?.trim() ? <p className="text-sm font-semibold">{demo.offer_name}</p> : null}
                  {demo.presell_note?.trim() ? (
                    <p className="text-justify text-xs leading-relaxed text-white/55 hyphens-auto [text-align-last:start]">
                      {demo.presell_note}
                    </p>
                  ) : null}
                </div>
                {demo.presell_status?.trim() ? (
                  <span className="rounded-full bg-emerald-400/15 px-2 py-1 text-[11px] font-medium text-emerald-300">
                    {demo.presell_status}
                  </span>
                ) : null}
              </div>
            ) : null}
            {keywords.length ? (
              <div>
                {demo.keywords_label?.trim() ? (
                  <p className="text-[11px] uppercase tracking-wide text-white/45">{demo.keywords_label}</p>
                ) : null}
                <ul className="mt-1 space-y-1 text-sm">
                  {keywords.map((keyword) => (
                    <li key={keyword} className="flex justify-between gap-3 border-b border-white/5 py-1">
                      <span>{keyword}</span>
                      {demo.keyword_meta?.trim() ? <span className="text-white/40">{demo.keyword_meta}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {demo.ad_title?.trim() ? (
              <div>
                {demo.ad_label?.trim() ? (
                  <p className="text-[11px] uppercase tracking-wide text-white/45">{demo.ad_label}</p>
                ) : null}
                <p className="mt-1 flex justify-between text-sm">
                  <span>{demo.ad_title}</span>
                  {demo.ad_meta?.trim() ? <span className="text-white/40">{demo.ad_meta}</span> : null}
                </p>
              </div>
            ) : null}
            {rows.length ? (
              <div className="rounded-lg border border-white/10 px-3 py-2 text-sm">
                {rows.map((row) => (
                  <div key={`${row.label}-${row.value}`} className="mt-1 flex justify-between gap-3 first:mt-0">
                    <span className="text-white/50">{row.label}</span>
                    <span className={row.label.toLowerCase() === "venda" ? "text-amber-200" : undefined}>{row.value}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {demo.caption?.trim() ? (
        <p className="border-t border-white/10 px-4 py-2 text-justify text-[11px] leading-relaxed text-white/45 hyphens-auto [text-align-last:start]">
          {demo.caption}
        </p>
      ) : null}
    </div>
  );
}

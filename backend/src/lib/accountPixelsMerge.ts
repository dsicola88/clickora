/**
 * Pixel da conta (Integrações) preenche a página se a presell não tiver ID próprio —
 * uma config → browser PageView em todas as landers publicadas.
 */
export function mergeAccountPixelsIntoSettings(
  settingsRaw: unknown,
  owner: { metaPixelId?: string | null; tiktokPixelId?: string | null } | null | undefined,
): Record<string, unknown> {
  const settings =
    settingsRaw && typeof settingsRaw === "object" && !Array.isArray(settingsRaw)
      ? { ...(settingsRaw as Record<string, unknown>) }
      : {};
  const pageFb = String(settings.fbPixelId ?? settings.metaPixelId ?? "").replace(/\D/g, "");
  const accountFb = String(owner?.metaPixelId ?? "").replace(/\D/g, "");
  if (!pageFb && /^\d{10,20}$/.test(accountFb)) {
    settings.fbPixelId = accountFb;
  }
  const pageTk = String(settings.tiktokPixelId ?? "").trim();
  const accountTk = String(owner?.tiktokPixelId ?? "").trim();
  if (!pageTk && /^[A-Z0-9]{10,64}$/i.test(accountTk)) {
    settings.tiktokPixelId = accountTk;
  }
  return settings;
}

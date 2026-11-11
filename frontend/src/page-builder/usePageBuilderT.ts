import { readStoredAppLocale, translate, type MessageKey } from "@/i18n";
import { useAppLocaleOptional } from "@/i18n/AppLocaleProvider";

/**
 * App locale when the provider is mounted (editor and in-app publish).
 * Exported HTML renders widgets without the provider, so fall back to the stored locale.
 */
export function usePageBuilderT(): (key: MessageKey) => string {
  const ctx = useAppLocaleOptional();
  return (key) => ctx?.t(key) ?? translate(readStoredAppLocale(), key);
}

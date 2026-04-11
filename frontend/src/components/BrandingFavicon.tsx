import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { brandingService } from "@/services/brandingService";

const QUERY_KEY = ["public-branding"] as const;

export function BrandingFavicon() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => brandingService.getPublicMeta(),
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    throwOnError: false,
  });

  useEffect(() => {
    const onInvalidate = () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    };
    window.addEventListener("clickora:branding", onInvalidate);
    return () => window.removeEventListener("clickora:branding", onInvalidate);
  }, [queryClient]);

  useEffect(() => {
    if (isLoading) return;

    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const apple = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (!icon && !apple) return;

    if (!data?.has_favicon) {
      if (icon) icon.href = "/favicon.svg";
      if (apple) apple.href = "/favicon.svg";
      return;
    }

    const href = brandingService.faviconHref(data.updated_at);
    if (icon) icon.href = href;
    if (apple) apple.href = href;
  }, [data, isLoading]);

  return null;
}

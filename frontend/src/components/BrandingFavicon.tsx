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

    const icons = Array.from(
      document.querySelectorAll<HTMLLinkElement>(
        'link[rel="icon"], link[rel="shortcut icon"]',
      ),
    );
    const apple = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (!icons.length && !apple) return;

    if (!data?.has_favicon) {
      for (const icon of icons) {
        icon.href = icon.type === "image/svg+xml" ? "/favicon.svg" : "/favicon.ico";
      }
      if (apple) apple.href = "/apple-touch-icon.png";
      return;
    }

    const href = brandingService.faviconHref(data.updated_at);
    for (const icon of icons) icon.href = href;
    if (apple) apple.href = href;
  }, [data, isLoading]);

  return null;
}

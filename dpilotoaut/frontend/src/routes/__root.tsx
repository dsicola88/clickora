import { Outlet, createRootRoute, HeadContent, Scripts, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import appCss from "../styles.css?url";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { AuthProvider } from "@/providers/AuthProvider";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { APP_NAME, META_PAGE_DESCRIPTION, META_PAGE_TITLE } from "@/lib/branding";
import { ClickoraSsoBridge } from "@/components/ClickoraSsoBridge";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">HTTP 404</p>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Recurso não encontrado
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          O endereço pode ter sido alterado, o link está incorreto, ou a sua sessão não tem
          permissão para ver este conteúdo.
        </p>
        <div className="mt-8">
          <Button asChild>
            <Link to="/">Voltar à página inicial</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#0a0a0b" },
      { name: "application-name", content: APP_NAME },
      { name: "robots", content: "index, follow" },
      { title: META_PAGE_TITLE },
      { name: "description", content: META_PAGE_DESCRIPTION },
      { property: "og:title", content: META_PAGE_TITLE },
      { property: "og:description", content: META_PAGE_DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: META_PAGE_TITLE },
      { name: "twitter:description", content: META_PAGE_DESCRIPTION },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ClickoraSsoBridge />
        <Outlet />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </ThemeProvider>
  );
}

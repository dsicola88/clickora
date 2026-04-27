import { createFileRoute } from "@tanstack/react-router";

import { PublicLandingBySlug } from "@/components/landing/PublicLandingBySlug";
import { getHomeLandingSlug } from "@/lib/home-landing";

/** Tela inicial = landing de vendas (slug padrão `vendas` ou `VITE_HOME_LANDING_SLUG` no .env). */
export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <PublicLandingBySlug
      slug={getHomeLandingSlug()}
      notFoundLinkTo="/auth/sign-in"
      notFoundLinkLabel="Iniciar sessão"
    />
  );
}

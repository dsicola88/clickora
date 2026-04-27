import { createFileRoute } from "@tanstack/react-router";

import { PublicLandingBySlug } from "@/components/landing/PublicLandingBySlug";
import { APP_NAME } from "@/lib/branding";

export const Route = createFileRoute("/l/$slug")({
  component: PublicLanding,
});

function PublicLanding() {
  const { slug } = Route.useParams();
  return (
    <PublicLandingBySlug
      slug={slug}
      notFoundLinkTo="/"
      notFoundLinkLabel={`Ir a ${APP_NAME}`}
      notFoundTitle="Página não disponível"
      notFoundDescription="Esta landing não está publicada ou o endereço está incorreto."
    />
  );
}

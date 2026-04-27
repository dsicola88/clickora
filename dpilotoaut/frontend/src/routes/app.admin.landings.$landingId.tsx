import { createFileRoute } from "@tanstack/react-router";

import { LandingPageEditScreen } from "@/components/landing/LandingPageEditScreen";

export const Route = createFileRoute("/app/admin/landings/$landingId")({
  component: AdminLandingEdit,
});

function AdminLandingEdit() {
  const { landingId } = Route.useParams();
  return <LandingPageEditScreen landingId={landingId} />;
}

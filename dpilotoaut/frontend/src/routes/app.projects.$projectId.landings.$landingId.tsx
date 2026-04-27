import { createFileRoute } from "@tanstack/react-router";

import { LandingPageEditScreen } from "@/components/landing/LandingPageEditScreen";

export const Route = createFileRoute("/app/projects/$projectId/landings/$landingId")({
  component: ProjectLandingEdit,
});

function ProjectLandingEdit() {
  const { projectId, landingId } = Route.useParams();
  return <LandingPageEditScreen landingId={landingId} backToProjectId={projectId} />;
}

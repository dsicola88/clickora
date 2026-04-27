import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/projects/$projectId/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/app/projects/$projectId/paid",
      params: { projectId: params.projectId },
      replace: true,
    });
  },
});

import { createFileRoute } from "@tanstack/react-router";

import { getMissingCriticalEnvInProduction } from "@backend/env";

export const Route = createFileRoute("/hooks/health")({
  server: {
    handlers: {
      GET: () => {
        const missing = getMissingCriticalEnvInProduction();
        const body = {
          service: "paid-autopilot",
          status: missing.length > 0 ? "degraded" : "ok",
          time: new Date().toISOString(),
          ...(missing.length > 0 ? { productionEnv: { missing } } : {}),
        };
        // 200 em prod para healthchecks (Railway/Vercel); o JSON indica "degraded" se faltar config.
        return Response.json(body, { status: 200 });
      },
    },
  },
});

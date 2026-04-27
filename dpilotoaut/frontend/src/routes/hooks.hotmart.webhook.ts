import { createFileRoute } from "@tanstack/react-router";

import { parseHotmartWebhookBody, upsertCommercePaymentFromHotmart } from "@backend/hotmart-ingest";

/**
 * Webhook Hotmart: configure o URL em Hotmart (postback) com o mesmo `hottok` que em
 * `HOTMART_WEBHOOK_HOTTOK` no ambiente, ex. `https://suaapp.com/hooks/hotmart/webhook?hottok=SECRETO`
 */
export const Route = createFileRoute("/hooks/hotmart/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const token = process.env.HOTMART_WEBHOOK_HOTTOK;
        if (!token || url.searchParams.get("hottok") !== token) {
          return new Response("Forbidden", { status: 403 });
        }

        let body: unknown;
        const contentType = request.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          try {
            body = await request.json();
          } catch {
            return new Response("Bad JSON", { status: 400 });
          }
        } else if (contentType.includes("application/x-www-form-urlencoded")) {
          const t = await request.text();
          const params = new URLSearchParams(t);
          const data = params.get("data");
          if (data) {
            try {
              body = JSON.parse(data);
            } catch {
              body = Object.fromEntries(params.entries());
            }
          } else {
            body = Object.fromEntries(params.entries());
          }
        } else {
          try {
            body = await request.json();
          } catch {
            return new Response("Unsupported body", { status: 415 });
          }
        }

        const fields = parseHotmartWebhookBody(body);
        if (!fields) {
          return new Response("Invalid payload", { status: 400 });
        }
        await upsertCommercePaymentFromHotmart(fields, body as object);
        return Response.json({ ok: true });
      },
    },
  },
});

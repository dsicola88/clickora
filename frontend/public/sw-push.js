/* global self, caches */

const CHIME_CACHE = "dclickora-push-chime-v1";
const CHIME_CACHE_KEY = "https://dclickora.internal/pending-chime";

async function rememberPendingChime(payload) {
  try {
    const cache = await caches.open(CHIME_CACHE);
    await cache.put(
      CHIME_CACHE_KEY,
      new Response(
        JSON.stringify({
          id: payload.id || "",
          sound: payload.sound || "kaching",
          at: Date.now(),
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    );
  } catch {
    /* ignore */
  }
}

async function pingOpenClients(msg) {
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of windows) {
    client.postMessage(msg);
  }
}

/** Entrega o som de venda à app aberta e guarda pendente se o telemóvel acordar depois. */
async function deliverSaleChime(payload) {
  const id = typeof payload.id === "string" ? payload.id : "";
  const sound = typeof payload.sound === "string" && payload.sound ? payload.sound : "kaching";
  await rememberPendingChime({ id, sound });
  const msg = { type: "dclickora-sale-chime", id, sound };
  await pingOpenClients(msg);
  setTimeout(() => pingOpenClients(msg), 350);
  setTimeout(() => pingOpenClients(msg), 1000);
  setTimeout(() => pingOpenClients(msg), 2500);
}

self.addEventListener("push", function (event) {
  event.waitUntil(
    (async () => {
      let data = {
        title: "dclickora",
        body: "Nova notificação",
        url: "/resultados",
      };
      try {
        if (event.data) {
          const text = await event.data.text();
          if (text) Object.assign(data, JSON.parse(text));
        }
      } catch {
        /* ignore */
      }
      const saleTag = data.tag || "dclickora-push";
      const notifyData = {
        url: data.url || "/resultados",
        chime: Boolean(data.chime),
        chimeSound: typeof data.chimeSound === "string" ? data.chimeSound : "kaching",
        saleTag,
      };
      const options = {
        body: data.body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: notifyData,
        tag: saleTag,
        renotify: true,
      };
      try {
        await self.registration.showNotification(
          data.title,
          data.chime ? { ...options, vibrate: [90, 40, 90, 40, 180] } : options,
        );
      } catch {
        await self.registration.showNotification(data.title, options);
      }
      if (data.chime) {
        await deliverSaleChime({ id: saleTag, sound: notifyData.chimeSound });
      }
    })(),
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const nd = event.notification.data || {};
  const url = nd.url;
  const path = typeof url === "string" && url.length > 0 ? url : "/resultados";
  const abs = new URL(path, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      let focused = false;
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          focused = true;
          if ("navigate" in client && typeof client.navigate === "function") {
            await client.navigate(abs);
          }
          await client.focus();
          break;
        }
      }
      if (!focused && self.clients.openWindow) {
        await self.clients.openWindow(abs);
      }
      if (nd.chime) {
        await deliverSaleChime({
          id: nd.saleTag || event.notification.tag || "",
          sound: nd.chimeSound || "kaching",
        });
      }
    })(),
  );
});

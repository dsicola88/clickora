/* global self */

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
      const options = {
        body: data.body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: { url: data.url || "/resultados" },
        tag: data.tag || "dclickora-push",
        renotify: true,
      };
      try {
        await self.registration.showNotification(data.title, data.chime ? { ...options, vibrate: [90, 40, 90, 40, 180] } : options);
      } catch {
        await self.registration.showNotification(data.title, options);
      }
      if (data.chime) {
        const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const client of windows) {
          client.postMessage({ type: "dclickora-sale-chime", id: data.tag || "" });
        }
      }
    })(),
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url;
  const path = typeof url === "string" && url.length > 0 ? url : "/resultados";
  const abs = new URL(path, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          if ("navigate" in client && typeof client.navigate === "function") {
            return client.navigate(abs).then((c) => c.focus());
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(abs);
      }
    }),
  );
});

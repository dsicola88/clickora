/* global self */

self.addEventListener("push", function (event) {
  event.waitUntil(
    (async () => {
      let data = {
        title: "dclickora",
        body: "Nova notificação",
        url: "/tracking/dashboard",
      };
      try {
        if (event.data) {
          const text = await event.data.text();
          if (text) Object.assign(data, JSON.parse(text));
        }
      } catch {
        /* ignore */
      }
      await self.registration.showNotification(data.title, {
        body: data.body,
        icon: "/favicon.svg",
        badge: "/favicon.svg",
        data: { url: data.url || "/tracking/dashboard" },
        tag: "dclickora-push",
        renotify: true,
      });
    })(),
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url;
  const path = typeof url === "string" && url.length > 0 ? url : "/tracking/dashboard";
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

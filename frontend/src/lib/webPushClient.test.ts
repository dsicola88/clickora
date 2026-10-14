import { describe, expect, it } from "vitest";
import { classifyPhonePush } from "./webPushClient";

const ready = {
  secure: true,
  ios: false,
  standalone: false,
  hasServiceWorker: true,
  hasNotification: true,
  hasPushManager: true,
};

describe("aviso no telemóvel", () => {
  it("deixa ativar no Chrome do Android", () => {
    expect(classifyPhonePush(ready)).toBe("ready");
  });

  it("pede o ecrã principal no iPhone, mesmo dentro do Chrome", () => {
    expect(classifyPhonePush({ ...ready, ios: true, hasPushManager: false })).toBe("ios-home");
    expect(classifyPhonePush({ ...ready, ios: true, standalone: false })).toBe("ios-home");
  });

  it("deixa ativar quando o iPhone abre o ícone da dclickora", () => {
    expect(classifyPhonePush({ ...ready, ios: true, standalone: true })).toBe("ready");
  });

  it("recusa um browser de telemóvel sem avisos", () => {
    expect(classifyPhonePush({ ...ready, hasPushManager: false })).toBe("unsupported");
  });
});

import { describe, expect, it, beforeEach } from "vitest";
import {
  GOOGLE_MANAGER_ALL_CAMPAIGNS,
  googleManagerPresetLabel,
  readGoogleManagerPrefs,
  sanitizeCampaignFilter,
  writeGoogleManagerPrefs,
} from "./googleManagerPrefs";

describe("googleManagerPrefs", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("default é hoje + todas", () => {
    expect(readGoogleManagerPrefs("p1")).toEqual({
      preset: "today",
      campaignFilter: GOOGLE_MANAGER_ALL_CAMPAIGNS,
    });
  });

  it("rejeita preset inválido e normaliza all → __all__", () => {
    writeGoogleManagerPrefs("p1", { preset: "nope" as "today", campaignFilter: "all" });
    expect(readGoogleManagerPrefs("p1")).toEqual({
      preset: "today",
      campaignFilter: GOOGLE_MANAGER_ALL_CAMPAIGNS,
    });
  });

  it("persiste last_7 e campanha", () => {
    writeGoogleManagerPrefs("p1", { preset: "last_7", campaignFilter: "camp-1" });
    expect(readGoogleManagerPrefs("p1")).toEqual({
      preset: "last_7",
      campaignFilter: "camp-1",
    });
  });

  it("sanitizeCampaignFilter limpa id órfão", () => {
    expect(sanitizeCampaignFilter("gone", ["a", "b"])).toBe(GOOGLE_MANAGER_ALL_CAMPAIGNS);
    expect(sanitizeCampaignFilter("a", ["a", "b"])).toBe("a");
    expect(sanitizeCampaignFilter(GOOGLE_MANAGER_ALL_CAMPAIGNS, [])).toBe(GOOGLE_MANAGER_ALL_CAMPAIGNS);
  });

  it("labels legíveis", () => {
    expect(googleManagerPresetLabel("today")).toBe("Hoje");
    expect(googleManagerPresetLabel("last_7")).toBe("Últimos 7 dias");
  });
});

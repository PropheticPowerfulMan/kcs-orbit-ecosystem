import { describe, expect, it } from "vitest";
import { buildTimeGreeting, getGivenName } from "./userGreeting";

describe("user greeting", () => {
  it("uses the last part of KCS institutional names as the given name", () => {
    expect(getGivenName("LOKALA LOMBOTO Jonathan")).toBe("Jonathan");
    expect(getGivenName("MADO")).toBe("Mado");
  });

  it("adapts the French greeting to Kinshasa local time", () => {
    expect(buildTimeGreeting("LOKALA LOMBOTO Jonathan", "fr", new Date("2026-08-29T07:00:00Z"))).toBe("Bonjour, Jonathan");
    expect(buildTimeGreeting("LOKALA LOMBOTO Jonathan", "fr", new Date("2026-08-29T12:00:00Z"))).toBe("Bon après-midi, Jonathan");
    expect(buildTimeGreeting("LOKALA LOMBOTO Jonathan", "fr", new Date("2026-08-29T18:00:00Z"))).toBe("Bonsoir, Jonathan");
  });

  it("supports the English interface", () => {
    expect(buildTimeGreeting("LOKALA LOMBOTO Jonathan", "en", new Date("2026-08-29T07:00:00Z"))).toBe("Good morning, Jonathan");
  });
});

import { describe, expect, it } from "vitest";
import { normalizeUsdInput, parseUsdInput } from "./currencyInput";

describe("USD payment input", () => {
  it("keeps whole dollar amounts exact", () => {
    expect(normalizeUsdInput("40")).toBe("40.00");
    expect(parseUsdInput("40")).toBe(40);
  });

  it("rounds floating point noise to cents", () => {
    expect(normalizeUsdInput("39.999999999")).toBe("40.00");
  });

  it("accepts a decimal comma without storing binary noise", () => {
    expect(normalizeUsdInput("40,25")).toBe("40.25");
  });
});
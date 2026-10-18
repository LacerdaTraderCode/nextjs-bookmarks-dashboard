import { describe, expect, it } from "vitest";

import { secondsUntilExpiry } from "@/lib/token-expiry";

function tokenWithPayload(payload: unknown): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256" })}.${encode(payload)}.signature`;
}

const NOW_MS = Date.UTC(2026, 9, 17, 12, 0, 0);
const NOW_SECONDS = NOW_MS / 1000;

describe("secondsUntilExpiry", () => {
  it("returns the remaining lifetime from the exp claim", () => {
    const token = tokenWithPayload({ sub: "42", exp: NOW_SECONDS + 1800 });
    expect(secondsUntilExpiry(token, NOW_MS)).toBe(1800);
  });

  it("returns zero for a token that already expired", () => {
    const token = tokenWithPayload({ exp: NOW_SECONDS - 60 });
    expect(secondsUntilExpiry(token, NOW_MS)).toBe(0);
  });

  it("falls back to one hour when exp is missing", () => {
    expect(secondsUntilExpiry(tokenWithPayload({ sub: "42" }), NOW_MS)).toBe(3600);
  });

  it("falls back to one hour when exp is not a number", () => {
    expect(secondsUntilExpiry(tokenWithPayload({ exp: "soon" }), NOW_MS)).toBe(3600);
  });

  it("falls back to one hour for a token without a payload segment", () => {
    expect(secondsUntilExpiry("opaque-token", NOW_MS)).toBe(3600);
  });

  it("falls back to one hour when the payload is not valid JSON", () => {
    expect(secondsUntilExpiry("a.%%%.c", NOW_MS)).toBe(3600);
  });
});

const FALLBACK_LIFETIME_SECONDS = 60 * 60;

// The API is the only party that verifies the token signature. This only reads the `exp` claim so the
// session cookie does not outlive the token it carries.
export function secondsUntilExpiry(token: string, nowMs: number = Date.now()): number {
  const payloadSegment = token.split(".")[1];
  if (!payloadSegment) return FALLBACK_LIFETIME_SECONDS;
  try {
    const payload = JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8")) as {
      exp?: unknown;
    };
    if (typeof payload.exp !== "number") return FALLBACK_LIFETIME_SECONDS;
    return Math.max(0, Math.floor(payload.exp - nowMs / 1000));
  } catch {
    return FALLBACK_LIFETIME_SECONDS;
  }
}

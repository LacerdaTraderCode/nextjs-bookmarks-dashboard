import { describe, expect, it } from "vitest";

import { formatSavedDate, hostnameOf } from "@/lib/format";
import { safeExternalHref } from "@/lib/safe-link";

describe("formatSavedDate", () => {
  it("formats an ISO timestamp as a short UTC date", () => {
    expect(formatSavedDate("2026-10-03T12:00:00+00:00")).toBe("3 Oct 2026");
  });

  it("does not shift the day for late-evening UTC timestamps", () => {
    expect(formatSavedDate("2026-10-03T23:59:00Z")).toBe("3 Oct 2026");
  });

  it("returns a placeholder for an unparseable timestamp", () => {
    expect(formatSavedDate("yesterday")).toBe("unknown date");
  });
});

describe("hostnameOf", () => {
  it("drops the www prefix", () => {
    expect(hostnameOf("https://www.typescriptlang.org/docs/")).toBe("typescriptlang.org");
  });

  it("returns the input when it is not a URL", () => {
    expect(hostnameOf("not a url")).toBe("not a url");
  });
});

describe("safeExternalHref", () => {
  it("passes http and https links", () => {
    expect(safeExternalHref("https://vitest.dev/guide/")).toBe("https://vitest.dev/guide/");
    expect(safeExternalHref("http://example.com")).toBe("http://example.com/");
  });

  it("blocks javascript: and data: links", () => {
    expect(safeExternalHref("javascript:alert(1)")).toBeNull();
    expect(safeExternalHref("data:text/html,<script>1</script>")).toBeNull();
  });

  it("blocks values that are not URLs", () => {
    expect(safeExternalHref("/relative/path")).toBeNull();
  });
});

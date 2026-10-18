import { describe, expect, it } from "vitest";

import {
  normalizeTags,
  parseBookmarkId,
  parseCredentials,
  parseNewBookmark,
  parseRegistration,
} from "@/lib/validation";

function formWith(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) formData.set(name, value);
  return formData;
}

describe("normalizeTags", () => {
  it("lowercases, trims and drops empty entries", () => {
    expect(normalizeTags(" TypeScript , ,React,")).toEqual(["typescript", "react"]);
  });

  it("removes duplicates while keeping first-seen order", () => {
    expect(normalizeTags("api, Python, API, python")).toEqual(["api", "python"]);
  });

  it("returns an empty list for blank input", () => {
    expect(normalizeTags("   ")).toEqual([]);
  });
});

describe("parseNewBookmark", () => {
  const validFields = { url: "https://nextjs.org/docs", title: "  Next.js docs ", tags: "React, SSR", notes: "" };

  it("accepts a complete bookmark and normalizes it", () => {
    const result = parseNewBookmark(formWith(validFields));
    expect(result).toEqual({
      ok: true,
      value: { url: "https://nextjs.org/docs", title: "Next.js docs", tags: ["react", "ssr"], notes: null },
    });
  });

  it("keeps non-empty notes", () => {
    const result = parseNewBookmark(formWith({ ...validFields, notes: "  read the caching chapter " }));
    expect(result.ok && result.value.notes).toBe("read the caching chapter");
  });

  it("rejects a value that is not a URL", () => {
    const result = parseNewBookmark(formWith({ ...validFields, url: "not a url" }));
    expect(result).toEqual({ ok: false, message: "Enter a full URL, including https://." });
  });

  it("rejects non-http protocols such as javascript:", () => {
    const result = parseNewBookmark(formWith({ ...validFields, url: "javascript:alert(1)" }));
    expect(result).toEqual({ ok: false, message: "Only http and https links can be saved." });
  });

  it("requires a title", () => {
    const result = parseNewBookmark(formWith({ ...validFields, title: "   " }));
    expect(result).toEqual({ ok: false, message: "Give the bookmark a title." });
  });

  it("limits the number of tags", () => {
    const manyTags = Array.from({ length: 11 }, (_, index) => `tag${index}`).join(",");
    const result = parseNewBookmark(formWith({ ...validFields, tags: manyTags }));
    expect(result.ok).toBe(false);
  });

  it("limits the length of a single tag", () => {
    const result = parseNewBookmark(formWith({ ...validFields, tags: "x".repeat(33) }));
    expect(result.ok).toBe(false);
  });
});

describe("parseCredentials", () => {
  it("lowercases and trims the email", () => {
    const result = parseCredentials(formWith({ email: "  Demo@Example.com ", password: "correct-horse" }));
    expect(result).toEqual({ ok: true, value: { email: "demo@example.com", password: "correct-horse" } });
  });

  it("rejects a malformed email", () => {
    expect(parseCredentials(formWith({ email: "demo", password: "x" })).ok).toBe(false);
  });

  it("rejects an empty password", () => {
    expect(parseCredentials(formWith({ email: "demo@example.com", password: "" })).ok).toBe(false);
  });

  it("does not trim the password", () => {
    const result = parseCredentials(formWith({ email: "demo@example.com", password: " spaced " }));
    expect(result.ok && result.value.password).toBe(" spaced ");
  });
});

describe("parseRegistration", () => {
  const validFields = { fullName: "Ada Lovelace", email: "ada@example.com", password: "analytical-engine" };

  it("accepts a complete registration", () => {
    expect(parseRegistration(formWith(validFields))).toEqual({
      ok: true,
      value: { fullName: "Ada Lovelace", email: "ada@example.com", password: "analytical-engine" },
    });
  });

  it("requires a name", () => {
    expect(parseRegistration(formWith({ ...validFields, fullName: " " })).ok).toBe(false);
  });

  it("requires a password of at least eight characters", () => {
    const result = parseRegistration(formWith({ ...validFields, password: "short" }));
    expect(result).toEqual({ ok: false, message: "Use a password with at least 8 characters." });
  });
});

describe("parseBookmarkId", () => {
  it("returns the trimmed identifier", () => {
    expect(parseBookmarkId(formWith({ bookmarkId: " abc123 " }))).toBe("abc123");
  });

  it("returns null when the field is missing or blank", () => {
    expect(parseBookmarkId(new FormData())).toBeNull();
    expect(parseBookmarkId(formWith({ bookmarkId: "  " }))).toBeNull();
  });
});

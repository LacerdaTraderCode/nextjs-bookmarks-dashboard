import { describe, expect, it } from "vitest";

import { hasActiveFilters, parseFilters } from "@/lib/bookmark-filters";

describe("parseFilters", () => {
  it("defaults to no tag and all read states", () => {
    expect(parseFilters({})).toEqual({ tag: null, readState: "all" });
  });

  it("normalizes the tag", () => {
    expect(parseFilters({ tag: "  TypeScript " }).tag).toBe("typescript");
  });

  it("treats a blank tag as no tag", () => {
    expect(parseFilters({ tag: "   " }).tag).toBeNull();
  });

  it("accepts the known read states", () => {
    expect(parseFilters({ status: "unread" }).readState).toBe("unread");
    expect(parseFilters({ status: "read" }).readState).toBe("read");
  });

  it("falls back to all for an unknown read state", () => {
    expect(parseFilters({ status: "archived" }).readState).toBe("all");
  });

  it("uses the first value when a parameter is repeated", () => {
    expect(parseFilters({ tag: ["api", "python"], status: ["read", "unread"] })).toEqual({
      tag: "api",
      readState: "read",
    });
  });
});

describe("hasActiveFilters", () => {
  it("is false for the default filters", () => {
    expect(hasActiveFilters({ tag: null, readState: "all" })).toBe(false);
  });

  it("is true when a tag or a read state is selected", () => {
    expect(hasActiveFilters({ tag: "api", readState: "all" })).toBe(true);
    expect(hasActiveFilters({ tag: null, readState: "unread" })).toBe(true);
  });
});

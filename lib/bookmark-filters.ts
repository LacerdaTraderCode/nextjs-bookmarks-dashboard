import type { BookmarkFilters, ReadState } from "@/lib/types";

type RawSearchParams = Record<string, string | string[] | undefined>;

const READ_STATES: readonly ReadState[] = ["all", "unread", "read"];

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseFilters(searchParams: RawSearchParams): BookmarkFilters {
  const rawTag = firstValue(searchParams.tag)?.trim().toLowerCase();
  const rawState = firstValue(searchParams.status);
  const readState = READ_STATES.find((candidate) => candidate === rawState) ?? "all";
  return { tag: rawTag ? rawTag : null, readState };
}

export function hasActiveFilters(filters: BookmarkFilters): boolean {
  return filters.tag !== null || filters.readState !== "all";
}

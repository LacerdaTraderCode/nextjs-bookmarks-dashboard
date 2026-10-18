import Link from "next/link";

import { hasActiveFilters } from "@/lib/bookmark-filters";
import type { BookmarkFilters } from "@/lib/types";

export function FilterForm({ filters }: { filters: BookmarkFilters }) {
  return (
    <form method="get" action="/dashboard" role="search" className="filter-form">
      <label className="field">
        <span>Tag</span>
        <input name="tag" type="search" placeholder="e.g. typescript" defaultValue={filters.tag ?? ""} />
      </label>
      <label className="field">
        <span>Status</span>
        <select name="status" defaultValue={filters.readState}>
          <option value="all">All</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
        </select>
      </label>
      <button type="submit" className="button">
        Apply
      </button>
      {hasActiveFilters(filters) && (
        <Link href="/dashboard" className="link-quiet">
          Clear filters
        </Link>
      )}
    </form>
  );
}

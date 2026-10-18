import { BookmarkList } from "@/components/bookmark-list";
import { FilterForm } from "@/components/filter-form";
import { fetchBookmarks } from "@/lib/api-client";
import { hasActiveFilters, parseFilters } from "@/lib/bookmark-filters";
import { redirectWhenSessionRejected, requireSessionToken } from "@/lib/session";

type BookmarkSectionProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Reads the cookie and the query string, so it is runtime data and has to sit inside <Suspense>.
export async function BookmarkSection({ searchParams }: BookmarkSectionProps) {
  const filters = parseFilters(await searchParams);
  const token = await requireSessionToken();

  let bookmarks;
  try {
    bookmarks = await fetchBookmarks(token, filters);
  } catch (error) {
    redirectWhenSessionRejected(error);
    throw error;
  }

  return (
    <section aria-labelledby="list-heading" className="stack">
      <h2 id="list-heading">
        Your bookmarks <span className="count">{bookmarks.length}</span>
      </h2>
      <FilterForm filters={filters} />
      <BookmarkList bookmarks={bookmarks} isFiltered={hasActiveFilters(filters)} />
    </section>
  );
}

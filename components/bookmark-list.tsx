import { BookmarkCard } from "@/components/bookmark-card";
import type { Bookmark } from "@/lib/types";

type BookmarkListProps = {
  bookmarks: Bookmark[];
  isFiltered: boolean;
};

export function BookmarkList({ bookmarks, isFiltered }: BookmarkListProps) {
  if (bookmarks.length === 0) {
    return (
      <p className="empty-state">
        {isFiltered ? "No bookmarks match these filters." : "Nothing saved yet. Add your first link above."}
      </p>
    );
  }

  return (
    <ul className="bookmark-list" aria-label="Bookmarks">
      {bookmarks.map((bookmark) => (
        <BookmarkCard key={bookmark.id} bookmark={bookmark} />
      ))}
    </ul>
  );
}

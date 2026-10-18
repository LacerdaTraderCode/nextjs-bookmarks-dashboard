import Link from "next/link";

import { deleteBookmarkAction, toggleReadAction } from "@/actions/bookmark-actions";
import { formatSavedDate, hostnameOf } from "@/lib/format";
import { safeExternalHref } from "@/lib/safe-link";
import type { Bookmark } from "@/lib/types";

export function BookmarkCard({ bookmark }: { bookmark: Bookmark }) {
  const href = safeExternalHref(bookmark.url);

  return (
    <li className={bookmark.isRead ? "bookmark bookmark-read" : "bookmark"}>
      <div className="bookmark-body">
        {href ? (
          <a className="bookmark-title" href={href} target="_blank" rel="noopener noreferrer">
            {bookmark.title}
          </a>
        ) : (
          <span className="bookmark-title">{bookmark.title}</span>
        )}
        <span className="bookmark-host">{hostnameOf(bookmark.url)}</span>
        {bookmark.notes && <p className="bookmark-notes">{bookmark.notes}</p>}
        {bookmark.tags.length > 0 && (
          <ul className="tag-list" aria-label="Tags">
            {bookmark.tags.map((tag) => (
              <li key={tag}>
                <Link className="tag" href={`/dashboard?tag=${encodeURIComponent(tag)}`}>
                  {tag}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="bookmark-meta">
          Saved {formatSavedDate(bookmark.savedAt)} · {bookmark.isRead ? "Read" : "Unread"}
        </p>
      </div>
      <div className="bookmark-actions">
        <form action={toggleReadAction}>
          <input type="hidden" name="bookmarkId" value={bookmark.id} />
          <input type="hidden" name="markAsRead" value={String(!bookmark.isRead)} />
          <button type="submit" className="button">
            {bookmark.isRead ? "Mark unread" : "Mark read"}
          </button>
        </form>
        <form action={deleteBookmarkAction}>
          <input type="hidden" name="bookmarkId" value={bookmark.id} />
          <button type="submit" className="button button-danger">
            Delete
          </button>
        </form>
      </div>
    </li>
  );
}

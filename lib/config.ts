import "server-only";

const DEFAULT_API_URL = "http://127.0.0.1:8000/api";

export function bookmarksApiBaseUrl(): string {
  const configured = process.env.BOOKMARKS_API_URL?.trim();
  return (configured || DEFAULT_API_URL).replace(/\/+$/, "");
}

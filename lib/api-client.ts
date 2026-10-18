import "server-only";

import { bookmarksApiBaseUrl } from "@/lib/config";
import type {
  Bookmark,
  BookmarkFilters,
  Credentials,
  NewBookmark,
  RegistrationInput,
} from "@/lib/types";

type WireBookmark = {
  id: string;
  url: string;
  title: string;
  tags: string[];
  notes: string | null;
  is_read: boolean;
  saved_at: string;
};

type WireTokenResponse = {
  access_token: string;
};

export class ApiRequestError extends Error {
  readonly status: number;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

function fromWireBookmark(wire: WireBookmark): Bookmark {
  return {
    id: wire.id,
    url: wire.url,
    title: wire.title,
    tags: wire.tags,
    notes: wire.notes,
    isRead: wire.is_read,
    savedAt: wire.saved_at,
  };
}

// Django Ninja answers `{"detail": "..."}` for handled errors and `{"detail": [...]}` for 422 validation errors.
function describeFailure(payload: unknown, status: number): string {
  if (payload && typeof payload === "object" && "detail" in payload) {
    const { detail } = payload as { detail: unknown };
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length > 0) return "The API rejected the submitted data.";
  }
  return `The API answered with status ${status}.`;
}

async function callApi(path: string, init: RequestInit & { token?: string } = {}): Promise<Response> {
  const { token, headers, ...rest } = init;
  const requestHeaders = new Headers(headers);
  requestHeaders.set("Accept", "application/json");
  if (token) requestHeaders.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${bookmarksApiBaseUrl()}${path}`, {
      ...rest,
      headers: requestHeaders,
      cache: "no-store",
    });
  } catch {
    throw new ApiRequestError(503, "The bookmarks API is unreachable.");
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiRequestError(response.status, describeFailure(payload, response.status));
  }
  return response;
}

function jsonBody(payload: unknown): Pick<RequestInit, "body" | "headers"> {
  return { body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } };
}

export async function registerAccount(input: RegistrationInput): Promise<void> {
  await callApi("/auth/register", {
    method: "POST",
    ...jsonBody({ email: input.email, password: input.password, full_name: input.fullName }),
  });
}

export async function loginAccount(credentials: Credentials): Promise<string> {
  const response = await callApi("/auth/login", { method: "POST", ...jsonBody(credentials) });
  const { access_token } = (await response.json()) as WireTokenResponse;
  return access_token;
}

export function buildBookmarkQuery(filters: BookmarkFilters): string {
  const query = new URLSearchParams();
  if (filters.tag) query.set("tag", filters.tag);
  if (filters.readState === "read") query.set("is_read", "true");
  if (filters.readState === "unread") query.set("is_read", "false");
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

export async function fetchBookmarks(token: string, filters: BookmarkFilters): Promise<Bookmark[]> {
  const response = await callApi(`/bookmarks${buildBookmarkQuery(filters)}`, { token });
  const wireBookmarks = (await response.json()) as WireBookmark[];
  return wireBookmarks.map(fromWireBookmark);
}

export async function createBookmark(token: string, bookmark: NewBookmark): Promise<Bookmark> {
  const response = await callApi("/bookmarks", { method: "POST", token, ...jsonBody(bookmark) });
  return fromWireBookmark((await response.json()) as WireBookmark);
}

export async function setBookmarkReadState(
  token: string,
  bookmarkId: string,
  isRead: boolean,
): Promise<Bookmark> {
  const response = await callApi(`/bookmarks/${encodeURIComponent(bookmarkId)}`, {
    method: "PATCH",
    token,
    ...jsonBody({ is_read: isRead }),
  });
  return fromWireBookmark((await response.json()) as WireBookmark);
}

export async function deleteBookmark(token: string, bookmarkId: string): Promise<void> {
  await callApi(`/bookmarks/${encodeURIComponent(bookmarkId)}`, { method: "DELETE", token });
}

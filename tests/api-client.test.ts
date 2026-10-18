import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiRequestError,
  buildBookmarkQuery,
  createBookmark,
  deleteBookmark,
  fetchBookmarks,
  loginAccount,
  registerAccount,
  setBookmarkReadState,
} from "@/lib/api-client";

const API_URL = "http://api.test/api";

const wireBookmark = {
  id: "b1",
  url: "https://nextjs.org/docs",
  title: "Next.js docs",
  tags: ["react"],
  notes: null,
  is_read: true,
  saved_at: "2026-10-03T12:00:00+00:00",
};

function jsonResponse(status: number, payload?: unknown): Response {
  return new Response(payload === undefined ? null : JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  process.env.BOOKMARKS_API_URL = `${API_URL}/`;
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  delete process.env.BOOKMARKS_API_URL;
});

function lastCall() {
  const [input, init] = fetchMock.mock.calls.at(-1)!;
  return { url: String(input), init: init as RequestInit, headers: new Headers(init?.headers) };
}

describe("buildBookmarkQuery", () => {
  it("is empty without filters", () => {
    expect(buildBookmarkQuery({ tag: null, readState: "all" })).toBe("");
  });

  it("maps the read state to the API's is_read flag", () => {
    expect(buildBookmarkQuery({ tag: null, readState: "read" })).toBe("?is_read=true");
    expect(buildBookmarkQuery({ tag: null, readState: "unread" })).toBe("?is_read=false");
  });

  it("combines and encodes filters", () => {
    expect(buildBookmarkQuery({ tag: "c++", readState: "unread" })).toBe("?tag=c%2B%2B&is_read=false");
  });
});

describe("fetchBookmarks", () => {
  it("maps snake_case wire fields to camelCase in one place", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, [wireBookmark]));

    const bookmarks = await fetchBookmarks("token-1", { tag: null, readState: "all" });

    expect(bookmarks).toEqual([
      {
        id: "b1",
        url: "https://nextjs.org/docs",
        title: "Next.js docs",
        tags: ["react"],
        notes: null,
        isRead: true,
        savedAt: "2026-10-03T12:00:00+00:00",
      },
    ]);
  });

  it("sends the bearer token and the filter query to the configured base URL", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));

    await fetchBookmarks("token-1", { tag: "react", readState: "read" });

    const { url, headers } = lastCall();
    expect(url).toBe(`${API_URL}/bookmarks?tag=react&is_read=true`);
    expect(headers.get("Authorization")).toBe("Bearer token-1");
  });

  it("never lets the platform cache an authenticated list", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await fetchBookmarks("token-1", { tag: null, readState: "all" });
    expect(lastCall().init.cache).toBe("no-store");
  });
});

describe("error mapping", () => {
  it("exposes the status and the detail string of a handled error", async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { detail: "Unauthorized" }));

    const failure = await fetchBookmarks("stale", { tag: null, readState: "all" }).catch((error) => error);

    expect(failure).toBeInstanceOf(ApiRequestError);
    expect(failure).toMatchObject({ status: 401, message: "Unauthorized" });
  });

  it("summarizes a 422 validation array instead of leaking its structure", async () => {
    fetchMock.mockResolvedValue(jsonResponse(422, { detail: [{ loc: ["body", "url"], msg: "Field required" }] }));

    const failure = await createBookmark("token-1", {
      url: "",
      title: "",
      tags: [],
      notes: null,
    }).catch((error) => error);

    expect(failure).toMatchObject({ status: 422, message: "The API rejected the submitted data." });
  });

  it("falls back to a status message when the body is not JSON", async () => {
    fetchMock.mockResolvedValue(new Response("<html>Bad gateway</html>", { status: 502 }));

    const failure = await fetchBookmarks("token-1", { tag: null, readState: "all" }).catch((error) => error);

    expect(failure).toMatchObject({ status: 502, message: "The API answered with status 502." });
  });

  it("reports a network failure as a 503", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    const failure = await loginAccount({ email: "a@b.co", password: "x" }).catch((error) => error);

    expect(failure).toMatchObject({ status: 503, message: "The bookmarks API is unreachable." });
  });
});

describe("authentication calls", () => {
  it("returns the access token from a login", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { access_token: "jwt-value", token_type: "bearer" }));

    await expect(loginAccount({ email: "demo@example.com", password: "correct-horse" })).resolves.toBe("jwt-value");
    expect(lastCall().url).toBe(`${API_URL}/auth/login`);
  });

  it("sends the registration with the API's snake_case field names", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: "u1", email: "ada@example.com", full_name: "Ada" }));

    await registerAccount({ email: "ada@example.com", password: "analytical-engine", fullName: "Ada" });

    expect(JSON.parse(String(lastCall().init.body))).toEqual({
      email: "ada@example.com",
      password: "analytical-engine",
      full_name: "Ada",
    });
  });

  it("surfaces a duplicate account as a 409", async () => {
    fetchMock.mockResolvedValue(jsonResponse(409, { detail: "An account with this email already exists." }));

    const failure = await registerAccount({ email: "a@b.co", password: "12345678", fullName: "A" }).catch(
      (error) => error,
    );

    expect(failure).toMatchObject({ status: 409 });
  });
});

describe("bookmark mutations", () => {
  it("creates a bookmark with a JSON body", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, wireBookmark));

    const created = await createBookmark("token-1", {
      url: wireBookmark.url,
      title: wireBookmark.title,
      tags: ["react"],
      notes: null,
    });

    const { init, headers } = lastCall();
    expect(init.method).toBe("POST");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(created.isRead).toBe(true);
  });

  it("patches only the read flag", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ...wireBookmark, is_read: false }));

    const updated = await setBookmarkReadState("token-1", "b1", false);

    const { url, init } = lastCall();
    expect(url).toBe(`${API_URL}/bookmarks/b1`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({ is_read: false });
    expect(updated.isRead).toBe(false);
  });

  it("encodes the identifier in the path", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await deleteBookmark("token-1", "a/b");

    expect(lastCall().url).toBe(`${API_URL}/bookmarks/a%2Fb`);
  });

  it("treats 204 on delete as success", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(deleteBookmark("token-1", "b1")).resolves.toBeUndefined();
  });

  it("surfaces a missing bookmark as a 404", async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { detail: "Bookmark not found." }));
    await expect(deleteBookmark("token-1", "gone")).rejects.toMatchObject({ status: 404 });
  });
});

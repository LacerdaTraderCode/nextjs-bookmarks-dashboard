// Stand-in for the django-ninja-mongo-api service, used for local development and for verifying this
// app end to end without MongoDB. It mirrors the real contract: Bearer auth, `{"detail": ...}` errors,
// 201 on create, 204 on delete, and 401/404/409 where the real API produces them.
// Tokens are unsigned and only valid until this process stops: restarting the mock is therefore a
// quick way to reproduce an "API rejects the stored token" scenario.
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.MOCK_API_PORT ?? 8000);
const TOKEN_LIFETIME_SECONDS = 60 * 60;

const accountsByEmail = new Map();
const bookmarksById = new Map();
const issuedTokens = new Map();

function encodeSegment(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function issueToken(accountId) {
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_LIFETIME_SECONDS;
  const token = `${encodeSegment({ alg: "none" })}.${encodeSegment({ sub: accountId, exp: expiresAt })}.mock`;
  issuedTokens.set(token, accountId);
  return token;
}

function seedDemoAccount() {
  const accountId = randomUUID();
  accountsByEmail.set("demo@example.com", {
    id: accountId,
    email: "demo@example.com",
    fullName: "Demo Reader",
    password: "correct-horse",
  });
  const seeds = [
    ["https://nextjs.org/docs", "Next.js documentation", ["nextjs", "react"], "Cache Components and the proxy convention.", false],
    ["https://www.typescriptlang.org/docs/", "TypeScript handbook", ["typescript"], null, true],
    ["https://vitest.dev/guide/", "Vitest guide", ["testing", "typescript"], "Config and mocking reference.", false],
    ["https://django-ninja.dev/", "Django Ninja", ["python", "api"], null, false],
  ];
  seeds.forEach(([url, title, tags, notes, isRead], index) => {
    const id = randomUUID();
    bookmarksById.set(id, {
      id,
      ownerId: accountId,
      url,
      title,
      tags,
      notes,
      is_read: isRead,
      saved_at: new Date(Date.UTC(2026, 9, 1 + index, 12, 0, 0)).toISOString(),
    });
  });
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(payload === undefined ? undefined : JSON.stringify(payload));
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function authenticatedAccountId(request) {
  const header = request.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return issuedTokens.get(token) ?? null;
}

function publicBookmark(bookmark) {
  const exposed = { ...bookmark };
  delete exposed.ownerId;
  return exposed;
}

function validationFailure(response, missingFields) {
  sendJson(response, 422, {
    detail: missingFields.map((field) => ({ loc: ["body", field], msg: "Field required", type: "missing" })),
  });
}

async function handleAuth(request, response, route) {
  const body = await readJsonBody(request);
  if (body === null) return sendJson(response, 400, { detail: "Malformed JSON." });

  if (route === "/register" && request.method === "POST") {
    const missing = ["email", "password", "full_name"].filter((field) => typeof body[field] !== "string");
    if (missing.length > 0) return validationFailure(response, missing);
    if (accountsByEmail.has(body.email)) {
      return sendJson(response, 409, { detail: "An account with this email already exists." });
    }
    const account = { id: randomUUID(), email: body.email, fullName: body.full_name, password: body.password };
    accountsByEmail.set(account.email, account);
    return sendJson(response, 201, { id: account.id, email: account.email, full_name: account.fullName });
  }

  if (route === "/login" && request.method === "POST") {
    const missing = ["email", "password"].filter((field) => typeof body[field] !== "string");
    if (missing.length > 0) return validationFailure(response, missing);
    const account = accountsByEmail.get(body.email);
    if (!account || account.password !== body.password) {
      return sendJson(response, 401, { detail: "Invalid email or password." });
    }
    return sendJson(response, 200, { access_token: issueToken(account.id), token_type: "bearer" });
  }

  return sendJson(response, 404, { detail: "Not Found" });
}

async function handleBookmarks(request, response, url, bookmarkId) {
  const accountId = authenticatedAccountId(request);
  if (!accountId) return sendJson(response, 401, { detail: "Unauthorized" });

  const ownedBookmark = bookmarkId ? bookmarksById.get(bookmarkId) : undefined;
  const isOwned = ownedBookmark?.ownerId === accountId;

  if (!bookmarkId && request.method === "GET") {
    const tag = url.searchParams.get("tag");
    const isRead = url.searchParams.get("is_read");
    const matching = [...bookmarksById.values()]
      .filter((bookmark) => bookmark.ownerId === accountId)
      .filter((bookmark) => (tag ? bookmark.tags.includes(tag) : true))
      .filter((bookmark) => (isRead === null ? true : bookmark.is_read === (isRead === "true")))
      .sort((first, second) => second.saved_at.localeCompare(first.saved_at));
    return sendJson(response, 200, matching.map(publicBookmark));
  }

  if (!bookmarkId && request.method === "POST") {
    const body = await readJsonBody(request);
    if (body === null) return sendJson(response, 400, { detail: "Malformed JSON." });
    const missing = ["url", "title"].filter((field) => typeof body[field] !== "string");
    if (missing.length > 0) return validationFailure(response, missing);
    const bookmark = {
      id: randomUUID(),
      ownerId: accountId,
      url: body.url,
      title: body.title,
      tags: Array.isArray(body.tags) ? body.tags : [],
      notes: body.notes ?? null,
      is_read: false,
      saved_at: new Date().toISOString(),
    };
    bookmarksById.set(bookmark.id, bookmark);
    return sendJson(response, 201, publicBookmark(bookmark));
  }

  if (bookmarkId && !isOwned) return sendJson(response, 404, { detail: "Bookmark not found." });

  if (bookmarkId && request.method === "GET") return sendJson(response, 200, publicBookmark(ownedBookmark));

  if (bookmarkId && request.method === "PATCH") {
    const body = await readJsonBody(request);
    if (body === null) return sendJson(response, 400, { detail: "Malformed JSON." });
    for (const field of ["title", "tags", "notes", "is_read"]) {
      if (field in body) ownedBookmark[field] = body[field];
    }
    return sendJson(response, 200, publicBookmark(ownedBookmark));
  }

  if (bookmarkId && request.method === "DELETE") {
    bookmarksById.delete(bookmarkId);
    return sendJson(response, 204);
  }

  return sendJson(response, 405, { detail: "Method not allowed" });
}

seedDemoAccount();

createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
  const path = url.pathname.replace(/\/+$/, "");

  if (path.startsWith("/api/auth/")) return handleAuth(request, response, path.slice("/api/auth".length));
  if (path === "/api/bookmarks") return handleBookmarks(request, response, url, null);
  if (path.startsWith("/api/bookmarks/")) {
    return handleBookmarks(request, response, url, path.slice("/api/bookmarks/".length));
  }
  return sendJson(response, 404, { detail: "Not Found" });
}).listen(PORT, () => {
  console.log(`Mock bookmarks API listening on http://127.0.0.1:${PORT}/api (demo@example.com / correct-horse)`);
});

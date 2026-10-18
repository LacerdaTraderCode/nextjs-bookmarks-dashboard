// Boots the mock API and the production build (`npm run build` must have run), then drives the app over
// plain HTTP the way a browser without JavaScript would: cookies, redirects and multipart form posts to
// Server Functions. It cannot exercise client-side behaviour (hydration, optimistic UI): see the README.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const MOCK_PORT = 8765;
const APP_PORT = 3765;
const APP_ORIGIN = `http://127.0.0.1:${APP_PORT}`;
const SESSION_COOKIE = "bookmarks_token";

const children = [];
const results = [];

function check(name, passed, detail = "") {
  results.push({ name, passed });
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${passed || !detail ? "" : `\n      ${detail}`}`);
}

function startProcess(command, args, env) {
  const child = spawn(command, args, { env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  children.push(child);
  return child;
}

async function waitForPort(url, label) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      await fetch(url, { redirect: "manual" });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`${label} did not become reachable at ${url}`);
}

function startMock() {
  return startProcess("node", ["mock-api/server.mjs"], { MOCK_API_PORT: String(MOCK_PORT) });
}

async function stopProcess(child) {
  if (child.exitCode !== null) return;
  await new Promise((resolve) => {
    child.once("exit", resolve);
    child.kill("SIGTERM");
  });
}

function newSession() {
  return new Map();
}

function applySetCookies(jar, response) {
  for (const line of response.headers.getSetCookie()) {
    const [pair] = line.split(";");
    const separator = pair.indexOf("=");
    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1);
    const isExpired = /max-age=0/i.test(line) || /expires=thu, 01 jan 1970/i.test(line) || value === "";
    if (isExpired) jar.delete(name);
    else jar.set(name, value);
  }
}

async function visit(path, { jar = newSession(), method = "GET", form } = {}) {
  const headers = { Origin: APP_ORIGIN };
  if (jar.size > 0) headers.Cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");

  let body;
  if (form) {
    body = new FormData();
    for (const [name, value] of form) body.append(name, value);
  }

  const response = await fetch(`${APP_ORIGIN}${path}`, { method, headers, body, redirect: "manual" });
  applySetCookies(jar, response);
  return {
    status: response.status,
    location: response.headers.get("location") ?? "",
    setCookies: response.getSetCookie?.() ?? response.headers.getSetCookie(),
    html: await response.text(),
  };
}

function decodeEntities(text) {
  return text
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function hiddenInputs(formHtml) {
  const fields = [];
  for (const [tag] of formHtml.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const name = /name="([^"]*)"/.exec(tag)?.[1];
    const value = /value="([^"]*)"/.exec(tag)?.[1] ?? "";
    if (name !== undefined) fields.push([decodeEntities(name), decodeEntities(value)]);
  }
  return fields;
}

function formsIn(html) {
  return [...html.matchAll(/<form[\s\S]*?<\/form>/g)].map(([markup]) => markup);
}

function formContaining(html, marker) {
  const found = formsIn(html).find((markup) => markup.includes(marker));
  if (!found) throw new Error(`No form containing ${marker}`);
  return found;
}

function listedTitles(html) {
  return [...html.matchAll(/class="bookmark-title"[^>]*>([^<]*)</g)].map(([, title]) => decodeEntities(title)).sort();
}

function sameTitles(html, expected) {
  return JSON.stringify(listedTitles(html)) === JSON.stringify([...expected].sort());
}

function bookmarkBlock(html, title) {
  const block = html.split('<li class="bookmark').slice(1).find((segment) => segment.includes(title));
  if (!block) throw new Error(`No bookmark titled ${title}`);
  return block;
}

async function submit(path, formHtml, fields, jar) {
  return visit(path, { jar, method: "POST", form: [...hiddenInputs(formHtml), ...Object.entries(fields)] });
}

async function logIn(email, password) {
  const jar = newSession();
  const page = await visit("/login", { jar });
  const response = await submit("/login", formContaining(page.html, 'name="email"'), { email, password }, jar);
  return { jar, response };
}

async function runChecks() {
  // --- access control at the edge (proxy) ---
  const anonymousDashboard = await visit("/dashboard");
  check(
    "anonymous visit to /dashboard is redirected to /login",
    [307, 308].includes(anonymousDashboard.status) && anonymousDashboard.location.endsWith("/login"),
    `${anonymousDashboard.status} -> ${anonymousDashboard.location}`,
  );
  const root = await visit("/");
  check("/ redirects to /dashboard", [307, 308].includes(root.status) && root.location.endsWith("/dashboard"));

  const loginPage = await visit("/login");
  check("login page renders", loginPage.status === 200 && loginPage.html.includes("Sign in"));
  const registerPage = await visit("/register");
  check("register page renders", registerPage.status === 200 && registerPage.html.includes("Create account"));

  // --- login ---
  const loginForm = formContaining(loginPage.html, 'name="email"');
  const wrongPassword = await submit("/login", loginForm, { email: "demo@example.com", password: "nope" }, newSession());
  check(
    "wrong password shows the API's message and keeps the typed email",
    wrongPassword.html.includes("Invalid email or password.") && wrongPassword.html.includes("demo@example.com"),
  );
  const malformedEmail = await submit("/login", loginForm, { email: "demo", password: "x" }, newSession());
  check("malformed email is rejected before reaching the API", malformedEmail.html.includes("Enter a valid email address."));

  const { jar, response: loggedIn } = await logIn("demo@example.com", "correct-horse");
  const sessionCookieLine = loggedIn.setCookies.find((line) => line.startsWith(`${SESSION_COOKIE}=`)) ?? "";
  check(
    "login redirects to /dashboard",
    [303, 307].includes(loggedIn.status) && loggedIn.location.endsWith("/dashboard"),
    `${loggedIn.status} -> ${loggedIn.location}`,
  );
  check(
    "session cookie is HttpOnly, SameSite=Lax and has a lifetime",
    /httponly/i.test(sessionCookieLine) && /samesite=lax/i.test(sessionCookieLine) && /max-age=\d+/i.test(sessionCookieLine),
    sessionCookieLine,
  );
  const accessToken = jar.get(SESSION_COOKIE) ?? "";
  const guestPageWhileSignedIn = await visit("/login", { jar });
  check(
    "signed-in visit to /login is redirected to /dashboard",
    [307, 308].includes(guestPageWhileSignedIn.status) && guestPageWhileSignedIn.location.endsWith("/dashboard"),
  );

  // --- server-side rendering with API data ---
  const dashboard = await visit("/dashboard", { jar });
  check("dashboard renders the list on the server", dashboard.status === 200 && dashboard.html.includes("Next.js documentation"));
  check("dashboard lists exactly the four seeded bookmarks", sameTitles(dashboard.html, ["Next.js documentation", "TypeScript handbook", "Vitest guide", "Django Ninja"]), JSON.stringify(listedTitles(dashboard.html)));
  check("the access token never appears in the HTML", accessToken !== "" && !dashboard.html.includes(accessToken));
  check("external links carry rel=noopener noreferrer", dashboard.html.includes('rel="noopener noreferrer"'));

  // --- filters (GET form) ---
  const byTag = await visit("/dashboard?tag=testing", { jar });
  check("tag filter lists matching bookmarks only", sameTitles(byTag.html, ["Vitest guide"]), JSON.stringify(listedTitles(byTag.html)));
  const readOnly = await visit("/dashboard?status=read", { jar });
  check("read filter lists read bookmarks only", sameTitles(readOnly.html, ["TypeScript handbook"]), JSON.stringify(listedTitles(readOnly.html)));
  const combined = await visit("/dashboard?status=unread&tag=typescript", { jar });
  check("tag and status filters combine", sameTitles(combined.html, ["Vitest guide"]), JSON.stringify(listedTitles(combined.html)));
  const noMatch = await visit("/dashboard?tag=does-not-exist", { jar });
  check("an empty filtered result explains itself", noMatch.html.includes("No bookmarks match these filters."));
  const unknownStatus = await visit("/dashboard?status=archived", { jar });
  check("an unknown status value falls back to all bookmarks", listedTitles(unknownStatus.html).length === 4, JSON.stringify(listedTitles(unknownStatus.html)));

  // --- mutations through Server Functions ---
  const createForm = formContaining(dashboard.html, 'name="url"');
  const badUrl = await submit("/dashboard", createForm, { url: "not a url", title: "Broken", tags: "", notes: "" }, jar);
  check("an invalid URL is rejected with a message and the input is kept", badUrl.html.includes("Enter a full URL") && badUrl.html.includes("Broken"));
  const scriptUrl = await submit("/dashboard", createForm, { url: "javascript:alert(1)", title: "Sneaky", tags: "", notes: "" }, jar);
  check("a javascript: URL is refused", scriptUrl.html.includes("Only http and https links can be saved."));

  await submit("/dashboard", createForm, { url: "https://react.dev/", title: "React reference", tags: "React, Docs", notes: "hooks chapter" }, jar);
  const afterCreate = await visit("/dashboard", { jar });
  check("a created bookmark appears with normalized tags", listedTitles(afterCreate.html).includes("React reference") && afterCreate.html.includes(">react<") && afterCreate.html.includes(">docs<"));

  const ninjaBlock = bookmarkBlock(afterCreate.html, "Django Ninja");
  await submit("/dashboard", formContaining(ninjaBlock, 'name="markAsRead"'), {}, jar);
  const afterRead = await visit("/dashboard?status=read", { jar });
  check("marking a bookmark as read moves it into the read filter", listedTitles(afterRead.html).includes("Django Ninja"));

  const readBlock = bookmarkBlock(afterRead.html, "Django Ninja");
  await submit("/dashboard", formContaining(readBlock, 'name="markAsRead"'), {}, jar);
  const afterUnread = await visit("/dashboard?status=unread", { jar });
  check("marking it unread again moves it back", listedTitles(afterUnread.html).includes("Django Ninja"));

  const reactBlock = bookmarkBlock(afterUnread.html, "React reference");
  const deleteForm = formsIn(reactBlock).find((markup) => !markup.includes('name="markAsRead"'));
  await submit("/dashboard", deleteForm, {}, jar);
  const afterDelete = await visit("/dashboard", { jar });
  check("deleting a bookmark removes it", !listedTitles(afterDelete.html).includes("React reference"));

  // --- forged and stale sessions ---
  const forgedJar = new Map([[SESSION_COOKIE, "forged.token.value"]]);
  const forgedRead = await submit("/dashboard", formContaining(ninjaBlock, 'name="markAsRead"'), {}, forgedJar);
  check(
    "a forged cookie cannot mutate data: the API rejects it and the app sends the visitor to /session/expired",
    [303, 307].includes(forgedRead.status) && forgedRead.location.includes("/session/expired"),
    `${forgedRead.status} -> ${forgedRead.location}`,
  );
  const unchanged = await visit("/dashboard?status=unread", { jar });
  check("the forged request changed nothing", listedTitles(unchanged.html).includes("Django Ninja"));
  const unauthenticatedMutation = await submit("/dashboard", formContaining(ninjaBlock, 'name="markAsRead"'), {}, newSession());
  check(
    "a mutation without any cookie is redirected to /login",
    [303, 307, 308].includes(unauthenticatedMutation.status) && unauthenticatedMutation.location.endsWith("/login"),
    `${unauthenticatedMutation.status} -> ${unauthenticatedMutation.location}`,
  );

  // --- registration ---
  const registrationForm = formContaining(registerPage.html, 'name="fullName"');
  const duplicate = await submit("/register", registrationForm, { fullName: "Demo", email: "demo@example.com", password: "long-enough-1" }, newSession());
  check("registering an existing email shows the conflict message", duplicate.html.includes("An account with this email already exists."));
  const shortPassword = await submit("/register", registrationForm, { fullName: "Ada", email: "ada@example.com", password: "short" }, newSession());
  check("a short password is rejected before reaching the API", shortPassword.html.includes("at least 8 characters"));
  const adaJar = newSession();
  const registered = await submit("/register", registrationForm, { fullName: "Ada Lovelace", email: "ada@example.com", password: "analytical-engine" }, adaJar);
  check("a valid registration signs the new account in", [303, 307].includes(registered.status) && adaJar.has(SESSION_COOKIE));
  const adaDashboard = await visit("/dashboard", { jar: adaJar });
  check("a new account starts with an empty list", adaDashboard.status === 200 && adaDashboard.html.includes("Nothing saved yet."));
  check("accounts do not see each other's bookmarks", listedTitles(adaDashboard.html).length === 0);

  // --- sign out ---
  const signOutForm = formContaining(dashboard.html, "Sign out");
  const signedOut = await submit("/dashboard", signOutForm, {}, jar);
  check("sign out redirects to /login and clears the cookie", [303, 307].includes(signedOut.status) && signedOut.location.endsWith("/login") && !jar.has(SESSION_COOKIE));

  return { dashboardHtml: dashboard.html };
}

async function runExpiredSessionChecks(mock) {
  const { jar } = await logIn("demo@example.com", "correct-horse");
  check("fresh login for the expired-session scenario", jar.has(SESSION_COOKIE));

  // Restarting the mock forgets every issued token, which is how the real API behaves once a token is rejected.
  await stopProcess(mock.current);
  mock.current = startMock();
  await waitForPort(`http://127.0.0.1:${MOCK_PORT}/api/bookmarks`, "mock API");

  const staleDashboard = await visit("/dashboard", { jar });
  const redirectsToExpiry = staleDashboard.location.includes("/session/expired") || staleDashboard.html.includes("/session/expired");
  check("a token the API rejects sends the dashboard to /session/expired", redirectsToExpiry, `${staleDashboard.status} ${staleDashboard.location}`);

  const expiry = await visit("/session/expired", { jar });
  check("/session/expired redirects to /login?reason=expired", [307, 308].includes(expiry.status) && expiry.location.endsWith("/login?reason=expired"), `${expiry.status} -> ${expiry.location}`);
  check("/session/expired clears the stale cookie", !jar.has(SESSION_COOKIE) && expiry.setCookies.some((line) => line.startsWith(`${SESSION_COOKIE}=`)));

  const loginAfterExpiry = await visit("/login?reason=expired", { jar });
  check("the login page explains the expiry and does not loop back", loginAfterExpiry.status === 200 && loginAfterExpiry.html.includes("Your session expired."));
}

async function runUnreachableApiChecks(mock) {
  const { jar } = await logIn("demo@example.com", "correct-horse");
  await stopProcess(mock.current);

  const dashboard = await visit("/dashboard", { jar });
  check("an unreachable API does not leak connection details to the page", !/ECONNREFUSED|127\.0\.0\.1:8765/.test(dashboard.html));
  check("an unreachable API does not render bookmarks", listedTitles(dashboard.html).length === 0);
}

async function main() {
  if (!existsSync(".next/BUILD_ID")) {
    console.error("No production build found. Run `npm run build` first.");
    process.exit(2);
  }

  const mock = { current: startMock() };
  startProcess("node", ["node_modules/next/dist/bin/next", "start", "-p", String(APP_PORT)], {
    BOOKMARKS_API_URL: `http://127.0.0.1:${MOCK_PORT}/api`,
  });

  try {
    await waitForPort(`http://127.0.0.1:${MOCK_PORT}/api/bookmarks`, "mock API");
    await waitForPort(`${APP_ORIGIN}/login`, "Next.js app");

    await runChecks();
    await runExpiredSessionChecks(mock);
    await runUnreachableApiChecks(mock);
  } catch (error) {
    check("verification ran to completion", false, error instanceof Error ? error.stack : String(error));
  } finally {
    for (const child of children) child.kill("SIGTERM");
  }

  const failed = results.filter((result) => !result.passed).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed === 0 ? 0 : 1);
}

await main();

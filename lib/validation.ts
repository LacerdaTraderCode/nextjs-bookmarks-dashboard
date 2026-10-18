import type { Credentials, NewBookmark, RegistrationInput } from "@/lib/types";

export type Validated<Value> = { ok: true; value: Value } | { ok: false; message: string };

const MAX_TAGS_PER_BOOKMARK = 10;
const MAX_TAG_LENGTH = 32;
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function textField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeTags(rawTags: string): string[] {
  const seen = new Set<string>();
  for (const candidate of rawTags.split(",")) {
    const tag = candidate.trim().toLowerCase();
    if (tag) seen.add(tag);
  }
  return [...seen];
}

export function parseNewBookmark(formData: FormData): Validated<NewBookmark> {
  const url = textField(formData, "url");
  const title = textField(formData, "title");
  const notes = textField(formData, "notes");
  const tags = normalizeTags(textField(formData, "tags"));

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { ok: false, message: "Enter a full URL, including https://." };
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return { ok: false, message: "Only http and https links can be saved." };
  }
  if (!title) return { ok: false, message: "Give the bookmark a title." };
  if (tags.length > MAX_TAGS_PER_BOOKMARK) {
    return { ok: false, message: `Use at most ${MAX_TAGS_PER_BOOKMARK} tags per bookmark.` };
  }
  if (tags.some((tag) => tag.length > MAX_TAG_LENGTH)) {
    return { ok: false, message: `Tags can have at most ${MAX_TAG_LENGTH} characters.` };
  }

  return { ok: true, value: { url: parsedUrl.toString(), title, tags, notes: notes || null } };
}

export function parseCredentials(formData: FormData): Validated<Credentials> {
  const email = textField(formData, "email").toLowerCase();
  const password = formData.get("password");
  if (!EMAIL_SHAPE.test(email)) return { ok: false, message: "Enter a valid email address." };
  if (typeof password !== "string" || password.length === 0) {
    return { ok: false, message: "Enter your password." };
  }
  return { ok: true, value: { email, password } };
}

export function parseRegistration(formData: FormData): Validated<RegistrationInput> {
  const credentials = parseCredentials(formData);
  if (!credentials.ok) return credentials;

  const fullName = textField(formData, "fullName");
  if (!fullName) return { ok: false, message: "Enter your name." };
  if (credentials.value.password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, message: `Use a password with at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  return { ok: true, value: { ...credentials.value, fullName } };
}

export function parseBookmarkId(formData: FormData): string | null {
  const bookmarkId = textField(formData, "bookmarkId");
  return bookmarkId || null;
}

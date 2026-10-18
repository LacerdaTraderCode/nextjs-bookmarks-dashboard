"use server";

import { revalidatePath } from "next/cache";

import {
  ApiRequestError,
  createBookmark,
  deleteBookmark,
  setBookmarkReadState,
} from "@/lib/api-client";
import { echoFields, type FormState } from "@/lib/form-state";
import { redirectWhenSessionRejected, requireSessionToken } from "@/lib/session";
import { parseBookmarkId, parseNewBookmark } from "@/lib/validation";

function isMissingBookmark(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status === 404;
}

export async function createBookmarkAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireSessionToken();
  const values = echoFields(formData, ["url", "title", "tags", "notes"]);

  const newBookmark = parseNewBookmark(formData);
  if (!newBookmark.ok) return { error: newBookmark.message, values };

  try {
    await createBookmark(token, newBookmark.value);
  } catch (error) {
    redirectWhenSessionRejected(error);
    if (error instanceof ApiRequestError) return { error: error.message, values };
    throw error;
  }

  revalidatePath("/dashboard");
  return { error: null, values: {} };
}

export async function toggleReadAction(formData: FormData): Promise<void> {
  const token = await requireSessionToken();
  const bookmarkId = parseBookmarkId(formData);
  if (!bookmarkId) return;
  const markAsRead = formData.get("markAsRead") === "true";

  try {
    await setBookmarkReadState(token, bookmarkId, markAsRead);
  } catch (error) {
    redirectWhenSessionRejected(error);
    // Deleted from another tab in the meantime: the refreshed list is the correct outcome.
    if (!isMissingBookmark(error)) throw error;
  }
  revalidatePath("/dashboard");
}

export async function deleteBookmarkAction(formData: FormData): Promise<void> {
  const token = await requireSessionToken();
  const bookmarkId = parseBookmarkId(formData);
  if (!bookmarkId) return;

  try {
    await deleteBookmark(token, bookmarkId);
  } catch (error) {
    redirectWhenSessionRejected(error);
    if (!isMissingBookmark(error)) throw error;
  }
  revalidatePath("/dashboard");
}

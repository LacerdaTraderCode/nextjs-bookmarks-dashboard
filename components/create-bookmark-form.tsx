"use client";

import { useActionState } from "react";

import { createBookmarkAction } from "@/actions/bookmark-actions";
import { initialFormState } from "@/lib/form-state";

export function CreateBookmarkForm() {
  const [state, submitAction, isPending] = useActionState(createBookmarkAction, initialFormState);

  return (
    <form action={submitAction} className="panel stack" aria-labelledby="create-heading">
      <h2 id="create-heading">Save a link</h2>
      <div className="field-row">
        <label className="field">
          <span>URL</span>
          <input name="url" type="url" placeholder="https://" defaultValue={state.values.url} required />
        </label>
        <label className="field">
          <span>Title</span>
          <input name="title" type="text" defaultValue={state.values.title} required />
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          <span>Tags (comma separated)</span>
          <input name="tags" type="text" placeholder="typescript, testing" defaultValue={state.values.tags} />
        </label>
        <label className="field">
          <span>Notes</span>
          <input name="notes" type="text" defaultValue={state.values.notes} />
        </label>
      </div>
      {state.error && (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      )}
      <div>
        <button type="submit" className="button button-primary" disabled={isPending}>
          {isPending ? "Saving…" : "Save bookmark"}
        </button>
      </div>
    </form>
  );
}

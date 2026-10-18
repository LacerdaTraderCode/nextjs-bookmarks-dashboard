"use client";

import { useActionState } from "react";

import { initialFormState, type FormState } from "@/lib/form-state";

type AuthFormProps = {
  mode: "login" | "register";
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
};

export function AuthForm({ mode, action }: AuthFormProps) {
  const [state, submitAction, isPending] = useActionState(action, initialFormState);
  const isRegistration = mode === "register";

  return (
    <form action={submitAction} className="stack" noValidate>
      {isRegistration && (
        <label className="field">
          <span>Full name</span>
          <input name="fullName" type="text" autoComplete="name" defaultValue={state.values.fullName} required />
        </label>
      )}
      <label className="field">
        <span>Email</span>
        <input name="email" type="email" autoComplete="email" defaultValue={state.values.email} required />
      </label>
      <label className="field">
        <span>Password</span>
        <input
          name="password"
          type="password"
          autoComplete={isRegistration ? "new-password" : "current-password"}
          minLength={isRegistration ? 8 : undefined}
          required
        />
      </label>
      {state.error && (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      )}
      <button type="submit" className="button button-primary" disabled={isPending}>
        {isPending ? "Please wait…" : isRegistration ? "Create account" : "Sign in"}
      </button>
    </form>
  );
}

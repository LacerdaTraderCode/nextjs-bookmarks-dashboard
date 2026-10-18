"use server";

import { redirect } from "next/navigation";

import { ApiRequestError, loginAccount, registerAccount } from "@/lib/api-client";
import { echoFields, type FormState } from "@/lib/form-state";
import { endSession, startSession } from "@/lib/session";
import { parseCredentials, parseRegistration } from "@/lib/validation";

function describeAuthFailure(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) return "Invalid email or password.";
    if (error.status === 409) return "An account with this email already exists.";
    if (error.status === 503) return "The bookmarks API is unreachable. Try again in a moment.";
    return error.message;
  }
  throw error;
}

export async function loginAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const values = echoFields(formData, ["email"]);
  const credentials = parseCredentials(formData);
  if (!credentials.ok) return { error: credentials.message, values };

  let accessToken: string;
  try {
    accessToken = await loginAccount(credentials.value);
  } catch (error) {
    return { error: describeAuthFailure(error), values };
  }

  await startSession(accessToken);
  redirect("/dashboard");
}

export async function registerAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const values = echoFields(formData, ["fullName", "email"]);
  const registration = parseRegistration(formData);
  if (!registration.ok) return { error: registration.message, values };

  let accessToken: string;
  try {
    await registerAccount(registration.value);
    accessToken = await loginAccount({
      email: registration.value.email,
      password: registration.value.password,
    });
  } catch (error) {
    return { error: describeAuthFailure(error), values };
  }

  await startSession(accessToken);
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/login");
}

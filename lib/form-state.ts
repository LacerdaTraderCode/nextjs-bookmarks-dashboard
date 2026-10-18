export type FormState = {
  error: string | null;
  // Echoed back so a rejected submission does not wipe what the person typed (React resets uncontrolled forms).
  values: Record<string, string>;
};

export const initialFormState: FormState = { error: null, values: {} };

export function echoFields(formData: FormData, fieldNames: readonly string[]): Record<string, string> {
  const echoed: Record<string, string> = {};
  for (const fieldName of fieldNames) {
    const value = formData.get(fieldName);
    if (typeof value === "string") echoed[fieldName] = value;
  }
  return echoed;
}

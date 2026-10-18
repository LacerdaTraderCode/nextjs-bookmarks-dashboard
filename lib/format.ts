const savedDateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });

export function formatSavedDate(isoTimestamp: string): string {
  const savedAt = new Date(isoTimestamp);
  return Number.isNaN(savedAt.getTime()) ? "unknown date" : savedDateFormat.format(savedAt);
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

"use client";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="dashboard stack">
      <section className="panel stack" role="alert">
        <h1>Something went wrong</h1>
        <p className="muted">The reading list could not be loaded. The bookmarks API may be unavailable.</p>
        <div>
          <button type="button" className="button button-primary" onClick={reset}>
            Try again
          </button>
        </div>
      </section>
    </main>
  );
}

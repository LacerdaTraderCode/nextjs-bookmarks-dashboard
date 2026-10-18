import type { Metadata } from "next";
import { Suspense } from "react";

import { logoutAction } from "@/actions/auth-actions";
import { BookmarkSection } from "@/components/bookmark-section";
import { CreateBookmarkForm } from "@/components/create-bookmark-form";
import { ListSkeleton } from "@/components/list-skeleton";

export const metadata: Metadata = { title: "Dashboard" };

// The header and the create form are the static shell; the list streams in behind <Suspense>.
export default function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <main className="dashboard stack">
      <header className="dashboard-header">
        <h1>Reading list</h1>
        <form action={logoutAction}>
          <button type="submit" className="button">
            Sign out
          </button>
        </form>
      </header>
      <CreateBookmarkForm />
      <Suspense fallback={<ListSkeleton />}>
        <BookmarkSection searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

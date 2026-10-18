export function ListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading bookmarks" className="skeleton-list">
      {[0, 1, 2].map((placeholder) => (
        <div key={placeholder} className="skeleton-row" />
      ))}
    </div>
  );
}

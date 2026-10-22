/** Pulsing placeholders while the first history page loads. */
export function SkeletonRows() {
  return (
    <div aria-hidden>
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="mb-5 grid grid-cols-[minmax(0,1fr)_240px] gap-3 pt-1 pl-1">
          <div className="h-56 animate-pulse rounded-2xl bg-page-2" />
          <div className="h-56 animate-pulse rounded-2xl bg-page-2" />
        </div>
      ))}
    </div>
  )
}

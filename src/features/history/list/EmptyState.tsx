/** Shown when the feed has no records at all. */
export function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
      <p className="text-sm font-medium text-fg">No generations yet</p>
      <p className="text-xs text-fg-2">Generated videos will appear here.</p>
    </div>
  )
}

/** Shown when a browser page has no valid session cookie. No API calls. */
export default function SessionRequiredPage() {
  return (
    <main className="grid h-dvh place-items-center bg-page p-6 text-center">
      <div className="flex max-w-md flex-col gap-3">
        <h1 className="text-sm font-medium text-fg">Session required</h1>
        <p className="text-sm text-fg-2">
          Open the link printed in the terminal where the server runs.
        </p>
        <code className="rounded-lg border border-line bg-page-2 px-3 py-2 text-xs text-fg-2">
          {'[unplatform-ai] open http://127.0.0.1:<port>/session#t=<token>'}
        </code>
      </div>
    </main>
  )
}

/**
 * Boots the Node runtime through the server composition root.
 * The import stays dynamic so the Edge build never loads server modules.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return
  }

  const { bootServer } = await import('@/server/boot')

  await bootServer()
}

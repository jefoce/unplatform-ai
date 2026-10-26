import 'server-only'

/** Mock flag shared by the registries without importing an adapter. */
export function isMockMode(): boolean {
  return process.env.OPENROUTER_MOCK === '1'
}

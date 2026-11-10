import 'server-only'

/** Mock flag shared by the registries without importing an adapter. */
export function isMockMode(): boolean {
  return process.env.OPENROUTER_MOCK === '1'
}

/** In-process custom endpoint mock, driven by the upai/1 fixtures. */
export function isCustomEndpointMockMode(): boolean {
  return process.env.CUSTOM_ENDPOINT_MOCK === '1'
}

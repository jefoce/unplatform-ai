import 'server-only'

/** Local server origin used by mock links and prefix checks. */
const configuredOrigin = process.env.APP_ORIGIN?.trim() ?? ''

const LOCAL_BASE_URL =
  configuredOrigin === '' ? `http://127.0.0.1:${process.env.PORT ?? 3000}` : configuredOrigin

export const MOCK_REMOTE_PREFIX = `${LOCAL_BASE_URL}/api/dev/remote/`

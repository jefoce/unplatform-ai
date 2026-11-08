const CHROME_MAJOR_PATTERN = /Chrome\/(\d+)\./

/** Env var that pins the expected Chrome major for the e2e run. */
export const E2E_CHROME_MAJOR_ENV = 'E2E_CHROME_MAJOR'

/** Major version from a CDP `Browser` string, or null when it does not parse. */
export function parseChromeMajor(browser) {
  const match = CHROME_MAJOR_PATTERN.exec(String(browser))

  if (match === null) {
    return null
  }

  return Number(match[1])
}

/** Logs the browser string and throws when `E2E_CHROME_MAJOR` is set and differs. */
export function checkChromeMajor(browser, expected = process.env.E2E_CHROME_MAJOR?.trim()) {
  console.log(`# chrome ${String(browser)}`)

  if (expected === undefined || expected === '') {
    return
  }

  const found = parseChromeMajor(browser)

  if (found !== Number(expected)) {
    throw new Error(
      `Chrome major ${String(found)} does not match ${E2E_CHROME_MAJOR_ENV}=${expected} (${String(browser)}).`,
    )
  }
}

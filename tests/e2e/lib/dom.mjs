const APP_TITLE = 'Unplatform AI'

export async function openApp(context) {
  const { driver, server, width, height } = context

  await driver.setViewport(width, height)
  await driver.setSessionCookie(server.token)
  await driver.navigate(server.baseUrl)
  await driver.waitFor(
    `window.__e2e.exists('[data-island]') || window.__e2e.exists('[data-generator-panel]')`,
    30_000,
    'the app shell',
  )
}

export async function gotoTab(driver, label) {
  await driver.clickText(label)
  await driver.waitFor(
    label === 'Image'
      ? `window.__e2e.exists('[data-image-prompt-bar]')`
      : `window.__e2e.exists('[data-generator-panel]')`,
    15_000,
    `the ${label} tab`,
  )
}

export async function setView(driver, label) {
  const clicked = await driver.evaluate(`window.__e2e.clickText(${JSON.stringify(label)})`)

  if (!clicked) {
    throw new Error(`No view button: ${label}`)
  }

  await driver.waitFor(
    `window.__e2e.all('[role="tab"][aria-selected="true"]').some((node) => node.innerText.trim() === ${JSON.stringify(label)})`,
    10_000,
    `the ${label} view`,
  )
}

export async function setPrompt(driver, text) {
  await driver.typeInto('[aria-label="Prompt"]', text)
  await driver.waitFor(
    `(window.__e2e.promptText('[aria-label="Prompt"]') ?? '').includes(${JSON.stringify(text)})`,
    10_000,
    'the prompt text',
  )
}

export async function clickGenerate(driver) {
  await driver.waitFor(
    `window.__e2e.all('button').some((button) => /^GENERATE/i.test(button.innerText.trim()) && !button.disabled)`,
    60_000,
    'an enabled Generate button',
  )
  await driver.evaluate(`(() => {
    const button = window.__e2e.all('button').find((node) => /^GENERATE/i.test(node.innerText.trim()))
    button.click()
  })()`)
}

export async function waitTitle(driver, expected, timeoutMs = 60_000) {
  await driver.waitFor(
    `document.title === ${JSON.stringify(expected)}`,
    timeoutMs,
    `the document title ${expected}`,
  )
}

export async function waitBodyText(driver, text, timeoutMs = 30_000) {
  await driver.waitFor(
    `document.body.innerText.includes(${JSON.stringify(text)})`,
    timeoutMs,
    `the text ${text}`,
  )
}

export function titleWithCount(count) {
  if (count === 0) {
    return APP_TITLE
  }

  return `(${String(count)}) Generating \u00b7 ${APP_TITLE}`
}

export async function tileClick(driver, label, index = 0) {
  const found = await driver.evaluate(`(() => {
    const tiles = window.__e2e.all('[role="button"]').filter((node) => node.getAttribute('aria-label') === ${JSON.stringify(label)})
    const tile = tiles[${String(index)}]
    if (tile === undefined) return false
    tile.click()
    return true
  })()`)

  if (!found) {
    throw new Error(`No ${label} tile at index ${String(index)}`)
  }
}

/** Clicks a visible control whose aria-label starts with the given text. */
export async function clickLabelPrefix(driver, prefix, index = 0) {
  const clicked = await driver.evaluate(`(() => {
    const nodes = window.__e2e.all('[aria-label]').filter((node) => (node.getAttribute('aria-label') ?? '').startsWith(${JSON.stringify(prefix)}))
    const node = nodes[${String(index)}]
    if (node === undefined) return false
    node.click()
    return true
  })()`)

  if (!clicked) {
    throw new Error(`No control labelled ${prefix} at index ${String(index)}`)
  }
}

export async function countLabel(driver, label) {
  return driver.evaluate(`window.__e2e.all('[aria-label=${JSON.stringify(label)}]').length`)
}

/** Waits for the picker surface opened by the prompt bar. */
export async function waitPicker(driver) {
  await driver.waitFor(
    `window.__e2e.exists('[aria-label="Close picker"]')`,
    15_000,
    'the media picker',
  )
}

/** Opens the image reference picker from the floating prompt bar. */
export async function openImagePicker(driver) {
  await driver.clickLabel('Add references')
  await waitPicker(driver)
}

/** Clicks one of the picker's static tabs by its visible label. */
export async function pickerTab(driver, label) {
  const clicked = await driver.evaluate(`(() => {
    const tabs = window.__e2e.all('button[aria-pressed]')
    const tab = tabs.find((node) => node.innerText.trim() === ${JSON.stringify(label)})
    if (tab === undefined) return false
    tab.click()
    return true
  })()`)

  if (!clicked) {
    throw new Error(`No picker tab: ${label}`)
  }
}

/** Synthetic file drop or paste on the window, as the browser would deliver it. */
export async function dropFile(driver, name, type, bytes, isPaste = false) {
  await driver.evaluate(`(() => {
    const binary = atob(${JSON.stringify(bytes)})
    const buffer = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) buffer[index] = binary.charCodeAt(index)
    const file = new File([buffer], ${JSON.stringify(name)}, { type: ${JSON.stringify(type)} })
    const transfer = new DataTransfer()
    transfer.items.add(file)
    const event = new ${isPaste ? 'ClipboardEvent' : 'DragEvent'}(${JSON.stringify(isPaste ? 'paste' : 'drop')}, { bubbles: true, cancelable: true, dataTransfer: transfer, clipboardData: transfer })
    window.dispatchEvent(event)
  })()`)
}

/** 1x1 PNG used for upload, drop and paste flows. */
export const PNG_1PX =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

/** Clears persisted browser state for the given store names, then reloads. */
export async function resetLocal(driver, names) {
  await driver.evaluate(`${JSON.stringify(names)}.forEach((name) => localStorage.removeItem(name))`)
  await driver.reload()
  await driver.waitFor(
    `window.__e2e.exists('[data-island]') || window.__e2e.exists('[data-generator-panel]')`,
    30_000,
    'the app after reset',
  )
}

/** Clicks a button whose visible text starts with the given prefix. */
export async function clickButtonStart(driver, prefix) {
  const clicked = await driver.evaluate(`(() => {
    const button = window.__e2e.all('button').find((node) => node.innerText.trim().startsWith(${JSON.stringify(prefix)}))
    if (button === undefined) return false
    button.click()
    return true
  })()`)

  if (!clicked) {
    throw new Error(`No button starting with ${prefix}`)
  }
}

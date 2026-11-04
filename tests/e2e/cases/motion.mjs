import { gotoTab, openApp, setView } from '../lib/dom.mjs'
import { createImageRecord } from '../lib/server.mjs'

/** Grace pill fades linearly over its 10 s window, glow keeps its breathe animation. */
async function reducedMotionKeepsAnimations(context) {
  const { driver, server } = context
  const startedAt = Date.now()

  await driver.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  })
  await createImageRecord(server, `e2e reduced motion ${String(startedAt)}`)

  await openApp(context)
  await gotoTab(driver, 'Image')
  await setView(driver, 'Grid')

  const isReduced = await driver.evaluate(`matchMedia('(prefers-reduced-motion: reduce)').matches`)

  if (!isReduced) {
    throw new Error('Chrome did not emulate reduced motion')
  }

  await driver.waitFor(
    `window.__e2e.exists('[data-grace-cancel]')`,
    10_000,
    'the grace cancel pill',
  )

  await driver.waitFor(
    `(() => {
      const pill = window.__e2e.bySelector('[data-grace-cancel]')
      if (pill === null) return false
      return Number(getComputedStyle(pill).opacity) < 0.9
    })()`,
    8_000 - (Date.now() - startedAt),
    'the grace pill to fade below 0.9',
  )

  const hasGlowAnimation = await driver.evaluate(`(() => {
    const glow = window.__e2e.bySelector('.glow-gray')
    if (glow === null) return false
    return glow.getAnimations().length > 0
  })()`)

  if (!hasGlowAnimation) {
    throw new Error('The active card glow has no animation under reduced motion')
  }
}

export const motionCases = [
  {
    name: 'motion/reduced-motion-keeps-animations',
    run: reducedMotionKeepsAnimations,
  },
]

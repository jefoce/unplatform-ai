import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const ROOT = path.join(os.tmpdir(), `cf-images-media-${process.pid}-${Date.now()}`)
const IMAGES = path.join(ROOT, 'images')
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

type ResolveMediaRef = (segments: string[]) => Promise<{
  absolutePath: string
  kind: string
  ref: string
}>

let resolveMediaRef: ResolveMediaRef

beforeAll(async () => {
  await fs.mkdir(IMAGES, { recursive: true })

  ;({ resolveMediaRef } = await import('@/server/fs/media-ref'))
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  if (PREVIOUS_ROOT === undefined) {
    delete process.env.STORAGE_ROOT

    return
  }

  process.env.STORAGE_ROOT = PREVIOUS_ROOT
})

describe('images media ref', () => {
  it('resolves an output file inside the images dir', async () => {
    const name = `${randomUUID()}-0.png`

    await fs.writeFile(path.join(IMAGES, name), 'png')

    const media = await resolveMediaRef(['images', name])

    expect(media.kind).toBe('image')
    expect(media.ref).toBe(`images/${name}`)
    expect(media.absolutePath).toBe(path.join(IMAGES, name))
  })

  it('resolves webp and jpeg outputs', async () => {
    const webp = `${randomUUID()}-1.webp`
    const jpeg = `${randomUUID()}-2.jpg`

    const first = await resolveMediaRef(['images', webp])
    const second = await resolveMediaRef(['images', jpeg])

    expect(first.kind).toBe('image')
    expect(second.kind).toBe('image')
  })

  it('rejects an unsupported extension and a record json', async () => {
    await expect(resolveMediaRef(['images', `${randomUUID()}-0.txt`])).rejects.toMatchObject({
      status: 400,
    })

    await expect(resolveMediaRef(['images', `${randomUUID()}.json`])).rejects.toMatchObject({
      status: 400,
    })
  })

  it('rejects names that are not app owned or contain a path', async () => {
    await expect(resolveMediaRef(['images', 'photo.png'])).rejects.toMatchObject({ status: 400 })

    await expect(
      resolveMediaRef(['images', `${randomUUID()}-0.png/../evil.png`]),
    ).rejects.toMatchObject({ status: 400 })
  })
})

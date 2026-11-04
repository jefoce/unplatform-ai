import { describe, expect, it } from 'vitest'

import { folderFileUpload, folderTargetPath } from '../src/core/folder-match'
import type { UploadItem } from '../src/core/schemas/upload-item'
import { upload, uploadsOf } from './helpers/validation-fixtures'

const folderPath = '/videos/root'
const rel = 'sub/clip.mp4'

function linked(id: string, target: string): UploadItem {
  return upload(id, 'video', { source: 'link', target })
}

describe('folderTargetPath', () => {
  it('joins the folder and rel with one slash', () => {
    expect(folderTargetPath({ folderPath, rel })).toBe('/videos/root/sub/clip.mp4')
  })

  it('uses forward slashes and collapses duplicate and trailing slashes', () => {
    expect(folderTargetPath({ folderPath: 'C:\\videos\\\\root\\', rel: 'sub\\clip.mp4' })).toBe(
      'C:/videos/root/sub/clip.mp4',
    )
  })

  it('keeps dot segments for the server to reject', () => {
    expect(folderTargetPath({ folderPath, rel: '../clip.mp4' })).toBe('/videos/root/../clip.mp4')
  })
})

describe('folderFileUpload', () => {
  it('finds a selected upload with the same normalized target', () => {
    const item = linked('linked', '\\videos\\root\\sub\\clip.mp4')

    expect(
      folderFileUpload({ folderPath, rel, selectedIds: ['linked'], uploadsById: uploadsOf(item) }),
    ).toBe(item)
  })

  it('ignores other links and files without a target', () => {
    const other = linked('other', `${folderPath}/sub/other.mp4`)
    const local = upload('local', 'video')

    expect(
      folderFileUpload({
        folderPath,
        rel,
        selectedIds: ['other', 'local'],
        uploadsById: uploadsOf(other, local),
      }),
    ).toBeNull()
  })
})

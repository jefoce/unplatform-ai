import { describe, expect, it } from 'vitest'

import { folderFileUpload, folderTargetPath, isFolderFileAttached } from '@/core/folder-match'
import type { UploadItem } from '@/core/schemas/upload-item'

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
  const target = folderTargetPath({ folderPath, rel })

  it('finds a selected upload with the same normalized target', () => {
    const item = linked('linked', '\\videos\\root\\sub\\clip.mp4')

    expect(
      folderFileUpload({ folderPath, rel, selectedIds: ['linked'], uploadsById: uploadsOf(item) }),
    ).toBe(item)

    expect(
      isFolderFileAttached({
        folderPath,
        rel,
        selectedIds: ['linked'],
        uploadsById: uploadsOf(item),
      }),
    ).toBe(true)
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

  it('returns null when the folder file is not selected', () => {
    const item = linked('linked', target)

    expect(
      isFolderFileAttached({ folderPath, rel, selectedIds: [], uploadsById: uploadsOf(item) }),
    ).toBe(false)
  })
})

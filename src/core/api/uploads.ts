import type { UploadItem } from '../schemas/upload-item'
import type { Dict } from '../utility-types'

/** Uploads keyed by upload id. */
export type UploadsById = Dict<UploadItem>

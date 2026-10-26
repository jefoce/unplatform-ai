import { z } from 'zod'

/** One connected folder stored in `data/folders.json`. */
const FolderItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  addedAt: z.string(),
})

export type FolderItem = z.infer<typeof FolderItemSchema>

/** Whole `folders.json` file. */
export const FoldersFileSchema = z.array(FolderItemSchema)

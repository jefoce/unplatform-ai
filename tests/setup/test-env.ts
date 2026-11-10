import { mkdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const realHome = os.homedir()

const root = path.join(
  os.tmpdir(),
  'upai-vitest',
  `${process.pid}-${process.env.VITEST_WORKER_ID ?? '0'}`,
)

mkdirSync(root, { recursive: true })

process.env.STORAGE_ROOT = root
process.env.HOME = root
process.env.USERPROFILE = root
process.env.UPAI_REAL_HOME = realHome

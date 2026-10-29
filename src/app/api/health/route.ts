import { isNil } from 'lodash-es'

import { appVersion } from '@/core/app-version'
import { errorResponse } from '@/server/http'
import { downloadQueueIds } from '@/server/jobs/download-queue'
import { isBooted } from '@/server/jobs/poller'
import { sendingCount } from '@/server/jobs/submit-queue'
import { listGenerations } from '@/server/repos/generations'
import { assertLocalRequest } from '@/server/request-guard'
import { sessionRequired } from '@/server/session'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    assertLocalRequest(request, { session: false })
    const records = await listGenerations()

    const grace = records.filter((record) => {
      return record.status === 'submitting' && record.submit?.stage === 'grace'
    }).length

    const uploading = records.filter((record) => {
      return record.status === 'submitting' && record.submit?.stage === 'uploading'
    }).length

    const generating = records.filter((record) => {
      return (
        record.status === 'pending' || (record.status === 'in_progress' && isNil(record.download))
      )
    }).length

    const downloadingIds = new Set(
      records
        .filter((record) => {
          return record.status === 'in_progress' && !isNil(record.download)
        })
        .map((record) => {
          return record.id
        }),
    )

    for (const id of downloadQueueIds()) {
      downloadingIds.add(id)
    }

    return Response.json({
      app: 'unplatform-ai',
      pid: process.pid,
      version: appVersion(),
      desktop: sessionRequired(),
      ready: isBooted(),
      generating,
      downloading: downloadingIds.size,
      sending: sendingCount(),
      uploading,
      grace,
      rssMb: Math.round(process.memoryUsage().rss / 1048576),
    })
  } catch (error) {
    return errorResponse(error)
  }
}

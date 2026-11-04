import type { SystemCapabilities } from '@/core/types'
import { errorResponse, jsonResponse } from '@/server/http'
import { assertLocalRequest } from '@/server/request-guard'
import { getSystem } from '@/server/system'

export async function GET(request: Request) {
  try {
    assertLocalRequest(request)
    const hasDialog = await getSystem().canChooseFiles()

    const result: SystemCapabilities = {
      chooseFiles: hasDialog,
      chooseFolder: hasDialog,
      platform: process.platform,
    }

    return jsonResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}

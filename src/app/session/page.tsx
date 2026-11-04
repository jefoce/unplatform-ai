'use client'

import { useEffect, useState } from 'react'
import { isNil } from 'lodash-es'

import { startSession } from '@/lib/api/system'

/** Exchanges the fragment token for a cookie, then drops the fragment from history. */
export default function SessionPage() {
  const [hasFailed, setHasFailed] = useState(false)

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('t')

    if (isNil(token) || token === '') {
      window.location.replace('/')

      return
    }

    void startSession(token)
      .then(() => {
        window.location.replace('/')
      })
      .catch(() => {
        setHasFailed(true)
      })
  }, [])

  const message = hasFailed ? 'Could not start a session. Open the app again.' : 'Starting...'

  return <main className="grid h-dvh place-items-center bg-page text-sm text-fg-2">{message}</main>
}

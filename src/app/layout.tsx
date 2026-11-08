import './globals.css'

import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { headers } from 'next/headers'
import { Toaster } from 'sonner'

const OS_SCRIPT = `document.documentElement.dataset.os = /Linux/.test(navigator.userAgent) && !/Android/.test(navigator.userAgent) ? 'linux' : 'other'
addEventListener('securitypolicyviolation', (event) => {
  console.error('[unplatform-ai] CSP violation', event.violatedDirective, event.blockedURI)
})`

const inter = localFont({
  src: './fonts/inter-latin-100-900.woff2',
  variable: '--font-inter',
  weight: '100 900',
  display: 'swap',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
})

const grotesk = localFont({
  src: './fonts/space-grotesk-latin-300-700.woff2',
  variable: '--font-space-grotesk',
  weight: '300 700',
  display: 'swap',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
})

export const metadata: Metadata = {
  title: 'Unplatform AI',
}

interface RootLayoutProps {
  children: React.ReactNode
}

export default async function RootLayout(props: RootLayoutProps) {
  const { children } = props
  const nonce = (await headers()).get('x-nonce') ?? undefined

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${grotesk.variable} font-sans antialiased`}
    >
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: OS_SCRIPT }} />
      </head>
      <body>
        {children}
        <div data-keep-panels>
          <Toaster richColors theme="dark" />
        </div>
      </body>
    </html>
  )
}

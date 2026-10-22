import 'server-only'

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { acceptForKinds } from '@/core/media-kinds'
import type { MediaKind } from '@/core/types'

import type { SystemAdapter } from './index'

const run = promisify(execFile)
const DIALOG_TIMEOUT = 10 * 60_000

export const win32: SystemAdapter = {
  canChooseFiles: async () => true,

  async chooseFiles({ kinds, multiple: isMultiple, prompt }) {
    const patterns = extensions(kinds)
      .map((ext) => `*.${ext}`)
      .join(';')
    const script = [
      'Add-Type -AssemblyName System.Windows.Forms',
      '$form = New-Object System.Windows.Forms.Form',
      '$form.TopMost = $true',
      '$form.ShowInTaskbar = $false',
      '$form.WindowState = [System.Windows.Forms.FormWindowState]::Minimized',
      '$dialog = New-Object System.Windows.Forms.OpenFileDialog',
      `$dialog.Title = ${quote(prompt)}`,
      `$dialog.Filter = ${quote(`Media|${patterns}`)}`,
    ]

    if (isMultiple) script.push('$dialog.Multiselect = $true')

    script.push("if ($dialog.ShowDialog($form) -eq 'OK') { $dialog.FileNames }")
    const { stdout } = await dialog(script)

    return lines(stdout)
  },

  async chooseFolder({ prompt }) {
    const script = [
      'Add-Type -AssemblyName System.Windows.Forms',
      '$form = New-Object System.Windows.Forms.Form',
      '$form.TopMost = $true',
      '$form.ShowInTaskbar = $false',
      '$form.WindowState = [System.Windows.Forms.FormWindowState]::Minimized',
      '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
      `$dialog.Description = ${quote(prompt)}`,
      "if ($dialog.ShowDialog() -eq 'OK') { $dialog.SelectedPath }",
    ]
    const { stdout } = await dialog(script)

    const picked = stdout.trim()

    return picked === '' ? null : picked
  },

  async reveal(path) {
    // explorer exits non-zero even on success, so ignore the result.
    await run('explorer', [`/select,${path}`]).catch(() => {})
  },
}

function extensions(kinds: readonly MediaKind[]): string[] {
  return acceptForKinds(kinds)
    .split(',')
    .filter(Boolean)
    .map((ext) => ext.slice(1))
}

function lines(stdout: string): string[] {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

/** Escapes a fixed prompt for a PowerShell single-quoted string. */
function quote(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

async function dialog(script: string[]) {
  return run('powershell', ['-NoProfile', '-STA', '-Command', script.join('\n')], {
    timeout: DIALOG_TIMEOUT,
    killSignal: 'SIGKILL',
  })
}

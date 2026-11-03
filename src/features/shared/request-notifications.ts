import { getPlatform } from '@/lib/platform'

/** Asks once on the first submit, ignoring a platform without notifications. */
export function requestNotifications(): void {
  void getPlatform()
    .then((platform) => {
      return platform.requestNotifications()
    })
    .catch(() => {})
}

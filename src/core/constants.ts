export const MAX_ACTIVE_JOBS = 4

/** Ids accepted in one history ids filter or reference plan. */
export const MAX_IDS = 100
export const MAX_INLINE_MEDIA_MB = 50
export const MAX_REQUEST_MB = 64

/** Space kept for the JSON body and prompt around inline media. */
export const REQUEST_RESERVE_MB = 1

export const POLL_INTERVAL_MS = 8000
export const POLL_PARALLEL = 3
export const MAX_JOB_AGE_MIN = 360
export const MAX_DOWNLOAD_RETRIES = 5

export const HISTORY_PAGE_SIZE = 20
export const HISTORY_MAX_PAGE_SIZE = 50
export const HISTORY_POLL_MS = 4000
export const HISTORY_SCROLL_DELAY_MS = 300
export const HISTORY_BATCH_MAX = 200
export const DOWNLOAD_STAGGER_MS = 300
export const CREDITS_POLL_MS = 60000
export const UPDATE_CHECK_DELAY_MS = 15000
export const UPDATE_CHECK_INTERVAL_MS = 43200000

export const LOW_RES_MIN_PX = 300

export const FLATTEN_BACKGROUND = '#ffffff'
export const FLATTEN_LIGHT = '#1c1e20'
export const FLATTEN_LUMINANCE = 0.6

/** Long side cap for reference images before the per-model limit. */
export const IMAGE_MAX_SIDE_PX = 4096

/** App cap per encoded image, in MB. Model limits can be lower. */
export const IMAGE_MAX_ENCODED_MB = 8

/** One ladder for the whole request: side and JPEG quality per step. */
export const IMAGE_STEPS = [
  { maxSidePx: 4096, jpegQuality: 95 },
  { maxSidePx: 4096, jpegQuality: 90 },
  { maxSidePx: 3072, jpegQuality: 88 },
  { maxSidePx: 2048, jpegQuality: 85 },
  { maxSidePx: 1536, jpegQuality: 80 },
] as const

export const CREDIT_WARN_USD = 2
export const CREDIT_DANGER_USD = 0.5

export const ZOOM_STEPS = 6
export const ZOOM_DEFAULT = 5

export const THUMB_WIDTH = 320
export const PREVIEW_WIDTH = 640
export const PREVIEW_AT_SEC = 0.5

/** Poster widths. Requests round up to the next bucket, capped at the last. */
export const POSTER_WIDTHS = [320, 640, 960, 1280, 1920] as const

/** Thumb cache: 30 days unused, 1 GB cap trimmed to 800 MB. */
export const THUMB_UNUSED_DAYS = 30
export const THUMBS_MAX_BYTES = 1024 ** 3
export const THUMBS_TARGET_BYTES = 800 * 1024 ** 2

/** A cache hit refreshes the file mtime at most once a day. */
export const THUMB_TOUCH_MS = 86_400_000

export const MOCK_QUEUE_MS = 3000
export const MOCK_GENERATE_MS = 6000

export const SEED_MAX = 2147483647

export const UPLOAD_CLEANUP_MS = 3_600_000

/** Raw provider error text kept per failure. */
export const PROVIDER_RAW_MAX_CHARS = 500

export const FETCH_TIMEOUTS = {
  submit: 300_000,
  poll: 30_000,
  content: 600_000,
  meta: 15_000,
} as const

export const FFMPEG_TIMEOUTS = {
  probe: 15_000,
  frame: 30_000,
  compatBase: 30_000,
  compatPerSec: 10_000,
  compatMax: 600_000,
  mock: 60_000,
} as const

export const PRICING_FALLBACK_TTL_MS = 5 * 60_000

export const SUBMIT_GRACE_MS = 10_000
export const SUBMIT_YIELD_MS = 50
export const GRACE_STALE_MS = 60_000
export const SHUTDOWN_SEND_WAIT_MS = 60_000
export const SHUTDOWN_EXIT_DELAY_MS = 100
export const REMOTE_LINK_TTL_SEC = 7200
export const REMOTE_UNUSED_DAYS = 30
export const REMOTE_MOCK_MBPS = 20

/** Cloudflare free R2 storage in GB-month. */
export const REMOTE_FREE_GB = 10

/** Tracked refs/ cap, leaving 2 GB of headroom inside the free tier. */
export const REMOTE_MAX_GB = 8

export const GRID_TILE_ASPECT = '1 / 1'
export const ZOOM_MIN = 0
export const ZOOM_MAX = 5
export const DETAILS_MIN_WIDTH = 240
export const ROW_MIN_HEIGHT = 280

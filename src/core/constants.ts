/** Active video generations. Image uses IMAGE_MAX_ACTIVE. */
export const MAX_ACTIVE_JOBS = 4

/** Active image generations, counted apart from video. */
export const IMAGE_MAX_ACTIVE = 4

/** Records one submit queue runs at once. */
export const SUBMIT_QUEUE_CONCURRENCY = 2

/** Ids accepted in one history ids filter or reference plan. */
export const MAX_IDS = 100
export const MAX_INLINE_MEDIA_MB = 50
export const MAX_REQUEST_MB = 64

/** One JSON request body, checked from the header and while it streams. */
export const MAX_JSON_BODY_BYTES = 1024 * 1024

/** One multipart upload, per file and per request. */
export const MAX_UPLOAD_BYTES = MAX_REQUEST_MB * 1024 * 1024

/** Files accepted in one multipart upload. */
export const MAX_UPLOAD_FILES = 20

/** Largest base64 payload accepted before decode, from the upload byte cap. */
export const MAX_PROVIDER_B64_CHARS = Math.ceil((MAX_UPLOAD_BYTES * 4) / 3)

/** Largest image output accepted per image in one response. */
export const IMAGE_OUTPUT_MAX_BYTES = 48 * 1024 * 1024

/** Space kept for the JSON body and prompt around inline media. */
export const REQUEST_RESERVE_MB = 1

export const POLL_INTERVAL_MS = 8000
export const POLL_PARALLEL = 3
export const MAX_JOB_AGE_MIN = 360
export const MAX_DOWNLOAD_RETRIES = 5

/** Pause before a viewer autoplays the current item, so quick switches load nothing. */
export const AUTOPLAY_DELAY_MS = 500

export const HISTORY_PAGE_SIZE = 20
export const HISTORY_MAX_PAGE_SIZE = 50
export const HISTORY_POLL_MS = 4000

/** Favorite ids kept so a slow poll cannot revert a recent pick. */
export const MAX_FAVORITE_EPOCHS = 1000

/** How long a finished video may keep polling for its poster. */
export const PREVIEW_GRACE_MS = 30_000

/** Slower history tick while the page is hidden. */
export const HIDDEN_POLL_MS = 15_000
export const HISTORY_SCROLL_DELAY_MS = 300
export const HISTORY_BATCH_MAX = 200
export const DOWNLOAD_STAGGER_MS = 300
export const CREDITS_POLL_MS = 60000

/** Follow-up credits refresh after a job finishes, once provider billing settles. */
export const CREDITS_SETTLE_MS = 15_000

/** Fresh credits fetch offsets from the settle moment. Each new settle restarts it. */
export const CREDITS_FOLLOWUP_DELAYS_MS = [0, CREDITS_SETTLE_MS, 45_000, 120_000] as const

/** A settled record older than this no longer triggers a credits refresh. */
export const CREDITS_SETTLE_WINDOW_MS = 120_000

/** Focus or tab-visible refresh only when the last credits fetch is older than this. */
export const CREDITS_FOCUS_STALE_MS = 30_000
export const UPDATE_CHECK_DELAY_MS = 15000
export const UPDATE_CHECK_INTERVAL_MS = 43200000

export const LOW_RES_MIN_PX = 300

/** Decode cap for every user-supplied image, about 50 MP. */
export const MAX_IMAGE_PIXELS = 50_000_000

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

/** Image workspace: count stepper cap, call fan-out, masonry and reference bounds. */
export const IMAGE_COUNT_MAX = 4
export const IMAGE_SUBMIT_PARALLEL = 2
export const IMAGE_GRID_GAP = 4
export const HISTORY_GRID_GAP = 12
export const IMAGE_ROW_MAX_HEIGHT = 640

/** Shortest masonry row. Shorter justified rows crop the tile instead. */
export const IMAGE_ROW_MIN_HEIGHT = 150

/** Tiles shorter than this use compact card actions. */
export const CARD_COMPACT_HEIGHT = 220

export const IMAGE_ROW_OVERSCAN = 2
export const IMAGE_REFERENCE_MAX = 16
export const IMAGE_REFERENCE_MAX_SIDE_PX = 2048
export const IMAGE_REFERENCE_MAX_MB = 5

export const CREDIT_WARN_USD = 2
export const CREDIT_DANGER_USD = 0.5

export const ZOOM_STEPS = 6
export const ZOOM_DEFAULT = 5

export const THUMB_WIDTH = 320

/** Stage backdrop: 96 px wide, blurred on the server so Linux needs no filter. */
export const BLUR_WIDTH = 96
export const BLUR_SIGMA = 8
export const BLUR_SATURATION = 1.5

export const PREVIEW_WIDTH = 640
export const PREVIEW_MAX_WIDTH = 1920
export const PREVIEW_QUALITY = 90
export const PREVIEW_AT_SEC = 0.5

/** Poster widths. Requests round up to the next bucket, capped at the last. */
export const POSTER_WIDTHS = [320, 640, 960, 1280, 1600, 1920] as const

/** Bumped when the thumb encoder changes, so old files regenerate. */
export const THUMB_ENCODER_VERSION = 1

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

export const PRICE_DEBOUNCE_MS = 500
export const PRICING_FALLBACK_TTL_MS = 5 * 60_000
export const PRICING_LIVE_TTL_MS = 3_600_000

/** Model catalog cache lifetime. Settings saves clear it. */
export const MODEL_CATALOG_TTL_MS = 60_000

/** Provider model lists are paginated. More pages than this means the list is incomplete. */
export const MODEL_LIST_MAX_PAGES = 20

/** Longest wait for one custom image job, then the call fails. */
export const CUSTOM_IMAGE_MAX_WAIT_MS = 15 * 60_000

/** Combined reference seconds custom presets advertise. */
export const CUSTOM_REF_TOTAL_SEC = 30

/** Longest duration a custom model may advertise, in seconds. */
export const CUSTOM_DURATION_MAX_SEC = 120

/** Most quick-pick duration options kept from one custom model. */
export const CUSTOM_DURATION_OPTIONS_MAX = 64

/** Largest video download accepted from a custom endpoint. */
export const CUSTOM_VIDEO_DOWNLOAD_MAX_BYTES = 512 * 1024 * 1024

/** Largest video download accepted from OpenRouter. */
export const OPENROUTER_VIDEO_MAX_BYTES = 2 * 1024 ** 3

/** Fresh availability check timeout on Generate. */
export const CUSTOM_CHECK_TIMEOUT_MS = 3_000

/** Days a missing custom model stays in the cache before it is dropped. */
export const CUSTOM_MISSING_KEEP_DAYS = 30

/** A health state older than this is refreshed on the next use. */
export const ENDPOINT_HEALTH_MAX_AGE_MS = 30_000

export const SUBMIT_GRACE_MS = 10_000
export const SUBMIT_YIELD_MS = 50
export const GRACE_STALE_MS = 60_000

/** A live owner with a lock this young may still be booting. */
export const LOCK_BOOT_GRACE_MS = 60_000

/** Sends outlive the submit timeout, so quitting waits for a request that may be billed. */
export const SHUTDOWN_SEND_WAIT_MS = FETCH_TIMEOUTS.submit + 5_000

/**
 * Image calls share one global limiter, so two records each run their own waves.
 * Quitting waits for both records' waves plus room to save.
 */
export const SHUTDOWN_IMAGE_WAIT_MS =
  SUBMIT_QUEUE_CONCURRENCY *
  Math.ceil(IMAGE_COUNT_MAX / IMAGE_SUBMIT_PARALLEL) *
  (FETCH_TIMEOUTS.submit + 5_000)

/** One download may run until the content timeout, plus room to write the result. */
export const SHUTDOWN_DOWNLOAD_WAIT_MS = FETCH_TIMEOUTS.content + 30_000
export const SHUTDOWN_EXIT_DELAY_MS = 100

/** A save-dialog path may overwrite only this long after the dialog returned it. */
export const EXPORT_TOKEN_TTL_MS = 10 * 60_000

export const REMOTE_LINK_TTL_SEC = 7200
export const REMOTE_UNUSED_DAYS = 30

/** Must stay below the 30 day R2 lifecycle rule in docs/user/CLOUDFLARE-R2.md. */
export const REMOTE_REFRESH_DAYS = 25
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

/** Default docked panel width, the video picker size. */
export const DOCKED_PANEL_WIDTH = 560

/** Gap kept between a docked panel and the viewport edges. */
export const DOCKED_PANEL_EDGE_GAP = 16

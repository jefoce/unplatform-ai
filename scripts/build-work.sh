#!/usr/bin/env bash
# Shared work dir, cleanup and job cap for the sidecar build scripts. Source it.

# Fails with the tool tag.
work_fail() {
  printf '[%s] error: %s\n' "$1" "$2" >&2
  exit 1
}

# Kibibytes available on the filesystem that holds a path.
free_kib() {
  local path=$1
  while [[ -n "$path" && ! -d "$path" ]]; do
    path=$(dirname "$path")
  done
  df -Pk "${path:-/}" | awk 'NR == 2 { print $4 }'
}

# Human size from kibibytes.
human_kib() {
  awk -v kib="$1" 'BEGIN {
    if (kib >= 1048576) {
      printf "%.1f GiB", kib / 1048576
    } else {
      printf "%.0f MiB", kib / 1024
    }
  }'
}

# Sets WORK to $UPAI_BUILD_WORK_DIR/<tool>/<name> when set, else fallback.
# Creates a missing root, refuses an unwritable one or one with less room than need_kib.
resolve_work() {
  local tag=$1 tool=$2 name=$3 fallback=$4 need_kib=$5
  local root=${UPAI_BUILD_WORK_DIR:-}

  if [[ -z "$root" ]]; then
    WORK=$fallback
    CLEAN_WORK=0
    return 0
  fi

  local free space
  free=$(free_kib "$root")
  space="$(human_kib "${free:-0}") free, $(human_kib "$need_kib") needed"

  if [[ ! -d "$root" ]]; then
    mkdir -p "$root" 2>/dev/null || work_fail "$tag" "cannot create UPAI_BUILD_WORK_DIR: $root ($space)"
  fi

  [[ -w "$root" ]] || work_fail "$tag" "UPAI_BUILD_WORK_DIR is not writable: $root ($space)"

  printf '[%s] work dir %s (%s)\n' "$tag" "$root" "$space"

  if ((${free:-0} < need_kib)); then
    work_fail "$tag" "not enough space in $root: $(human_kib "$need_kib") needed, $(human_kib "$free") free"
  fi

  WORK="$root/$tool/$name"
  CLEAN_WORK=1
}

# Sets JOBS to the override when set, else min(cores, 4).
build_jobs() {
  local tag=$1 override=${2:-} name=$3

  if [[ -n "$override" ]]; then
    [[ "$override" =~ ^[1-9][0-9]*$ ]] || work_fail "$tag" "$name must be a positive integer: $override"
    JOBS=$override
    return 0
  fi

  JOBS=$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 4)
  if ((JOBS > 4)); then
    JOBS=4
  fi
}

# Removes an external work tree unless keep is 1, and prints the freed size.
# Without UPAI_BUILD_WORK_DIR resolve_work leaves CLEAN_WORK at 0 and this is a no-op.
cleanup_work() {
  local tag=$1 work=$2 keep=${3:-0}

  if [[ "${CLEAN_WORK:-0}" != "1" ]]; then
    return 0
  fi

  if [[ "$keep" == "1" ]]; then
    printf '[%s] keeping work dir %s\n' "$tag" "$work"
    return 0
  fi

  [[ -d "$work" ]] || return 0

  local size
  size=$(du -sh "$work" | cut -f1)
  rm -rf "$work"
  printf '[%s] removed work dir %s (%s freed)\n' "$tag" "$work" "$size"
}

#!/usr/bin/env bash
set -euo pipefail

pnpm typecheck
pnpm lint
pnpm deps
pnpm format:check
pnpm knip
pnpm test
pnpm build
E2E_SKIP_BUILD=1 pnpm e2e

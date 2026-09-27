#!/usr/bin/env bash
# Operational tests: replace sudo with a fail-closed stub. No real Docker or
# Nginx commands are executed, and the production .env is never read or changed.
set -euo pipefail
cd /home/ubuntu/exxplore-kittens
test -f .env
GUARD_LOG=$(mktemp /tmp/kittens-release-guard.XXXXXX)
export GUARD_LOG
trap 'rm -f -- "$GUARD_LOG"' EXIT
sudo() {
    case "$*" in
        '-n docker compose config --quiet')
            printf '%s\n' config >>"$GUARD_LOG"
            return 0 ;;
        '-n docker compose build game-server')
            printf '%s\n' build >>"$GUARD_LOG"
            if [ "$GUARD_SCENARIO" = build-failure ]; then return 72; fi
            return 0 ;;
        "-n ss -Hnt state established ( sport = :3105 )")
            printf '%s\n' connections >>"$GUARD_LOG"
            printf '%s\n' 'ESTAB 0 0 127.0.0.1:3105 127.0.0.1:54321'
            return 0 ;;
        *)
            printf '%s\n' "Unexpected privileged command: $*" >&2
            printf '%s\n' unexpected >>"$GUARD_LOG"
            return 99 ;;
    esac
}
export -f sudo
export GUARD_SCENARIO=connected
set +e
output=$(bash deploy/start-release.sh 2>&1)
status=$?
set -e
test "$status" = 1
printf '%s' "$output" | grep -q 'Release stopped: 1 backend connection'
test "$(cat "$GUARD_LOG")" = "$(printf 'config\nbuild\nconnections')"
printf '%s\n' 'PASS: connected backend blocks replacement after build.'
: >"$GUARD_LOG"
export GUARD_SCENARIO=build-failure
set +e
output=$(bash deploy/start-release.sh 2>&1)
status=$?
set -e
test "$status" = 72
test "$(cat "$GUARD_LOG")" = "$(printf 'config\nbuild')"
printf '%s\n' 'PASS: failed build prevents connection check and replacement.'

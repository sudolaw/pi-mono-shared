#!/usr/bin/env bash
# Replaces each shared project with its committed files on pi_mono's main branch,
# plus its CI workflows. Uncommitted work in pi_mono is never copied.
set -euo pipefail

SOURCE="${PI_MONO:-$HOME/pi_mono}"
REF="${REF:-main}"
PROJECTS=(mcp_multi_player nudge)

cd "$(dirname "$0")"

for p in "${PROJECTS[@]}"; do
  git -C "$SOURCE" cat-file -e "$REF:$p" || { echo "$p not found on $REF in $SOURCE" >&2; exit 1; }
  rm -rf "./$p" .github/workflows/"$p"-*.yml
  workflows=$(git -C "$SOURCE" ls-tree --name-only "$REF" .github/workflows/ | grep "^.github/workflows/$p-" || true)
  # shellcheck disable=SC2086
  git -C "$SOURCE" archive "$REF" "$p" $workflows | tar -x
done

echo "Synced ${PROJECTS[*]} from $SOURCE@$(git -C "$SOURCE" rev-parse --short "$REF")"
git status --short 2>/dev/null || true

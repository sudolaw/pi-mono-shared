#!/usr/bin/env bash
# Replaces each shared project with its committed files on pi_mono's main branch,
# plus its CI workflows. Uncommitted work in pi_mono is never copied.
# --push also commits the result (naming the source commit) and pushes it.
set -euo pipefail

PUSH=false
case "${1:-}" in
  --push) PUSH=true ;;
  "") ;;
  *) echo "usage: $0 [--push]" >&2; exit 2 ;;
esac

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

rev=$(git -C "$SOURCE" rev-parse --short "$REF")
echo "Synced ${PROJECTS[*]} from $SOURCE@$rev"

# Only the synced paths: other local changes stay out of sync commits.
paths=("${PROJECTS[@]}" .github/workflows)
git add -A -- "${paths[@]}"
if git diff --cached --quiet -- "${paths[@]}"; then
  echo "Nothing new."
  exit 0
fi
git status --short -- "${paths[@]}"

if $PUSH; then
  git commit -q -m "Sync from pi_mono $REF at $rev" -- "${paths[@]}"
  git push -q
  echo "Committed and pushed $(git rev-parse --short HEAD)."
fi

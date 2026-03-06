#!/usr/bin/env bash
#
# Pre-commit hook: block commits exceeding MAX_LINES changed lines.

MAX_LINES=500
EXCLUDE_PATTERNS="pnpm-lock.yaml|.*\.md"

total=0
while IFS=$'\t' read -r added deleted file; do
  [[ "$added" == "-" || "$deleted" == "-" ]] && continue
  echo "$file" | grep -qE "(${EXCLUDE_PATTERNS})$" && continue
  total=$((total + added + deleted))
done < <(git diff --cached --numstat)

if [ "$total" -gt "$MAX_LINES" ]; then
  echo ""
  echo -e "\033[1;31m ERROR: Commit too large - $total lines changed (max $MAX_LINES lines).\033[0m"
  echo ""
  echo "  This violates 软件工程 course rules and costs -0.5 per team member."
  echo ""
  echo "  Suggestions:"
  echo "    - Split into smaller and more commits"
  echo "    - Separate refactors from feature work"
  echo "    - Use 'git add -p' to stage partial changes"
  echo ""
  exit 1
fi

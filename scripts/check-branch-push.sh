#!/usr/bin/env bash
#
# Pre-push hook: block pushes to main and validate branch names.

BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null)

# Block direct push to main or master.
if [ "$BRANCH" = "main" ]; then
  echo ""
  echo -e "\033[1;31m ERROR: Direct push to '$BRANCH' is not allowed.\033[0m"
  echo ""
  echo "  This violates 软件工程 course rules and costs -0.5 per team member."
  echo ""
  echo "  Use a feature branch and create a Pull Request (must be linked to an Issue) instead:"
  echo "    git checkout -b feature/my-feature"
  echo "    git push -u origin feature/my-feature"
  echo ""
  exit 1
fi

# Validate branch name format.
BRANCH_REGEX="^(feature|feat|bugfix|fix|hotfix|chore|docs|refactor|test|ci|style|perf)/[a-z0-9][a-z0-9-]*$"

if ! echo "$BRANCH" | grep -qE "$BRANCH_REGEX"; then
  echo ""
  echo -e "\033[1;31m ERROR: Invalid branch name '$BRANCH'.\033[0m"
  echo ""
  echo "  This violates 软件工程 course rules and costs -0.5 per team member."
  echo ""
  echo "  Branch names must match: type/short-description"
  echo ""
  echo "  Valid types: feature, feat, bugfix, fix, hotfix, chore, docs,"
  echo "               refactor, test, ci, style, perf"
  echo ""
  echo "  Examples:"
  echo "    feature/user-login"
  echo "    bugfix/fix-login-error"
  echo "    chore/update-dependencies"
  echo ""
  exit 1
fi

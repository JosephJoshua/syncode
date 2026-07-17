#!/usr/bin/env bash
set -euo pipefail

# Merge unit and integration coverage reports into a single lcov.info

COVERAGE_DIR="coverage"

mkdir -p "$COVERAGE_DIR/merge"
cp "$COVERAGE_DIR/unit/coverage-final.json" "$COVERAGE_DIR/merge/unit.json"
cp "$COVERAGE_DIR/integration/coverage-final.json" "$COVERAGE_DIR/merge/integration.json"

npx nyc merge "$COVERAGE_DIR/merge" "$COVERAGE_DIR/coverage-final.json"
npx nyc report \
  --temp-dir "$COVERAGE_DIR" \
  --report-dir "$COVERAGE_DIR" \
  --reporter text \
  --reporter lcov

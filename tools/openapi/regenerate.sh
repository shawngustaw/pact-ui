#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "$0")/../.." && pwd)"
upstream_sha="e27e1135f7398cd05ac8bbad9698eae15f9c4d0a"
source_dir="${PACT_BROKER_SOURCE:-$(mktemp -d)/pact_broker}"
if [ ! -d "$source_dir/.git" ]; then
  git clone https://github.com/pact-foundation/pact_broker.git "$source_dir"
  git -C "$source_dir" checkout "$upstream_sha"
fi
actual_sha="$(git -C "$source_dir" rev-parse HEAD)"
if [ "$actual_sha" != "$upstream_sha" ]; then
  echo "Expected $upstream_sha, found $actual_sha. Review tooling before upgrading." >&2
  exit 1
fi
capture_file="$(mktemp)"
trap 'rm -f "$capture_file"' EXIT
cd "$source_dir"
cp "$project_root/tools/openapi/upstream.Gemfile.lock" Gemfile.lock
pact_gem_dir="${PACT_BROKER_GEM_PATH:-$source_dir/.bundle/gems}"
bundle config set --local path "$pact_gem_dir"
bundle install
bundle exec ruby -Ilib "$project_root/tools/openapi/extract.rb" "$project_root/openapi/source-inventory.json"
# Pinned upstream has a known approval fixture mismatch. Preserve the exit status;
# do not silently declare the upstream suite green or discard its captured evidence.
set +e
PACT_UI_CAPTURE="$capture_file" bundle exec rspec spec/lib/pact_broker/api/resources spec/features spec/integration --require "$project_root/tools/openapi/capture.rb" --format progress > "$project_root/openapi/upstream-test-results.log" 2>&1
test_status=$?
set -e
cp "$capture_file" "$project_root/openapi/observations.jsonl"
cd "$project_root"
node tools/openapi/sanitize-paths.mjs "$source_dir" "$pact_gem_dir"
node tools/openapi/generate.mjs
npm run api:validate
npm run api:coverage
npm run api:generate
cd "$source_dir"
bundle exec ruby "$project_root/tools/openapi/validate.rb"
echo "Upstream test exit status: $test_status (see openapi/upstream-test-results.log)"
exit "$test_status"

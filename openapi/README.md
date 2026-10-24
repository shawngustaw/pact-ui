# Generated Pact Broker API

Upstream: [pact-foundation/pact_broker](https://github.com/pact-foundation/pact_broker/tree/e27e1135f7398cd05ac8bbad9698eae15f9c4d0a), commit `e27e1135f7398cd05ac8bbad9698eae15f9c4d0a` (gem version 2.122.0).

`pact-broker.yaml` is a standalone OpenAPI 3.1 document. It does not require a modified Broker or a Ruby runtime to use. `source-inventory.json` is runtime route/contract/serializer evidence. `observations.jsonl` contains request-test observations, not production traffic. `coverage.json` separates route coverage from test/schema evidence. `validation.json` records observed-response validation. `UPSTREAM-LICENSE.txt` applies to upstream-derived material. Local filesystem prefixes in captured logs/backtraces are normalized to `<pact-ui>`, `<pact-broker>`, `<bundle>`, and `<home>` before assembly; test statuses and response evidence remain intact.

The specification has exhaustive route/method inventory coverage for the main Webmachine API and the two optional diagnostic routes. It is not a claim that every field and conditional response has a complete proven schema. Inspect `x-uncertainties`, `x-evidence`, and `x-uncertainty`; unconstrained schema locations intentionally generate `unknown` in TypeScript. See [coverage and limitations](../docs/api-coverage.md).

Reassemble from the checked-in source evidence with `npm run api:assemble`. Re-extract from Ruby with `tools/openapi/regenerate.sh`; this needs Ruby 3.2+, Bundler, Git, and network access. The script clones a pinned disposable source checkout by default; point `PACT_BROKER_SOURCE` at an existing disposable checkout to reuse dependencies. It does not alter tracked upstream source. Never point it at an unrelated checkout with valuable generated/test artifacts.

The generated type file `src/lib/api/schema.d.ts` must never be edited manually.

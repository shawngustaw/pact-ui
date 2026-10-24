# Delivery and operating notes

Pact UI is a read-only Next.js application with a same-origin Broker proxy, MIT licensed. It requires one configured OSS Broker and no application database. The generated standalone API spec can be used independently.

## Validation performed locally

- Runtime source introspection, all route/method comparison, OpenAPI syntax/reference validation, and generated TypeScript consistency.
- Upstream Ruby request/resource/integration capture: 1,563 examples, one approval fixture mismatch, one upstream pending example; original results preserved.
- Captured JSON response and successful request-body validation against generated operation schemas; exact counts in `openapi/validation.json`.
- Unit/API/domain/connection/component tests and real disposable OSS Broker integration checks.
- Playwright Chromium desktop and Pixel 7 mobile core workflows, including search/filter/empty states, application detail tabs, interaction inspection, JSON comparison, CI links, unknown/blocked/safe deployment checks, graph filtering, environment records, theme persistence, per-user Basic auth, independent user contexts, runtime URL configuration, memory-only credentials, server write/destination rejection, and a Broker without CORS headers.
- Light and dark desktop/mobile screenshots in `docs/screenshots/`; broader review evidence under `.impeccable/review/`.
- Production Next.js standalone build with strict TypeScript: 71 unit/component/proxy tests and 20 desktop/mobile browser tests pass. Unit tests cover transport, configuration, per-request credential isolation, destination/path validation, redirects, response limits, and error handling. Browser tests run the built production app against a separate authenticated fixture Broker with no CORS headers. Real Ruby Broker integration checks are separate from the browser fixture checks.

## Limitations

The specification enumerates the pinned API surface exhaustively but does not claim every conditional body/status/header is completely inferred. The report documents the unobserved cases and leaves insufficiently proven fields unknown. Test-derived schemas require review when upgrading upstream.

The browser calls the same-origin Next.js proxy. The proxy connects only to the runtime-configured Broker or additional explicitly allowed URLs. Each user enters their own existing Broker credentials; passwords/tokens stay in browser memory and are forwarded per request without persistence or sharing. Reloading requires reentry. The Broker enforces permissions, and the app adds no authentication database. Existing Broker cookies are not forwarded. Broker-side CORS configuration is unnecessary.

Both the browser transport and server proxy only permit reads; the generated client includes the full API for independent consumers. HAL links must stay within the configured Broker origin/base path. The proxy rejects redirects, disables caching, bounds responses to 10 MiB, and uses a 15-second upstream timeout. Authentication challenges and cookies are not relayed to the browser. Deploy the app using HTTPS and control who can reach it through your existing deployment access policy.

The graph is a simple layered layout with a bounded cycle fallback; large or cyclic ecosystems may need manual node positioning and filtering. Matrix-based verification history displays up to 100 rows rather than promising complete history. Structural JSON comparisons are exact data comparisons, not Pact matching-rule semantic equivalence. Message/plugin contract content is also available as full JSON when the HTTP-style inspector is insufficient.

Demo data is explicitly synthetic application data generated through a real pinned Broker. It contains example repository/build URLs. It never stands in for live failures. A demo request outside captured records returns a visible 404.

The original Ruby checkout is disposable; the frontend runtime does not depend on it or any temporary instrumentation. Reproduction tools and dependency lockfile are preserved separately.

## Container verification

The multi-stage Dockerfile produces Next.js standalone output and runs one non-root Node.js process on port 3000. Broker URL configuration is supplied at startup. Compose requires no companion proxy or database. Local smoke verification passed for runtime configuration, UI/assets, authenticated reads with two users, unauthenticated rejection, uncached responses, write/destination rejection, and non-root execution. Compose configuration validated. The smoke container was stopped and removed. No image was pushed and no external deployment was made.

## Real Broker Docker end-to-end verification

The actual UI image was tested against the official Pact Broker 2.121.2 image and PostgreSQL 17, both running in Docker. The Broker image is pinned to `sha256:420341d4fbfb00a621c313f47e530ad75703f969bbc7520d0d72bc71bb53cef9`; PostgreSQL is pinned separately in `tools/testing/compose.real.yaml`.

The seed script publishes two distinct applications, two contract versions, successful and failed verifications, branches, and deployments to production/staging through live HTTP API calls. No response fixtures, Rack mock, or demo data are used. The real Broker rejects unauthenticated reads and preflight with 401, rejects writes by the read-only user, and does not send an Access-Control-Allow-Origin header.

All 8 desktop/mobile end-to-end checks passed. They cover rejected and accepted Basic auth, live application/detail/branch reads, contract interactions and verification build links, dependency graph, deployed environments, safe/blocked can-i-deploy results, memory-only credential reset, independent reader/admin sessions, and proxy write rejection even with admin credentials. Run `npm run test:docker` to build the UI, create the isolated stack, seed it, run Chromium, and remove the test containers/database. Browser screenshots are saved as `docs/screenshots/real-docker-desktop.png` and `real-docker-mobile.png`.

The complete `npm run test:docker` build/start/seed/browser/cleanup run passed. Its test containers, network, and disposable PostgreSQL data were removed afterward. No application fixes were needed.

GitHub Actions includes a separate `docker-broker-e2e` job for this same command on pushes and pull requests, with failure trace uploads and an always-run cleanup step. Hosted execution will be confirmed by the first GitHub run after pushing.

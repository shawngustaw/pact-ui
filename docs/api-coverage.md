# API coverage and known limits

## Source of truth

[Pact Broker commit e27e1135f7398cd05ac8bbad9698eae15f9c4d0a](https://github.com/pact-foundation/pact_broker/tree/e27e1135f7398cd05ac8bbad9698eae15f9c4d0a), gem 2.122.0. The main routes are registered in `lib/pact_broker/api.rb`; diagnostics in `lib/pact_broker/diagnostic/app.rb`. `Webmachine::DescribeRoutes` instantiates resources and exposes per-method validation contracts. The upstream `pact_broker:routes` Rake task was run to cross-check discovery. Its standard output omits OPTIONS, so the extractor also calls each resource's actual `allowed_methods`.

104 public API/diagnostic route templates and 259 operations are represented. This includes deprecated aliases, publication, participants, integrations, branches/versions/tags, verification, environments, deployments/releases, matrix/can-i-deploy, webhooks, metrics, badges, and the upstream error-test route. Non-production Webmachine trace routes and Sinatra HTML/static/documentation pages are excluded; they are not Broker JSON product APIs. Diagnostic routes are deployment-configurable and may return 404 on a particular server.

## Generation approach

1. Clone and pin upstream. Install its Ruby dependencies; preserve the resolved lockfile separately.
2. Migrate a disposable in-memory SQLite database, load the real application, and introspect route objects and allowed methods. Capture source provenance for every operation.
3. Export dry-validation contracts through dry-schema's existing JSON Schema extension. Separate query contracts, wire bodies, unused validators on read methods, and internal transformed validation inputs. Internal `PutPactParamsContract` data is **not** a wire request schema. UUIDs injected by resources are removed from external body schemas.
4. Inspect loaded Roar/Representable field definitions to preserve real serialized names and `_embedded` associations. Undeclared scalar types stay unknown; they are not guessed from their names.
5. Instrument Rack::Test temporarily using `prepend` outside upstream source and run the existing resources, features, and integration suites. Capture request/response JSON, method/path/query/status/media types and selected response headers. Examples contain synthetic upstream test data only.
6. Infer open, optional-property response schemas from actual examples. A test proves the observed representation, not universal field presence. JSON null, absence, arrays, and scalar unions are distinct. Empty collections cannot prove their item shape and keep an explicit uncertainty annotation.
7. Reuse and convert the existing upstream OpenAPI components and its two path definitions (publish contracts and deployed/released versions), replacing OpenAPI 3.0 nullable conventions with JSON Schema unions.
8. Assemble standalone OpenAPI 3.1 YAML; validate syntax, references, route/method equality, unique operation IDs, captured bodies, and generated TypeScript.

No Rails-specific generation library is used. See [primary-source research](research/openapi-generation-options.md) for the evaluated tools. The source extractor and response instrumentation are preserved under `tools/openapi/`; no temporary annotation needs to remain in a running Broker.

## What coverage means

`openapi/coverage.json` is the machine-readable per-operation report and exact observed status list. `npm run api:coverage` fails if a path/method is missing or an unexpected operation is introduced. The initial clean run captured 1,063 HTTP observations, exercising 140 operations, with successful responses for 136. OPTIONS accounts for 102 operations; the upstream introspector normally suppresses it, and most OPTIONS routes have no request-test sample.

`openapi/validation.json` validates captured JSON bodies against the assembled operation schemas. This checks schema assembly, reference resolution, nullability, and reused upstream schema compatibility. Example-derived schema validation is not independent proof of every runtime response. Dry-validation schemas and reviewed upstream OAS provide stronger evidence where available.

The upstream run completed 1,563 examples with one failure and one existing pending example. The failure is an approval comparison in `get_provider_pacts_for_verification_spec.rb`: encoded metadata URLs contain a different internal consumer-version ID (8 instead of 10) from the approved fixture. The pending deletion-of-branch example is already marked pending upstream. See `openapi/upstream-test-results.log`. No fixture was changed to hide that failure.

## Deliberate uncertainties

- Full route inventory coverage is not complete body-schema inference. Unobserved responses use a `default` response with an unconstrained schema and explicit explanation, rather than an invented 200/201/status/body. `x-uncertainties` names gaps per operation.
- Response fields stay optional unless established by the reused reviewed upstream schemas. Observed values determine unions. Additional properties remain allowed. Generated `unknown` is intentional where proof is missing; do not replace it with `any` or an invented type.
- Roar declarations establish names and embedding, but not scalar types or presence. Custom `to_hash`, nested serializer blocks, data-dependent rendering, and conditional media representations can escape declaration introspection. Operation-specific observed schemas remain the primary response evidence.
- Ruby validation rules involving domain data, URL/body equality, conditional requirements, and custom macros are not fully expressible in exported structural JSON Schema. `x-source` links the implementation locations. Internal validators must be mapped to wire inputs, not copied blindly.
- Query keys come from runtime query contracts, resource source, and actual request tests. Matrix selectors use Rack's bracket notation, including repeated `q[][pacticipant]` and `q[][version]` keys. Those wire names are preserved; the nonstandard pairing semantics are not fully modeled as OpenAPI arrays. No universal nested-query serializer is supplied for arbitrary typed calls; use an explicit URLSearchParams query and the HAL loader when needed.
- `Accept` chooses a response media type and `Content-Type` is described through request bodies. Authentication headers are represented by security schemes. Additional Webmachine conditional request/header behavior is not fully inferred. Response headers are captured where exercised; unobserved header/status combinations remain a gap.
- Authentication is deployment-configured: anonymous, HTTP Basic, or Bearer are documented as alternatives. Custom reverse-proxy or middleware auth policies are outside the Ruby resource contract.
- Pagination is generally opt-in. Collection clients explicitly request/follow pages and HAL next links; the generator preserves page/size and pageNumber/pageSize where contracts declare them. Not all endpoints paginate; the matrix supports a limit rather than HAL paging. The UI shows up to 100 matrix rows per relationship and says so.
- Upstream route matching is ordered. OpenAPI's unordered path model reports three genuine ambiguities, e.g. `pacticipants/label/{label_name}` versus `pacticipants/{pacticipant_name}/branches`. These lint warnings are preserved; renaming paths would misrepresent the real API.
- HAL links can be strings, objects, arrays, or templated relationships as defined by actual representations. Helpers only follow concrete links and reject off-Broker origins/base paths. Automatic RFC 6570 expansion is not implemented; callers supply explicit path/query values for templated endpoints.
- Pact specification extensions, plugin transports, binary content, and interaction-level test failures are not assumed to share one universal structure. The contract viewer supports HTTP interactions and message contents; full JSON remains available for extensions. CI links are shown only if the Broker reports them.

## Upgrade process

Review the upstream commit and Ruby dependency lock, update the pin intentionally, rerun extraction/tests, diff the route inventory, inspect every new uncertainty, validate captured responses, regenerate TypeScript, then run real-Broker and UI tests. Commit the independent YAML, evidence, reports, generated types, and updated documentation together. The frontend needs none of the Ruby tooling at runtime.

## Evidence strength and request-schema checks

Resource-unit captures can stub service and validation results; a successful unit HTTP status does not prove the request is accepted by a real Broker. All captures retain their originating test path. Only feature/integration captures infer wire JSON shapes or participate in the body-schema validation gate. Unit captures remain useful for route exercise and status inventories. Shared examples whose original suite is not unambiguously classified are also excluded from wire-shape inference.

The final validation gate checks **629 response bodies and 245 successful request bodies**, with zero failures. Custom `validate_with_contract` and `validate_each_with_contract` declarations enrich nested structures from the actual Ruby child contracts, including webhook request objects, pacticipant names, and event-name enums. The dry-schema exporter alone incorrectly narrows some `maybe(min_size?: 1)` values to null; the custom-rule traversal corrects these from source evidence. Ruby date coercion accepts more wire string formats than JSON Schema's strict `date`, so these fields retain string typing with an explicit uncertainty annotation instead of an inaccurate restrictive format.

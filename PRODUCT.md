# Pact UI

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js App Router, strict TypeScript, Tailwind, shadcn/ui primitives, TanStack Query, React Flow, and Zod. Single-container deployment using Next.js standalone output.

## Users

Developers inspecting contracts and deciding whether application versions can deploy safely.

## Product Purpose

A free, open-source interface to an existing self-hosted OSS Pact Broker. No Broker changes or additional database.

## Capabilities and Constraints

Read-only frontend. Same-origin server proxy using each user’s existing Broker authentication. Configurable runtime Broker URL and optional additional allowed URLs, with local browser preferences. Entered credentials stay in browser memory and are forwarded per request without server persistence. Generated API specification and client precede UI implementation. Only expose information supported by the OSS Broker. Unknown compatibility is distinct from incompatibility. Demo responses must be explicitly labeled.

## Brand Commitments

User requested premium developer-tool clarity inspired by Linear, Vercel, and Datadog: readable density, fast filters, dark/light modes, restrained colors, no decorative charts or gradients.

## Evidence on Hand

Pinned upstream source, live route inventory, dry-validation contracts, and captured Rack::Test responses in openapi/. No user Broker credentials provided.

## Product Principles

- Keep provenance and uncertainty visible.
- Follow HAL relationships and pagination.
- Make contracts and deployment blockers easy to inspect.
- Reuse existing Broker authentication; never persist entered passwords or tokens.

## Accessibility & Inclusion

Keyboard-friendly navigation, labeled controls, focus indicators, reduced-motion support, responsive layouts.

# Project context

Inspected 2026-09-29 at commit `c12f36f`. This is a static source review, not a runtime certification or an exhaustive security audit. Tests and live integrations were not executed during this review.

## Product and architecture

HubbyGlobal (Hubby) is a multi-tenant commerce management platform focused on multi-store operations, with English/Arabic interfaces and Gulf-market workflows. It is a monorepo containing a Laravel API, Next.js web application, Flutter mobile application, deployment configuration, and detailed feature specifications.

| Area | Implementation and entry points |
| --- | --- |
| API | Laravel 12, Sanctum, MySQL, Redis/Horizon; `backend/routes/api.php`, `backend/app/Http/Controllers`, `backend/app/Services` |
| Web | Next.js 16.2.4, React 19.2.4, Tailwind 4, Axios, Zustand; `frontend/src/app`, `frontend/src/components` |
| Mobile | Flutter/Dart, Bloc/Cubit, Dio, GoRouter, SQLite scan outbox; `mobile/lib/core`, `mobile/lib/features` |
| Domain storage | Eloquent models and migrations under `backend/app/Models` and `backend/database/migrations` |
| Async work | `backend/app/Jobs`; recurring schedules in `backend/routes/console.php` |
| Infrastructure | Docker Compose, nginx, GitHub Actions, aaPanel reverse proxy; root deployment guides |

The web application separates public landing, authentication, onboarding, and dashboard routes. The landing page uses React Three Fiber, Three.js, GSAP, and Lenis. Dashboard translations live in `frontend/src/i18n`; landing translations are separate. Mobile translations live in `mobile/lib/l10n/strings.dart`.

## Authentication and tenant boundaries

Both clients send a Sanctum bearer token and `X-Organization-Id`. Web request interception is in `frontend/src/lib/api.ts`, with persisted session state in `frontend/src/store/auth.ts`. Mobile request interception is in `mobile/lib/core/network/api_client.dart`.

`EnsureOrganizationMember` verifies that the authenticated user belongs to the requested organization. This does not automatically scope every model query: controllers, services, and queue jobs must preserve tenant constraints. Profit endpoints have an additional `cost.access` middleware group. Do not assume that authenticated organization membership alone makes an arbitrary ID/SKU lookup safe.

## Main data flows

- Platform adapters are selected by `IntegrationFactory`: Shopify, Salla, WooCommerce, Zid, Amazon, Noon, and Trendyol. Adapter existence does not establish equal capability or live certification.
- `SyncOrdersJob` fetches and maps platform orders, upserts by store plus external order ID, updates line items, captures addresses, and queues profit calculation and automation evaluation. Webhooks can request a single external order.
- `SyncInventoryJob` pulls stock; `PushInventoryJob` propagates variant stock to connected stores in the variant's organization. Manual adjustments dispatch the push job. See the outstanding isolation and master-store issues below.
- Profit services resolve costs, consume FIFO layers, account for fees/VAT, and persist order/line profit rollups. Reporting reads these rollups instead of calculating everything on demand.
- Automation has rule evaluation, run/application records, inline mutations, deferred notifications/webhooks, and local order splitting.
- Returns and shipping have explicit lifecycle services/state machines. Shipping includes carrier adapters, labels, tracking, packing slips, manifests, and pickups; capabilities vary by adapter.
- Warehouse workflows include barcode lookup, receiving, picking, packing, and cycle counts. Mobile scans use a SQLite outbox with UUIDs for replay and organization-associated queue entries.

## Implemented scope versus roadmap

The code extends substantially beyond the root README: profit, automation, returns, shipping, COD, invoices, and warehouse functionality all have backend implementations and tests. Web pages exist for the financial and fulfillment areas. Mobile includes core commerce, profit, and warehouse screens; full web/mobile feature parity should not be assumed.

Invoicing is explicitly Milestone 0. Invoice issuance and credit notes exist, but this must not be described as completed ZATCA clearance/reporting integration. WhatsApp has a roadmap specification; no implementation was identified in the application file inventory inspected.

`docs/specs/README.md` is historical context rather than a current defect tracker. Several listed blockers have since been addressed: store-scoped order upserts, line identity/name handling, webhook job arguments, inventory push dispatch, organization-scoped SKU uniqueness, encrypted integration tokens, order-date analytics, and Amazon signing code. Their presence in source does not prove every edge case or external integration works.

Recent commits focus on warehouse backend workflows and mobile lookup/receive/pick/pack/count screens.

## Findings to prioritize

1. **Inventory tenant isolation:** `backend/app/Jobs/SyncInventoryJob.php:60` selects the first variant matching a SKU without an organization filter. `ProductVariant` has no tenant global scope, while the SKU migration permits duplicates across organizations. A sync can therefore modify another organization's stock and, for a master source, queue propagation using that variant's organization.
2. **Inventory source authority:** the same job fans out over all stores and updates central stock before checking `is_master`. The master flag only gates the outgoing push. Non-master stores can overwrite central quantities.
3. **Inventory adapter coverage:** that pull job explicitly supports only Shopify and Salla, despite the shared integration factory supporting seven platforms. Other scheduled store pulls reach the unsupported-platform branch.
4. **Verification imbalance:** the inspected tree contains 55 backend `*Test.php` files, one frontend test file, and four mobile test files. CI makes frontend unit tests non-blocking and has no mobile job. File counts are not coverage measurements.
5. **Documentation drift:** the mobile README is a scaffold, the root README understates scope, and historical spec comments may predate later implementations. Prefer current code and focused tests when planning changes.

These findings are based on source inspection; no reproduction test or fix was added in this context-building pass.

## Development and verification conventions

- Development stack: `docker compose -f docker/docker-compose.yml up -d`; use `http://localhost:8000` for the single-origin app. Frontend direct port is 3000; development MySQL host port is 3307.
- The root `docker-compose.yml` is production, bound to `127.0.0.1:8001` behind the host reverse proxy. Do not confuse the two stacks.
- Web API defaults to relative `/api`; `frontend/next.config.ts` controls proxy rewrites through `API_PROXY_DESTINATION`.
- Mobile defaults to the production API. Use an explicit `--dart-define=API_URL=...` for local testing; Android emulator example: `http://10.0.2.2:8000/api`.
- Backend: `php artisan test` in `backend` or its configured container. `phpunit.xml` specifies SQLite in-memory and synchronous queues; this does not replace MySQL/Redis integration verification.
- Frontend: `npm run lint`, `npm run test`, `npm run build` in `frontend`.
- Mobile: `flutter analyze` and `flutter test` in `mobile` when the SDK is available.
- CI checks lint/build and backend tests, then deploys successful pushes to `main` over SSH using `deploy.sh`.
- Before editing frontend code, obey `frontend/AGENTS.md`: read the relevant bundled Next.js guide in `node_modules/next/dist/docs/` because this version has changed conventions.

Useful references: `README.md`, `DEPLOYMENT.md`, `CICD.md`, `SMOKE_TEST.md`, `docs/COMPETITIVE_STRATEGY.md`, and `docs/specs/`. Recheck this note against the current code after subsequent changes.

# Operations expansion — implementation status

Updated 2026-09-29. These changes are local and have not been pushed or deployed.

## Available workflows

- **Operations dashboard:** actionable fulfillment, held-order, delivery-exception, overdue COD, return and low-stock queues; store filtering; links to records; integration health and recent sync jobs; protected profit summaries from the existing reporting service.
- **Search and order workspaces:** organization-scoped order/product/tracking search; saved order filters in this browser, scoped to user and organization; bulk creation of pick lists.
- **Warehouse:** receiving, picking, stock-count and packing screens connected to existing APIs. Barcode entry supports scanner keyboards. Retry-safe scan request IDs prevent accidental repeat application. This is a web workflow, not a new Flutter camera-scanning implementation.
- **Purchasing:** suppliers and lead times, draft purchase orders, local ordered status, partial receipts, stock increments and FIFO cost layers. Receipt IDs prevent duplicate application. Purchases use the organization's base currency. Marking a PO ordered does not contact a supplier. Do not receive the same delivery again through warehouse receiving.
- **Replenishment:** suggestions based on 30-day sales velocity, supplier lead time, stock on hand and open purchase quantities. No seasonal forecasting yet.
- **COD statements:** preview and apply CSVs with `awb,currency,amount`. Amount is gross COD remittance before carrier fees. Only exact matches are applied; discrepancies, ambiguous references and currency mismatches remain unresolved for review. Imports and applications are repeat-safe. This is not payment-gateway payout reconciliation.
- **Customer portal:** revocable 30-day private links, shipment tracking and return/exchange requests for delivered orders within 30 days. Requests enter staff review; they do not automatically refund or create replacement orders. Links must be shared manually.
- **Catalog quality:** missing core product data and channel mapping issues, including duplicate external IDs and disabled mappings. Checks do not guarantee marketplace acceptance and do not create or publish listings.
- **Channel safety stock:** per-channel fixed units withheld per SKU on subsequent stock pushes. A master store must be configured; its quantity is not reduced. Disabled mappings are respected. Product sync from downstream stores preserves existing central stock when a master exists, avoiding repeated buffer deductions.
- **Sync hardening:** queued order/product syncs are deduplicated; inventory reads are scoped to the organization and authoritative store; pushes refresh current stock and log outcomes. The store sync button queues products/orders; it is not a dedicated retry of failed inventory pushes.
- **Responsive shell:** mobile navigation drawer and compact header. New operational screens include English/Arabic text.

## Remaining scope and decisions

- Automatic reservations and bundle/component stock consumption require the stock-ownership decision: should Hubby own physical stock and deduct fulfillment, or should the master store remain authoritative? These mutations are not implemented yet.
- WhatsApp provider selection and live messaging are deferred at the user's request.
- Full marketplace listing creation/publishing, seasonal forecasts, courier statement API ingestion, payment payout matching, configurable portal policies and deeper warehouse exception workflows remain future work.
- Saved views are browser-local. Purchasing does not yet provide PO cancellation or supplier editing. FIFO cost layers do not switch an existing SKU's configured costing method automatically.

## Deployment requirements

Use the normal application deployment process and back up the database before migration. The backend requires PHP 8.3 or later. Run `php artisan migrate --force` in the intended backend environment and restart queue workers after deploying code.

Four new migrations create COD statements, purchasing tables, customer portals and the store safety-stock column. Only an isolated temporary SQLite preview database has been migrated during development; the configured MySQL database has not been changed.

Customer-facing links require the frontend and API to be publicly reachable over the deployment's normal HTTPS setup. Run the existing queue workers and scheduler for asynchronous channel syncs. No provider credentials or external carrier/store writes were used in the new tests.

## Validation

- Backend full suite: 320 tests, 1,045 assertions passed. An additional catalog-quality isolation/conflict test then passed separately (1 test, 8 assertions).
- Frontend: all 6 tests passed; production build and TypeScript completed successfully.
- PHP formatting passed. Earlier targeted frontend lint had no errors and 14 hook-related warnings; these are not reported as a clean lint run.
- Earlier local browser checks covered login, queues, search, purchasing and mobile layout using disposable fixture data. Further visual/RTL verification was blocked when the browser policy rejected reconnecting to the preview; no additional visual pass is claimed.

These results verify local behavior, not live marketplace compatibility or production deployment.

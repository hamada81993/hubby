<?php

use App\Http\Controllers\AddressController;
use App\Http\Controllers\AdSpendController;
use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\AutomationController;
use App\Http\Controllers\BillingController;
use App\Http\Controllers\CarrierAccountController;
use App\Http\Controllers\CarrierController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\CodController;
use App\Http\Controllers\CodStatementController;
use App\Http\Controllers\CountController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\CustomerPortalController;
use App\Http\Controllers\ExpenseController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\ListingQualityController;
use App\Http\Controllers\ManifestController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\OAuthController;
use App\Http\Controllers\OperationsController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\OrganizationController;
use App\Http\Controllers\PickPackController;
use App\Http\Controllers\PickupController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ProfitController;
use App\Http\Controllers\PurchasingController;
use App\Http\Controllers\ReceiptController;
use App\Http\Controllers\ReturnController;
use App\Http\Controllers\ReturnReasonController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\ShipmentBatchController;
use App\Http\Controllers\ShipmentController;
use App\Http\Controllers\StoreController;
use App\Http\Controllers\WarehouseController;
use App\Http\Controllers\WebhookController;
use App\Http\Middleware\VerifyWebhookSignature;
use Illuminate\Support\Facades\Route;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/password/forgot', [AuthController::class, 'forgotPassword']);
Route::post('/password/reset', [AuthController::class, 'resetPassword']);
Route::get('/customer-portal/{token}', [CustomerPortalController::class, 'show'])->middleware('throttle:60,1');
Route::post('/customer-portal/{token}/returns', [CustomerPortalController::class, 'requestReturn'])->middleware('throttle:10,1');

// Pricing is public so the landing/pricing page can list plans without auth.
Route::get('/billing/plans', [BillingController::class, 'plans']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/email/resend', [AuthController::class, 'resendVerificationEmail']);

    // Account settings (no org membership required)
    Route::put('/profile', [SettingsController::class, 'updateProfile']);
    Route::put('/password', [SettingsController::class, 'changePassword']);
    Route::get('/notification-preferences', [SettingsController::class, 'getNotificationPreferences']);
    Route::put('/notification-preferences', [SettingsController::class, 'updateNotificationPreferences']);

    Route::middleware('org.member')->group(function () {
        // Organization settings
        Route::put('/organization', [SettingsController::class, 'updateOrganization']);

        // Organization members & roles
        Route::get('/organization/members', [OrganizationController::class, 'members']);
        Route::put('/organization/members/{userId}', [OrganizationController::class, 'updateMemberRole']);

        // OAuth
        Route::get('/oauth/{platform}/redirect', [OAuthController::class, 'redirect']);

        // Stores
        Route::get('/stores', [StoreController::class, 'index']);
        Route::get('/stores/connect-options', [StoreController::class, 'connectOptions']);
        Route::post('/stores/connect', [StoreController::class, 'connect']);
        Route::post('/stores/sync-all', [StoreController::class, 'syncAll']);
        Route::post('/stores/{id}/set-master', [StoreController::class, 'setMaster']);
        Route::put('/stores/{id}/safety-stock', [StoreController::class, 'safetyStock']);
        Route::post('/stores/{id}/sync', [StoreController::class, 'sync']);
        Route::delete('/stores/{id}', [StoreController::class, 'destroy']);

        // Orders
        Route::post('/orders/{id}/portal', [CustomerPortalController::class, 'issue']);
        Route::get('/orders', [OrderController::class, 'index']);
        Route::get('/orders/export', [OrderController::class, 'export']);
        Route::get('/orders/{id}', [OrderController::class, 'show']);
        Route::put('/orders/{id}', [OrderController::class, 'update']);

        // Customers
        Route::get('/customers', [CustomerController::class, 'index']);
        Route::get('/customers/{email}', [CustomerController::class, 'show']);

        // Products
        Route::get('/listing-quality', [ListingQualityController::class, 'index']);
        Route::get('/products', [ProductController::class, 'index']);
        Route::post('/products', [ProductController::class, 'store']);
        Route::get('/products/{id}', [ProductController::class, 'show']);
        Route::put('/products/{id}', [ProductController::class, 'update']);
        Route::delete('/products/{id}', [ProductController::class, 'destroy']);
        Route::post('/products/sync', [ProductController::class, 'sync']);
        Route::post('/products/upload', [ProductController::class, 'uploadImage']);
        Route::post('/platform-products/{id}/toggle-sync', [ProductController::class, 'togglePlatformSync']);

        // Inventory
        Route::get('/inventory', [InventoryController::class, 'index']);
        Route::post('/inventory/adjust', [InventoryController::class, 'adjust']);
        Route::get('/inventory/logs', [InventoryController::class, 'logs']);

        // Analytics
        Route::get('/operations', [OperationsController::class, 'summary']);
        Route::get('/operations/queues/{kind}', [OperationsController::class, 'queue']);
        Route::get('/operations/health', [OperationsController::class, 'health']);
        Route::get('/search', [OperationsController::class, 'search']);
        Route::get('/analytics/dashboard', [AnalyticsController::class, 'dashboard']);
        Route::get('/analytics/orders-timeline', [AnalyticsController::class, 'ordersTimeline']);
        Route::get('/analytics/top-customers', [AnalyticsController::class, 'topCustomers']);
        Route::get('/analytics/by-platform', [AnalyticsController::class, 'byPlatform']);
        Route::get('/analytics/top-products', [AnalyticsController::class, 'topProducts']);

        // Profit reporting — reads the materialized rollups; nothing recomputes on request.
        // Cost/margin data is gated by role (spec 01 §9): a viewer-level teammate can work orders
        // without seeing what the business makes. Static segments stay above any /{id} route so they
        // can't be captured as an id.
        Route::middleware('cost.access')->group(function () {
            Route::get('/suppliers', [PurchasingController::class, 'suppliers']);
            Route::post('/suppliers', [PurchasingController::class, 'supplier']);
            Route::get('/purchase-orders', [PurchasingController::class, 'index']);
            Route::post('/purchase-orders', [PurchasingController::class, 'store']);
            Route::post('/purchase-orders/{id}/submit', [PurchasingController::class, 'submit']);
            Route::post('/purchase-orders/{id}/receive', [PurchasingController::class, 'receive']);
            Route::get('/replenishment', [PurchasingController::class, 'replenishment']);
            Route::get('/analytics/profit/timeline', [ProfitController::class, 'timeline']);
            Route::get('/analytics/profit/by-sku', [ProfitController::class, 'bySku']);
            Route::get('/analytics/profit/by-channel', [ProfitController::class, 'byChannel']);
            Route::get('/analytics/profit/coverage', [ProfitController::class, 'coverage']);
            Route::get('/analytics/profit', [ProfitController::class, 'summary']);
            Route::get('/orders/{id}/profit', [ProfitController::class, 'order']);

            // Operating-cost inputs that feed the P&L: business expenses + advertising spend.
            Route::get('/expenses', [ExpenseController::class, 'index']);
            Route::post('/expenses', [ExpenseController::class, 'store']);
            Route::put('/expenses/{id}', [ExpenseController::class, 'update']);
            Route::delete('/expenses/{id}', [ExpenseController::class, 'destroy']);

            Route::get('/ad-spend', [AdSpendController::class, 'index']);
            Route::post('/ad-spend', [AdSpendController::class, 'store']);
            Route::post('/ad-spend/import', [AdSpendController::class, 'import']);
            Route::delete('/ad-spend/{id}', [AdSpendController::class, 'destroy']);
        });

        // Automation rules engine (spec 02) — org-scoped but ungated in every plan.
        Route::get('/automation/schema', [AutomationController::class, 'schema']);
        Route::get('/automation/templates', [AutomationController::class, 'templates']);
        Route::get('/automation/rules', [AutomationController::class, 'index']);
        Route::post('/automation/rules', [AutomationController::class, 'store']);
        Route::post('/automation/rules/simulate', [AutomationController::class, 'simulate']);
        Route::get('/automation/runs', [AutomationController::class, 'runs']);
        Route::get('/automation/rules/{id}', [AutomationController::class, 'show']);
        Route::put('/automation/rules/{id}', [AutomationController::class, 'update']);
        Route::post('/automation/rules/{id}/toggle', [AutomationController::class, 'toggle']);
        Route::delete('/automation/rules/{id}', [AutomationController::class, 'destroy']);

        // Returns / RMA (spec 03)
        Route::get('/return-reasons', [ReturnReasonController::class, 'index']);
        Route::get('/returns', [ReturnController::class, 'index']);
        Route::post('/returns', [ReturnController::class, 'store']);
        // Static segment before /{id} so it isn't captured as an id.
        Route::get('/returns/analytics', [ReturnController::class, 'analytics']);
        Route::get('/returns/{id}', [ReturnController::class, 'show']);
        Route::post('/returns/{id}/refund', [ReturnController::class, 'refund']);
        Route::post('/returns/{id}/approve', [ReturnController::class, 'approve']);
        Route::post('/returns/{id}/reject', [ReturnController::class, 'reject']);
        Route::post('/returns/{id}/ship', [ReturnController::class, 'ship']);
        Route::post('/returns/{id}/receive', [ReturnController::class, 'receive']);
        Route::post('/returns/{id}/inspect', [ReturnController::class, 'inspect']);

        // Shipping (spec 04) — carrier accounts + shipment lifecycle over the shipment engine.
        Route::get('/shipping/carriers', [CarrierController::class, 'catalog']);
        Route::get('/shipping/accounts', [CarrierAccountController::class, 'index']);
        Route::post('/shipping/accounts', [CarrierAccountController::class, 'store']);
        Route::put('/shipping/accounts/{id}', [CarrierAccountController::class, 'update']);
        Route::delete('/shipping/accounts/{id}', [CarrierAccountController::class, 'destroy']);
        Route::post('/shipping/accounts/{id}/validate', [CarrierAccountController::class, 'validateCredentials']);

        Route::get('/shipments', [ShipmentController::class, 'index']);
        Route::post('/shipments', [ShipmentController::class, 'store']);
        Route::get('/shipments/{id}', [ShipmentController::class, 'show']);
        Route::delete('/shipments/{id}', [ShipmentController::class, 'destroy']);
        Route::post('/shipments/{id}/rates', [ShipmentController::class, 'rates']);
        Route::post('/shipments/{id}/label', [ShipmentController::class, 'purchaseLabel']);
        Route::get('/shipments/{id}/label', [ShipmentController::class, 'downloadLabel']);
        Route::get('/shipments/{id}/packing-slip', [ShipmentController::class, 'packingSlip']);
        Route::post('/shipments/{id}/cancel', [ShipmentController::class, 'cancel']);
        Route::get('/shipments/{id}/tracking', [ShipmentController::class, 'tracking']);
        Route::post('/shipments/{id}/tracking-events', [ShipmentController::class, 'addManualEvent']);
        Route::post('/orders/{id}/shipments', [ShipmentController::class, 'storeForOrder']);
        Route::post('/addresses/validate', [AddressController::class, 'validateAddress']);

        // Manifests + pickups (spec 04 §4.10)
        Route::get('/manifests', [ManifestController::class, 'index']);
        Route::post('/manifests', [ManifestController::class, 'store']);
        Route::get('/manifests/{id}', [ManifestController::class, 'show']);
        Route::get('/manifests/{id}/document', [ManifestController::class, 'document']);
        Route::post('/shipments/packing-slips/batch', [ShipmentBatchController::class, 'packingSlips']);
        Route::get('/pickups', [PickupController::class, 'index']);
        Route::post('/pickups', [PickupController::class, 'store']);
        Route::delete('/pickups/{id}', [PickupController::class, 'destroy']);

        // COD reconciliation (spec 06)
        Route::get('/cod/statements', [CodStatementController::class, 'index']);
        Route::post('/cod/statements', [CodStatementController::class, 'preview']);
        Route::post('/cod/statements/{id}/apply', [CodStatementController::class, 'apply']);
        Route::get('/cod/summary', [CodController::class, 'summary']);
        Route::get('/cod/transactions', [CodController::class, 'index']);
        Route::post('/cod/transactions/{id}/collected', [CodController::class, 'markCollected']);
        Route::post('/cod/transactions/{id}/remitted', [CodController::class, 'markRemitted']);

        // Warehouse scanning (spec 08 slice 1: setup + barcode resolution + lookup scan).
        Route::get('/warehouses', [WarehouseController::class, 'index']);
        Route::post('/warehouses', [WarehouseController::class, 'storeWarehouse']);
        Route::get('/warehouses/{id}/locations', [WarehouseController::class, 'locations']);
        Route::post('/warehouses/{id}/locations', [WarehouseController::class, 'storeLocation']);
        Route::get('/barcodes', [WarehouseController::class, 'barcodes']);
        Route::post('/barcodes', [WarehouseController::class, 'storeBarcode']);
        Route::delete('/barcodes/{id}', [WarehouseController::class, 'destroyBarcode']);
        Route::post('/scan', [WarehouseController::class, 'scan']);
        // Receiving (spec 08 §4.3) — stock moves on complete, never per scan.
        Route::get('/receipts', [ReceiptController::class, 'index']);
        Route::post('/receipts', [ReceiptController::class, 'store']);
        Route::get('/receipts/{id}', [ReceiptController::class, 'show']);
        Route::post('/receipts/{id}/scan', [ReceiptController::class, 'scan']);
        Route::post('/receipts/{id}/complete', [ReceiptController::class, 'complete']);
        Route::post('/receipts/{id}/cancel', [ReceiptController::class, 'cancel']);

        // Pick + pack (spec 08 §4.1/§4.2). Picking never moves stock; packing verifies by barcode.
        Route::get('/pick-lists', [PickPackController::class, 'index']);
        Route::post('/pick-lists', [PickPackController::class, 'store']);
        Route::get('/pick-lists/{id}', [PickPackController::class, 'show']);
        Route::post('/pick-lists/{id}/start', [PickPackController::class, 'start']);
        Route::post('/pick-lists/{id}/pick', [PickPackController::class, 'pick']);
        Route::post('/pick-lists/{id}/items/{itemId}/short', [PickPackController::class, 'short']);
        Route::post('/pick-lists/{id}/complete', [PickPackController::class, 'complete']);
        Route::post('/pick-lists/{id}/cancel', [PickPackController::class, 'cancel']);

        Route::post('/pack-sessions', [PickPackController::class, 'openPack']);
        Route::get('/pack-sessions/{id}', [PickPackController::class, 'showPack']);
        Route::post('/pack-sessions/{id}/scan', [PickPackController::class, 'packScan']);
        Route::post('/pack-sessions/{id}/complete', [PickPackController::class, 'completePack']);
        Route::post('/pack-sessions/{id}/void', [PickPackController::class, 'voidPack']);

        // Cycle counting (spec 08 §4.4). Approval is the only stock-mutating path and is owner/admin.
        Route::get('/count-sessions', [CountController::class, 'index']);
        Route::post('/count-sessions', [CountController::class, 'store']);
        Route::get('/count-sessions/{id}', [CountController::class, 'show']);
        Route::post('/count-sessions/{id}/count', [CountController::class, 'count']);
        Route::post('/count-sessions/{id}/submit', [CountController::class, 'submit']);
        Route::post('/count-sessions/{id}/approve', [CountController::class, 'approve']);
        Route::post('/count-sessions/{id}/reject', [CountController::class, 'reject']);
        Route::get('/scan-events', [WarehouseController::class, 'scanEvents']);

        // Invoicing / VAT (spec 05 Milestone 0 — proper VAT documents, not yet ZATCA-cleared).
        // Note there is no delete route for an issued invoice: cancellation is a credit note only.
        Route::get('/tax-registration', [InvoiceController::class, 'taxRegistration']);
        Route::put('/tax-registration', [InvoiceController::class, 'saveTaxRegistration']);
        Route::get('/invoices', [InvoiceController::class, 'index']);
        Route::post('/invoices', [InvoiceController::class, 'store']);
        Route::get('/invoices/{id}', [InvoiceController::class, 'show']);
        Route::post('/invoices/{id}/issue', [InvoiceController::class, 'issue']);
        Route::post('/invoices/{id}/credit-note', [InvoiceController::class, 'creditNote']);
        Route::delete('/invoices/{id}', [InvoiceController::class, 'destroy']);

        // Categories
        Route::get('/categories', [CategoryController::class, 'index']);
        Route::post('/categories', [CategoryController::class, 'store']);
        Route::get('/categories/{id}', [CategoryController::class, 'show']);
        Route::put('/categories/{id}', [CategoryController::class, 'update']);
        Route::delete('/categories/{id}', [CategoryController::class, 'destroy']);

        // Billing (plans are public — see above)
        Route::get('/billing/status', [BillingController::class, 'status']);
        Route::post('/billing/subscribe', [BillingController::class, 'subscribe']);

        // Notifications
        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::post('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
        Route::post('/billing/cancel', [BillingController::class, 'cancel']);
    });
});

Route::get('/email/verify/{id}/{hash}', [AuthController::class, 'verify'])->name('verification.verify');
Route::get('/oauth/{platform}/callback', [OAuthController::class, 'callback'])->name('oauth.callback');

// edfapay posts payment results here (server-to-server, signature-verified).
Route::post('/billing/callback', [BillingController::class, 'callback']);

Route::post('/webhooks/{platform}', [WebhookController::class, 'handle'])
    ->middleware(VerifyWebhookSignature::class);

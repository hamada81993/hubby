<?php

/*
| Systems a merchant can ask Hubby to connect next. These are not built yet: the
| integrations page shows them as "coming soon" and records who asked, so the next
| one is chosen by demand. Keys are stable identifiers; names live in the dashboard.
*/
return [
    'requestable' => [
        // Accounting and ERP
        'zoho_books', 'qoyod', 'daftra', 'wafeq',
        // Advertising (ad spend into the profit report)
        'meta_ads', 'google_ads', 'tiktok_ads', 'snapchat_ads',
    ],
];

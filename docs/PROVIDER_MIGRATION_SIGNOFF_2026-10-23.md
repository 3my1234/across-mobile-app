# Provider migration delivery status ? 23 October 2026

The two previously identified interface differences are now implemented in the native candidate: an in-app map with tap/drag/GPS/address search and owner-scoped notification delivery diagnostics. Automated interactions and TypeScript pass (19 native-provider suites). These are source/test results; phone acceptance and a signed EAS APK remain pending.

## Scope and compatibility

Native provider navigation includes account/onboarding/profile/documents, product/service publishing and availability, requests/bookings, subscriptions and cancellations, driver availability, messages/Town Hall, orders/bulk/ETA/manifests/printing, Support and settings. Essential candidate flows do not open the provider PWA. The existing account identity, records, APIs and business rules are reused.

Most functionality is compatible with reported production57411f0. Full safe service editing requires the private complete read in PR70. Exact booking navigation uses its optional request filter. Detailed notification-test tracking uses its new read over existing delivery records. Other existing workflows do not require PR66 infrastructure changes. See PROVIDER_BACKEND_COMPATIBILITY_2026-10-23.md for the exact boundaries.

PR70 is the standalone minimal release choice; PR69 repeats the two service/request changes on an older PR66 foundation. Do not merge both implementations. No PR is merged or deployed here.

## EAS delivery

provider-preview is prepared for the normal internal Android APK flow: existing application ID/signing source, existing production API, explicit native/direct flags. User approval is still required to deploy PR70 and confirm the production-connected build target. The ONE EAS build should follow those confirmations and successful candidate checks. It must not use a placeholder backend. Build source commit, EAS build ID and installation link must be recorded when produced.

Camera/files/location, subscriptions/browser returns, background notification display/sound/taps, account switching and all provider journeys still require installation and device acceptance. iOS compilation/device acceptance remains separate; direct Flutterwave subscription checkout is intentionally unavailable in store distribution. No claim of full store readiness or measured large-user capacity follows from this migration.

## Keep provider Coolify running

Source Dockerfile.provider serves static Nginx content; actual saved Coolify runtime/configuration remains unverified. Source dependencies include older APK provider WebViews, welcome-email links, PWA checkout return URLs, installed browser push and web/desktop/iPhone users. Keep it running until mobile acceptance, safe redirects/returns and a transition for remaining users are verified. No resource was stopped or deleted.

## Retirement acceptance (later)

- Accept signed Android and iOS provider journeys and preserve account/data/payment history.
- Verify actual Coolify image, mounts, domains, proxy configuration and any server-side dependencies read-only.
- Inventory old APKs, web users, email links, browser notifications and pending checkout returns.
- Maintain safe landing/return URLs and communicate the transition before disabling portal access.
- Retain an approved rollback path and separately approve stopping/removing the resource.

# Native provider migration: implementation and acceptance

Updated 23 October 2026. Mobile draft PR49 (`feat/native-provider-account`), backend draft PR69 (`feat/native-provider-contracts`, stacked on foundation PR66).

## Current implementation

The native candidate reuses the existing authenticated identity and Go authorization. It does not create a second provider account or copy existing provider data. `EXPO_PUBLIC_NATIVE_PROVIDER_ACCOUNT=true` selects native screens. Release profiles have not been enabled, draft PRs are unmerged and the public PWA remains available.

All essential provider tools in the candidate stay native. There is no link back into a portal WebView from the native workspace. An invalid destination displays a native recovery screen. The flag-disabled existing release path is retained until migration acceptance; this does not constitute PWA retirement.

| Provider capability | Native implementation | Remaining acceptance |
|---|---|---|
| Same identity and workspace switching | Existing login/session, customer/provider navigation, existing server account status | Android/iOS account switching, approval and restrictions |
| Onboarding | All provider categories, contacts, location and driver declaration | Submit/review on integrated backend |
| Verification | Top-level Documents, camera/library/files/PDF, private signed preview; licence/car/plate require photos | Permissions, interrupted upload/register, admin review |
| Business identity | Full profile, separate banner/avatar upload/removal, overlapping circular avatar | Device display, image permissions, old data preservation |
| Products | Create/full edit/archive/submit, stock routes, categories, sale terms, delivery offers, media caps | Integrated publishing and tier boundaries |
| Services | Complete owner snapshot, full edit, pricing modes, location, capacity, availability slots | Requires PR69 endpoint; device and server integration |
| Subscription purchasing | Existing server checkout/verification, monthly recurring cards, monthly/3/6/12-month prepaid transfer, annual prepaid card and backend yearly quote | Direct Android APK only; safe gateway/device acceptance; store billing remains a release gate |
| Renewal/cancellation | Owner-only existing API, expiry preserved, next-period tier choice, uncertain cancellation remains uncertain | Gateway sandbox, expiry and failed renewal acceptance |
| Interrupted payment | Provider-scoped SecureStore marker before request, saved hosted checkout, server reconciliation on restart/resume and manual check | Process-kill/browser return and network interruption on device |
| Messaging | Shared native CommunityScreen, ordinary inbox/threads/photos/replies | Two phones, background/locked push, history isolation, reconnect |
| Town Hall | Shared native discovery/join/respond, provider request creation disabled | Subscription/approval/group participation and expiry |
| Support | Existing native main-app inbox/thread under same identity | Older-ticket routing, safe areas and back navigation |
| Bookings/enquiries | Search/status/pagination, confirm/accept/reject/complete; exact owned request context | Integrated backend PR69 lookup and device transitions |
| Previous paid orders | Tracking transitions, settlement restrictions, expected version/idempotency, ETA | Existing historical orders and customer tracking acceptance |
| Bulk fulfillment | Selection, legal common transitions, versioned atomic backend updates | Representative imported/local orders in isolated integration |
| Manifests | Create/list/details/status transitions, fresh private OS print | Native print UI and server-integrated lifecycle |
| Driver availability | Foreground GPS, bounded leases, serialized heartbeat/offline cleanup | Android/iOS permissions, GPS loss, foreground/background |
| Settings/notifications | Shared native settings, sound/phone settings, native destinations and nonblocking read acknowledgement | Real device delivery, deep links, OS channel behavior |

Native location entry supports foreground GPS, manual coordinates, Maps pin verification and confirmation. It does not reproduce the PWA's draggable browser map. Existing nested service attributes are preserved during editing. Retired settlement-account setup remains retired (backend HTTP410), rather than being reintroduced.

## Payment safety and distribution

New Flutterwave purchases require Android plus `EXPO_PUBLIC_DISTRIBUTION_CHANNEL=direct`. Play/iOS store builds do not enable this external digital-subscription checkout. Existing access/status, verification and renewal controls remain available. Store-compliant subscription purchasing is still required before claiming full store readiness.

The app uses server catalog prices, including annual quotes; it does not independently grant entitlements, calculate settlement or trust callback success. Checkout hosts/return paths are constrained. A pending marker blocks a second checkout after an ambiguous failure. Server-confirmed settled/not-found states clear the marker; pending retains it. Closing the browser does not claim a sent payment was cancelled. The Go backend verifies reference, ownership, currency and amount and controls paid-through dates.

Tier changes stop the old automatic renewal and save the next choice for checkout after expiry, using the existing backend behavior. They do not activate a higher tier immediately or silently charge the next tier. Cancellation preserves already-paid access. Customer/provider conversations are not gated by a paid-through date.

## Validation evidence

Local `npm run test:provider-native` now contains 14 suites: account/deep-link/upload policy, workspace bridge policy, onboarding, profile, publishing, driver leases, booking policy, real booking component interaction, orders/bulk/manifests/ETA/print policy, notification destinations, Town Hall feed, subscription policy, real subscription component interaction and real fulfillment component interaction.

The subscription interaction fixture exercises confirmation, double taps, durable interrupted-checkout recovery, authoritative settlement and uncertain cancellation. Fulfillment interactions exercise single-flight confirmed bulk updates, expected versions, fresh owned manifest reads, escaped printing and delayed confirmation after unmount. These use synthetic data and mocked services, not production accounts or payment requests.

TypeScript and existing marketplace/notification regressions pass locally. Targeted ESLint has no errors; pre-existing App.tsx warnings are recorded separately. Backend PR69 at `55613e3` passed isolated PostgreSQL16 contract CI in [run 39871523779](https://github.com/3my1234/across-backend-api/actions/runs/39871523779): full service detail ownership plus exact request filtering/foreign-provider exclusion and route compilation. Local Go compilation also passed; the actual database test is qualified by CI, not a local absent database.

Prior Android ARM64 bundled compilation passed in [run 39849961969](https://github.com/3my1234/across-mobile-app/actions/runs/39849961969), app source `886c6d3`. That does not qualify the subsequently added expo-print and payment/fulfillment code; another native compile is required. Compile workflow uses generated test signing and a non-production `.invalid` API. Its APK is compile-only and must not replace the user's existing app.

## Next EAS APK and release gates

The user has rejected USB/SSH-tunnel device testing. Use the usual EAS APK delivery after backend compatibility and a reviewed API environment are ready. No USB setup, new rented server, EAS build or production action is part of these source changes.

Before producing the usable candidate: coordinate PR66/PR69-compatible API and worker configuration, qualify the API target and synthetic/sandbox test data, select native/direct build flags for a directly distributed Android APK, preserve existing signing/application identity and run the EAS internal APK build. Existing preview/production profiles have deliberately not been silently switched to candidate features or payment behavior.

A usable EAS APK still requires installation and complete real-device journeys. Android acceptance must cover owner/manager/applicant/restricted accounts, existing provider records, all media/tier limits, registration/verification, payments/cancellation/next-period changes, both chat directions, push taps while closed, Town Hall, driver leases, fulfillment and printing. iOS native compilation, permissions, safe areas and physical-device notification/browser-return acceptance remain unverified from Windows. No store enrollment or submission has occurred.

Do not equate source implementation or compile success with production-ready migration. Keep the PWA until existing providers can complete these journeys in signed Android/iOS candidates and data/entitlements/history remain correct. Do not merge/deploy PR49, PR69 or PR66, change production, submit to stores or retire the PWA without explicit approval.

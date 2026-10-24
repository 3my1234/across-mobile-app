# Provider migration: existing-backend compatibility

23 October 2026 (Africa/Lagos). Source review, not a new live-production test.

## Direct answer

This is primarily a client-interface migration. Existing accounts, database records, storage, authentication, payment verification, paid expiry, listing limits, orders and messaging business logic are reused. Native forms/camera/GPS/browser returns/notification handlers replace their browser equivalents. Those platform-specific connections need testing; the business system is not being rebuilt.

EAS authentication is required only when the assistant submits/monitors a build under the existing Expo account. The user can run the usual EAS command instead. Neither EAS authentication nor automated SSH is required to write mobile code. Server access is required for server operations, and operator-run commands remain a valid alternative.

A separate test backend is recommended for safely exercising mutations, payments and notifications against a candidate version. It is NOT a technical prerequisite to generating an APK. A production-connected build or production test still needs the user's approval. A build pointed at a placeholder does not qualify as a usable candidate.

## Existing API reuse

Compared native candidate workflows and provider.js with the last user-reported deployed backend source57411f0. This does not establish today's running revision or certify all end-to-end behavior.

| Native workflow | Existing API family reused |
|---|---|
| Login/provider onboarding | /auth/login, /auth/signup, /providers/onboarding |
| Provider account/profile/banner/avatar | /providers/me, /providers/me/media |
| Private document selection/upload/review | /providers/me/uploads/presign, /providers/me/verification-documents |
| Product create/edit/submit/archive | /providers/me/products and existing item/submit routes |
| Service list/create/save/submit/archive | /providers/me/listings and existing PATCH/POST/DELETE routes |
| Plan limits/media verification | /providers/me/post-policy, /providers/me/videos/complete |
| Service availability | /providers/me/listings/:id/availability |
| Bookings/enquiries | /providers/me/requests and existing item PATCH |
| Driver availability | /providers/me/driver-availability |
| Subscription quotes/checkout/verification/cancellation | /marketplace/subscription-plans, /providers/me/subscription-checkout, subscription-confirm, subscription-renewal |
| Previous paid orders/ETA/bulk fulfillment | /providers/me/merchant-orders, item fulfillment and fulfillment/bulk |
| Manifests/details/status/print data | /providers/me/manifests and item GET/PATCH |
| Chat/Town Hall/Support/settings | Existing shared main-app messaging, Town Hall, ticket and preference APIs; no replacement backend system introduced |
| Provider notification acknowledgement | /providers/me/notifications/:id/read and existing account notification reads |

## Actual migration-specific backend changes

1. NEW GET /providers/me/listings/:listing_id. The existing list response omits contact_email/contact_phone. Its existing PATCH writes those values. The PWA editor reads its list snapshot; the native editor deliberately refuses an incomplete snapshot to avoid clearing existing contacts. The new owner/manager-only, private/no-store read returns all editable fields. Public discovery is not an adequate substitute for private draft/rejected/suspended edits. This is a small read-contract correction, not new listing business logic. Without it, current native full service editing stays closed safely; other service operations use existing APIs.
2. OPTIONAL request_id UUID filter on the existing scoped request list. This lets a notification locate one owned booking directly without scanning pages. Existing list/transition behavior is unchanged. This is a navigation enhancement, not required for ordinary booking-list operation. The native target view refuses unrelated rows if an older server ignores the filter.

3. NEW GET /notifications/test-push/:notification_id. Reads the existing native push delivery ledger for the authenticated owner and the original test device. Returns only delivery state, attempts and timestamps; never tokens, raw errors or gateway tickets. No schema change or additional notification system. A receipt reports push-service acceptance, not audible sound. Existing POST /notifications/test-push already queues the real phone test on the deployed API.

PR70 (fix/provider-mobile-compat, currently40b511c) contains all three minimal changes, based on reported production57411f0. It excludes foundation PR66. Source comparison confirms PR69 has byte-identical service-detail implementation/tests and exact-request implementation/tests: these are alternatives, not two patches to merge. Use PR70 for the minimal release. Keep PR69 unmerged; after approved PR70 integration, drop its duplicate commits when rebasing any foundation integration. The diagnostics read is unique to PR70. PR66/67 infrastructure work and PR68 development-login protection remain separate; this patch does not silently resolve or discard them.

## What an APK can do before new backend deployment

Existing-API workflows have a source-compatible path to the reported current backend. This is not a claim that a physical phone has tested them. The three exact limitations above remain until the small API additions are available. A complete functioning service editor cannot be claimed against an older server lacking its read route.

The existing EAS preview profile points at production and does not enable the native candidate by default. The new provider-preview profile explicitly inherits that internal APK identity/API and enables native/direct Android flags. It is prepared for the user?s usual EAS flow, but no production compatibility deployment or connected candidate build is implied by preparing it. A provider-enabled build needs explicit reviewed flags and API target; the prepared provider-staging profile is one safe option, not a universal requirement. No production-connected candidate or real payment/user-data test is authorized here.

Native purchase implementation reuses Flutterwave for directly distributed Android APKs. Play/iOS digital billing remains a separate store gate. Real camera/files/GPS, notification sound/taps and payment browser returns require device checks even when server rules are unchanged.

No live APIs, payments, uploads, deployments, PR merges, infrastructure settings or EAS builds were changed/run for this comparison.

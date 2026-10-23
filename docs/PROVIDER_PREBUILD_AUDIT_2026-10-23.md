# Provider migration pre-build audit - 23 October 2026

This is source and automated qualification, not physical-device acceptance. It supersedes older staging/PR dependency instructions in previous migration notes. The candidate uses the existing API at https://api.atlxpres.com, existing app identity/signing and the deployed minimal backend compatibility release 65a159b. PR66/69 are not prerequisites for these mobile flows. The provider PWA remains available.

## Registration and identity

Customer email/password and Google entry remain available. New provider email registration asks for full name, email, phone and password, sends the existing registration_context=provider metadata, and requires email verification before sign-in. This metadata controls existing email guidance; it grants no permissions. Password visibility toggle and new-password validation remain available. Provider signup explains returning to the mobile app after verification and signing in with the same email/password.

After authentication, the provider choice opens business onboarding. The choice is held in SecureStore and bound to the email, surviving verification, login and restart before a business exists. On restored sessions, a missing /providers/me business is only treated as a pending provider journey after the authenticated /profile email matches that choice. Existing providers are identified by /providers/me, including applicants/restricted/expired accounts; API restrictions remain authoritative. OAuth completion resets stale form intent before authoritative account detection.

Business onboarding requires the PWA-required business name, category, contact email/phone, city, state/region and country. Other fields and driver declaration are preserved. It submits /providers/onboarding under the same token, without a client-selected user ID or approval. Successful submission leads to Documents; driver applicants start with drivers_license and instructions for licence, car and plate photos. Failed/uncertain submission requires refreshing account access, not automatic replay.

No new login system, account duplication, business-data copy or backend role grant is introduced. Personal name/photo and business name/logo remain distinct.

## Product/service media coverage

| Display | Data and implementation |
| --- | --- |
| Provider Products | NativeProviderCatalog maps existing image_urls to ProviderPostImages, showing all images with enlargement. |
| Provider Services | Same catalogue maps media_urls; no image field is guessed or replaced by stock imagery. |
| Existing post editor | Retains current product/service image arrays and video references; owner image previews have no unrelated stock fallback. Service edit first reads the complete private snapshot to preserve contacts. |
| Service availability | The selected service passes its existing media_urls to NativeProviderAvailability. |
| Bookings/enquiries | Existing booking API has listing_id but no photos. Background owner-scoped private service reads supply images, deduplicated per page, capped at 25 services and three concurrent reads. Booking content/actions appear without waiting. Load more waits for the current image batch to settle; stale pages cannot update images. Failed reads show unavailable/retry, not an empty-photo claim. No new endpoint or deployment. |
| Previous paid orders | NativeProviderOrders renders order_items.product_snapshot.image_urls, preserving the purchased product snapshot. |
| Bulk order selection | NativeProviderFulfillmentTools shows saved product photos for each order item. |
| Manifest detail | Same tools render existing item.product.image_urls. Printed manifests retain the PWA's textual package/product/quantity/contact layout. |
| Public product cards/details | Existing ProductCard and Screens product detail already read image_urls; shared customer browsing remains available to providers. |
| Public services and related services | Existing MarketplaceScreen renders media_urls in cards, detail gallery and related cards. |
| Chat | Shared existing chat attachment rendering remains; a conversation's regular message history does not need a duplicated product-description header. |
| Business identity | ProviderIdentity, provider overview and profile continue using provider_identity avatar/banner. Unrelated stock-photo fallback is disabled for business branding. |

ProviderPostImages supports horizontal previews, full-image display, Android Back/close, honest empty state and explicit image-error retry. Network/storage availability still determines whether an actual remote photo can be fetched. No photo was re-uploaded or production record changed by this audit.

## Remaining PWA capability audit

| Capability | Native implementation / existing API |
| --- | --- |
| Approval and identity | ProviderWorkspace, NativeProviderProfile; /providers/me and existing profile/media APIs |
| Private documents | Top-level Documents; signed preview, camera/library/files; driver evidence rules |
| Product/service publishing | NativeProviderCatalog, publishing policy, product options, delivery offers; same draft/edit/submit/archive APIs, server-owned quotas/moderation |
| Location | NativeProviderLocationPicker; map tap/drag, GPS, address search, explicit confirmation and retry |
| Availability and driver presence | NativeProviderAvailability / NativeProviderDriver; existing capacity and lease APIs |
| Bookings/enquiries | NativeProviderRequests; existing scoped pagination/search/status/transition APIs |
| Paid-order tracking and ETA | NativeProviderOrders and providerOrderPolicy; existing owned versioned tracking API |
| Bulk fulfillment and manifests | NativeProviderFulfillmentTools; existing atomic updates, manifest lifecycle and native printing |
| Subscriptions | NativeProviderSubscription; existing checkout/verification, prepaid periods, renewal/cancellation/next-period tier rules and interrupted-payment recovery |
| Ordinary messaging / Town Hall | Shared native CommunityScreen; existing history, photos, replies, group participation and provider restrictions |
| Notifications and destinations | NativeProviderNotifications provides direct workspace access to provider event history plus account notifications, deduplicating events mirrored by existing migration085. Exact routing preserves both ordinary-notification and provider-event ledger IDs. Refresh/foreground refresh and confirmed mark-all reuse existing APIs; diagnostics distinguish queued/worker/push-service states from actual phone receipt/sound |
| Support and settings | Existing native account support/settings; no provider WebView required for essential workflows |
| Retired payout setup | PWA hides this path and backend returns410; it is intentionally not reintroduced as a new workflow |

The control comparison also identified missing direct inbox access inside the provider modal. The server already mirrors newer provider events into ordinary account notifications; those notifications were not absent from the system. The new provider-facing inbox exposes both histories without duplicates, including legacy business events that predate the native mirror. No additional missing native PWA control was identified after this correction. This does not certify every API, payment, permission, race, network or platform condition on a phone. Direct Android APK checkout is supported by its existing distribution flag. Store-compliant digital-subscription checkout and iOS/device/store acceptance remain separate release gates.

## Qualification and remaining work

The expanded 25-suite provider regression gate executes actual registration/auth coordination, verification-before-session, workspace entry/restart/email isolation, actual onboarding submission/duplicate-tap/error behavior, populated catalogue/order/manifest media mapping, booking photo concurrency/stale protection, and existing publishing/subscription/fulfillment/notification policies and interactions. Marketplace, chat/options, page refresh and history retry regressions also run. Services are synthetic/mocked in component fixtures; these are not a real provider application, email delivery, payment or notification sent to production.

Record exact final-source CI/build results in HANDOVER.md. Use PROVIDER_PHONE_ACCEPTANCE_2026-10-23.md for the new provider and existing provider tests. Do not mark this as physically accepted until those journeys pass.

One existing backend copy issue is explicitly open: provider verification-page wording and welcome email still refer to the web provider portal. The mobile form already tells applicants to return to the app. A two-string wording patch is prepared at ../qualification/PROVIDER_NATIVE_EMAIL_GUIDANCE_2026-10-23.patch; it has not been applied or deployed. Existing email verification and email/password login work without that wording change, but it should be corrected to avoid steering new mobile providers to the old portal. PWA links remain live during transition.

No EAS build was submitted, production services/settings changed, paid operation executed, or PWA retired.

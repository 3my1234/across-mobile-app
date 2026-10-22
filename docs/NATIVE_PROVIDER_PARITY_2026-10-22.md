# Native provider migration: candidate account slice

Branch: `feat/native-provider-account`, based on mobile `6319b5f`.

This is a reviewable first slice, not completion of the provider migration. No deployment, EAS build, production call, new account identity, data migration or provider PWA retirement is part of this change.

## Verified starting point

`components/ProviderWorkspace.tsx` previously hosted the provider portal in a WebView. It was not a native implementation. `../admin-web/provider.js` is the parity reference; backend authorization remains authoritative. The existing `App.tsx` account entry and provider notification destination already open this workspace using the current authenticated token.

## Candidate behavior

`EXPO_PUBLIC_NATIVE_PROVIDER_ACCOUNT=true` selects the candidate native account screens. The default is false. Use a candidate build with synthetic/staging accounts for device acceptance before enabling this in a release. This is a public build-time feature flag, not a security permission.

- Native overview reads `/providers/me`, shows existing business identity, banner behind the circular avatar at its lower left, verification notes and paid-through date.
- Documents are a top-level native tab, not hidden in settings. Owners/managers may submit an image using the existing private verification presign/upload/register sequence. All three driver evidence types are available. Image MIME and 10 MB limits are checked locally; server validation remains authoritative. Existing review status/notes are displayed. The server preserves private storage and gives review URLs only through authorized reads; this screen does not persist or display document URLs.
- Subscriptions displays server-supplied monthly/yearly prices, current paid access and renewal state. An owner may stop automatic renewal with confirmation. The same cancellation endpoint also clears a next-plan choice. Uncertain cancellation remains visibly uncertain; the screen reloads authoritative status after the request.
- Switching back to customer closes the workspace without logging out. Customer identity/messages are untouched. Paid access is determined by active status and a valid future expiry; it does not gate access to conversations.
- No purchase link or external native checkout was introduced. Store billing policy/implementation remains a separate launch blocker.
- All deep links into unmigrated conversations, shared/Town Hall rooms, tickets and provider events continue into the existing portal. Profile, verification and booking-request routes are now retained by the fallback URL allowlist instead of being dropped.
- Refresh retains existing content, has no periodic full-screen polling, and uses generation checks to prevent late reads replacing another view. Mutations are single-flight and never automatically replayed. API bearer credentials are never sent to storage PUT requests.

## Parity matrix

| Existing provider capability | Native candidate | Residual work / acceptance |
|---|---|---|
| Current account identity/customer switching | Existing token reused; native overview | Android/iOS transitions, approval/restriction changes and stale account tests |
| Registration/provider onboarding | Main-app auth plus native provider application | Android/iOS application and driver evidence acceptance |
| Verification photos/review status | Native image submission and review notes | Native PDF picker, private preview, camera capture, device permission/retry acceptance |
| Business profile/banner/avatar editing | Native full profile and image upload/removal | Device media/branding acceptance |
| Product publishing/edit/archive/moderation | Native local create/full edit/submit/archive | Cross-border creation, advanced sale/delivery editing, device acceptance |
| Service publishing/availability/moderation | Native create/submit/archive; full edit requires complete owner contacts | Candidate owner-contact API contract, native availability, device acceptance |
| Subscription status/yearly quote/cancellation | Native read and owner cancellation | Native compliant purchasing, next-renewal tier choice, payment history/reconciliation |
| Customer ordinary messaging/photos/replies | Existing portal retained | Full native provider inbox/thread reuse, optimistic delivery/history ownership and push acceptance |
| Town Hall discovery/join/respond | Existing portal retained | Capability-aware native provider participation; never request creation |
| Support | Existing portal retained | Native provider support routing/permissions acceptance |
| Bookings/requests | Existing portal retained | Native request transitions |
| Merchant fulfillment/manifests | Existing portal retained | Native operations where still commercially applicable; no silent removal |
| Driver availability/location | Existing portal retained | Native permission, background/foreground policy and safety acceptance |
| Notifications/settings | Current app plus portal retained | Native provider notification registration/route/device coverage |

## Publishing follow-on slice

The same candidate feature flag now also selects native Products and Services screens. `NativeProviderCatalog.tsx` loads 25 records per page, supports search/pagination and provides draft creation, review submission and archive confirmation. Existing conversations are not removed by archive. The server remains authoritative for publishing, permissions and the combined listing limit.

- Product creation starts with seller-managed local stock and requires explicit delivery areas, primary item price, stock location and location confirmation. Full existing product payloads are cloned when editing: sale fields, SKU, categories, delivery offers, videos, fulfillment and stock data are preserved. Existing cross-border products keep their route; creating a cross-border route and editing advanced sale/delivery terms still require the existing tools.
- Service creation includes every Go `listingPayload` field, pricing modes/notes, location, contact information, capacity and availability flags. Existing service editing is deliberately guarded if the deployed list response omits contact fields: `UpdateListing` would otherwise overwrite them with blanks. It will become available as soon as an owner-scoped read returns complete contacts; until then use existing tools rather than risk data loss.
- All retained and newly selected images/videos count toward freshly fetched server policy. MP4 videos require at most 50 MB and 60 seconds each and are registered only after `/videos/complete` verifies them. Expo ImagePicker's installed type definition confirms duration is expressed in milliseconds. Free/paid caps come from `/providers/me/post-policy`, not a second client-side pricing table.
- Location can come from the existing bounded foreground-location helper or manual coordinates; changing coordinates clears confirmation. A Maps link lets the provider check the pin before confirming. Native map search/dragging remains future parity work.
- Shared JSON reading now handles successful 204/205 responses without trying to parse a nonexistent JSON body. Existing edit/submit/archive endpoints return 204; successful operations must not appear as connection failures.

Publishing validation passed: full nested payload preservation, service missing-contact guard, location confirmation, tier media caps, delivery-time validation and real shared JSON-reader behavior for HTTP 204. `node scripts/test-provider-publishing.cjs`, TypeScript, targeted ESLint, existing marketplace, notification and workspace policy tests passed locally. Device and backend-integrated acceptance remain pending. No live server was called.

## Security and limitations

### Native onboarding follow-on

The candidate now provides a native application form for all six server provider categories, including custom work and the driver declaration. It uses the existing authenticated identity, posts the existing `/providers/onboarding` contract and then directs applicants to the native Documents workflow. Existing customer data is untouched. Validation covers business/contact details, country code and optional HTTPS website. It has no automatic mutation retry and offers account refresh after an interrupted submission. A 404 does not automatically create or reactivate anything; the user explicitly submits an application and server ownership/access rules still apply.

`node scripts/test-provider-onboarding.cjs` covers category normalization, same-account ownership payload and driver declaration. This supersedes the initial matrix's onboarding row: registration/authentication itself remains the existing main-app authentication flow, while provider application submission is now native behind the same candidate flag.

### Native profile/media follow-on

Business profile editing and avatar/banner upload/removal now use native controls. The full profile write preserves every editable contact/address field and fetches current `logo_url` immediately before saving, preventing a text edit from reverting a newly changed or removed avatar. Private verification media is never repurposed as public branding: the existing server route enforces provider-owned `logo`/`banner` prefixes and validates uploaded objects. Branding images are capped at 5 MB and app bearer credentials are not forwarded to storage.

`node scripts/test-provider-profile.cjs` passed for fresh branding preservation, complete write fields, permission-field exclusion and validation. This remains behind the candidate flag and needs Android/iOS upload, cropping, light/dark and large-text acceptance. Source changes do not count as device-tested parity.

The native UI is not the authorization boundary. Document registration permissions are owner/manager in the Go handler; renewal management is owner-only. A suspended provider may receive 403/404 from existing backend access rules; native code does not interpret that as permission to reactivate or create an account. A missing profile displays a neutral setup/access message and preserves existing tools.

The build remains gated and the portal remains available. Do not claim native provider parity, retirement readiness or store acceptance from typechecking alone. Do not disable the provider portal until every required workflow has passed Android and iOS release-build acceptance and existing data/history/entitlements have been checked.

## Verification

### Latest native parity additions

The follow-on implementation now adds native bookings/enquiries (search, status,
pagination, confirm/accept/reject/complete), service availability creation with
local-time validation and confirmation, camera/file/PDF verification selection,
fresh signed document previews, advanced product stock/sale/category/delivery
controls and previous paid-order tracking. Driver evidence remains photo-only.
The document picker is the SDK54-compatible native dependency selected by Expo;
it and the camera permission copy require a new test binary, not just a JS update.
Private previews use freshly fetched short-lived links in the system browser;
the application does not put those links into persisted chat/document history.

Service editing now requires the complete private detail contract in backend
[draft PR69](https://github.com/3my1234/across-backend-api/pull/69), commit `65008d5`,
stacked on PR66. Its PostgreSQL16 CI passed complete fields, nested data,
owner/manager access, outsider/member/inactive/suspended denial and route compile
checks. Old servers without that endpoint leave the native editor closed safely.
The public listing API does not gain private contact fields.

`npm run test:provider-native` is the shared eleven-suite local/CI regression gate.
It covers policy, entitlement/ownership failures, document MIME/size rules,
private-preview links, fresh complete edit snapshots, destination delivery offers,
foreground driver lease ordering, booking transitions/date validation, historical
order version/idempotency/settlement rules, notification routes and Town Hall.
These are source/functional checks, not Android/iOS user-journey certification.

Remaining parity: native subscription purchasing and next-plan checkout; legacy
bulk order/manifests and estimated-delivery editing; some notification contexts
still intentionally retain legacy routing; full native notification/settings
acceptance, richer service attributes/map interaction, interrupted-upload/device
tests and complete signed Android/iOS release journeys. The backend explicitly
returns 410 for settlement-account setup, so that retired operation is not being
reintroduced as a native workflow. Existing historical paid orders are retained.

Provider Support now hands off to the main application's existing native Support
inbox/thread using the same authenticated identity. Valid ticket deep links are
preserved; ambiguous or unmigrated notification contexts retain fallback routing.
Local typecheck, policy/destination/workspace/publishing/Town Hall regressions and
targeted ESLint passed after this change. Device safe-area, back navigation and
private-history checks remain required. Pre-existing messaging changes were
preserved; these checks do not certify the complete messaging migration.

`NativeProviderDriver` adds foreground-only nearby availability through existing
approved-listing and driver-document contracts. It paginates owned approved
services, validates fresh accurate location, serializes heartbeats and waits for
an in-flight PUT before offline DELETE. A provider-scoped cleanup barrier protects
rapid close/reopen from a stale DELETE. Permission, network and GPS failures stop
publishing; the server's two-minute lease handles unreachable cleanup. Background
tracking and automatic restart are not enabled. Android/iOS permission-dialog,
background, account-switch, expiry and ownership acceptance remain pending.

Both additions remain behind `EXPO_PUBLIC_NATIVE_PROVIDER_ACCOUNT`; no release
profile or production configuration was enabled and the PWA remains available.

Run `npm run typecheck`, `node scripts/test-native-provider.cjs`, `node scripts/test-provider-workspace.cjs` and `npm run test:notifications`. Tests cover paid-period boundaries, invalid dates, the three driver photo types, upload limits, preserving unmigrated notification routes, owner denial propagation, no automatic mutation replay, HTTPS storage upload and absence of application credentials on storage requests.

Local verification passed: TypeScript, native provider tests, workspace policy, notification setup and marketplace regression suites. The marketplace composer test needed its fixture updated with the already-existing reply state bindings; application messaging code was not changed by that fixture correction. Targeted ESLint covers the three new native modules. Device acceptance remains pending.

Before accepting this slice on devices: use a staging owner and manager; submit all three synthetic driver photos; reject/approve evidence and refresh; revoke photo access; interrupt upload/register separately; double-tap submit/cancellation; test renewal failure/uncertain state and expiry; switch workspaces; open provider notification routes; exercise light/dark, large text, screen readers and safe areas on Android/iOS. No real user documents should be used in CI.

### Draft review and Android compile evidence

Native migration review is [mobile draft PR49](https://github.com/3my1234/across-mobile-app/pull/49). Local TypeScript, targeted ESLint, eleven native-provider suites (including a real-component booking-screen interaction test) and the pre-existing CI community/unread/catalogue/account-design suites passed. The first Linux source regression run passed at commit 81ab796; subsequent workflow-only revisions also passed source checks.

A separate Android compile workflow generates the native project and uses generated test signing with a non-production .invalid API endpoint. It does not use EAS/store credentials, connect to production or establish device acceptance. Its first attempt failed before application compilation because the setup action requested the retired Android SDK tools package. The package request was corrected to platform-tools; subsequent native compilation is tracked separately from passing source checks. The APK, if produced, is compile-only; integrated staging-device testing needs a reviewed staging API target and synthetic test accounts.

Android compile result: PASS in [run 39849961969](https://github.com/3my1234/across-mobile-app/actions/runs/39849961969), application source commit 886c6d3. Generated Android project, bundled ARM64 release compilation, APK checksum and artifact upload all passed (8m25s job). Artifact provider-android-compile-only has three-day retention. It uses generated test signing, the normal package namespace and a non-production .invalid endpoint; it is not a replacement for the installed app or a staging/production release. Device and iOS acceptance remain open. Subsequent booking-screen-test-only changes do not change the application source compiled in that run.

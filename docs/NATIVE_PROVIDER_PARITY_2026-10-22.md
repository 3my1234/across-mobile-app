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
| Registration/provider onboarding | Existing portal retained | Build native application form, all provider categories and driver declaration |
| Verification photos/review status | Native image submission and review notes | Native PDF picker, private preview, camera capture, device permission/retry acceptance |
| Business profile/banner/avatar editing | Read-only native identity header | Native profile/media editor |
| Product publishing/edit/archive/moderation | Existing portal retained | Native editor, media pipeline and combined tier enforcement UX |
| Service publishing/availability/moderation | Existing portal retained | Native editor and availability |
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

The native UI is not the authorization boundary. Document registration permissions are owner/manager in the Go handler; renewal management is owner-only. A suspended provider may receive 403/404 from existing backend access rules; native code does not interpret that as permission to reactivate or create an account. A missing profile displays a neutral setup/access message and preserves existing tools.

The build remains gated and the portal remains available. Do not claim native provider parity, retirement readiness or store acceptance from typechecking alone. Do not disable the provider portal until every required workflow has passed Android and iOS release-build acceptance and existing data/history/entitlements have been checked.

## Verification

Run `npm run typecheck`, `node scripts/test-native-provider.cjs`, `node scripts/test-provider-workspace.cjs` and `npm run test:notifications`. Tests cover paid-period boundaries, invalid dates, the three driver photo types, upload limits, preserving unmigrated notification routes, owner denial propagation, no automatic mutation replay, HTTPS storage upload and absence of application credentials on storage requests.

Local verification passed: TypeScript, native provider tests, workspace policy, notification setup and marketplace regression suites. The marketplace composer test needed its fixture updated with the already-existing reply state bindings; application messaging code was not changed by that fixture correction. Targeted ESLint covers the three new native modules. Device acceptance remains pending.

Before accepting this slice on devices: use a staging owner and manager; submit all three synthetic driver photos; reject/approve evidence and refresh; revoke photo access; interrupt upload/register separately; double-tap submit/cancellation; test renewal failure/uncertain state and expiry; switch workspaces; open provider notification routes; exercise light/dark, large text, screen readers and safe areas on Android/iOS. No real user documents should be used in CI.

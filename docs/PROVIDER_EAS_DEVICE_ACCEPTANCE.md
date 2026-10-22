# Provider Android device candidate

Status: prepared, not built or deployed. The provider workflows are implemented in draft PR49. There is not yet a usable migrated APK. A successful compile-only artifact does not change the app installed on a phone.

## Delivery choice

Use the normal EAS internal APK process; no USB debugging, laptop tunnel, new developer-store account or additional rented server is required for this delivery method. Store submission and iOS device signing remain separate.

`provider-staging` is a separate EAS profile using the preview environment, native provider workspace and direct Android distribution flags. Existing preview/production profiles retain their existing behavior. The staging profile requires `EXPO_PUBLIC_PROVIDER_STAGING_API_URL`, uses no default production URL, rejects known production/placeholder/local origins and runs the build pre-install guard. Required public Privy app/client identifiers must be configured in the reviewed preview environment; do not paste credentials into reports. A syntactically valid URL is not evidence of a deployed or isolated backend.

Expo build environment behavior and hooks: https://docs.expo.dev/eas/environment-variables/usage/ and https://docs.expo.dev/build-reference/npm-hooks/ .

## Backend prerequisite: proposed isolated setup on the existing application host

This is a plan requiring approval, not an existing environment. Proposed hostname: `staging-api.atlxpres.com` (not created or verified). The operator prepares this address; the user does not need to invent it.

1. Recheck main-host health, available memory/disk and running release identity before allocating resources. Stop if headroom is insufficient; historical server readings do not prove current headroom.
2. Build/pin the PR69 candidate revision (`55613e3`, including PR66 foundation) for API and worker. Do not merge main or reuse production deployment resources/webhooks/controller labels. CI image builds are local-to-runner, not registry-published deployment artifacts.
3. Use separate PostgreSQL16 and Redis instances, volumes, database credentials, JWT secret, TLS materials and Docker networks. Seed synthetic customers/providers/approved evidence and tiers. Do not restore/copy production users, messages, documents, billing tokens or payment references. API/worker use the same candidate revision and only these staging stores.
4. Suggested starting runtime limits: PostgreSQL 768 MiB/0.5 CPU; API 512 MiB/0.5 CPU; worker 256 MiB/0.25 CPU; Redis 128 MiB/0.25 CPU; ingress/controlled egress 128 MiB/0.25 CPU. Total 1,792 MiB and 1.75 CPU quotas, subject to the fresh headroom check. Build work also consumes resources; build outside the live host where practical. These are isolation budgets, not measured traffic capacity.
5. Keep database/Redis off public ports. Do not attach application containers to production service networks or use production connection URLs. Expose only the proposed HTTPS API route through reviewed ingress. Adding DNS/ingress or egress restrictions is a production-host configuration change requiring explicit approval. Existing routing and replica reconciliation remain unchanged.
6. Begin with external egress blocked and captured/local test adapters. Browser/device push, email, OAuth and Flutterwave sandbox acceptance are separate controlled egress steps. Use sandbox-only credentials and owned test recipients/tokens, storage restricted to synthetic media and isolated prefixes/bucket. No production payment secret, SMTP/SES sending credential, real provider renewal token or production push registration may be copied. Review the actual client/worker behavior before allowing destinations; environment labels alone cannot guarantee isolation.
7. Use actual authenticated routes. Disable development login and bootstrap tokens. Generate protected test passwords through a private operator channel; never include passwords/tokens in CI artifacts, commands pasted to chat or this file. Fixture users may be pre-verified for initial UI tests; that does not qualify the registration/verification-email journey.
8. Run separate migrations against staging only, then readiness and authenticated customer/provider checks. Verify the private service editor, scoped request lookup, payments/renewals, ordinary chats and Town Hall on the deployed candidate. An HTTP200 readiness response alone cannot close these gates.
9. Establish a rollback/cleanup boundary using only staging-owned resource IDs. Removing staging must not stop production or remove its storage. Do not use blanket Docker prune or compose project names shared with production. Retain sanitized evidence; remove synthetic accounts/media when acceptance ends.

No server, DNS, routing, secrets, runtime settings, test accounts or gateway configuration has been changed by preparing this plan. No new paid server is proposed. EAS build quota/credit consumption must be checked before submitting a cloud build; no charged build is authorized by this document.

## Build identity and permissions

The current Android application ID is `com.atlanticexpress.mobile`; iOS bundle ID matches. The `across` URL scheme is retained for authentication/payment returns. No keystore/certificate was read or changed. EAS-managed signing identity must be checked against the previously installed APK before distributing an update. A same-ID APK updates/replaces the installed app; it is not a side-by-side application. If signatures differ Android rejects the update. Uninstalling clears device-only sessions/cache; it is not a database migration and must not delete server records.

Expo introspection confirmed the existing Android package/scheme, foreground location declarations and all three iOS camera/photos/location purpose strings. The installed image-picker Android library manifest contributes CAMERA, and the notification library contributes POST_NOTIFICATIONS; final merged-APK permissions and runtime prompts still require binary/device verification. expo-print and expo-document-picker require a new native binary. Verify generated permissions, Android13+ notification prompts, denied camera/photos/location, limited photo access, file picker and OS printing in the actual candidate. Config inspection/typechecking are not permission-dialog/device proof.

Once the environment and signing are qualified, run the local configuration check with the reviewed preview variables loaded, then request the EAS build with `eas build --platform android --profile provider-staging`. The configuration check is `npm run check:provider-staging`. Do not run the build while the target is missing, unreviewed or production. No installation-ready artifact/link exists yet.

## Device acceptance checklist

- [ ] Record APK build ID, source revision, API origin, signing identity and Android/phone versions. Check the API target before entering test credentials.
- [ ] Register/login/logout; password eye/validation; verification email and Spam guidance. Test disabled/expired sessions without private data crossing accounts.
- [ ] Customer and provider workspace switch under the same identity; applicant, owner, manager, approved, suspended and expired-paid states.
- [ ] All existing provider screens are reachable natively; Documents is prominent; settings and Support open the associated native pages.
- [ ] Licence, vehicle and plate photos; camera/library/files/PDF as permitted; approval notes, private preview, denied permissions, interrupted upload and register step.
- [ ] Business banner/avatar/contact changes persist, including existing values and light/dark/large-text display.
- [ ] Product/service create/full edit/archive/submit, locations, prices, availability and delivery offers. Test combined post/media limits at each tier.
- [ ] Monthly recurring card, one-off transfer and annual prepaid sandbox checkout; failed/cancelled/interrupted/duplicate taps/process restart; only verified server results change access.
- [ ] Cancellation preserves paid expiry; uncertain cancellation stays uncertain; next-tier choice does not activate/charge early; next-period checkout occurs after expiry.
- [ ] Two test phones/accounts exchange messages/photos/replies across multiple products in one conversation; switch threads rapidly and check stale-history isolation.
- [ ] Background/locked notification sound and sender identity, tapping to the exact chat/request/Support destination. Separate OS delivery from in-app message sync.
- [ ] Provider joins/responds in Town Hall without creating a request; admission double taps; reply targets; expiry/ended-request handling.
- [ ] Booking search and exact request notification, accept/reject/complete; availability capacity/date checks.
- [ ] Driver foreground opt-in/offline, permissions/GPS loss/background/reopen; no unintended availability resurrection.
- [ ] Previous paid orders, seller-settlement gates, ETA/time zones, version conflicts, bulk updates, manifests and native print dialog.
- [ ] Offline/slow-network failures are actionable and do not duplicate mutations or grant access. Report only time, action, status and sanitized request reference; never bearer headers, payment details or chat contents.

Provider API errors now expose only validated request references for correlation. No new analytics SDK or private-content logging was added. Crash/OS diagnostics require the installed build and device evidence; source checks cannot claim crash-free behavior.

## iOS limits

Windows cannot qualify Xcode native compilation, provisioning, APNs entitlements, iOS browser returns, camera/location dialogs, safe areas or physical-device sound. These need an approved macOS/EAS build path, appropriate Apple signing/enrollment and a physical iPhone. Android compile success does not establish iOS acceptance. Store billing remains a separate gate: direct Flutterwave digital subscription checkout is not silently enabled in Play/iOS store builds.

## Existing automated candidate evidence

Mobile: native workflow compilation at `8826bc7` passed in run 39871938430; later source changes are covered by source regressions. The staging guard adds a fifteenth provider suite and does not turn the compile-only artifact into a usable candidate.

Backend candidate `55613e3`: private contract CI run 39871523779 PASS; API/worker Docker and PostgreSQL provider/payment/messaging checks run 39873110097 PASS; Redis TLS, security/concurrency/vulnerability checks and synthetic recovery run 39873119341 PASS. These use isolated CI/synthetic resources and do not establish a deployed phone-reachable staging environment.

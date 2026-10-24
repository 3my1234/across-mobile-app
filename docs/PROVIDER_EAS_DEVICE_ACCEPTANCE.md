# Provider Android device candidate

Status: prepared, not built or deployed. The provider workflows are implemented in draft PR49. There is not yet a usable migrated APK. A successful compile-only artifact does not change the app installed on a phone.

## Current delivery choice ? normal EAS APK

The user will trigger the build personally when the approved minimal backend release is confirmed. Use provider-preview from the native-provider branch, not the ordinary preview/production profile (which does not enable the native workspace). This profile inherits the existing internal Android APK, application identity and remote signing, explicitly enables native/direct Android features, and uses the existing https://api.atlxpres.com backend. The cloud preview environment contains the required public Privy variable names; values/keystores are not printed or changed. The build hook fails if required public authentication settings or reviewed flags are missing.

The approved backend candidate is PR70 only, merged as65a159bea32b3176cb67065e835ee26f6daff50e. It adds the complete private service-edit read, optional exact owned request filter and private native test-push status read. Its five CI checks pass. Worker/API/replica deployment alignment still needs operator confirmation; merge/readiness alone do not prove those new routes are deployed. No PR66 foundation release is required for this APK.

When readiness and source alignment are confirmed, run from the mobile directory:

```powershell
eas build --platform android --profile provider-preview
```

Do not start a second build if submission is slow; inspect the first EAS build ID instead. Record the source commit, build ID and installation link. This is a same-identity replacement/update APK; no USB tunnel, new rented server, test-backend setup or store developer payment is required to compile/install it. Tests inside this selected existing-API build affect live records and payments, so use owned accounts and deliberate actions. Controlled synthetic/sandbox acceptance remains preferable for destructive/payment boundaries.

The provider-staging profile remains an optional fail-closed alternative for a separately reviewed staging origin. No such backend has been deployed; its absence is not a prerequisite to the selected normal APK flow. Expo build environment behavior and hooks: https://docs.expo.dev/eas/environment-variables/usage/ and https://docs.expo.dev/build-reference/npm-hooks/ .

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

Historical stacked backend candidate `55613e3`: private contract CI run 39871523779 PASS; API/worker Docker and PostgreSQL provider/payment/messaging checks run 39873110097 PASS; Redis TLS, security/concurrency/vulnerability checks and synthetic recovery run 39873119341 PASS. These use isolated CI/synthetic resources and do not establish a deployed phone-reachable staging environment.

Latest native application source f2074d3 adds map tap/drag/GPS/address search and private delivery diagnostics.19 provider suites/typecheck/lint PASS; Android native compile39885410547 PASS atf2074d3, including MapLibre. A subsequent compact-layout/doc refinement is recorded in the source history. Direct Flutterwave subscription checkout remains direct-Android-only, not store distribution. Keep PWA available and keep device/iOS acceptance open.

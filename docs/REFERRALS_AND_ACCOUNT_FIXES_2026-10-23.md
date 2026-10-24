# Referral, price and account-switch candidate

This source is prepared for a coordinated release, not deployed or phone-accepted. The user submits EAS personally. Keep the PWA and production services running.

## Corrected customer entry

The old shared JSON reader discarded a plain-text HTTP404 from /providers/me, converting the normal missing-business response into a connection/provider-access error. It now preserves error statuses even when the response is not JSON. Malformed successful responses and actual401/500 failures remain errors; they are not silently treated as customer accounts.

The provider request helper also lacked explicit permission for the shared GET/profile, GET/notifications and PATCH/notifications/read-all operations used by pending onboarding and the provider inbox. Those exact operations are permitted; unrelated shared writes remain rejected. The new test executes the actual reader, actual request helper and actual entry component together with a plain-text404, a prior provider preference and a different customer's session/email. It verifies correct new-token headers and customer entry. Previous component-level API mocks missed this integration gap.

The screenshot is evidence of the fallback being shown, not a captured network response. The source defect and its reproduction are verified; no live customer's token or records were accessed to diagnose it.

## Corrected product prices

Current price is authoritative from the catalogue response; an inactive raw flash-sale field no longer overrides it. Crossed prices are red and directly below the current price in cards and details. Smaller adaptive typography plus an exact concise currency format accommodates large values without K/M rounding or dropping real fractions.

The current backend omits ordinary compare_at_price outside flash sales. Backend PR71 corrects list/detail/recommendation/flash output with consistent delivery/currency/base-offer handling. Without that approved backend release the phone cannot invent missing compare prices. Public PostgreSQL tests verify actual endpoint results, including normal and flash prices, shipping and independent destination offers.

## Referral policy and native experience

Both customer Account and Provider workspace expose Refer and earn XP. The shared screen reads an authenticated code and aggregate statistics, shares a manual-entry invitation, and opens the existing XP balance/withdrawal UI. No client action grants XP or initiates payouts.

Optional referral codes are accepted on provider/customer email registration and customer Google entry. Codes are normalized and validated before creating a platform account. An unavailable/old backend fails closed for a nonempty code, rather than silently creating an unattributed signup. Signup with no code and normal existing-account sign-in remain compatible.

Approved rules:5 XP after a new referred account verifies; free providers remain at5 XP. The first confirmed qualifying500/1000/2000/5000 NGN provider-plan payment adds495 XP, for500 XP TOTAL for that attributed account. Renewals, upgrades, retries and multiple subscriptions do not repeat the bonus. Existing welcome/daily/review XP remain separate. The existing1000-XP/admin-reviewed withdrawal rules remain authoritative.

The new backend supports atomic attribution during email registration and new signed-Privy identity creation, not retroactive claims by existing accounts. It prevents self-attribution and duplicate credit and stores durable XP/notification events. Per-account uniqueness is not proof of unique humans; fraud/refund review remains part of payout operations. Share supports a code to enter manually; automatic app-install/deep-link attribution is not claimed. This new referral interface is native; the legacy PWA is retained without a new referral UI.

## Release requirements

Backend PR71 is based on deployed65a159b. It includes migration102, catalogue prices, native-provider email guidance and prerequisite authentication guards (retire unverified email-only Gmail login, default-off/nonproduction-only dev login; signed Privy and normal email/password remain). It overlaps the development-login guard in unmerged PR68, which must be reconciled rather than merged twice. PR66/67 are independent.

Migration102 starts referrals paused. After an approved API/worker/replica rollout and alignment check, an approved operator enables the existing database program row. Only then generate the next normal provider-preview APK. Do not run production migrations, change program state or merge/deploy without explicit approval. The release guide in backend docs/REFERRAL_REWARDS_RELEASE.md covers pausing and preserving ledger/security on rollback.

## Acceptance

Local gate has28 provider/native suites, including real transport entry, actual card/detail price rendering and actual referral API/UI/share behavior; TypeScript and existing marketplace/history/retry tests also apply. Backend financial tests run only in isolated PostgreSQL16 CI, including all102 migrations, concurrency and verified-payment/Google identity cases. Record exact commit/CI results in root HANDOVER.md; compile fixtures do not establish live phone behavior.

After release, test the same-phone provider logout/customer login, a provider's ordinary compare price with shipping/large amounts, a customer and a provider joining with an invite code, verification producing5 XP, and an intentionally authorized qualifying payment raising the referrer's total to500. A renewal must leave it at500. Do not create real charges merely as a readiness probe.

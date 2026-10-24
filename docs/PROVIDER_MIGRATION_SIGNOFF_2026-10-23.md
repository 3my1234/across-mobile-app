# Provider migration acceptance - entry-flow correction

23 October 2026. User-reported build44 feedback invalidated acceptance of the entry experience. Latest EAS metadata: provider-preview, ec9c8a0, build ba648177-0475-4c04-a66a-23270f99a884. Source confirms signup had no workspace choice and login always landed on customer home; provider tools were hidden under Account. This was an implementation gap, not evidence that provider data was lost.

The correction adds Customer/Provider registration selection, email-bound continuation through verification, automatic existing-provider detection on sign-in/session restoration, explicit error recovery, and a visible workspace switch. Provider tools are native by default, including normal preview/production builds; explicit false remains a rollback option. Backend authorization still controls publishing, verification and subscriptions. Existing customer access and chats remain with the same identity.

21 local provider suites and TypeScript pass; actual screen/entry callback interactions are tested. Fresh CI/native compilation must be checked for the final source. No corrected EAS APK or device acceptance is claimed until built and retested. User will submit EAS themselves.

The approved minimal backend compatibility release65a159b is already deployed to healthy aligned API/worker/replicas. This entry fix requires no further backend release, schema/runtime changes or new services. PR69 is closed as superseded; PR66/67/68 remain separate.

Provider screens remain native for onboarding, profile/documents, product/service management, subscriptions, availability, bookings, driver tools, chats/Town Hall, orders/bulk/ETA/manifests and Support/settings. Registration choice does not grant a provider role or create an organization without explicit application submission. Device acceptance must start from fresh registration and existing-provider login, then verify the full journeys.

Keep provider Coolify running. Older APKs, web users, email links, browser push and PWA checkout returns need an accepted transition. iOS/store billing, physical-device acceptance and measured scaling remain separate gates. No PWA shutdown or server configuration change accompanies this fix.

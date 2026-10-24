# Native provider migration parity

Updated 23 October 2026. The current control audit and media/onboarding qualification are in [PROVIDER_PREBUILD_AUDIT_2026-10-23.md](PROVIDER_PREBUILD_AUDIT_2026-10-23.md). That document replaces the superseded PR66/69/staging prerequisites and older test counts previously recorded here.

The mobile candidate reuses the existing API, authentication, provider records, subscriptions and conversations. Minimal compatibility PR70 is deployed as 65a159b. Native screens are the default; the explicit false flag retains the legacy rollback path. The provider PWA remains running.

Implementation coverage is not physical acceptance. Follow [PROVIDER_PHONE_ACCEPTANCE_2026-10-23.md](PROVIDER_PHONE_ACCEPTANCE_2026-10-23.md) with an existing provider and a new applicant before retiring the PWA or claiming migration acceptance. User submits EAS builds personally; no new build has been launched by the agent.

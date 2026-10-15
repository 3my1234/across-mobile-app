# Session restoration

Cold starts previously waited for GET /auth/session before opening the app.
Its five-second timeout made network/TLS/server delay part of the launch screen.
The same unexpired SecureStore session was already used as an offline fallback
after that wait.

Now the app reads its saved token/expiry together and opens immediately when
that local session is present and unexpired. Remote validation runs in the
background with its own deadline. HTTP 401/403 clears session state and returns
to authentication; temporary server/network failures retain the existing local
fallback. Protected API endpoints continue to authenticate every request.
Missing, expired, blank and nonfinite-expiry records never open the signed-in UI.

Startup generations and abort signals prevent a delayed SecureStore read or
old validation response from reopening after logout, changing a newer login,
or updating an unmounted app. The eight-second keychain watchdog also cancels
late restoration. Clearing session state is immediate; storage cleanup follows.

App-stage effects own initial profile/catalogue loading. Startup activity polling
establishes its baseline without loading orders/notifications a second time;
account changes discard stale activity responses.

Validation: scripts/test-session-startup.cjs stalls server responses and tests
rejection, expiry/corruption, unavailable storage, offline fallback, cancelled
reads, unmount and newer-account isolation. Run the regular mobile regressions,
TypeScript and local Android/iOS exports. A new EAS binary is required for users
to receive this code; no backend migration/configuration change is required.
Physical-phone cold-start timing still depends on native/JS initialization,
keychain/device speed and catalogue/image availability.

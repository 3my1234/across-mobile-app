# Message receipts

Product/service chats, shared private chats and Support show one gray tick for a
saved message, two gray ticks for recipient acknowledgement, and two blue ticks
for a read acknowledgement visible under both accounts' privacy preferences.
Town Hall uses Delivered to / Seen by counts. Indicators appear on outgoing
messages only and have accessible status labels.

Account -> Settings -> Privacy and storage -> Read receipts saves the preference
on the server. Turning it off hides read receipts in both directions; delivery
and the account's own unread counts continue working. Provider PWA uses the same
user preference; admin Support has its own authenticated admin preference.

useMessageReceipts acknowledges received history separately from visible items.
FlatList viewability requires 50% visibility for750ms before acknowledging read.
Foreground polls refresh only receipt metadata every5sec. Inbox previews use one
bounded delivery-only batch, never read. No message mutation is automatically
retried and receipt errors never block the composer or history. State lives in
memory, outside persistent chat snapshots; privacy/account generations discard
late responses. Unchanged metadata preserves component state.

Delivery is based on receiving-app synchronization, not an accepted push ticket.
An older client or a closed app that has not synchronized can remain at one tick.
This does not add background execution or require new native permissions.

Deploy backend migration091 before releasing clients (pending090 also fixes
provider message rollback). Deploy admin and standalone provider PWA separately;
installed PWA Refresh app. Build a new EAS binary from mobile main; the user runs
that build. No new secret or worker loop. Backend docs/MESSAGE_RECEIPTS.md gives
the API/privacy/cleanup details and rollout.

Tests: scripts/test-message-receipts.cjs covers acknowledgements, visibility,
batching, duplicate guards, indicators, Settings save, account and opt-out races,
and background polling. Existing composer, launch-settings and chat regressions
remain required. Verify actual cross-device Android/iOS/PWA receipt transitions
and both-sided opt-out after deployment; local bundle checks cannot replace this.

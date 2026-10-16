# Support fast-open device cache

Support previously used only the short-lived process-memory cache. After an app
restart, its ticket list and conversations required network history before text
could appear. It now also uses the existing encrypted privateChatStore, alongside
general chats. First visits still require the server.

The latest ticket page and latest message page are stored separately with their
server pagination cursors. On cold entry, disk hydration and the history request
run concurrently: saved history can paint first, then fresh messages merge in.
A successful network result prevents later disk reads from overwriting it. Actor,
request generation and current-ticket checks prevent late private data crossing
accounts or conversations. Hydration does not call unread-marking endpoints.
Live cursors replace hydrated cursors so intervening messages remain pageable.

Reuses the existing AES-GCM encrypted, bounded, seven-day snapshot store, with
the key in SecureStore, account isolation and logout/cache-clear behavior.
There are no plaintext chat bodies in AsyncStorage, no attachment downloads and
no new cloud backup or device backup requirement. PostgreSQL remains authoritative
and its off-server backups remain the recovery mechanism. This is not an added
offline send queue and does not remove network synchronization/polling traffic.

Provider workspace bridge permits only its existing chat keys plus explicit
support:inbox/support:UUID keys; trusted-origin and nonce checks remain.
Rollout requires a new user-run mobile build. No new permission, secret, database
migration, backend API or worker change. Validate cold reopen, slow/offline history,
pagination, logout/switch accounts and clear-local-history on real phones.

# Chat sending and keyboard layout

The product chat previously passed history loading as the composer's send-busy
state, disabling replies while cached messages were visible. History loading
and sending are now separate. The shared product/service/DM/Town Hall composer
shows its own sending spinner, blocks duplicate taps immediately and displays
send failures next to the draft. Text, attachments and location are retained
on failure; explicit retries keep the same client message reference. UUID
generation errors also release the send lock. Clients require a message ID and
timestamp before clearing the draft. No automatic mutation retries were added.

Community requests now retain their timeout through response-body reading.
Product/service requests already used the complete-body deadline. A stalled
body cannot keep the shared composer waiting indefinitely. Sending invalidates
an earlier product-thread lookup so a late read cannot reset the new thread.

KeyboardFrame measures the current full-screen root-relative native frame and
keyboard bounds. It only pads the actual remaining overlap: Android's native
adjustResize and navigation changes are measured rather than subtracted twice.
The old measureInWindow origin loses Android's visible-window top inset, and
the old KeyboardAvoidingView height calculation retained the original layout.
Keyboard metrics handle opening a chat while the keyboard is already visible.
The Town Hall bubble is hidden inside a service conversation, protecting its
composer from the draggable overlay. Send/attachment buttons retain their width.

Location sharing is available in ordinary product/service chats on mobile and
the provider portal, as well as shared private chats and admitted Hall rooms.
It does not require a driver listing. Users preview and explicitly send a static
pin; this does not start live tracking. The earlier 087–089 backend migrations
must already be deployed for profile/driver/location features.

Regression coverage: test-chat-composer.cjs, test-keyboard-frame.cjs,
test-community-api.cjs and existing product/service-chat scripts. Full mobile
regressions, TypeScript and local Android/iOS exports are the release checks.
These tests exercise component logic and geometry, not an Android/iOS keyboard.

Build a new EAS binary from main. On a physical Android phone and iPhone:

- Open product and service chats; send while history refreshes. Observe progress
  and the acknowledged message. Double tapping must produce one message.
- Interrupt the network during sending. Confirm an error and retained draft;
  restore the network and retry, confirming one delivered copy.
- Open/close the keyboard, enter multiline text, switch chats with keyboard open
  and rotate the phone. Composer and Send must remain above the keyboard with no
  spare gap when it closes. Check gesture and three-button Android navigation.
- Exchange a standalone pin and a text-plus-pin with a non-driver provider in
  mobile/PWA, including permission denial and removing the unsent preview.

No new migration, provider deployment or environment variable is needed for
this composer fix. No EAS build is submitted by this repository workflow.

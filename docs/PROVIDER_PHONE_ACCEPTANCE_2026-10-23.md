# Provider phone acceptance

Use the next APK built from `feat/native-provider-account`, including the provider entry correction and catalogue photo previews. An installed older APK will not acquire these changes automatically. The existing production API is used; changes made in the app affect real records. The PWA remains available during acceptance.

## Understand the two workspaces

- One login and one account identity. No second registration is needed for an existing provider.
- Customer workspace: browse products/services, buy, create Town Hall requests and view personal account details. A personal name/avatar can differ from the business name/logo.
- Provider workspace: business dashboard, products/services, verification documents, bookings/enquiries, orders, subscriptions, driver tools where applicable, customer conversations and Town Hall participation. Its header shows the business identity.
- Existing providers should enter the provider workspace after login. The customer header and Account page also provide a Provider workspace button. Back to customer returns to browsing without signing out.
- New email registration offers Customer or Provider before the form. This chooses the initial journey; business approval and subscriptions are still enforced by the server.

## Run in this order

Record PASS, FAIL or NOT TESTED for each row. Use an existing provider and a separate customer on another phone for messaging. Test new registration with an email you control, not by re-registering an existing provider.

| Check | Expected result |
| --- | --- |
| Existing provider sign-in | Business workspace opens; correct business name, logo/banner, approval and subscription details. No duplicate provider setup. |
| Relaunch and sign out/in | Same business is restored. No other account's data flashes on screen. |
| Switch workspaces | Customer browsing and provider management are clearly distinguishable. Switching preserves the same login and conversations. |
| Existing products and services | Correct titles, statuses and uploaded photos. Swipe through previews; tap the last image, then close it with Android Back. Search, status filters and Load more preserve correct results. Compare existing records with the PWA. |
| Existing listing editor | Correct saved images, description, location, pricing and service contacts appear. Cancel without saving first; saved data must remain unchanged. |
| Controlled publishing | Using a clearly designated test listing, exercise create/edit, image/video limits, location picker, draft save and submission. Approval remains required. Do not archive a real listing as a test. |
| Business profile | Saved business information and branding load correctly. Any intentional test edit retains unrelated fields. Personal identity remains separate from business branding. |
| Documents | Existing submission statuses appear. Uploaded private evidence is accessible only to its permitted account/reviewers. Drivers see licence, car and plate requirements. Do not upload dummy evidence for a real verification decision. |
| Subscription management | Current paid period, plan, prices, renewal mode and history match existing records. Review renewal/tier/cancellation controls. Do not confirm a purchase or cancellation merely to test navigation: this APK uses live billing. Record actual payment/cancellation acceptance separately when intentionally exercised. |
| Bookings and availability | Existing enquiries/bookings are correct. Exercise transitions and availability only with designated test records and consenting participants. Driver availability uses explicit location permission and stops when disabled. |
| Orders and fulfillment | Existing order/history reads work. Verify bulk selection, ETA and manifest screens where applicable. Do not mark real orders shipped or completed for testing. |
| Chat from a product/service | Opens the existing conversation with the right customer/provider; correct identity and history, no unrelated history flash or unwanted About/job-description text. Composer clears the phone navigation/keyboard. |
| Photo chat | Send a harmless test photo between the two consenting accounts. Verify upload, display and retry after a network interruption. |
| Notifications | With recipient app elsewhere, then backgrounded/phone locked, send a test message. Verify notification display, audible behavior subject to phone settings, sender image and tap navigation to the exact conversation. Sender must not receive a notification for their own message. Repeat in both directions. Queue acceptance is not proof of phone display or sound. |
| Town Hall | Customer can create a designated test request; provider can discover/respond but cannot create one. Approval is single-flight; admitted provider can chat immediately and reply to individual messages. Check closure/expiry separately; do not claim 24-hour expiry was tested without waiting or isolated test evidence. |
| Settings and Support | Correct account settings, notification diagnostics and support destination open. Notification test states reflect the actual delivery ledger; no false delivered/sounded claim. |
| Error recovery | Briefly disable internet during a read, restore it and retry. Show an actionable error without losing session or mixing account data. Do not repeatedly retry an uncertain payment or submission. |
| New Customer / Provider registration | Selected journey survives verification/login. Existing account is reused; choosing Provider cannot grant approval or paid access. |

Android acceptance does not establish iOS acceptance. Repeat platform-sensitive flows on an iPhone release build before claiming iOS readiness. No PWA retirement until accepted mobile workflows and remaining web links/users have a transition.

## Report one failure

Send: APK build/version, workspace and screen, steps, expected result, actual result, approximate time/timezone and a cropped screenshot. Exclude passwords, bearer tokens, verification links, payment details and other people's private content. A blocked or untested row stays open; successful compilation does not mark it passed.

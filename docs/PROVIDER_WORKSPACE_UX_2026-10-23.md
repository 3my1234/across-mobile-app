# Provider workspace and listing corrections

This batch responds to the phone observations and the supplied workspace redesign. It changes the native client only. Existing production API f811095, provider records, entitlement checks, referral policy and live PWA remain unchanged. The user submits EAS personally after source qualification.

## Service and product creation

The PWA's broad type select contains13 types, matching the previous mobile list. Its additional searchable service catalogue was missing from mobile. The exact37 groups and827 service names from admin-web/service-categories-data.js are now included, with bounded20-result search, group browsing, the same driver aliases and broad-type mappings, and custom service names. Professional service is the readable label for the existing artisan API type; no new backend types are invented.

The forms explain that customers message the provider to agree payment, delivery and work. Core details appear first; extra service fields, stock codes and timing controls are tucked into an optional section while defaults and all fetched edit fields are preserved. Pricing reads One set price, Price starts from, and Agree a price in chat, with explanations. Fixed/starting amounts preserve decimal input while payloads remain numeric. Quote mode still sends null price. Contact-only product payloads, required delivery offers, approval, location consent and server plan/media limits remain enforced.

Validation has field identities. Red messages and error borders appear at the relevant title, category, price, stock, image/video or location section. Saving an unconfirmed pin highlights the actual confirmation switch and scrolls to that section before sending a mutation. Selecting a pin does not silently consent to its accuracy. Gallery/GPS errors stay with media/location controls. General connection/unknown server failures remain explicit form errors; no mutations are replayed automatically.

## Navigation and interaction

One workspace Modal hosts embedded tools through ProviderPanel, keeping Overview, Listings, Bookings, Chats and More visible. The compact header uses the existing configured ATL logo. More groups business tools, documents, subscription/cancellation, historical orders, driver tools, Town Hall, referrals, preferences and support. Customer switching is an explicit More action. Customers enter the workspace from Account; the redundant global Provider workspace/swap header is removed.

Detail Back returns to its previous section. Embedded pages register their physical Back handler with the existing workspace window, including catalogue drafts, availability and fulfillment details. Unsaved catalogue drafts require confirmation before tab navigation; in-flight catalogue operations block leaving. Settings and Support opened from More have an account-bound return to provider tools. No second identity or data migration is introduced.

GPS/search/subscription progress belongs to the selected action. Other controls remain locked where needed to prevent conflicting operations, especially duplicate financial requests, but do not all fade or show a pressed/progress state together. Repeated plan labels use the plan ID to distinguish progress. The existing payment verification, pending-checkout recovery and renewal rules are preserved.

## Freeze investigation and limits

Verified source risks: major provider routes replaced the entire native Modal; referrals opened another sibling Modal; provider access reads depended on every view change; and heavy customer content plus catalogue/page refreshes stayed active underneath provider tools. The correction keeps the workspace window stable, embeds referrals, reads provider access independently of navigation, separates document reads, avoids callback-identity-driven support effects, and pauses/unmounts hidden customer catalogue/page content. Account and subscription refreshes preserve the active provider page.

These findings identify and remove reproducible lifecycle/refresh problems. There is no affected-phone crash trace or memory profile, so this is not a claim that every possible device freeze has been proven eliminated.

## Qualification and phone acceptance

The29-suite provider gate includes an actual workspace component fixture:120 parent rerenders keep Chats active, make only one provider-access read, keep five tabs and one primary window, and preserve context Back/unsaved navigation guards. Separate checks cover embedded physical Back registration, every original PWA service entry, group/search bounds and custom input, actual product/service location errors beside the switch, single-action GPS progress and decimal price saving. Existing subscription screen tests check unique plan progress while preserving duplicate-payment protection. Customer page tests verify hidden provider work does not install customer page timers. Existing media, account/session, messaging, notifications, fulfillment and subscription suites remain required. Record exact source/CI/Android compilation in root HANDOVER.md.

After the next qualified APK is installed, test an existing and a new provider: create/edit service and product drafts; choose a service outside the old broad list and type a custom one; try all price modes; omit location consent and verify the nearby red message; acquire GPS and confirm the map button does not appear activated. Verify tab navigation, draft-discard confirmation, physical Back through availability/details, documents, subscription, Settings/Support return, and Refer and earn XP from Overview and More. Remain in the workspace for at least15 minutes, move between pages, background/resume, then reopen referrals and chats. Confirm the active page and drafts are retained and the UI stays responsive. Record any freeze time, active screen and steps without sharing credentials or private messages. Use refresh/cancelled confirmation to check subscription feedback; do not create a charge merely as a diagnostic.

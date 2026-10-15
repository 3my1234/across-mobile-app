# Location cards

The user confirmed that their reported missing location message had not been
sent: both people stopped at the preview, which incorrectly used the same
"Shared location" heading as a sent message.

The composer now shows "Location ready to send" and "Not sent yet. Tap Send to
share this pin." A folded-map/pin vector makes it recognizable without loading
remote map tiles. It is an icon, not a geographic preview. The draft can be
removed or previewed in Maps and is transmitted only with the Send action.

Sent and received cards have separate Open map and Get directions actions.
Directions opens Google Maps with the shared coordinates as destination; Maps
can use its own location permission or ask for a starting point. Static pins
remain the location at the time sent, not automatic live location tracking.
URL syntax: https://developers.google.com/maps/documentation/urls/get-started

The provider portal uses the same labels and graphic. Its composer now requires
a message ID and timestamp in the server acknowledgement before clearing a
draft, matching mobile. Its update cache is v14. Deploy the provider resource
and select Refresh app in an installed PWA. A new EAS binary from mobile main
is needed; the user builds it. No new schema or backend deployment is required.

Validation: local PostgreSQL tests TestCommunityLocationPinsPrivateAndIdempotent
and TestProductChatMigrationPermissionsAttachmentsAndRetries passed, including
provider pin persistence and customer history retrieval. Mobile tests exercise
draft/received labels, explicit send, directions destination and invalid pins;
portal browser tests cover preview and received actions at four viewport widths.
These do not claim a production delivery failure; the confirmed issue was the
preview wording. Real-device map app routing remains an acceptance check.

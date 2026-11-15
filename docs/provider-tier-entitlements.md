# Provider tier comparison

Current backend rules (migrations 107, 111, 117 and pending119):

| Tier | Monthly NGN | Shared listings | Images/listing | New videos | Concurrent Town Hall requests | Exposure |
| --- | ---: | ---: | ---: | --- | ---: | --- |
| Free | 0 | 1 | 1 | None | 0 | Limited; no paid sponsorship |
| Bronze | 500 | 3 | 3 | None | 3 | Basic |
| Silver | 1000 | 10 | 5 | None | 5 | Standard |
| Diamond | 2000 | 25 | 8 | None | 8 | Enhanced |
| Gold | 5000 | 60 | 12 | 1/listing, 5/business, 180 seconds after119 | 10 | Premium |

The UI uses server-supplied plan limits, prices and usage; administrator changes remain authoritative. The older internal code `provider-diamond` now means Gold.

Products, services and active published jobs share the listing allowance. Unarchived product/service drafts count; job drafts do not. Closing, filling, expiry or admin removal releases a job's slot immediately. Republishing requires capacity. Existing paid publications/media are preserved when rules become stricter; this does not grant new uploads beyond the current policy. Three-minute duration is pending release of migration119 and compatible API/worker code; live remains30 seconds until that release. The new mobile build compresses locally before upload; actual reduction and HDR compatibility require phone acceptance. Gold video uploads are limited to 50 MiB each, 250 MiB stored per provider, 10 upload reservations/day and 2 pending reservations (migration111 defaults); uploads can be paused by the server.

All tiers support direct customer messaging and relevant recommendations after verification. Paid Town Hall search/filter access and participation require active paid eligibility. Promotion is subject to verification, relevance, availability, opt-out and fair rotation; exposure weights are Bronze1, Silver2, Diamond3 and Gold5, not guaranteed views, sales or positions. Browsing/applying to Jobs is free.

Sponsored viewing does not change entitlements. Published videos follow existing backend public-media policy; private verification documents never belong in ads. New viewer builds and physical-device acceptance are separate from production deployment and store publication.

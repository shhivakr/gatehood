Data model. projects, invites, buyers, notices, admins. Each notice stores audienceKeys (all, tower:A, unit:A-1204) derived from its audience. Reads live at notices/{id}/reads/{uid}, mirrored at buyers/{uid}/reads/{id}.

Feed query. audienceKeys array-contains-any [all, tower:X, unit:X-N], ordered by pinned desc, createdAt desc, served by a live listener whose limit grows by 15 per Load more. One composite index covers all three filters. I chose a growing limit over cursors so live inserts can't drop or duplicate items; the cost is re-reading earlier pages.

Read counts. A read is an idempotent write keyed by buyer uid, so retries and re-opens never double count. The builder's count uses server-side count(), which stays exact without a hot counter field. Unread is audience buyers minus read docs.

Security. The builder is an admins document. Invites can be fetched by code but not listed; a claim must be unclaimed, unexpired and set to the caller's uid. Tower and unit are copied from the invite, never trusted from the client. Buyers read only notices matching their keys and write only their own read doc.

Trade-offs. audienceKeys duplicates audience data for cheap queries. The JS SDK has no persistent cache on React Native, so page one is cached in AsyncStorage. Who hasn't read is computed on the client, fine for hundreds of units but it needs a Cloud Function at scale. Anonymous accounts are device-bound, and short invite codes lack rate limiting. No push notifications.

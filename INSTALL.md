# Receipt Portal — same squarelogs project

No new GitHub repo, Vercel project, secrets, API keys, or environment variables are required.

## Add
- `lib/receipts.ts`
- `lib/receipt-builder.ts`
- `app/api/receipts/route.ts`

## Replace
- `app/page.tsx`
- `app/globals.css`

If either existing file contains content you still need, merge it instead of overwriting it.

## Make one tiny edit
Open `app/api/poll-square/route.ts` and follow `PATCH-poll-square.md`.

Do not replace the whole poller. This keeps the working Square → UniFi integration intact.

## Existing Vercel variables reused
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `UNIFI_CONSOLE_ID`
- `UNIFI_CAMERA_ID`
- your existing Square credentials/settings

## Redis isolation
The portal uses new key names inside the same Upstash database:
- existing dedupe: `square-unifi:processed:*`
- receipts: `square-unifi:receipt:*`
- receipt index: `square-unifi:receipts:by-time`

It does not overwrite the existing dedupe keys.

## Deploy/test
1. Copy the files into the existing GitHub repo.
2. Make the small poller edit.
3. Commit/push.
4. Let the existing Vercel project redeploy.
5. Make a physical-register test sale.
6. Wait for the poller to process it.
7. Open the root site URL.
8. The receipt should appear and `View Footage` should open Protect about 20 seconds before the transaction.

## Important
Only transactions processed after this patch is deployed will be stored in the new receipt index. Historical backfill can be added separately later.

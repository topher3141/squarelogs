# Square → UniFi Protect POS (Polling Version)

This version polls Square once per minute instead of depending on Square payment webhooks.

## Production flow

Vercel Cron
→ `/api/poll-square`
→ Square `ListPayments` (5-minute lookback)
→ only `COMPLETED` payments
→ Upstash duplicate check
→ Square `RetrieveOrder`
→ UniFi Protect POS ingestion
→ Checkout camera timeline

## Preconfigured IDs

- Square location: `LB8AX8W6TMXKZ`
- UniFi console: `58D61F643B0E0000000009A9F63E000000000A325D6600000000692AA50E:1493167662`
- Checkout camera: `69c41ae4010ec003e400040c`

## New requirement: Upstash Redis

Create a small Upstash Redis database and add its REST credentials to Vercel:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

The database only stores processed Square payment IDs. Keys expire after 90 days.

## Recommended Vercel variables

Existing:
- `SQUARE_ACCESS_TOKEN`
- `SQUARE_API_VERSION=2026-07-15`
- `SQUARE_LOCATION_ID=LB8AX8W6TMXKZ`
- `POS_LOCATION_NAME=Deals & Steals`
- `UNIFI_API_KEY`
- `UNIFI_CONSOLE_ID`
- `UNIFI_CAMERA_ID`

New:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `CRON_SECRET` (recommended)

If keeping the diagnostic webhook route:
- `SQUARE_WEBHOOK_SIGNATURE_KEY`
- `SQUARE_WEBHOOK_NOTIFICATION_URL=https://squarelogs-virid.vercel.app/api/square-webhook`

## Cron

`vercel.json` schedules:

`* * * * *`

which calls `/api/poll-square` once per minute in production.

## Immediate test

Before waiting for cron, temporarily leave `CRON_SECRET` unset and visit:

`https://squarelogs-virid.vercel.app/api/poll-square`

You should get JSON showing:
- polling window
- payments found
- completed payments
- whether each payment was `sent` or `skipped`

Once confirmed, set a `CRON_SECRET` in Vercel and redeploy.

With `CRON_SECRET` enabled, Vercel Cron automatically sends:

`Authorization: Bearer <CRON_SECRET>`

so random visitors cannot manually trigger the poller.

## Duplicate protection

The poller intentionally searches the last 5 minutes every minute. Upstash stores every successfully-sent Square Payment ID for 90 days, so overlapping searches do not create duplicate Protect events.

A payment is marked processed only after UniFi accepts it.

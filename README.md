# Square → UniFi Protect POS

A small Next.js/Vercel integration that attaches completed Square POS transactions to a UniFi Protect camera timeline.

## What it does

1. Square sends `payment.updated` to `/api/square-webhook`.
2. The endpoint verifies Square's HMAC-SHA256 webhook signature.
3. Only `COMPLETED` payments continue.
4. It retrieves the Square Order to get line items.
5. It maps Square data to UniFi Protect's POS transaction schema.
6. It posts the transaction to the configured Protect camera through the UniFi remote connector.

## Preconfigured UniFi values

This project is prefilled for the Deals & Steals system:

- Console: Deals & Steals UNVR
- Checkout camera ID: `69c41ae4010ec003e400040c`
- Console ID: `58D61F643B0E0000000009A9F63E000000000A325D6600000000692AA50E:1493167662`

The API keys themselves are NOT included.

## Deploy to Vercel

### 1. Put this project in GitHub

Create a new repository and upload/push these files.

### 2. Import the repository into Vercel

Create a new Vercel project from the repository. Framework should auto-detect as Next.js.

### 3. Add Vercel environment variables

In Vercel → Project → Settings → Environment Variables, add:

- `SQUARE_ACCESS_TOKEN`
- `SQUARE_WEBHOOK_SIGNATURE_KEY`
- `SQUARE_WEBHOOK_NOTIFICATION_URL`
- `SQUARE_API_VERSION` = `2026-07-15`
- `SQUARE_LOCATION_ID` (optional but recommended)
- `POS_LOCATION_NAME` = `Deals & Steals`
- `UNIFI_API_KEY`
- `UNIFI_CONSOLE_ID`
- `UNIFI_CAMERA_ID`

Use `.env.example` as the template.

**Important:** `SQUARE_WEBHOOK_NOTIFICATION_URL` must exactly equal the production webhook URL entered in Square. Example:

`https://YOUR-VERCEL-DOMAIN.vercel.app/api/square-webhook`

Do not add/remove a trailing slash between Square and this variable.

### 4. Confirm the deployment

Open:

`https://YOUR-VERCEL-DOMAIN.vercel.app/api/health`

Expected response:

```json
{"ok":true,"service":"square-unifi-protect","time":"..."}
```

## Configure Square

In the Square Developer Console:

1. Open or create your application.
2. Use **Production** credentials for the real store.
3. Copy the Production Access Token into `SQUARE_ACCESS_TOKEN`.
4. Go to **Webhooks**.
5. Add a Production webhook endpoint:
   `https://YOUR-VERCEL-DOMAIN.vercel.app/api/square-webhook`
6. Subscribe to:
   - `payment.updated`
7. Copy that webhook subscription's **Signature Key** into:
   - `SQUARE_WEBHOOK_SIGNATURE_KEY`
8. Set `SQUARE_WEBHOOK_NOTIFICATION_URL` in Vercel to the exact same webhook URL.
9. Redeploy after changing environment variables.

The Square application needs access to read Payments and Orders.

## Recommended Square location lock

If this Square account contains more than one location, set:

`SQUARE_LOCATION_ID=YOUR_LOCATION_ID`

Then only payments from that location are sent to this Protect camera.

If the account contains only the Deals & Steals location, this can be left blank initially.

## Data mapping

| UniFi Protect | Square |
|---|---|
| `type` | Always `sale` |
| `externalId` | Square Payment ID |
| `amount` | `payment.amount_money.amount` |
| `currency` | `payment.amount_money.currency` |
| `lineItems[].title` | Square Order item name + variation |
| `lineItems[].quantity` | Square Order quantity |
| `location.id` | Square Location ID |
| `location.name` | `POS_LOCATION_NAME` |
| `paymentTypes[]` | Card brand or Square source type |
| `timestamp` | Square payment update time in milliseconds |

## Duplicate behavior

The code uses the stable Square Payment ID as UniFi `externalId`. It processes only the `COMPLETED` version of `payment.updated`.

Square can occasionally redeliver webhook notifications. The endpoint returns 200 only after Protect accepts the transaction. If you later observe duplicate Protect POS events from redelivery, add a persistent idempotency store (for example Vercel Redis / Upstash) keyed by Square Payment ID. Do not use in-memory deduplication on Vercel because serverless instances are ephemeral.

## Refunds

This first version intentionally handles sales only. Refund/return events should be implemented separately after confirming the exact UniFi `type` values accepted by the POS ingestion schema beyond `sale`.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

For webhook signature validation, a locally forwarded webhook URL must exactly match the URL used to calculate Square's signature.

## Security

- Never commit `.env.local`.
- Never put Square or UniFi keys in browser/client code.
- Revoke and rotate a key immediately if it is exposed.
- The webhook validates Square's `x-square-hmacsha256-signature` against the raw request body.

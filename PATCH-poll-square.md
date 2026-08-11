# Small edit to your existing poller

Do **not** replace your working `app/api/poll-square/route.ts`.

Add these imports near the top:

```ts
import { buildReceiptRecord } from "@/lib/receipt-builder";
import { saveReceiptRecord } from "@/lib/receipts";
```

After Protect successfully accepts the transaction, where you already have access to the Square `payment`, Square `order`, and Protect response, add:

```ts
const receiptRecord = buildReceiptRecord({
  payment,
  order,
  protectEventId: protectResult.eventId,
});

await saveReceiptRecord(receiptRecord);
```

Keep your existing physical-POS filter:

```ts
payment.status === "COMPLETED" &&
payment.id &&
payment.order_id &&
payment.application_details?.square_product === "RETAIL" &&
payment.device_details?.device_id
```

This means invoices, ecommerce orders and payment-link transactions are not stored in the portal.

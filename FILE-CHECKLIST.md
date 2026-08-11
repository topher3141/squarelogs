# COMPLETE FILE CHECKLIST

Your repo should contain ALL of these after copying this bundle:

app/
  layout.tsx
  page.tsx
  globals.css
  api/
    receipts/
      route.ts
    poll-square/
      route.ts   <-- your existing file, with the small patch from PATCH-poll-square.md

lib/
  receipts.ts
  receipt-builder.ts

If Vercel says it cannot resolve '@/lib/receipts', then `lib/receipts.ts` is missing from GitHub.

If Vercel says it cannot resolve '@/lib/receipt-builder', then `lib/receipt-builder.ts` is missing from GitHub.

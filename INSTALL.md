# Admin Login Patch

This protects the receipt portal without touching the working Square -> UniFi poller.

## 1. Add ONE Vercel environment variable

In Vercel:

Project -> Settings -> Environment Variables

Add:

ADMIN_PASSWORD

Set it to a strong password.

Apply it to Production (and Preview too if you want preview deployments protected).

You do NOT need to add an ADMIN_USERNAME variable.
The username is always:

admin

After adding the variable, redeploy the project.

## 2. Add these files

Copy these files to the matching paths in your GitHub repo:

- middleware.ts
- lib/auth.ts
- app/login/page.tsx
- app/api/auth/login/route.ts
- app/api/auth/logout/route.ts

## 3. Add the login styles

Open:

AUTH-STYLES.txt

Copy everything in it to the BOTTOM of your existing:

app/globals.css

Do not replace the existing stylesheet.

## 4. Push to GitHub

After Vercel deploys, opening the site root should redirect to:

/login

Login with:

Username: admin
Password: whatever you put in ADMIN_PASSWORD

## What is protected

Protected:
- /
- /api/receipts
- anything under /api/receipts/*

Not changed / not blocked:
- /api/poll-square
- /api/health
- /api/auth/login
- /api/auth/logout

So your existing Vercel cron continues running normally.

## Session security

The login creates a signed HMAC session cookie that:

- is HttpOnly
- is Secure in production
- uses SameSite=Lax
- expires after 12 hours
- cannot be forged without ADMIN_PASSWORD

The actual admin password is never stored in the browser.

## Logging out

A logout API route is included at:

POST /api/auth/logout

The current portal does not yet display a Logout button. Once login is confirmed working,
we can add a small Logout button to the receipt portal header.

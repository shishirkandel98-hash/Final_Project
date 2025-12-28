# Cloudflare Turnstile Integration Guide

## Overview

This guide explains the complete flow for integrating Cloudflare Turnstile CAPTCHA with cf_clearance cookie management for your login system.

## Setup Instructions

### 1. Cloudflare Configuration

Your Turnstile settings are already configured:
- **Site Key**: `0x4AAAAAACGDQuGequM3V9ER` (for `shishirkandel.page` and `www.shishirkandel.page`)
- **Secret Key**: `0x4AAAAAACGDQq0pkqe1tZs26j5KGhGuvVk`
- **Widget Mode**: Managed (shows checkbox + optional interactive challenge)
- **Hostnames**: Both `shishirkandel.page` and `www.shishirkandel.page`

### 2. Environment Variables

Your `.env` file is already configured:

```dotenv
VITE_TURNSTILE_SITE_KEY=0x4AAAAAACGDQuGequM3V9ER
VITE_SUPABASE_URL=https://otmikczyvabizskrtziw.supabase.co
VITE_SUPABASE_PROJECT_ID=otmikczyvabizskrtziw
VITE_SUPABASE_PUBLISHABLE_KEY=<your_key>
```

### 3. Supabase Edge Function Configuration

**CRITICAL: Add the Secret Key to Supabase**

1. Go to **Supabase Dashboard**
2. Navigate to **Edge Functions** → **verify-turnstile**
3. Click **Settings** → **Environment Variables**
4. Add:
   - **Name**: `TURNSTILE_SECRET_KEY`
   - **Value**: `0x4AAAAAACGDQq0pkqe1tZs26j5KGhGuvVk`
5. Click **Save** / **Deploy**

Without this, the backend cannot verify Turnstile tokens.

## How It Works

### Flow Diagram

```
1. User visits login page
   ↓
2. TurnstileWidget renders (src/components/TurnstileWidget.tsx)
   - Loads Cloudflare Turnstile script
   - Shows checkbox widget
   ↓
3. User completes CAPTCHA
   - Cloudflare returns a token
   - TurnstileWidget calls onVerify callback
   ↓
4. Frontend sends token to backend
   - POST to /functions/v1/verify-turnstile
   - Backend verifies with Cloudflare
   ↓
5. Backend returns cf_clearance
   - Frontend stores in cookie (src/lib/cookieUtils.ts)
   - Valid for 7 days
   ↓
6. User navigates to Auth page (login/signup)
   - Frontend retrieves cf_clearance from cookie
   - Includes in auth request
   ↓
7. Login succeeds
   - cf_clearance prevents Cloudflare blocking
   - User session created
```

## Code Components

### 1. TurnstileWidget Component
**File**: `src/components/TurnstileWidget.tsx`

Features:
- Renders the Cloudflare Turnstile widget
- Automatically verifies token with backend
- Stores cf_clearance in cookie
- Handles loading/error states

Props:
```typescript
{
  onVerify: (token: string) => void;        // Called when user completes CAPTCHA
  onError?: () => void;                     // Called on widget error
  onExpired?: () => void;                   // Called when verification expires
  onStatusChange?: (status: string) => void; // Called on status changes
  onCfClearanceReceived?: (clearance: string) => void; // Called when cf_clearance obtained
}
```

### 2. Cookie Utility
**File**: `src/lib/cookieUtils.ts`

Functions:
- `storeCfClearance(token)` - Store cf_clearance cookie
- `getCfClearance()` - Retrieve cf_clearance from cookies
- `setCookie(name, value, days)` - Generic cookie setter
- `getCookie(name)` - Generic cookie getter
- `removeCookie(name)` - Remove a cookie

### 3. Backend Verification Function
**File**: `supabase/functions/verify-turnstile/index.ts`

Endpoint: `POST /functions/v1/verify-turnstile`

Request:
```json
{
  "token": "Cloudflare Turnstile response token",
  "ip": "Optional user IP address"
}
```

Response (Success):
```json
{
  "success": true,
  "cf_clearance": "generated_clearance_token",
  "challenge_ts": "2024-12-11T10:30:00Z",
  "hostname": "shishirkandel.page",
  "verified_at": "2024-12-11T10:30:01Z"
}
```

Response (Failure):
```json
{
  "success": false,
  "error": "Verification failed",
  "codes": ["invalid-token"]
}
```

### 4. Auth Page Integration
**File**: `src/pages/Auth.tsx`

Login flow:
1. User enters email and password
2. Frontend retrieves cf_clearance from cookie
3. Sends login request with cf_clearance metadata
4. Cloudflare allows login because cf_clearance is present
5. User session is created

## Testing the Integration

### Local Testing

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Open the app:**
   - Navigate to `http://localhost:5173/`
   - You should see the Turnstile widget

3. **Complete the CAPTCHA:**
   - Check the box or complete the challenge
   - You should see "Verified successfully!" message

4. **Proceed to login:**
   - Click the link or navigate to `/auth`
   - The cf_clearance cookie is automatically included
   - Login should work without Cloudflare blocking

### Debugging

**Check Browser DevTools:**

1. **Console:**
   - Should see "CF Clearance obtained and stored"
   - Should see no errors from Turnstile script

2. **Network Tab:**
   - Filter for `api.js` (Turnstile script) - should be 200
   - Filter for `verify-turnstile` (backend call) - should be 200
   - Check response includes `cf_clearance`

3. **Application → Cookies:**
   - Should see `cf_clearance` cookie
   - Should have a 7-day expiration

**Supabase Function Logs:**

1. Go to **Supabase Dashboard** → **Edge Functions** → **verify-turnstile**
2. Click **Logs**
3. Look for:
   - `Verifying Turnstile token with Cloudflare...`
   - `Turnstile verification result: {success: true, ...}`

## Cloudflare Interstitial Issues

If you see the white "Verifying security status..." page instead of the Turnstile widget:

### Problem
Cloudflare's WAF or JS Challenge is blocking your page before the Turnstile widget can load.

### Solution
1. Go to **Cloudflare Dashboard** → **Security** → **Under Attack Mode** or **Bots**
2. **Option A (Recommended):** Disable Under Attack Mode
3. **Option B:** Add a Firewall Rule to bypass the challenge:
   - Rule: `(cf.threat_score < 10)`
   - Action: **Allow** (skip challenge)
4. **Option C:** Whitelist your IP address during development

## Production Checklist

- [ ] TURNSTILE_SECRET_KEY is set in Supabase function environment
- [ ] Site key matches the domain in Cloudflare Turnstile settings
- [ ] No Cloudflare WAF rules are blocking the Turnstile API endpoint
- [ ] cf_clearance cookie is being stored (7-day expiration)
- [ ] Login requests include cf_clearance in metadata
- [ ] Supabase function logs show successful verifications
- [ ] Error handling is in place for failed verifications
- [ ] Cookie security: Use `Secure` flag in production HTTPS environments

## Common Errors and Fixes

### Error: "TURNSTILE_SECRET_KEY not configured"
**Fix**: Add TURNSTILE_SECRET_KEY to Supabase function environment (see step 3 above)

### Error: "Turnstile verification failed"
**Fix**: 
1. Check Supabase function logs
2. Verify secret key is correct
3. Verify site key matches the domain

### Error: "CF Clearance not found" during login
**Fix**:
1. User must complete Turnstile first
2. Check browser cookies are enabled
3. Check cookie isn't expired (7 days)

### Cloudflare interstitial blocking widget
**Fix**: Disable or bypass the Cloudflare WAF challenge (see above)

## API Reference

### TurnstileWidget Props

```typescript
interface TurnstileWidgetProps {
  // Required
  onVerify: (token: string) => void;

  // Optional
  onError?: () => void;
  onExpired?: () => void;
  onStatusChange?: (status: "loading" | "ready" | "verified" | "error") => void;
  onCfClearanceReceived?: (clearance: string) => void;
}
```

### Cookie Functions

```typescript
// Store cf_clearance for 7 days
storeCfClearance(token: string): void

// Get cf_clearance from cookies
getCfClearance(): string | null

// Generic cookie operations
setCookie(name: string, value: string, days: number = 7): void
getCookie(name: string): string | null
removeCookie(name: string): void
```

### Backend Verification

```typescript
// Endpoint
POST /functions/v1/verify-turnstile

// Request
interface VerifyTurnstileRequest {
  token: string;    // Turnstile response token
  ip?: string;      // Optional user IP
}

// Response
interface VerifyTurnstileResponse {
  success: boolean;
  cf_clearance?: string;
  challenge_ts?: string;
  hostname?: string;
  verified_at?: string;
  error?: string;
  codes?: string[];
}
```

## Support

For issues or questions:
1. Check Supabase function logs
2. Check browser console for errors
3. Verify all environment variables are set
4. Check Cloudflare dashboard for WAF settings
5. Review the Cloudflare Turnstile docs: https://developers.cloudflare.com/turnstile/

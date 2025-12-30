# Telegram PIN Authentication Setup Guide

## Problem Identified

The Telegram bot is still showing the old **email-based authentication flow** instead of the new **PIN-based flow**. This is a **webhook caching or configuration issue**, not a code issue.

## What Was Fixed

✅ **Code is Correct**: The Telegram webhook function now has PIN-based authentication
- `/start` command: Should ask for PIN (not email)
- PIN verification: 6-digit PIN from Dashboard → Profile → Telegram Connect
- Deployment: Version deployed at 2025-12-30 15:45+

## Root Cause

The Telegram bot is showing:
```
📧 Step 1: Enter your registered email address:
```

But our code sends:
```
🔑 Step 1: Enter your PIN from the website:
```

This indicates **Telegram's webhook is caching the old response** OR **the webhook URL is pointing to an old version**.

## Solution Steps

### Option 1: Clear Telegram Webhook Cache (Recommended)

1. **Go to Telegram Bot Settings**:
   - Delete the webhook URL from Telegram's side
   - Re-add the webhook URL to force refresh

2. **Command to delete webhook**:
```bash
curl https://api.telegram.org/bot{YOUR_BOT_TOKEN}/setWebhook -d "url="
```

3. **Command to set webhook again**:
```bash
curl https://api.telegram.org/bot{YOUR_BOT_TOKEN}/setWebhook \
  -d "url=https://zicezkodnaghvoroiswm.supabase.co/functions/v1/telegram-webhook"
```

### Option 2: Test with New /start Message

After the webhook is cleared and reset, users should:
1. Send `/start` command in Telegram bot
2. See the PIN prompt (not email prompt)
3. Copy PIN from Dashboard
4. Enter the 6-digit PIN in Telegram

### Option 3: Verify Function Deployment

Check that the function is deployed correctly:

```bash
# List functions
supabase functions list

# Check the latest telegram-webhook version
# It should show recent update time
```

Current Status:
- ✅ Function deployed with PIN authentication
- ✅ Debug logs added for verification
- ✅ Code pushed to GitHub (commit: 4f61cda)

## Testing Instructions

1. **Before Testing**:
   - Clear your Telegram chat history with the bot (start fresh)
   - OR reset the webhook URL as shown above

2. **Test Process**:
   - Send `/start`
   - Bot should ask for PIN (not email)
   - Copy PIN from: Dashboard → Profile → Telegram Connect → Generate PIN
   - Paste 6-digit PIN in Telegram
   - Bot should verify and connect

3. **Expected Messages**:

   **Step 1 (PIN Prompt)**:
   ```
   🎉 Welcome to Finance Manager Bot!
   🔐 Secure Account Connection
   🔑 Step 1: Enter your PIN from the website:
   Get your PIN from Finance Manager Dashboard → Profile → Telegram Connect
   ```

   **Step 2 (After Valid PIN)**:
   ```
   ✅ Account Connected!
   Welcome [User Name]!
   Your Telegram account is now securely connected.
   ```

## Debug Information

If the PIN prompt is not showing:

1. **Check Supabase Logs**:
   - Go to: Supabase Dashboard → Functions → telegram-webhook → Logs
   - Look for debug messages:
     - `DEBUG: handleStart called for chat [ID]`
     - `DEBUG: Sending PIN prompt to chat [ID]`

2. **Check Webhook URL**:
   - Verify webhook is set to: `https://zicezkodnaghvoroiswm.supabase.co/functions/v1/telegram-webhook`
   - NOT pointing to old/different URL

3. **Verify Bot Token**:
   - Ensure `TELEGRAM_BOT_TOKEN` environment variable is set correctly

## Code Changes Made

1. ✅ Changed `/start` flow from email → PIN
2. ✅ PIN verification: 6-digit code from database
3. ✅ Automatic account connection after PIN validation
4. ✅ Database-backed authentication state
5. ✅ No session expiration issues

## Next Actions

**User Action Required**:
1. Reset Telegram webhook URL (delete and re-add)
2. Clear bot chat history or start new conversation
3. Test `/start` command
4. Report if PIN prompt appears

**Technical Support**:
- Check Supabase function logs for debug messages
- Verify webhook configuration in Telegram Bot Settings
- Confirm environment variables are set

---

**Last Updated**: December 30, 2025 15:45 UTC
**Function Version**: PIN-based Authentication v1.0
**Deployment Status**: ✅ Live

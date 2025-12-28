// ============================================
// TURNSTILE + CF_CLEARANCE QUICK START
// ============================================

// 1. INDEX PAGE (Turnstile Verification)
// src/pages/Index.tsx - ALREADY UPDATED

import { TurnstileWidget } from "@/components/TurnstileWidget";

export default function Index() {
  const [widgetStatus, setWidgetStatus] = useState("loading");

  const handleTurnstileVerify = async (token: string) => {
    // Token is verified and cf_clearance is stored automatically
    // by TurnstileWidget component
    console.log("Turnstile verified, cf_clearance stored in cookie");
    
    // Redirect to login after a delay
    setTimeout(() => {
      navigate("/auth");
    }, 1000);
  };

  return (
    <div>
      <TurnstileWidget
        onVerify={handleTurnstileVerify}
        onStatusChange={setWidgetStatus}
      />
    </div>
  );
}

// ============================================

// 2. LOGIN PAGE (Auth.tsx) - ALREADY UPDATED

import { getCfClearance } from "@/lib/cookieUtils";

export default function Auth() {
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    // Get cf_clearance from cookie (set by Turnstile widget)
    const cfClearance = getCfClearance();
    
    if (!cfClearance) {
      toast.error("Security verification expired. Please verify again.");
      return;
    }

    // Sign in (cf_clearance is automatically included in user metadata)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: {
        data: {
          cf_clearance: cfClearance, // Cloudflare won't block this request
          login_ip: clientIP,
          login_timestamp: new Date().toISOString(),
        }
      }
    });

    if (!error) {
      navigate("/dashboard");
    }
  };

  return (
    <form onSubmit={handleSignIn}>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button type="submit">Login</button>
    </form>
  );
}

// ============================================

// 3. COOKIE MANAGEMENT
// src/lib/cookieUtils.ts - ALREADY CREATED

import { getCfClearance, storeCfClearance } from "@/lib/cookieUtils";

// Store cf_clearance (done automatically by TurnstileWidget)
storeCfClearance("your_clearance_token");

// Retrieve cf_clearance (use in login)
const clearance = getCfClearance();
console.log("CF Clearance:", clearance);

// Remove cf_clearance (optional, on logout)
import { removeCookie } from "@/lib/cookieUtils";
removeCookie("cf_clearance");

// ============================================

// 4. BACKEND VERIFICATION
// supabase/functions/verify-turnstile/index.ts - ALREADY UPDATED

/*
POST /functions/v1/verify-turnstile

Request:
{
  "token": "Cloudflare Turnstile response token",
  "ip": "Optional user IP"
}

Response:
{
  "success": true,
  "cf_clearance": "base64_encoded_clearance_token",
  "challenge_ts": "2024-12-11T10:30:00Z",
  "hostname": "shishirkandel.page"
}
*/

// ============================================

// 5. FLOW DIAGRAM

/*
                    ┌─────────────────────┐
                    │   User visits /      │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ TurnstileWidget     │
                    │ renders & loads     │
                    │ Cloudflare script   │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ User completes      │
                    │ CAPTCHA             │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ Frontend sends      │
                    │ token to backend    │
                    │ /verify-turnstile   │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ Backend verifies    │
                    │ with Cloudflare &   │
                    │ generates cf_clearance
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ Frontend stores     │
                    │ cf_clearance cookie │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ Redirect to /auth   │
                    │ (login page)        │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ User enters email & │
                    │ password            │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ Frontend retrieves  │
                    │ cf_clearance cookie │
                    │ includes in request │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ Cloudflare sees     │
                    │ cf_clearance, allows│
                    │ login request       │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ User logged in ✓    │
                    │ Redirect to         │
                    │ /dashboard          │
                    └─────────────────────┘
*/

// ============================================

// 6. ENVIRONMENT VARIABLES CHECKLIST

/*
✓ Frontend (.env file):
  VITE_TURNSTILE_SITE_KEY=0x4AAAAAACGDQuGequM3V9ER
  VITE_SUPABASE_URL=https://otmikczyvabizskrtziw.supabase.co
  VITE_SUPABASE_PROJECT_ID=otmikczyvabizskrtziw

✓ Backend (Supabase function environment):
  TURNSTILE_SECRET_KEY=0x4AAAAAACGDQq0pkqe1tZs26j5KGhGuvVk
  
  Set this in: Supabase Dashboard → Edge Functions → verify-turnstile → Settings
*/

// ============================================

// 7. TESTING CHECKLIST

/*
□ Dev server running: npm run dev
□ Visit http://localhost:5173/
□ Turnstile widget loads
□ Can complete CAPTCHA
□ "Verified successfully!" message shown
□ Browser console shows "CF Clearance obtained and stored"
□ Cookie "cf_clearance" visible in DevTools
□ Click to go to /auth
□ Login fields appear
□ Can submit login form
□ Login succeeds without Cloudflare blocking

If Turnstile widget doesn't show:
□ Check browser console for errors
□ Check Network tab: api.js should load (200)
□ Check .env has correct VITE_TURNSTILE_SITE_KEY
□ Cloudflare dashboard: ensure no WAF blocking

If login fails:
□ Check Supabase function logs
□ Verify TURNSTILE_SECRET_KEY is set in function environment
□ Check cf_clearance cookie exists in browser
*/

// ============================================

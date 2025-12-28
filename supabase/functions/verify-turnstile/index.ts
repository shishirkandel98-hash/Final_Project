import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Verify Turnstile token and return cf_clearance cookie
 * 
 * Backend Secret Key: Set as TURNSTILE_SECRET_KEY in Supabase function environment
 * 
 * Request body:
 * {
 *   "token": "Turnstile response token from frontend",
 *   "ip": "Optional IP address of the user"
 * }
 * 
 * Response on success:
 * {
 *   "success": true,
 *   "cf_clearance": "clearance_token",
 *   "challenge_ts": "timestamp",
 *   "hostname": "your-domain.com"
 * }
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, ip } = await req.json();

    if (!token) {
      console.error("Missing Turnstile token");
      return new Response(
        JSON.stringify({ success: false, error: "Missing token" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use environment secret or Cloudflare's test secret key
    // Test secret: 1x0000000000000000000000000000000AA (always passes)
    const secretKey = Deno.env.get('TURNSTILE_SECRET_KEY') || '1x0000000000000000000000000000000AA';
    
    if (!secretKey) {
      console.error("TURNSTILE_SECRET_KEY not configured, using test key");
    }

    // Verify with Cloudflare
    const formData = new FormData();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (ip) {
      formData.append('remoteip', ip);
    }

    console.log("Verifying Turnstile token with Cloudflare...");

    const verifyResponse = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        body: formData,
      }
    );

    const result = await verifyResponse.json();
    console.log("Turnstile verification result:", JSON.stringify(result));

    if (result.success) {
      // Generate a cf_clearance token
      // In production, this should be a secure, randomly generated token
      // For now, we'll create a simple clearance that includes verification metadata
      const cf_clearance = generateCfClearance(token, result.challenge_ts);

      return new Response(
        JSON.stringify({
          success: true,
          cf_clearance: cf_clearance,
          challenge_ts: result.challenge_ts,
          hostname: result.hostname,
          verified_at: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.error("Turnstile verification failed:", result['error-codes']);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Verification failed",
          codes: result['error-codes'],
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Turnstile verification error:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Generate a cf_clearance token (for development)
 * In production, you should use a more secure method like signed JWT or session ID
 */
function generateCfClearance(token: string, challengeTs: string): string {
  // Create a simple clearance token combining verification data
  const clearanceData = {
    verified: true,
    token_hash: hashString(token.substring(0, 20)),
    challenge_ts: challengeTs,
    issued_at: new Date().toISOString(),
  };

  // Encode as base64 for transport
  return btoa(JSON.stringify(clearanceData));
}

/**
 * Simple hash function (for development)
 * In production, use a proper crypto function
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}


import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, email, password, ip_address, user_agent } = await req.json();

    console.log(`Rate limit auth request: ${action} from IP: ${ip_address}`);

    // Check rate limit
    const { data: canProceed, error: rateLimitError } = await supabase
      .rpc('check_rate_limit', { check_ip: ip_address, window_minutes: 2, max_attempts: 5 });

    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError);
      throw new Error('Rate limit check failed');
    }

    if (!canProceed) {
      // Log the blocked attempt
      await supabase.from('login_attempts').insert({
        ip_address,
        email,
        success: false,
        user_agent
      });

      return new Response(
        JSON.stringify({ 
          error: 'Too many login attempts. Please wait 2 minutes before trying again.',
          rate_limited: true 
        }),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    let authResult;
    
    if (action === 'signin') {
      authResult = await supabase.auth.signInWithPassword({ email, password });
    } else if (action === 'signup') {
      const { first_name, last_name, phone, country } = await req.json().catch(() => ({}));
      authResult = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { first_name, last_name, phone, country }
        }
      });
    } else {
      throw new Error('Invalid action');
    }

    // Log the attempt
    const success = !authResult.error;
    await supabase.from('login_attempts').insert({
      ip_address,
      email,
      success,
      user_agent
    });

    if (authResult.error) {
      console.error('Auth error:', authResult.error);
      return new Response(
        JSON.stringify({ error: authResult.error.message }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // If login successful, create session record
    if (success && authResult.data.user) {
      await supabase.from('user_sessions').insert({
        user_id: authResult.data.user.id,
        ip_address,
        user_agent
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: authResult.data.user,
        session: authResult.data.session 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Rate limit auth error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

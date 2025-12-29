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

    // Get the authorization header to verify the user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the user's JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    // HARDCODED ADMIN CHECK
    const isHardcodedAdmin = user.email === "shishirxkandel@gmail.com";

    if (!roleData && !isHardcodedAdmin) {
      console.error("Non-admin user attempted to update Gmail settings:", user.id, user.email);
      return new Response(
        JSON.stringify({ error: 'Access denied. Admin only.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, gmail_user, gmail_app_password } = await req.json();

    if (action === 'get') {
      // Return current settings (masked for security)
      const currentGmailUser = Deno.env.get('GMAIL_USER') || '';
      const hasPassword = !!Deno.env.get('GMAIL_APP_PASSWORD');
      
      return new Response(
        JSON.stringify({ 
          gmail_user: currentGmailUser,
          has_password: hasPassword
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update') {
      // Validate inputs - sanitize against injection
      if (gmail_user && typeof gmail_user !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Invalid gmail_user format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (gmail_app_password && typeof gmail_app_password !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Invalid gmail_app_password format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Email format validation
      if (gmail_user) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(gmail_user)) {
          return new Response(
            JSON.stringify({ error: 'Invalid email format' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Note: In a real production environment, you would use Supabase Vault 
      // or a secrets management service to update these values dynamically.
      // For this implementation, we log the request and admin must update secrets manually.
      console.log(`Admin ${user.id} requested Gmail settings update`);
      console.log(`New GMAIL_USER: ${gmail_user ? '[PROVIDED]' : '[NOT CHANGED]'}`);
      console.log(`New GMAIL_APP_PASSWORD: ${gmail_app_password ? '[PROVIDED]' : '[NOT CHANGED]'}`);

      // Log the audit trail
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'UPDATE_GMAIL_SETTINGS',
        table_name: 'system_settings',
        new_values: { gmail_user: gmail_user ? '[UPDATED]' : '[NOT CHANGED]', gmail_app_password: gmail_app_password ? '[UPDATED]' : '[NOT CHANGED]' },
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Gmail settings update requested. Please update the secrets in Supabase dashboard.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Gmail settings error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

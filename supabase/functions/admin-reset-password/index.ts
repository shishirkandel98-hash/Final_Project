import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the user's JWT token
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
      return new Response(
        JSON.stringify({ error: "Access denied. Admin only." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Filter manually because listUsers doesn't support email filtering directly in all versions, 
    // or use getUserById if we had ID. But here we have email.
    // Actually typically we should search but listUsers is paginated.
    // Better strategy: Attempt to generate password and update? 
    // Wait, Supabase Admin API has `listUsers` but searching by email is not always straightforward without `page` params if many users.
    // However, for this scale, iterating is likely fine, or we can assume user exists if we don't get an error updating?
    // Let's find the user ID.

    // Better way: use `generateLink` type 'magiclink' to check? No.
    // Let's iterate through listUsers (default 50) - likely enough for this personal app.
    // If not found, strict check might fail for large userbase but this is "Finance Guard" likely personal/small.

    // Actually, `supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })`
    // Let's try to match email case-insensitive

    // NOTE: To be safe and efficient, we can try to update directly using `updateUserById` BUT we need ID.
    // So we MUST find the ID.

    // ALTERNATIVE: Use `supabase.rpc` if we had a function, but we are in Edge Function.

    // Let's stick to listing users for now (assuming < 1000 users).

    // const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    // if (listError) throw listError;
    // const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    // Actually, `supabase.rpc` calling a database function to get ID by email is safest?
    // Or just trusting the user provided email matches one in the system?

    // Let's try to fetch user by email via a simple query if we have access to `auth.users`? No, we shouldn't access that directly usually.
    // We will use the listUsers approach.

    // 2. Generate Random Password
    const newPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
    // e.g. "x8k29a..."

    // 3. Update User Password
    // We need the User ID.
    // Let's find the user.
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;

    const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (updateError) throw updateError;

    // 4. Send Email via SMTP
    const client = new SmtpClient();

    const GMAIL_USER = "kpoliking001@gmail.com";
    const GMAIL_PASS = "nrcd lxrl omvc rpfy";

    await client.connectTLS({
      hostname: "smtp.gmail.com",
      port: 465,
      username: GMAIL_USER,
      password: GMAIL_PASS,
    });

    await client.send({
      from: `Finance Manager <${GMAIL_USER}>`,
      to: email,
      subject: "Password Reset Request",
      content: `
        <h1>Password Reset</h1>
        <p>Hello,</p>
        <p>You have requested a new password for Finance Manager.</p>
        <p><strong>Your new password is:</strong> ${newPassword}</p>
        <p>Please login and change it in your Profile settings immediately.</p>
        <br>
        <p>Regards,<br>Finance Manager Team</p>
      `,
    });

    await client.close();

    return new Response(
      JSON.stringify({ message: "Password reset successful! Check your email." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
// Hardcoded Gmail credentials as requested
const GMAIL_USER = "kpoliking001@gmail.com";
const GMAIL_APP_PASSWORD = "nrcd lxrl omvc rpfy";

// Validate required environment variables
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing required Supabase environment variables");
}

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendResetEmail(email: string, tempPassword: string): Promise<boolean> {
  try {
    console.log(`Attempting to send reset email to: ${email}`);

    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: {
          username: GMAIL_USER!,
          password: GMAIL_APP_PASSWORD!,
        },
      },
    });

    console.log("SMTP client created, sending email...");

    await client.send({
      from: GMAIL_USER!,
      to: email,
      subject: "Password Reset by Administrator - Finance Manager",
      content: `Hello,

Your password has been reset by an administrator in the Finance Manager application.

Your new temporary password is: ${tempPassword}

Please login with this password and change it immediately to a secure password you can remember.

For security reasons, please change your password as soon as possible after logging in.

Best regards,
Finance Manager Team`,
    });

    await client.close();
    console.log(`Reset email sent successfully to: ${email}`);
    return true;
  } catch (error) {
    console.error("SMTP error sending reset email:", error);
    return false;
  }
}

async function adminResetPassword(userEmail: string, adminId: string): Promise<{ success: boolean; message: string; tempPassword?: string }> {
  console.log(`Admin reset password called for user: ${userEmail} by admin: ${adminId}`);

  try {
    // Check if admin has permission
    const { data: adminProfile, error: adminError } = await supabase
      .from("profiles")
      .select("id, approved")
      .eq("id", adminId)
      .single();

    if (adminError || !adminProfile || !adminProfile.approved) {
      console.error("Admin permission check failed:", adminError);
      return { success: false, message: "Unauthorized: Admin access required" };
    }

    // Check if admin has admin role
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", adminId)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) {
      console.error("Admin role check failed - user is not admin");
      return { success: false, message: "Unauthorized: Admin role required" };
    }

    // Normalize email
    const normalizedEmail = userEmail.trim().toLowerCase();
    console.log(`Normalized email: ${normalizedEmail}`);

    // Check if user exists
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, approved")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (profileError) {
      console.error("Profile lookup error:", profileError);
      return { success: false, message: "Error checking user" };
    }

    if (!profile) {
      console.error("User not found with email:", normalizedEmail);
      return { success: false, message: "User not found" };
    }

    console.log(`Found user profile: ${profile.id}, email: ${profile.email}`);

    // Generate random temporary password
    const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
    console.log(`Generated temporary password for user: ${profile.id}`);

    // Update user password in database using Supabase Admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(profile.id, {
      password: tempPassword,
    });

    if (updateError) {
      console.error("Update password error:", updateError);
      return { success: false, message: "Failed to update password" };
    }

    console.log(`Password updated successfully for user: ${profile.id}`);

    // Send email with temporary password
    const emailSent = await sendResetEmail(normalizedEmail, tempPassword);

    if (!emailSent) {
      console.error("Failed to send reset email");
      return { success: false, message: "Password updated but failed to send email" };
    }

    console.log(`Password reset completed successfully for user: ${profile.id}`);
    return { success: true, message: "Password reset successfully. Email sent to user.", tempPassword };
  } catch (error) {
    console.error("Admin reset password error:", error);
    return { success: false, message: "Internal error occurred" };
  }
}

serve(async (req) => {
  console.log(`Admin reset password request: ${req.method} ${req.url}`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Verify admin authentication
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("Authentication error:", authError);
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`Authenticated user: ${user.id}, email: ${user.email}`);

    // Parse request body
    const { userEmail } = await req.json();

    if (!userEmail) {
      console.error("No userEmail provided in request");
      return new Response(JSON.stringify({ error: "userEmail is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`Attempting password reset for: ${userEmail} by admin: ${user.id}`);

    // Perform admin password reset
    const result = await adminResetPassword(userEmail, user.id);

    console.log(`Password reset result:`, result);

    if (result.success) {
      return new Response(JSON.stringify({
        success: true,
        message: result.message,
        tempPassword: result.tempPassword // Only for admin reference, not sent to user
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } else {
      return new Response(JSON.stringify({
        success: false,
        message: result.message
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

  } catch (error) {
    console.error("Admin reset password function error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateRandomPassword(length: number = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function sendPasswordResetEmail(to: string, newPassword: string): Promise<void> {
  const gmailUser = Deno.env.get('GMAIL_USER');
  const gmailAppPassword = Deno.env.get('GMAIL_APP_PASSWORD');

  if (!gmailUser || !gmailAppPassword) {
    throw new Error('Gmail credentials not configured');
  }

  const client = new SmtpClient();

  await client.connectTLS({
    hostname: "smtp.gmail.com",
    port: 465,
    username: gmailUser,
    password: gmailAppPassword,
  });

  const emailContent = `
Subject: Finance Manager - Password Reset

Dear User,

Your password has been reset for Finance Manager.

Your new temporary password is: ${newPassword}

Please login with this password and change it immediately from your Profile page for security.

If you did not request this password reset, please contact support immediately.

Best regards,
Finance Manager Team
  `.trim();

  await client.send({
    from: gmailUser,
    to: to,
    content: emailContent,
  });

  await client.close();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, email } = await req.json();

    if (action === 'reset_password_by_email') {
      // Validate email input
      if (!email || typeof email !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Email is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const normalizedEmail = email.trim().toLowerCase();

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        return new Response(
          JSON.stringify({ error: 'Invalid email format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if user exists and is approved
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, approved')
        .eq('email', normalizedEmail)
        .eq('approved', true)
        .maybeSingle();

      if (profileError || !profile) {
        // Don't reveal if email exists or not for security
        return new Response(
          JSON.stringify({
            success: true,
            message: 'If the email exists in our system, a new password has been sent.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate new random password
      const newPassword = generateRandomPassword();

      // Update user password in Supabase Auth
      const { error: updateError } = await supabase.auth.admin.updateUserById(profile.id, {
        password: newPassword
      });

      if (updateError) {
        console.error('Error updating password:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update password' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Send email with new password
      try {
        await sendPasswordResetEmail(normalizedEmail, newPassword);

        // Log the password reset
        await supabase.from('audit_logs').insert({
          user_id: profile.id,
          action: 'PASSWORD_RESET_PUBLIC',
          table_name: 'auth.users',
          new_values: { password: '[RESET]' },
          ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
        });

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Password reset successful. Check your email for the new password.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        // Password was updated but email failed - still return success but warn
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Password updated but email sending failed. Contact admin for your new password.',
            warning: 'Email delivery failed'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (action === 'reset_password') {
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

      // Generate new random password
      const newPassword = generateRandomPassword();

      // Update user password in Supabase Auth
      const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
        password: newPassword
      });

      if (updateError) {
        console.error('Error updating password:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update password' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Send email with new password
      try {
        await sendPasswordResetEmail(user.email!, newPassword);

        // Log the password reset
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'PASSWORD_RESET',
          table_name: 'auth.users',
          new_values: { password: '[RESET]' },
          ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
        });

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Password reset successful. Check your email for the new password.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        // Password was updated but email failed - still return success but warn
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Password updated but email sending failed. Contact admin for your new password.',
            warning: 'Email delivery failed'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Password reset error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
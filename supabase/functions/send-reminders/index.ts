import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Hardcoded Gmail credentials as requested
const GMAIL_USER = "kpoliking001@gmail.com";
const GMAIL_APP_PASSWORD = "nrcd lxrl omvc rpfy";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendReminderEmail(email: string, title: string, message: string): Promise<boolean> {
  try {
    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: {
          username: GMAIL_USER,
          password: GMAIL_APP_PASSWORD,
        },
      },
    });

    await client.send({
      from: `"Finance Manager" <${GMAIL_USER}>`,
      to: email,
      subject: `📅 ${title}`,
      content: `Hi there,

Here's your scheduled reminder:

📝 ${message}

⏰ Reminder set for: ${new Date().toLocaleString()}

This is an automated message from your Finance Manager application.
Please do not reply to this email.

Best regards,
Finance Manager Team
📊 Track your finances with ease`,
      headers: {
        "X-Mailer": "Finance Manager Reminder System",
        "X-Priority": "1",
        "Importance": "high",
      },
    });

    await client.close();
    return true;
  } catch (error) {
    console.error("SMTP error:", error);
    return false;
  }
}

async function processReminders() {
  const now = new Date();
  console.log(`Processing reminders at ${now.toISOString()}`);

  try {
    // Get all active reminders that are due
    const { data: dueReminders, error: fetchError } = await supabase
      .from("reminders")
      .select(`
        id,
        user_id,
        title,
        message,
        reminder_date,
        reminder_email,
        is_recurring,
        recurrence_count,
        recurrence_interval,
        recurrence_end_date,
        email_sent_count
      `)
      .eq("is_active", true)
      .lte("reminder_date", now.toISOString())
      .gt("email_sent_count", 0); // Has remaining sends

    if (fetchError) {
      console.error("Error fetching reminders:", fetchError);
      return;
    }

    console.log(`Found ${dueReminders?.length || 0} due reminders`);

    for (const reminder of dueReminders || []) {
      try {
        const userEmail = reminder.reminder_email;

        // Send the email
        const emailSent = await sendReminderEmail(userEmail, reminder.title, reminder.message);

        if (emailSent) {
          // Update the reminder
          const updateData: any = {
            email_sent_count: reminder.email_sent_count - 1,
            last_sent_at: now.toISOString(),
          };

          // Handle recurring reminders
          if (reminder.is_recurring && reminder.email_sent_count > 1) {
            // Calculate next reminder date
            const nextDate = new Date(reminder.reminder_date);

            switch (reminder.recurrence_interval) {
              case "daily":
                nextDate.setDate(nextDate.getDate() + 1);
                break;
              case "weekly":
                nextDate.setDate(nextDate.getDate() + 7);
                break;
              case "monthly":
                nextDate.setMonth(nextDate.getMonth() + 1);
                break;
            }

            // Check if we've reached the end date or max count
            const shouldContinue = !reminder.recurrence_end_date ||
              nextDate <= new Date(reminder.recurrence_end_date);

            if (shouldContinue) {
              updateData.reminder_date = nextDate.toISOString();
            } else {
              updateData.is_active = false;
            }
          } else if (reminder.email_sent_count <= 1) {
            // No more sends remaining
            updateData.is_active = false;
          }

          const { error: updateError } = await supabase
            .from("reminders")
            .update(updateData)
            .eq("id", reminder.id);

          if (updateError) {
            console.error(`Error updating reminder ${reminder.id}:`, updateError);
          } else {
            console.log(`Successfully sent reminder ${reminder.id} to ${userEmail}`);
          }
        } else {
          console.error(`Failed to send email for reminder ${reminder.id}`);
        }
      } catch (error) {
        console.error(`Error processing reminder ${reminder.id}:`, error);
      }
    }

  } catch (error) {
    console.error("Error in processReminders:", error);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // This function can be called manually or via cron
    await processReminders();

    return new Response(JSON.stringify({
      success: true,
      message: "Reminders processed successfully"
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Send reminders function error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
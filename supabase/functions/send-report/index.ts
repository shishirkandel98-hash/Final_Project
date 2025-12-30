import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReportRequest {
  userEmail: string;
  reportType: "daily" | "weekly" | "monthly";
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      console.error("Auth error:", userError);
      throw new Error("Unauthorized - Invalid token");
    }

    const { userEmail, reportType }: ReportRequest = await req.json();

    // Get user profile for personalized greeting
    const { data: userProfile } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    const userName = userProfile?.full_name || user.email?.split("@")[0] || "User";

    const { data: transactions } = await supabaseClient
      .from("transactions")
      .select("*")
      .eq("user_id", user.id);

    const { data: loans } = await supabaseClient
      .from("loans")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active");

    const { data: bankAccounts } = await supabaseClient
      .from("bank_accounts")
      .select("*")
      .eq("user_id", user.id);

    const totalIncome = transactions?.filter((t) => t.type === "income").reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0) || 0;
    const totalExpenses = transactions?.filter((t) => t.type === "expense").reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0) || 0;
    const balance = totalIncome - totalExpenses;
    const totalLoans = loans?.reduce((sum, l) => sum + parseFloat(l.amount.toString()), 0) || 0;
    const totalBankBalance = bankAccounts?.reduce((sum, b) => sum + parseFloat(b.current_balance.toString()), 0) || 0;

    // Create professional email HTML (clean, minimal colors)
    const emailHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="font-family:'Segoe UI',Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;background:#f5f5f5;"><div style="max-width:650px;margin:0 auto;background:white;"><div style="background:#1e40af;color:white;padding:30px;text-align:center;"><h1 style="margin:0;font-size:24px;font-weight:600;">Financial Statement</h1><p style="margin:10px 0 0 0;font-size:14px;opacity:0.9;">${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report</p></div><div style="padding:30px;"><p style="font-size:15px;margin:0 0 20px 0;color:#555;">Dear ${userName},</p><p style="font-size:14px;color:#666;margin:0 0 20px 0;line-height:1.7;">I trust this message finds you well. Please find your financial statement for the ${reportType} period below. For the complete PDF statement with detailed breakdown, please log in to your Finance Manager account.</p><div style="background:#f8f9fa;border-left:4px solid #1e40af;padding:20px;margin:20px 0;border-radius:4px;"><h3 style="margin:0 0 15px 0;color:#1e40af;font-size:15px;">Summary Overview</h3><table style="width:100%;border-collapse:collapse;font-size:14px;"><tr><td style="padding:8px 0;color:#666;">Total Income</td><td style="text-align:right;font-weight:600;color:#10b981;">NPR ${totalIncome.toFixed(2)}</td></tr><tr><td style="padding:8px 0;color:#666;">Total Expenses</td><td style="text-align:right;font-weight:600;color:#ef4444;">NPR ${totalExpenses.toFixed(2)}</td></tr><tr style="border-top:2px solid #e5e7eb;"><td style="padding:8px 0;color:#333;font-weight:600;">Net Balance</td><td style="text-align:right;font-weight:600;color:#1e40af;padding:8px 0;">NPR ${balance.toFixed(2)}</td></tr></table></div><div style="background:#f8f9fa;border-left:4px solid #1e40af;padding:20px;margin:20px 0;border-radius:4px;"><h3 style="margin:0 0 15px 0;color:#1e40af;font-size:15px;">Bank Accounts Summary</h3><div style="font-size:14px;color:#666;">${bankAccounts && bankAccounts.length > 0 ? bankAccounts.map(bank => `<div style="padding:8px 0;display:flex;justify-content:space-between;"><span>${bank.bank_name}</span><span style="font-weight:600;">NPR ${parseFloat(bank.current_balance.toString()).toFixed(2)}</span></div>`).join('') : '<div style="padding:8px 0;color:#999;">No bank accounts added</div>'}</div><div style="border-top:2px solid #e5e7eb;margin-top:10px;padding-top:10px;display:flex;justify-content:space-between;font-weight:600;color:#1e40af;"><span>Total Bank Balance</span><span>NPR ${totalBankBalance.toFixed(2)}</span></div></div><div style="background:#e3f2fd;border:1px solid #1e40af;padding:15px;margin:20px 0;border-radius:4px;text-align:center;"><p style="margin:0;font-size:13px;color:#1e40af;"><strong>Complete Bank Statement</strong><br><span style="font-size:12px;">Log in to Finance Manager to download the detailed PDF statement with full transaction history.</span></p></div><p style="font-size:13px;color:#666;margin:20px 0 0 0;border-top:1px solid #e5e7eb;padding-top:15px;text-align:left;"><strong>Next Steps:</strong><br>1. Review your summary above<br>2. Log in to Finance Manager for complete details<br>3. Download the full PDF statement from the Statement section<br><br>If you have any questions, please reply to this email.</p><p style="font-size:12px;color:#999;margin:30px 0 0 0;text-align:center;border-top:1px solid #e5e7eb;padding-top:15px;"><span style="display:block;margin-bottom:5px;">Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span><span>Finance Manager - Personal Finance Tracker</span></p></div></div></body></html>`;

    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: {
          username: "kpoliking001@gmail.com",
          password: "nrcd lxrl omvc rpfy",
        },
      },
    });

    await client.send({
      from: `"Finance Manager" <kpoliking001@gmail.com>`,
      to: userEmail,
      subject: `Finance Report - ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Summary`,
      html: emailHtml,
    });

    await client.close();

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    await serviceClient.from("audit_logs").insert({
      user_id: user.id,
      table_name: "reports",
      action: "email_sent",
      new_values: { reportType, sentTo: userEmail, includedBankAccounts: bankAccounts?.length || 0 },
    });

    console.log(`Report email sent to ${userEmail} for user ${user.id}`);

    return new Response(
      JSON.stringify({ success: true, message: "Report sent successfully" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    console.error("Error sending report:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

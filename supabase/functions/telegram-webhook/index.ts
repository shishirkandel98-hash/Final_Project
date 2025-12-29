import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendTelegramMessage(chatId: number, text: string, options?: { reply_markup?: unknown }) {
  const body: Record<string, unknown> = { chat_id: chatId, text, parse_mode: "HTML" };
  if (options?.reply_markup) body.reply_markup = options.reply_markup;
  
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.json();
}

async function getTelegramFile(fileId: string): Promise<{ url: string; buffer: ArrayBuffer } | null> {
  try {
    const fileResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`);
    const fileData = await fileResponse.json();
    
    if (!fileData.ok || !fileData.result?.file_path) {
      console.error("Failed to get file path:", fileData);
      return null;
    }
    
    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileData.result.file_path}`;
    const imageResponse = await fetch(fileUrl);
    const buffer = await imageResponse.arrayBuffer();
    
    return { url: fileUrl, buffer };
  } catch (error) {
    console.error("Error fetching file:", error);
    return null;
  }
}

async function uploadImageToStorage(userId: string, buffer: ArrayBuffer, fileName: string): Promise<string | null> {
  try {
    const filePath = `${userId}/${Date.now()}_${fileName}`;
    const { error } = await supabase.storage
      .from("transaction-images")
      .upload(filePath, buffer, {
        contentType: "image/jpeg",
        upsert: false,
      });
    
    if (error) {
      console.error("Upload error:", error);
      return null;
    }
    
    const { data: publicUrl } = supabase.storage
      .from("transaction-images")
      .getPublicUrl(filePath);
    
    return publicUrl.publicUrl;
  } catch (error) {
    console.error("Storage upload error:", error);
    return null;
  }
}

function getMainMenuKeyboard() {
  return {
    keyboard: [
      [{ text: "📥 Income" }, { text: "📤 Expense" }],
      [{ text: "💳 Loan" }, { text: "🏦 Bank Balance" }],
      [{ text: "📊 Report" }, { text: "ℹ️ Status" }],
      [{ text: "🔓 Disconnect Account" }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  };
}

function getLoanTypeKeyboard() {
  return {
    keyboard: [
      [{ text: "💰 Take Loan (Borrowed)" }],
      [{ text: "🤝 Give Loan (Lent)" }],
      [{ text: "🔙 Back to Menu" }],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

function getPaymentMethodKeyboard(bankAccounts: { id: string; bank_name: string }[]) {
  const keyboard = [[{ text: "💵 Cash" }]];
  
  for (const bank of bankAccounts) {
    keyboard.push([{ text: `🏦 ${bank.bank_name}` }]);
  }
  
  keyboard.push([{ text: "🔙 Back to Menu" }]);
  
  return {
    keyboard,
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

function getSkipImageKeyboard() {
  return {
    keyboard: [
      [{ text: "⏭️ Skip Image" }],
      [{ text: "🔙 Back to Menu" }],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

function getConfirmDisconnectKeyboard() {
  return {
    keyboard: [
      [{ text: "✅ Yes, Disconnect" }],
      [{ text: "❌ Cancel" }],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

// Store pending authentication in database to persist across function restarts
interface PendingAuth {
  email: string;
  attempts: number;
  step: "email" | "password";
  timestamp: number;
}

async function getPendingAuth(chatId: number): Promise<PendingAuth | null> {
  const { data } = await supabase
    .from("telegram_links")
    .select("verification_code")
    .eq("telegram_chat_id", chatId)
    .eq("verified", false)
    .maybeSingle();
  
  if (!data?.verification_code) return null;
  
  try {
    const parsed = JSON.parse(data.verification_code);
    // Check if auth session is still valid (expires after 10 minutes)
    if (parsed.timestamp && Date.now() - parsed.timestamp > 10 * 60 * 1000) {
      await clearPendingAuth(chatId);
      return null;
    }
    return parsed as PendingAuth;
  } catch {
    return null;
  }
}

async function setPendingAuth(chatId: number, auth: PendingAuth): Promise<void> {
  // First check if there's already a pending auth record
  const { data: existing } = await supabase
    .from("telegram_links")
    .select("id")
    .eq("telegram_chat_id", chatId)
    .eq("verified", false)
    .maybeSingle();
  
  if (existing) {
    await supabase
      .from("telegram_links")
      .update({ verification_code: JSON.stringify(auth) })
      .eq("telegram_chat_id", chatId)
      .eq("verified", false);
  } else {
    // Create a temporary unverified link to store auth state
    await supabase
      .from("telegram_links")
      .insert({
        telegram_chat_id: chatId,
        user_id: "00000000-0000-0000-0000-000000000000", // Placeholder, will be updated on success
        verified: false,
        verification_code: JSON.stringify(auth),
      });
  }
}

async function clearPendingAuth(chatId: number): Promise<void> {
  await supabase
    .from("telegram_links")
    .delete()
    .eq("telegram_chat_id", chatId)
    .eq("verified", false);
}

// Validate email format strictly
function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}

async function getUserLink(chatId: number) {
  const { data } = await supabase
    .from("telegram_links")
    .select("user_id, verification_code")
    .eq("telegram_chat_id", chatId)
    .eq("verified", true)
    .maybeSingle();
  
  return data;
}

async function getUserBankAccounts(userId: string) {
  const { data } = await supabase
    .from("bank_accounts")
    .select("id, bank_name")
    .eq("user_id", userId);
  
  return data || [];
}

async function saveUserState(chatId: number, userId: string, stateData: Record<string, unknown>) {
  await supabase
    .from("telegram_links")
    .update({ verification_code: JSON.stringify(stateData) })
    .eq("telegram_chat_id", chatId);
}

async function handleStart(chatId: number) {
  // Clear any pending auth
  await clearPendingAuth(chatId);
  
  // Check if already verified
  const existingLink = await getUserLink(chatId);
  if (existingLink) {
    // User is already connected - show menu directly
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, email")
      .eq("id", existingLink.user_id)
      .maybeSingle();
    
    const name = profile?.first_name || profile?.email?.split("@")[0] || "User";
    
    await sendTelegramMessage(chatId, `
👋 <b>Welcome back, ${name}!</b>

Your account is already connected.

<b>Choose an option below:</b>
    `, { reply_markup: getMainMenuKeyboard() });
    return;
  }
  
  // Set initial auth state - waiting for email (persist in database)
  await setPendingAuth(chatId, { email: "", attempts: 0, step: "email", timestamp: Date.now() });
  
  await sendTelegramMessage(chatId, `
🎉 <b>Welcome to Finance Manager Bot!</b>

I help you record financial transactions directly from Telegram.

🔐 <b>Secure Account Connection</b>

📧 <b>Step 1:</b> Enter your registered email address:

<i>Example: yourname@email.com</i>
  `);
}

async function handleEmailStep(chatId: number, email: string, username?: string) {
  // Validate email format first
  if (!isValidEmail(email)) {
    await sendTelegramMessage(chatId, `
❌ <b>Invalid email format!</b>

Please enter a valid email address.

<i>Example: yourname@email.com</i>
    `);
    return;
  }
  
  console.log(`Checking email: ${email}`);
  
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, first_name, last_name")
    .ilike("email", email.trim())
    .maybeSingle();

  if (error || !profile) {
    console.log("Email not found:", error);
    await sendTelegramMessage(chatId, `
❌ <b>Email not found!</b>

The email <code>${email}</code> is not registered in Finance Manager.

Please make sure you:
1. Have signed up on Finance Manager website first
2. Entered the correct email address

Try again with your registered email:
    `);
    return;
  }

  // Check if this user already has a Telegram connected on another device
  const { data: existingLink } = await supabase
    .from("telegram_links")
    .select("telegram_chat_id, verified")
    .eq("user_id", profile.id)
    .eq("verified", true)
    .maybeSingle();

  if (existingLink && existingLink.telegram_chat_id !== chatId) {
    await sendTelegramMessage(chatId, `
⚠️ <b>Account Already Connected!</b>

This email is already connected to another Telegram device.

Only <b>one device</b> can be connected at a time.

To use this device instead:
1. Go to the Finance Manager website
2. Disconnect your Telegram from the Profile page
3. Come back here and try again

Or send /start to try with a different email.
    `);
    return;
  }

  // Store email and request password (persist in database)
  await setPendingAuth(chatId, { email: email.trim(), attempts: 0, step: "password", timestamp: Date.now() });
  
  await sendTelegramMessage(chatId, `
✅ <b>Email verified!</b>

📧 Email: <code>${email}</code>

🔑 <b>Step 2:</b> Enter your password to complete verification:

<i>(Your password is the same one you use to login on the website)</i>
  `);
}

async function handlePasswordStep(chatId: number, password: string, username?: string) {
  const pending = await getPendingAuth(chatId);
  
  if (!pending || pending.step !== "password") {
    await sendTelegramMessage(chatId, `
❌ Session expired. Please start again.

Send /start to begin.
    `);
    return;
  }

  pending.attempts++;
  
  if (pending.attempts > 3) {
    await clearPendingAuth(chatId);
    await sendTelegramMessage(chatId, `
🚫 <b>Too many failed attempts!</b>

For security, please wait a few minutes before trying again.

Send /start to restart.
    `);
    return;
  }

  // Update attempts in database
  await setPendingAuth(chatId, pending);

  // Verify password using Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: pending.email,
    password: password,
  });

  if (authError || !authData.user) {
    console.log("Auth error:", authError);
    const remainingAttempts = 3 - pending.attempts;
    await sendTelegramMessage(chatId, `
❌ <b>Invalid password!</b>

${remainingAttempts > 0 ? `You have <b>${remainingAttempts}</b> attempt(s) remaining.` : "No attempts remaining."}

Please enter your correct password:
    `);
    return;
  }

  // Sign out the service role client session
  await supabase.auth.signOut();

  // Get profile data
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, first_name, email, currency")
    .eq("email", pending.email)
    .maybeSingle();

  if (!profile) {
    await sendTelegramMessage(chatId, "❌ Profile not found. Please try again.");
    await clearPendingAuth(chatId);
    return;
  }

  // Clear pending auth first
  await clearPendingAuth(chatId);

  // Remove any existing telegram links for this user (enforce single device)
  await supabase
    .from("telegram_links")
    .delete()
    .eq("user_id", profile.id);

  // Create telegram link
  const { error: linkError } = await supabase
    .from("telegram_links")
    .insert({
      user_id: profile.id,
      telegram_chat_id: chatId,
      telegram_username: username,
      verified: true,
      verification_code: JSON.stringify({}),
    });

  if (linkError) {
    console.error("Link error:", linkError);
    await sendTelegramMessage(chatId, "❌ Error linking account. Please try again.");
    return;
  }

  const name = profile.first_name || profile.email.split("@")[0];

  await sendTelegramMessage(chatId, `
✅ <b>Account Connected Successfully!</b>

Welcome, <b>${name}</b>! 🎉

━━━━━━━━━━━━━━━━━━━━━━
🔐 <b>Securely Authenticated</b>
📧 ${pending.email}
━━━━━━━━━━━━━━━━━━━━━━

You can now record transactions instantly!

<b>Available Options:</b>
📥 <b>Income</b> - Record money received
📤 <b>Expense</b> - Record money spent
💳 <b>Loan</b> - Track borrowed/lent money
🏦 <b>Bank Balance</b> - View account summary
📊 <b>Report</b> - Full statement

<b>Choose an option below:</b>
  `, { reply_markup: getMainMenuKeyboard() });
}

async function handleDisconnect(chatId: number, userId: string) {
  // Delete the telegram link
  const { error } = await supabase
    .from("telegram_links")
    .delete()
    .eq("telegram_chat_id", chatId)
    .eq("user_id", userId);

  if (error) {
    console.error("Disconnect error:", error);
    await sendTelegramMessage(chatId, "❌ Failed to disconnect. Please try again.");
    return;
  }

  await sendTelegramMessage(chatId, `
✅ <b>Account Disconnected Successfully!</b>

Your Telegram has been unlinked from Finance Manager.

You can connect again anytime by sending /start

To connect a different Telegram account:
1. Open the bot on your other device
2. Follow the authentication process

Goodbye! 👋
  `, { reply_markup: { remove_keyboard: true } });
}

async function handleStatus(chatId: number, userId: string) {
  const [{ data: transactions }, { data: loans }, { data: banks }, { data: profile }] = await Promise.all([
    supabase.from("transactions").select("type, amount").eq("user_id", userId),
    supabase.from("loans").select("amount, status, loan_type").eq("user_id", userId),
    supabase.from("bank_accounts").select("current_balance, bank_name").eq("user_id", userId),
    supabase.from("profiles").select("currency").eq("id", userId).maybeSingle(),
  ]);

  const currency = profile?.currency || "NPR";
  const totalIncome = (transactions || []).filter(t => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpenses = (transactions || []).filter(t => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0);
  const activeLoans = (loans || []).filter(l => l.status === "active");
  const loansTaken = activeLoans.filter(l => l.loan_type === "take").reduce((sum, l) => sum + Number(l.amount), 0);
  const loansGiven = activeLoans.filter(l => l.loan_type === "give").reduce((sum, l) => sum + Number(l.amount), 0);
  const bankBalance = (banks || []).reduce((sum, b) => sum + Number(b.current_balance), 0);
  const balance = totalIncome - totalExpenses;
  const usableBalance = bankBalance - loansTaken;

  let bankList = "";
  if (banks && banks.length > 0) {
    bankList = banks.map(b => `  • ${b.bank_name}: ${currency} ${Number(b.current_balance).toFixed(2)}`).join("\n");
  }

  await sendTelegramMessage(chatId, `
📊 <b>Your Financial Summary</b>

━━━━━━━━━━━━━━━━━━━━━━
💵 <b>Total Income:</b> ${currency} ${totalIncome.toFixed(2)}
💸 <b>Total Expenses:</b> ${currency} ${totalExpenses.toFixed(2)}
📈 <b>Net Balance:</b> ${currency} ${balance.toFixed(2)}

💳 <b>Loans Taken:</b> ${currency} ${loansTaken.toFixed(2)}
🤝 <b>Loans Given:</b> ${currency} ${loansGiven.toFixed(2)}

🏦 <b>Bank Balance:</b> ${currency} ${bankBalance.toFixed(2)}
${bankList || "  No bank accounts added"}

✅ <b>Usable Balance:</b> ${currency} ${usableBalance.toFixed(2)}
━━━━━━━━━━━━━━━━━━━━━━
  `, { reply_markup: getMainMenuKeyboard() });
}

async function handleReport(chatId: number, userId: string) {
  const [{ data: transactions }, { data: loans }, { data: profile }] = await Promise.all([
    supabase.from("transactions").select("*").eq("user_id", userId).order("transaction_date", { ascending: false }).limit(50),
    supabase.from("loans").select("*").eq("user_id", userId).order("loan_date", { ascending: false }).limit(20),
    supabase.from("profiles").select("currency, first_name, email").eq("id", userId).maybeSingle(),
  ]);

  const currency = profile?.currency || "NPR";
  const name = profile?.first_name || profile?.email?.split("@")[0] || "User";
  const today = new Date().toLocaleDateString();

  let report = `
📋 <b>FINANCIAL STATEMENT</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Account Holder: <b>${name}</b>
Statement Date: ${today}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>📝 TRANSACTION HISTORY</b>
`;

  let runningBalance = 0;
  const sortedTransactions = [...(transactions || [])].reverse();
  
  if (sortedTransactions.length > 0) {
    report += `\n<code>Date       | Type    | Amount</code>\n`;
    report += `<code>━━━━━━━━━━━━━━━━━━━━━━━━━━━━</code>\n`;
    
    for (const t of sortedTransactions) {
      const date = new Date(t.transaction_date).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" });
      const type = t.type === "income" ? "IN " : "OUT";
      const amount = Number(t.amount);
      runningBalance += t.type === "income" ? amount : -amount;
      
      report += `<code>${date.padEnd(10)} | ${type.padEnd(7)} | ${currency} ${amount.toFixed(0)}</code>\n`;
    }
    report += `\n<b>Final Balance:</b> ${currency} ${runningBalance.toFixed(2)}`;
  } else {
    report += `\nNo transactions recorded.\n`;
  }

  if (loans && loans.length > 0) {
    report += `\n\n<b>💳 LOAN RECORDS</b>\n`;
    const activeLoans = loans.filter(l => l.status === "active");
    
    if (activeLoans.length > 0) {
      for (const l of activeLoans) {
        const date = new Date(l.loan_date).toLocaleDateString("en-GB");
        const type = l.loan_type === "take" ? "Borrowed" : "Lent";
        report += `• ${date} - ${type}: ${currency} ${Number(l.amount).toFixed(2)}${l.description ? ` (${l.description})` : ""}\n`;
      }
    }
  }

  await sendTelegramMessage(chatId, report, { reply_markup: getMainMenuKeyboard() });
}

async function saveTransaction(
  userId: string, 
  type: "income" | "expense", 
  amount: number, 
  description: string, 
  bankAccountId?: string,
  imageUrl?: string
) {
  const { error } = await supabase.from("transactions").insert({
    user_id: userId,
    type,
    amount,
    description: description || null,
    remarks: description || null,
    transaction_date: new Date().toISOString().split("T")[0],
    bank_account_id: bankAccountId || null,
    image_url: imageUrl || null,
  });
  
  if (error) {
    console.error("Transaction save error:", error);
    return false;
  }
  
  // Update bank account balance if bank was selected
  if (bankAccountId) {
    const balanceChange = type === "income" ? amount : -amount;
    
    const { data: currentBank } = await supabase
      .from("bank_accounts")
      .select("current_balance")
      .eq("id", bankAccountId)
      .single();
    
    if (currentBank) {
      const newBalance = Number(currentBank.current_balance) + balanceChange;
      await supabase
        .from("bank_accounts")
        .update({ current_balance: newBalance, updated_at: new Date().toISOString() })
        .eq("id", bankAccountId);
    }
  }
  
  return true;
}

async function saveLoan(
  userId: string, 
  loanType: "take" | "give", 
  amount: number, 
  description: string, 
  bankAccountId?: string,
  imageUrl?: string
) {
  const { error } = await supabase.from("loans").insert({
    user_id: userId,
    loan_type: loanType,
    amount,
    description: description || null,
    remarks: description || null,
    status: "active",
    loan_date: new Date().toISOString().split("T")[0],
    bank_account_id: bankAccountId || null,
    image_url: imageUrl || null,
  });
  
  if (error) {
    console.error("Loan save error:", error);
    return false;
  }
  
  if (bankAccountId) {
    const balanceChange = loanType === "take" ? amount : -amount;
    
    const { data: currentBank } = await supabase
      .from("bank_accounts")
      .select("current_balance")
      .eq("id", bankAccountId)
      .single();
    
    if (currentBank) {
      const newBalance = Number(currentBank.current_balance) + balanceChange;
      await supabase
        .from("bank_accounts")
        .update({ current_balance: newBalance, updated_at: new Date().toISOString() })
        .eq("id", bankAccountId);
    }
  }
  
  return true;
}

async function finalizeTransaction(
  chatId: number,
  userId: string,
  stateData: Record<string, unknown>,
  imageUrl?: string
) {
  const amount = stateData.amount as number;
  const bankAccountId = stateData.bankAccountId as string | undefined;
  const bankName = stateData.bankName as string | undefined;
  const desc = stateData.description as string || "";
  let success = false;
  let emoji = "";
  let label = "";
  const paymentInfo = bankName ? `🏦 ${bankName}` : "💵 Cash";

  if (stateData.action === "income") {
    success = await saveTransaction(userId, "income", amount, desc, bankAccountId, imageUrl);
    emoji = "📥";
    label = "Income";
  } else if (stateData.action === "expense") {
    success = await saveTransaction(userId, "expense", amount, desc, bankAccountId, imageUrl);
    emoji = "📤";
    label = "Expense";
  } else if (stateData.action === "loan") {
    const loanType = stateData.loanType as "take" | "give";
    success = await saveLoan(userId, loanType, amount, desc, bankAccountId, imageUrl);
    emoji = loanType === "take" ? "💰" : "🤝";
    label = loanType === "take" ? "Loan (Borrowed)" : "Loan (Lent)";
  }

  await saveUserState(chatId, userId, {});

  if (success) {
    const imageText = imageUrl ? "\n📷 Proof: Uploaded ✓" : "";
    await sendTelegramMessage(chatId, `
✅ <b>${label} Recorded!</b>

━━━━━━━━━━━━━━━━━━━━━━
${emoji} <b>Amount:</b> ${amount}
💳 <b>Payment:</b> ${paymentInfo}
📝 <b>Description:</b> ${desc || "N/A"}${imageText}
━━━━━━━━━━━━━━━━━━━━━━

✨ Transaction synced to Dashboard!
Use 📊 Report to see all transactions.
    `, { reply_markup: getMainMenuKeyboard() });
  } else {
    await sendTelegramMessage(chatId, "❌ Failed to save. Please try again.", { reply_markup: getMainMenuKeyboard() });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const update = await req.json();
    console.log("Received update:", JSON.stringify(update));

    const message = update.message;
    if (!message) {
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    const chatId = message.chat.id;
    const text = message.text?.trim() || "";
    const username = message.from?.username;
    const lowerText = text.toLowerCase();
    const photo = message.photo;

    console.log(`Chat ${chatId}, Text: "${text}", HasPhoto: ${!!photo}`);

    // Handle /start command
    if (lowerText === "/start" || lowerText.startsWith("/start ")) {
      await handleStart(chatId);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check if user is verified
    const link = await getUserLink(chatId);
    
    if (!link) {
      // Check if we have pending auth in database
      const pending = await getPendingAuth(chatId);
      
      if (pending) {
        if (pending.step === "password") {
          // User is entering password
          await handlePasswordStep(chatId, text, username);
        } else if (pending.step === "email") {
          // User is entering email - validate it first
          await handleEmailStep(chatId, text, username);
        }
      } else {
        // No pending auth and not verified - ask to start
        await sendTelegramMessage(chatId, `
🔐 <b>Authentication Required</b>

Please send /start to begin the secure connection process.
        `);
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // User is verified
    const userId = link.user_id;
    let stateData: Record<string, unknown> = {};
    try {
      stateData = link.verification_code ? JSON.parse(link.verification_code) : {};
    } catch { stateData = {}; }

    // Handle disconnect request
    if (text === "🔓 Disconnect Account") {
      await saveUserState(chatId, userId, { step: "confirm_disconnect" });
      await sendTelegramMessage(chatId, `
⚠️ <b>Disconnect Account?</b>

Are you sure you want to disconnect your Telegram from Finance Manager?

You will need to authenticate again to use the bot.

This allows you to:
• Connect from a different device
• Use a different Telegram account
      `, { reply_markup: getConfirmDisconnectKeyboard() });
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Handle disconnect confirmation
    if (text === "✅ Yes, Disconnect" && stateData.step === "confirm_disconnect") {
      await handleDisconnect(chatId, userId);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (text === "❌ Cancel" && stateData.step === "confirm_disconnect") {
      await saveUserState(chatId, userId, {});
      await sendTelegramMessage(chatId, "Disconnect cancelled. You're still connected! ✅", { reply_markup: getMainMenuKeyboard() });
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Handle photo upload
    if (photo && photo.length > 0 && stateData.step === "image") {
      const largestPhoto = photo[photo.length - 1];
      const fileData = await getTelegramFile(largestPhoto.file_id);
      
      if (fileData) {
        const imageUrl = await uploadImageToStorage(userId, fileData.buffer, `telegram_${Date.now()}.jpg`);
        await finalizeTransaction(chatId, userId, stateData, imageUrl || undefined);
      } else {
        await finalizeTransaction(chatId, userId, stateData);
      }
      
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Handle menu buttons
    if (text === "📥 Income") {
      await saveUserState(chatId, userId, { action: "income", step: "amount" });
      await sendTelegramMessage(chatId, `📥 <b>Record Income</b>\n\nEnter the <b>amount</b> (numbers only):`);
    } else if (text === "📤 Expense") {
      await saveUserState(chatId, userId, { action: "expense", step: "amount" });
      await sendTelegramMessage(chatId, `📤 <b>Record Expense</b>\n\nEnter the <b>amount</b> (numbers only):`);
    } else if (text === "💳 Loan") {
      await saveUserState(chatId, userId, { action: "loan", step: "type" });
      await sendTelegramMessage(chatId, `💳 <b>Record Loan</b>\n\nSelect loan type:`, { reply_markup: getLoanTypeKeyboard() });
    } else if (text === "🏦 Bank Balance" || text === "ℹ️ Status") {
      await handleStatus(chatId, userId);
    } else if (text === "📊 Report") {
      await handleReport(chatId, userId);
    } else if (text === "🔙 Back to Menu") {
      await saveUserState(chatId, userId, {});
      await sendTelegramMessage(chatId, "Main menu:", { reply_markup: getMainMenuKeyboard() });
    } else if (text === "💰 Take Loan (Borrowed)") {
      await saveUserState(chatId, userId, { action: "loan", step: "amount", loanType: "take" });
      await sendTelegramMessage(chatId, "💰 Enter the amount you <b>borrowed</b> (numbers only):");
    } else if (text === "🤝 Give Loan (Lent)") {
      await saveUserState(chatId, userId, { action: "loan", step: "amount", loanType: "give" });
      await sendTelegramMessage(chatId, "🤝 Enter the amount you <b>lent</b> (numbers only):");
    } else if (text === "💵 Cash") {
      if (stateData.step === "payment") {
        await saveUserState(chatId, userId, { ...stateData, step: "desc", bankAccountId: null });
        await sendTelegramMessage(chatId, `Payment: <b>💵 Cash</b>\nAmount: <b>${stateData.amount}</b>\n\nEnter a <b>description/remarks</b> (or type <code>skip</code>):`);
      }
    } else if (text.startsWith("🏦 ")) {
      if (stateData.step === "payment") {
        const bankName = text.replace("🏦 ", "");
        const bankAccounts = await getUserBankAccounts(userId);
        const selectedBank = bankAccounts.find(b => b.bank_name === bankName);
        
        if (selectedBank) {
          await saveUserState(chatId, userId, { ...stateData, step: "desc", bankAccountId: selectedBank.id, bankName: selectedBank.bank_name });
          await sendTelegramMessage(chatId, `Payment: <b>🏦 ${selectedBank.bank_name}</b>\nAmount: <b>${stateData.amount}</b>\n\nEnter a <b>description/remarks</b> (or type <code>skip</code>):`);
        } else {
          await sendTelegramMessage(chatId, "❌ Bank not found. Please try again.");
        }
      }
    } else if (text === "⏭️ Skip Image") {
      if (stateData.step === "image") {
        await finalizeTransaction(chatId, userId, stateData);
      }
    } else if (stateData.action && stateData.step === "amount") {
      // Validate amount input
      if (!/^\d+(\.\d+)?$/.test(text)) {
        await sendTelegramMessage(chatId, "❌ Invalid entry. Please enter a valid amount (numbers only).");
      } else {
        const amount = parseFloat(text);
        if (isNaN(amount) || amount <= 0) {
          await sendTelegramMessage(chatId, "❌ Please enter a valid amount greater than 0");
        } else {
          const bankAccounts = await getUserBankAccounts(userId);
          await saveUserState(chatId, userId, { ...stateData, step: "payment", amount });
          await sendTelegramMessage(chatId, `Amount: <b>${amount}</b>\n\n💳 <b>Select payment method:</b>`, { reply_markup: getPaymentMethodKeyboard(bankAccounts) });
        }
      }
    } else if (stateData.action && stateData.step === "desc") {
      const desc = lowerText === "skip" ? "" : text;
      
      // Ask for optional image
      await saveUserState(chatId, userId, { ...stateData, step: "image", description: desc });
      await sendTelegramMessage(chatId, `
📝 Description: <b>${desc || "N/A"}</b>

📷 <b>Upload proof/screenshot</b> (optional)

Send an image or tap "⏭️ Skip Image" to finish:
      `, { reply_markup: getSkipImageKeyboard() });
    } else {
      await sendTelegramMessage(chatId, "Use the menu buttons below:", { reply_markup: getMainMenuKeyboard() });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error processing webhook:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

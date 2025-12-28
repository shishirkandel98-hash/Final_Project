import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DashboardData {
  totalIncome: number;
  totalExpenses: number;
  loansGiven: number;
  loansTaken: number;
  totalBankBalance: number;
  currency: string;
  isApproved: boolean;
  isAdmin: boolean;
  reportEmail: string;
}

async function fetchDashboardData(userId: string): Promise<DashboardData> {
  // Batch all requests in parallel for maximum efficiency
  const [profileResult, roleResult, txResult, loansResult, bankResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("approved, report_email, currency")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle(),
    supabase
      .from("transactions")
      .select("type, amount")
      .eq("user_id", userId),
    supabase
      .from("loans")
      .select("amount, loan_type")
      .eq("user_id", userId)
      .eq("status", "active"),
    supabase
      .from("bank_accounts")
      .select("current_balance")
      .eq("user_id", userId),
  ]);

  const transactions = txResult.data || [];
  const loans = loansResult.data || [];
  const bankAccounts = bankResult.data || [];

  const totalIncome = transactions
    .filter(t => t.type === "income")
    .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

  const totalExpenses = transactions
    .filter(t => t.type === "expense")
    .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

  const loansGiven = loans
    .filter(l => l.loan_type === "give")
    .reduce((sum, l) => sum + parseFloat(l.amount.toString()), 0);

  const loansTaken = loans
    .filter(l => l.loan_type === "take")
    .reduce((sum, l) => sum + parseFloat(l.amount.toString()), 0);

  const totalBankBalance = bankAccounts
    .reduce((sum, b) => sum + parseFloat(b.current_balance.toString()), 0);

  return {
    totalIncome,
    totalExpenses,
    loansGiven,
    loansTaken,
    totalBankBalance,
    currency: profileResult.data?.currency || "NPR",
    isApproved: profileResult.data?.approved ?? true,
    isAdmin: !!roleResult.data,
    reportEmail: profileResult.data?.report_email || "",
  };
}

export function useDashboardData(userId: string | undefined) {
  return useQuery({
    queryKey: ["dashboard", userId],
    queryFn: () => fetchDashboardData(userId!),
    enabled: !!userId,
    staleTime: 30 * 1000, // Consider data fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false,
  });
}

export function useInvalidateDashboard() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["dashboard"] });
}

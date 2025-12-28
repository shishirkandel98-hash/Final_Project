import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Transaction {
  type: string;
  amount: number;
  transaction_date: string;
}

interface BankAccount {
  id: string;
  bank_name: string;
  current_balance: number;
}

interface AnalyticsData {
  transactions: Transaction[];
  bankAccounts: BankAccount[];
}

async function fetchAnalyticsData(userId: string): Promise<AnalyticsData> {
  const [txResult, bankResult] = await Promise.all([
    supabase
      .from("transactions")
      .select("type, amount, transaction_date")
      .eq("user_id", userId)
      .order("transaction_date", { ascending: true }),
    supabase
      .from("bank_accounts")
      .select("id, bank_name, current_balance")
      .eq("user_id", userId),
  ]);

  return {
    transactions: txResult.data || [],
    bankAccounts: bankResult.data || [],
  };
}

export function useAnalyticsData(userId: string | undefined) {
  return useQuery({
    queryKey: ["analytics", userId],
    queryFn: () => fetchAnalyticsData(userId!),
    enabled: !!userId,
    staleTime: 60 * 1000, // Analytics can be slightly stale
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

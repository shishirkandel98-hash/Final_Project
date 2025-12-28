import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  remarks: string | null;
  image_url: string | null;
  transaction_date: string;
  created_at: string;
  bank_account_id: string | null;
}

interface Loan {
  id: string;
  amount: number;
  description: string | null;
  remarks: string | null;
  image_url: string | null;
  loan_date: string;
  status: string;
  loan_type: string;
  created_at: string;
  refunded_at: string | null;
}

interface Note {
  id: string;
  title: string;
  content: string | null;
  created_at: string;
  updated_at: string;
}

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  current_balance: number;
}

interface TransactionsData {
  transactions: Transaction[];
  loans: Loan[];
  notes: Note[];
  bankAccounts: BankAccount[];
  currency: string;
}

async function fetchTransactionsData(userId: string): Promise<TransactionsData> {
  const [txResult, loanResult, notesResult, bankResult, profileResult] = await Promise.all([
    supabase.from("transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("loans").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("notes").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("bank_accounts").select("*").eq("user_id", userId),
    supabase.from("profiles").select("currency").eq("id", userId).maybeSingle(),
  ]);

  return {
    transactions: txResult.data || [],
    loans: loanResult.data || [],
    notes: notesResult.data || [],
    bankAccounts: bankResult.data || [],
    currency: profileResult.data?.currency || "NPR",
  };
}

export function useTransactionsData(userId: string | undefined) {
  return useQuery({
    queryKey: ["transactions", userId],
    queryFn: () => fetchTransactionsData(userId!),
    enabled: !!userId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useDeleteTransaction(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transaction: Transaction) => {
      const { error } = await supabase.from("transactions").delete().eq("id", transaction.id);
      if (error) throw error;

      // Log audit
      await supabase.from("audit_logs").insert([{
        user_id: userId,
        table_name: "transactions",
        action: "delete",
        record_id: transaction.id,
        old_values: transaction as any,
      }]);
    },
    onSuccess: () => {
      toast.success("Transaction deleted");
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateTransaction(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      transaction, 
      updates 
    }: { 
      transaction: Transaction; 
      updates: { amount: number; description: string | null; remarks: string | null; bank_account_id: string | null } 
    }) => {
      const { error } = await supabase
        .from("transactions")
        .update(updates)
        .eq("id", transaction.id);

      if (error) throw error;

      await supabase.from("audit_logs").insert([{
        user_id: userId,
        table_name: "transactions",
        action: "update",
        record_id: transaction.id,
        old_values: transaction as any,
        new_values: updates as any,
      }]);
    },
    onSuccess: () => {
      toast.success("Transaction updated");
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteLoan(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (loan: Loan) => {
      const { error } = await supabase.from("loans").delete().eq("id", loan.id);
      if (error) throw error;

      await supabase.from("audit_logs").insert([{
        user_id: userId,
        table_name: "loans",
        action: "delete",
        record_id: loan.id,
        old_values: loan as any,
      }]);
    },
    onSuccess: () => {
      toast.success("Loan deleted");
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });
}

export function useRefundLoan(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (loan: Loan) => {
      const refundedAt = new Date().toISOString();
      const transactionType = loan.loan_type === "give" ? "income" : "expense";
      const description = loan.loan_type === "give"
        ? `Loan Received Back: ${loan.description || 'Loan repayment'}`
        : `Loan Paid Back: ${loan.description || 'Loan repayment'}`;

      const { data: newTx, error: txError } = await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          type: transactionType,
          amount: loan.amount,
          description,
          remarks: `Refunded on ${new Date().toLocaleString()}`,
        })
        .select()
        .single();

      if (txError) throw txError;

      const { error: loanError } = await supabase
        .from("loans")
        .update({
          status: "refunded",
          refunded_at: refundedAt,
          refund_transaction_id: newTx.id
        })
        .eq("id", loan.id);

      if (loanError) throw loanError;

      await supabase.from("audit_logs").insert([{
        user_id: userId,
        table_name: "loans",
        action: "refund",
        record_id: loan.id,
        old_values: { status: loan.status },
        new_values: { status: "refunded", refunded_at: refundedAt, transaction_id: newTx.id },
      }]);

      return transactionType;
    },
    onSuccess: (transactionType) => {
      toast.success(`Loan marked as refunded and added to ${transactionType}`);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase.from("notes").delete().eq("id", noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Note deleted");
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });
}

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  remarks: string | null;
  transaction_date: string;
  created_at: string;
}

interface TransactionListProps {
  onUpdate: () => void;
}

export const TransactionList = ({ onUpdate }: TransactionListProps) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [currency, setCurrency] = useState("NPR");

  const fetchTransactions = async () => {
    try {
      // Fetch user currency
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("currency")
          .eq("id", user.id)
          .maybeSingle();
        
        if (profile?.currency) {
          setCurrency(profile.currency);
        }
      }

      // Explicitly filter by user_id to ensure data isolation
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error: any) {
      console.error("Error fetching transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleDelete = async (transaction: Transaction) => {
    setDeleting(transaction.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", transaction.id);

      if (error) throw error;

      // Log the deletion
      await supabase.from("audit_logs").insert([{
        user_id: user.id,
        table_name: "transactions",
        action: "delete",
        record_id: transaction.id,
        old_values: transaction as any,
      }]);

      toast.success("Transaction deleted successfully");
      fetchTransactions();
      onUpdate();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-4 text-sm">
        No transactions yet. Add your first record!
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {transactions.map((tx) => (
        <Card key={tx.id} className="overflow-hidden">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <div className={`p-1.5 sm:p-2 rounded-full ${tx.type === "income" ? "bg-green-500/10" : "bg-red-500/10"}`}>
                  {tx.type === "income" ? (
                    <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />
                  ) : (
                    <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm sm:text-base truncate">
                    {tx.description || "No description"}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {new Date(tx.transaction_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <Badge variant={tx.type === "income" ? "default" : "destructive"} className="text-xs sm:text-sm">
                  {formatCurrency(parseFloat(tx.amount.toString()), currency)}
                </Badge>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8">
                      <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="max-w-[95vw] sm:max-w-md">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete this {tx.type} of {formatCurrency(parseFloat(tx.amount.toString()), currency)}.
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(tx)}
                        disabled={deleting === tx.id}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleting === tx.id ? "Deleting..." : "Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
            {tx.remarks && (
              <p className="text-xs text-muted-foreground mt-2 pl-8 sm:pl-11 truncate">
                {tx.remarks}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

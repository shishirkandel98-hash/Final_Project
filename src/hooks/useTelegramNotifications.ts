import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

interface UseTelegramNotificationsProps {
  userId: string | undefined;
  currency: string;
  onNewTransaction?: () => void;
}

export const useTelegramNotifications = ({ 
  userId, 
  currency, 
  onNewTransaction 
}: UseTelegramNotificationsProps) => {
  useEffect(() => {
    if (!userId) return;

    // Subscribe to new transactions
    const transactionChannel = supabase
      .channel('telegram-transactions')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const newTransaction = payload.new as {
            type: string;
            amount: number;
            description: string | null;
            remarks: string | null;
          };
          
          // Check if this was from Telegram (has remarks mentioning telegram or description pattern)
          const description = newTransaction.description || newTransaction.remarks || '';
          
          const isIncome = newTransaction.type === 'income';
          const emoji = isIncome ? '📥' : '📤';
          const label = isIncome ? 'Income' : 'Expense';
          
          toast.success(
            `${emoji} New ${label} Recorded!`,
            {
              description: `${formatCurrency(newTransaction.amount, currency)}${description ? ` - ${description}` : ''}`,
              duration: 5000,
            }
          );
          
          onNewTransaction?.();
        }
      )
      .subscribe();

    // Subscribe to new loans
    const loanChannel = supabase
      .channel('telegram-loans')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'loans',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const newLoan = payload.new as {
            loan_type: string;
            amount: number;
            description: string | null;
          };
          
          const isTaken = newLoan.loan_type === 'take';
          const emoji = isTaken ? '💰' : '🤝';
          const label = isTaken ? 'Loan Borrowed' : 'Loan Given';
          
          toast.success(
            `${emoji} ${label} Recorded!`,
            {
              description: `${formatCurrency(newLoan.amount, currency)}${newLoan.description ? ` - ${newLoan.description}` : ''}`,
              duration: 5000,
            }
          );
          
          onNewTransaction?.();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(transactionChannel);
      supabase.removeChannel(loanChannel);
    };
  }, [userId, currency, onNewTransaction]);
};

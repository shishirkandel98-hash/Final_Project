import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Building2, ArrowUpDown, Pencil } from "lucide-react";

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  current_balance: number;
  created_at: string;
}

interface BankTransaction {
  id: string;
  bank_account_id: string;
  amount: number;
  description: string | null;
  remarks: string | null;
  transaction_date: string;
  created_at: string;
}

interface Props {
  onUpdate?: () => void;
}

export const BankAccountForm = ({ onUpdate }: Props) => {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [openTxDialog, setOpenTxDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);

  // Form states
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [balance, setBalance] = useState("");

  // Edit form states
  const [editBankName, setEditBankName] = useState("");
  const [editAccountNumber, setEditAccountNumber] = useState("");
  const [editBalance, setEditBalance] = useState("");

  // Transaction form states
  const [txAmount, setTxAmount] = useState("");
  const [txDescription, setTxDescription] = useState("");
  const [txRemarks, setTxRemarks] = useState("");
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Get current user to ensure data isolation
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Explicitly filter by user_id to ensure only user's own bank accounts are shown
      const [accountsResult, txResult] = await Promise.all([
        supabase.from("bank_accounts").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("bank_transactions").select("*, bank_accounts!inner(user_id)").eq("bank_accounts.user_id", user.id).order("created_at", { ascending: false }),
      ]);

      if (accountsResult.data) setAccounts(accountsResult.data);
      if (txResult.data) setTransactions(txResult.data);
    } catch (error) {
      console.error("Error fetching bank data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("bank_accounts").insert({
        user_id: user.id,
        bank_name: bankName,
        account_number: accountNumber,
        current_balance: parseFloat(balance) || 0,
      });

      if (error) throw error;

      toast.success("Bank account added successfully");
      setBankName("");
      setAccountNumber("");
      setBalance("");
      setOpenDialog(false);
      fetchData();
      onUpdate?.();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from("bank_accounts")
        .update({
          bank_name: editBankName,
          account_number: editAccountNumber,
          current_balance: parseFloat(editBalance) || 0,
        })
        .eq("id", editingAccount.id);

      if (error) throw error;

      toast.success("Bank account updated successfully");
      setOpenEditDialog(false);
      setEditingAccount(null);
      fetchData();
      onUpdate?.();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (account: BankAccount) => {
    setEditingAccount(account);
    setEditBankName(account.bank_name);
    setEditAccountNumber(account.account_number);
    setEditBalance(account.current_balance.toString());
    setOpenEditDialog(true);
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;
    setSaving(true);

    try {
      const amount = parseFloat(txAmount);
      
      // Add transaction
      const { error: txError } = await supabase.from("bank_transactions").insert({
        bank_account_id: selectedAccount,
        amount,
        description: txDescription || null,
        remarks: txRemarks || null,
        transaction_date: txDate,
      });

      if (txError) throw txError;

      // Update balance
      const account = accounts.find(a => a.id === selectedAccount);
      if (account) {
        const newBalance = account.current_balance + amount;
        const { error: updateError } = await supabase
          .from("bank_accounts")
          .update({ current_balance: newBalance })
          .eq("id", selectedAccount);

        if (updateError) throw updateError;
      }

      toast.success("Bank transaction recorded");
      setTxAmount("");
      setTxDescription("");
      setTxRemarks("");
      setTxDate(new Date().toISOString().split('T')[0]);
      setOpenTxDialog(false);
      setSelectedAccount(null);
      fetchData();
      onUpdate?.();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    setDeleting(id);
    try {
      const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
      if (error) throw error;
      toast.success("Bank account deleted");
      fetchData();
      onUpdate?.();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setDeleting(null);
    }
  };

  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.current_balance), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Bank Accounts
          </h3>
          <p className="text-sm text-muted-foreground">Total: NPR {totalBalance.toFixed(2)}</p>
        </div>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Add Bank
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Bank Account</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddAccount} className="space-y-4">
              <div className="space-y-2">
                <Label>Bank Name</Label>
                <Input
                  placeholder="e.g., Nepal Bank"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Account Number</Label>
                <Input
                  placeholder="Account number"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Current Balance (NPR)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Add Account
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No bank accounts added yet.
        </p>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => (
            <Card key={account.id}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{account.bank_name}</p>
                    <p className="text-xs text-muted-foreground">A/C: {account.account_number}</p>
                    <p className="text-sm font-semibold text-primary">
                      NPR {Number(account.current_balance).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditModal(account)}
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedAccount(account.id);
                        setOpenTxDialog(true);
                      }}
                    >
                      <ArrowUpDown className="w-3 h-3" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost">
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Bank Account?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will delete the account and all its transactions.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteAccount(account.id)}
                            className="bg-destructive text-destructive-foreground"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Bank Account Dialog */}
      <Dialog open={openEditDialog} onOpenChange={(open) => {
        setOpenEditDialog(open);
        if (!open) setEditingAccount(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Bank Account</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditAccount} className="space-y-4">
            <div className="space-y-2">
              <Label>Bank Name</Label>
              <Input
                placeholder="e.g., Nepal Bank"
                value={editBankName}
                onChange={(e) => setEditBankName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Account Number</Label>
              <Input
                placeholder="Account number"
                value={editAccountNumber}
                onChange={(e) => setEditAccountNumber(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Current Balance (NPR)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={editBalance}
                onChange={(e) => setEditBalance(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Update Account
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bank Transaction Dialog */}
      <Dialog open={openTxDialog} onOpenChange={(open) => {
        setOpenTxDialog(open);
        if (!open) setSelectedAccount(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Bank Transaction</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddTransaction} className="space-y-4">
            <div className="space-y-2">
              <Label>Amount (NPR) - Use negative for withdrawal</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="e.g., -1000 or 5000"
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                placeholder="What was this transaction for?"
                value={txDescription}
                onChange={(e) => setTxDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Input
                placeholder="Additional notes"
                value={txRemarks}
                onChange={(e) => setTxRemarks(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Record Transaction
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
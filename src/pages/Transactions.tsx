import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import { ArrowLeft, Trash2, Eye, Loader2, TrendingUp, TrendingDown, CreditCard, StickyNote, RefreshCw, ArrowUpRight, ArrowDownLeft, Calendar, Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/utils";

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

const Transactions = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editRemarks, setEditRemarks] = useState("");
  const [editBankId, setEditBankId] = useState<string>("");
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<Transaction | Loan | null>(null);
  const [currency, setCurrency] = useState("NPR");

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setUser(session.user);
    
    // Fetch user currency
    const { data: profile } = await supabase
      .from("profiles")
      .select("currency")
      .eq("id", session.user.id)
      .maybeSingle();
    
    if (profile?.currency) {
      setCurrency(profile.currency);
    }
    
    fetchData();
    setLoading(false);
  };

  const fetchData = async () => {
    const [txResult, loanResult, notesResult, bankResult] = await Promise.all([
      supabase.from("transactions").select("*").order("created_at", { ascending: false }),
      supabase.from("loans").select("*").order("created_at", { ascending: false }),
      supabase.from("notes").select("*").order("created_at", { ascending: false }),
      supabase.from("bank_accounts").select("*"),
    ]);

    if (txResult.data) setTransactions(txResult.data);
    if (loanResult.data) setLoans(loanResult.data);
    if (notesResult.data) setNotes(notesResult.data);
    if (bankResult.data) setBankAccounts(bankResult.data);
  };

  const handleDeleteTransaction = async (tx: Transaction) => {
    setDeleting(tx.id);
    try {
      const { error } = await supabase.from("transactions").delete().eq("id", tx.id);
      if (error) throw error;

      await supabase.from("audit_logs").insert([{
        user_id: user?.id,
        table_name: "transactions",
        action: "delete",
        record_id: tx.id,
        old_values: tx as any,
      }]);

      toast.success("Transaction deleted");
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setDeleting(null);
    }
  };

  const handleUpdateTransaction = async (tx: Transaction) => {
    if (!editAmount || isNaN(parseFloat(editAmount))) {
      toast.error("Please enter a valid amount");
      return;
    }

    setEditing(tx.id);
    try {
      const oldValues = { ...tx };
      const { error } = await supabase
        .from("transactions")
        .update({
          amount: parseFloat(editAmount),
          description: editDescription || null,
          remarks: editRemarks || null,
          bank_account_id: editBankId === "cash" ? null : editBankId || null,
        })
        .eq("id", tx.id);

      if (error) throw error;

      await supabase.from("audit_logs").insert([{
        user_id: user?.id,
        table_name: "transactions",
        action: "update",
        record_id: tx.id,
        old_values: oldValues as any,
        new_values: {
          amount: parseFloat(editAmount),
          description: editDescription,
          remarks: editRemarks,
          bank_account_id: editBankId === "cash" ? null : editBankId || null,
        } as any,
      }]);

      toast.success("Transaction updated successfully");
      setEditing(null);
      setEditAmount("");
      setEditDescription("");
      setEditRemarks("");
      setEditBankId("");
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const startEditTransaction = (tx: Transaction) => {
    setEditing(tx.id);
    setEditAmount(tx.amount.toString());
    setEditDescription(tx.description || "");
    setEditRemarks(tx.remarks || "");
    setEditBankId(tx.bank_account_id || "cash");
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditAmount("");
    setEditDescription("");
    setEditRemarks("");
    setEditBankId("");
  };

  const handleDeleteLoan = async (loan: Loan) => {
    setDeleting(loan.id);
    try {
      const { error } = await supabase.from("loans").delete().eq("id", loan.id);
      if (error) throw error;

      await supabase.from("audit_logs").insert([{
        user_id: user?.id,
        table_name: "loans",
        action: "delete",
        record_id: loan.id,
        old_values: loan as any,
      }]);

      toast.success("Loan deleted");
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setDeleting(null);
    }
  };

  const handleRefundLoan = async (loan: Loan) => {
    if (!user) return;
    setDeleting(loan.id);
    try {
      const refundedAt = new Date().toISOString();
      
      // For "take" loans (borrowed money) - refund means we paid back, so it's an expense
      // For "give" loans (lent money) - refund means we got it back, so it's income
      const transactionType = loan.loan_type === "give" ? "income" : "expense";
      const description = loan.loan_type === "give" 
        ? `Loan Received Back: ${loan.description || 'Loan repayment'}`
        : `Loan Paid Back: ${loan.description || 'Loan repayment'}`;
      
      // Create transaction for refunded loan
      const { data: newTx, error: txError } = await supabase
        .from("transactions")
        .insert({
          user_id: user.id,
          type: transactionType,
          amount: loan.amount,
          description,
          remarks: `Refunded on ${new Date().toLocaleString()}`,
        })
        .select()
        .single();

      if (txError) throw txError;

      // Update loan status to refunded
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
        user_id: user.id,
        table_name: "loans",
        action: "refund",
        record_id: loan.id,
        old_values: { status: loan.status },
        new_values: { status: "refunded", refunded_at: refundedAt, transaction_id: newTx.id },
      }]);

      toast.success(`Loan marked as refunded and added to ${transactionType}`);
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setDeleting(null);
    }
  };

  const calculateDaysUsed = (loanDate: string, refundedAt: string | null) => {
    const startDate = new Date(loanDate);
    const endDate = refundedAt ? new Date(refundedAt) : new Date();
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleDeleteNote = async (noteId: string) => {
    setDeleting(noteId);
    try {
      const { error } = await supabase.from("notes").delete().eq("id", noteId);
      if (error) throw error;
      toast.success("Note deleted");
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalIncome = transactions.filter(t => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpenses = transactions.filter(t => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0);
  const totalLoans = loans.filter(l => l.status === "active").reduce((sum, l) => sum + Number(l.amount), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/10">
      <header className="border-b bg-card/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex justify-between items-center">
          <h1 className="text-lg sm:text-xl font-bold">Transaction History</h1>
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Back</span>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="grid gap-3 sm:gap-6 grid-cols-3 mb-4 sm:mb-8">
          <Card>
            <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-1">
                <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />
                <span className="hidden sm:inline">Total </span>Income
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-sm sm:text-2xl font-bold text-green-500">{formatCurrency(totalIncome, currency)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-1">
                <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" />
                <span className="hidden sm:inline">Total </span>Expenses
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-sm sm:text-2xl font-bold text-red-500">{formatCurrency(totalExpenses, currency)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-1">
                <CreditCard className="w-3 h-3 sm:w-4 sm:h-4 text-orange-500" />
                <span className="hidden sm:inline">Active </span>Loans
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-sm sm:text-2xl font-bold text-orange-500">{formatCurrency(totalLoans, currency)}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="text-base sm:text-lg">All Records</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              View and manage your financial records
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 sm:pt-0">
            <Tabs defaultValue="income">
              <TabsList className="mx-3 sm:mx-0 mb-3 grid grid-cols-4 w-auto">
                <TabsTrigger value="income" className="text-xs sm:text-sm">
                  <TrendingUp className="w-3 h-3 sm:mr-1 text-green-500" />
                  <span className="hidden sm:inline">Income</span>
                  <span className="ml-1">({transactions.filter(t => t.type === "income").length})</span>
                </TabsTrigger>
                <TabsTrigger value="expense" className="text-xs sm:text-sm">
                  <TrendingDown className="w-3 h-3 sm:mr-1 text-red-500" />
                  <span className="hidden sm:inline">Expense</span>
                  <span className="ml-1">({transactions.filter(t => t.type === "expense").length})</span>
                </TabsTrigger>
                <TabsTrigger value="loans" className="text-xs sm:text-sm">
                  <CreditCard className="w-3 h-3 sm:mr-1 text-orange-500" />
                  <span className="hidden sm:inline">Loans</span>
                  <span className="ml-1">({loans.length})</span>
                </TabsTrigger>
                <TabsTrigger value="notes" className="text-xs sm:text-sm">
                  <StickyNote className="w-3 h-3 sm:mr-1" />
                  <span className="hidden sm:inline">Notes</span>
                  <span className="ml-1">({notes.length})</span>
                </TabsTrigger>
              </TabsList>

              {/* Income Tab */}
              <TabsContent value="income">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm">Amount</TableHead>
                        <TableHead className="text-xs sm:text-sm">Description</TableHead>
                        <TableHead className="text-xs sm:text-sm hidden md:table-cell">Remarks</TableHead>
                        <TableHead className="text-xs sm:text-sm hidden md:table-cell">Account</TableHead>
                        <TableHead className="text-xs sm:text-sm">Date</TableHead>
                        <TableHead className="text-xs sm:text-sm">View</TableHead>
                        <TableHead className="text-xs sm:text-sm text-right">Delete</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.filter(t => t.type === "income").length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No income records found
                          </TableCell>
                        </TableRow>
                      ) : (
                        transactions.filter(t => t.type === "income").map((tx) => (
                          <TableRow key={tx.id} className={editing === tx.id ? "bg-accent/50" : ""}>
                            <TableCell className="text-xs sm:text-sm font-medium text-green-500">
                              {editing === tx.id ? (
                                <Input
                                  type="number"
                                  value={editAmount}
                                  onChange={(e) => setEditAmount(e.target.value)}
                                  className="h-7 text-xs"
                                  step="0.01"
                                />
                              ) : (
                                formatCurrency(Number(tx.amount), currency)
                              )}
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm max-w-[150px]">
                              {editing === tx.id ? (
                                <Input
                                  value={editDescription}
                                  onChange={(e) => setEditDescription(e.target.value)}
                                  className="h-7 text-xs"
                                  placeholder="Description"
                                />
                              ) : (
                                <span className="truncate">{tx.description || "-"}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm hidden md:table-cell max-w-[150px]">
                              {editing === tx.id ? (
                                <Input
                                  value={editRemarks}
                                  onChange={(e) => setEditRemarks(e.target.value)}
                                  className="h-7 text-xs"
                                  placeholder="Remarks"
                                />
                              ) : (
                                <span className="truncate">{tx.remarks || "-"}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm hidden md:table-cell max-w-[150px]">
                              {editing === tx.id ? (
                                <Select value={editBankId} onValueChange={setEditBankId}>
                                  <SelectTrigger className="h-7 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="cash">💵 Cash</SelectItem>
                                    {bankAccounts.map(bank => (
                                      <SelectItem key={bank.id} value={bank.id}>
                                        🏦 {bank.bank_name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span className="truncate">
                                  {tx.bank_account_id ? bankAccounts.find(b => b.id === tx.bank_account_id)?.bank_name || "Bank" : "💵 Cash"}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm">
                              {new Date(tx.transaction_date).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              {editing === tx.id ? (
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="h-7 w-7 p-0"
                                    onClick={() => handleUpdateTransaction(tx)}
                                    disabled={deleting === tx.id}
                                  >
                                    <Check className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 w-7 p-0"
                                    onClick={cancelEdit}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              ) : (
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setSelectedItem(tx)}>
                                      <Eye className="w-4 h-4 text-primary" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-2xl">
                                    <DialogHeader>
                                      <DialogTitle>Income Details</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <p className="text-sm text-muted-foreground">Amount</p>
                                          <p className="font-bold text-green-500">{formatCurrency(Number(tx.amount), currency)}</p>
                                        </div>
                                        <div>
                                          <p className="text-sm text-muted-foreground">Date</p>
                                          <p className="font-medium">{new Date(tx.transaction_date).toLocaleDateString()}</p>
                                        </div>
                                      </div>
                                      <div>
                                        <p className="text-sm text-muted-foreground">Description</p>
                                        <p className="font-medium">{tx.description || "No description"}</p>
                                      </div>
                                      <div>
                                        <p className="text-sm text-muted-foreground">Remarks</p>
                                        <p className="font-medium">{tx.remarks || "No remarks"}</p>
                                      </div>
                                      {tx.image_url && (
                                        <div>
                                          <p className="text-sm text-muted-foreground mb-2">Attached Image</p>
                                          <img src={tx.image_url} alt="Transaction" className="w-full max-h-96 object-contain rounded-lg border" />
                                        </div>
                                      )}
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {editing === tx.id ? null : (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => startEditTransaction(tx)}
                                  >
                                    <Pencil className="w-4 h-4 text-blue-500" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Income Record?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This will permanently delete this income of {formatCurrency(Number(tx.amount), currency)}.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleDeleteTransaction(tx)}
                                          disabled={deleting === tx.id}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          {deleting === tx.id ? "Deleting..." : "Delete"}
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Expense Tab */}
              <TabsContent value="expense">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm">Amount</TableHead>
                        <TableHead className="text-xs sm:text-sm">Description</TableHead>
                        <TableHead className="text-xs sm:text-sm hidden md:table-cell">Remarks</TableHead>
                        <TableHead className="text-xs sm:text-sm hidden md:table-cell">Account</TableHead>
                        <TableHead className="text-xs sm:text-sm">Date</TableHead>
                        <TableHead className="text-xs sm:text-sm">View</TableHead>
                        <TableHead className="text-xs sm:text-sm text-right">Delete</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.filter(t => t.type === "expense").length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No expense records found
                          </TableCell>
                        </TableRow>
                      ) : (
                        transactions.filter(t => t.type === "expense").map((tx) => (
                          <TableRow key={tx.id} className={editing === tx.id ? "bg-accent/50" : ""}>
                            <TableCell className="text-xs sm:text-sm font-medium text-red-500">
                              {editing === tx.id ? (
                                <Input
                                  type="number"
                                  value={editAmount}
                                  onChange={(e) => setEditAmount(e.target.value)}
                                  className="h-7 text-xs"
                                  step="0.01"
                                />
                              ) : (
                                formatCurrency(Number(tx.amount), currency)
                              )}
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm max-w-[150px]">
                              {editing === tx.id ? (
                                <Input
                                  value={editDescription}
                                  onChange={(e) => setEditDescription(e.target.value)}
                                  className="h-7 text-xs"
                                  placeholder="Description"
                                />
                              ) : (
                                <span className="truncate">{tx.description || "-"}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm hidden md:table-cell max-w-[150px]">
                              {editing === tx.id ? (
                                <Input
                                  value={editRemarks}
                                  onChange={(e) => setEditRemarks(e.target.value)}
                                  className="h-7 text-xs"
                                  placeholder="Remarks"
                                />
                              ) : (
                                <span className="truncate">{tx.remarks || "-"}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm hidden md:table-cell max-w-[150px]">
                              {editing === tx.id ? (
                                <Select value={editBankId} onValueChange={setEditBankId}>
                                  <SelectTrigger className="h-7 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="cash">💵 Cash</SelectItem>
                                    {bankAccounts.map(bank => (
                                      <SelectItem key={bank.id} value={bank.id}>
                                        🏦 {bank.bank_name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span className="truncate">
                                  {tx.bank_account_id ? bankAccounts.find(b => b.id === tx.bank_account_id)?.bank_name || "Bank" : "💵 Cash"}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm">
                              {new Date(tx.transaction_date).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              {editing === tx.id ? (
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="h-7 w-7 p-0"
                                    onClick={() => handleUpdateTransaction(tx)}
                                    disabled={deleting === tx.id}
                                  >
                                    <Check className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 w-7 p-0"
                                    onClick={cancelEdit}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              ) : (
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                      <Eye className="w-4 h-4 text-primary" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-2xl">
                                    <DialogHeader>
                                      <DialogTitle>Expense Details</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <p className="text-sm text-muted-foreground">Amount</p>
                                          <p className="font-bold text-red-500">{formatCurrency(Number(tx.amount), currency)}</p>
                                        </div>
                                        <div>
                                          <p className="text-sm text-muted-foreground">Date</p>
                                          <p className="font-medium">{new Date(tx.transaction_date).toLocaleDateString()}</p>
                                        </div>
                                      </div>
                                      <div>
                                        <p className="text-sm text-muted-foreground">Description</p>
                                        <p className="font-medium">{tx.description || "No description"}</p>
                                      </div>
                                      <div>
                                        <p className="text-sm text-muted-foreground">Remarks</p>
                                        <p className="font-medium">{tx.remarks || "No remarks"}</p>
                                      </div>
                                      {tx.image_url && (
                                        <div>
                                          <p className="text-sm text-muted-foreground mb-2">Attached Image</p>
                                          <img src={tx.image_url} alt="Transaction" className="w-full max-h-96 object-contain rounded-lg border" />
                                        </div>
                                      )}
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {editing === tx.id ? null : (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => startEditTransaction(tx)}
                                  >
                                    <Pencil className="w-4 h-4 text-blue-500" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Expense Record?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This will permanently delete this expense of {formatCurrency(Number(tx.amount), currency)}.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleDeleteTransaction(tx)}
                                          disabled={deleting === tx.id}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          {deleting === tx.id ? "Deleting..." : "Delete"}
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Loans Tab */}
              <TabsContent value="loans">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm">Type</TableHead>
                        <TableHead className="text-xs sm:text-sm">Status</TableHead>
                        <TableHead className="text-xs sm:text-sm">Amount</TableHead>
                        <TableHead className="text-xs sm:text-sm">Description</TableHead>
                        <TableHead className="text-xs sm:text-sm hidden md:table-cell">Days</TableHead>
                        <TableHead className="text-xs sm:text-sm">Date</TableHead>
                        <TableHead className="text-xs sm:text-sm">View</TableHead>
                        <TableHead className="text-xs sm:text-sm text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loans.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                            No loans found
                          </TableCell>
                        </TableRow>
                      ) : (
                        loans.map((loan) => (
                          <TableRow key={loan.id}>
                            <TableCell>
                              <Badge 
                                variant="outline" 
                                className={`text-[10px] sm:text-xs ${loan.loan_type === "give" ? "border-blue-500 text-blue-500" : "border-purple-500 text-purple-500"}`}
                              >
                                {loan.loan_type === "give" ? (
                                  <><ArrowUpRight className="w-3 h-3 mr-1" />Lent</>
                                ) : (
                                  <><ArrowDownLeft className="w-3 h-3 mr-1" />Borrowed</>
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={loan.status === "active" ? "default" : "secondary"} className="text-[10px] sm:text-xs">
                                {loan.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm font-medium text-orange-500">
                              {formatCurrency(Number(loan.amount), currency)}
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm max-w-[150px] truncate">
                              {loan.description || "-"}
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm hidden md:table-cell">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {calculateDaysUsed(loan.loan_date, loan.refunded_at)} days
                              </span>
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm">
                              {new Date(loan.loan_date).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                    <Eye className="w-4 h-4 text-primary" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl">
                                  <DialogHeader>
                                    <DialogTitle>Loan Details</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <p className="text-sm text-muted-foreground">Loan Type</p>
                                        <Badge variant="outline" className={loan.loan_type === "give" ? "border-blue-500 text-blue-500" : "border-purple-500 text-purple-500"}>
                                          {loan.loan_type === "give" ? "Lent (Given)" : "Borrowed (Taken)"}
                                        </Badge>
                                      </div>
                                      <div>
                                        <p className="text-sm text-muted-foreground">Amount</p>
                                        <p className="font-bold text-orange-500">{formatCurrency(Number(loan.amount), currency)}</p>
                                      </div>
                                      <div>
                                        <p className="text-sm text-muted-foreground">Status</p>
                                        <Badge variant={loan.status === "active" ? "default" : "secondary"}>
                                          {loan.status}
                                        </Badge>
                                      </div>
                                      <div>
                                        <p className="text-sm text-muted-foreground">Days {loan.status === "refunded" ? "Used" : "Active"}</p>
                                        <p className="font-medium">{calculateDaysUsed(loan.loan_date, loan.refunded_at)} days</p>
                                      </div>
                                      <div>
                                        <p className="text-sm text-muted-foreground">Loan Date</p>
                                        <p className="font-medium">{new Date(loan.loan_date).toLocaleDateString()}</p>
                                      </div>
                                      {loan.refunded_at && (
                                        <div>
                                          <p className="text-sm text-muted-foreground">Refunded At</p>
                                          <p className="font-medium text-green-600">{new Date(loan.refunded_at).toLocaleString()}</p>
                                        </div>
                                      )}
                                    </div>
                                    <div>
                                      <p className="text-sm text-muted-foreground">Description</p>
                                      <p className="font-medium">{loan.description || "No description"}</p>
                                    </div>
                                    <div>
                                      <p className="text-sm text-muted-foreground">Remarks</p>
                                      <p className="font-medium">{loan.remarks || "No remarks"}</p>
                                    </div>
                                    {loan.image_url && (
                                      <div>
                                        <p className="text-sm text-muted-foreground mb-2">Attached Image</p>
                                        <img src={loan.image_url} alt="Loan" className="w-full max-h-96 object-contain rounded-lg border" />
                                      </div>
                                    )}
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-1 justify-end">
                                {loan.status === "active" && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Mark as Refunded">
                                        <RefreshCw className="w-4 h-4 text-green-500" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Mark Loan as Refunded?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This will mark the loan as refunded and automatically add {formatCurrency(Number(loan.amount), currency)} to your income.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleRefundLoan(loan)}
                                          disabled={deleting === loan.id}
                                          className="bg-green-600 hover:bg-green-700"
                                        >
                                          {deleting === loan.id ? "Processing..." : "Confirm Refund"}
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                      <Trash2 className="w-4 h-4 text-destructive" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Loan?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will permanently delete this loan of {formatCurrency(Number(loan.amount), currency)}.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteLoan(loan)}
                                        disabled={deleting === loan.id}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        {deleting === loan.id ? "Deleting..." : "Delete"}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Notes Tab */}
              <TabsContent value="notes">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm">Title</TableHead>
                        <TableHead className="text-xs sm:text-sm">Content</TableHead>
                        <TableHead className="text-xs sm:text-sm">Created</TableHead>
                        <TableHead className="text-xs sm:text-sm">Updated</TableHead>
                        <TableHead className="text-xs sm:text-sm text-right">Delete</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {notes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No notes found
                          </TableCell>
                        </TableRow>
                      ) : (
                        notes.map((note) => (
                          <TableRow key={note.id}>
                            <TableCell className="text-xs sm:text-sm font-medium">
                              {note.title}
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm max-w-[200px] truncate">
                              {note.content || "-"}
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm">
                              {new Date(note.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm">
                              {new Date(note.updated_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Note?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete the note "{note.title}".
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteNote(note.id)}
                                      disabled={deleting === note.id}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      {deleting === note.id ? "Deleting..." : "Delete"}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Transactions;

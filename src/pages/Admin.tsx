import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, Loader2, Shield, Search, Eye, Trash2, TrendingUp, TrendingDown, CreditCard, Building2, Globe, Monitor } from "lucide-react";
import { toast } from "sonner";

interface ProfileUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  country: string | null;
  approved: boolean;
  created_at: string;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  remarks: string | null;
  image_url: string | null;
  transaction_date: string;
}

interface Loan {
  id: string;
  amount: number;
  description: string | null;
  status: string;
  loan_date: string;
}

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  current_balance: number;
}

interface LoginAttempt {
  id: string;
  ip_address: string;
  email: string | null;
  success: boolean;
  user_agent: string | null;
  created_at: string;
}

interface UserSession {
  id: string;
  user_id: string;
  ip_address: string;
  user_agent: string | null;
  created_at: string;
  last_active: string;
}

const Admin = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [allUsers, setAllUsers] = useState<ProfileUser[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<ProfileUser | null>(null);
  const [userTransactions, setUserTransactions] = useState<Transaction[]>([]);
  const [userLoans, setUserLoans] = useState<Loan[]>([]);
  const [userBankAccounts, setUserBankAccounts] = useState<BankAccount[]>([]);
  const [userSessions, setUserSessions] = useState<UserSession[]>([]);
  const [loadingUserData, setLoadingUserData] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState<LoginAttempt[]>([]);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleData) {
        toast.error("Access denied. Admin only.");
        navigate("/");
        return;
      }

      setIsAdmin(true);
      fetchAllUsers();
    } catch (error) {
      console.error("Error checking admin access:", error);
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    const [usersResult, attemptsResult] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("login_attempts").select("*").order("created_at", { ascending: false }).limit(100)
    ]);

    if (usersResult.error) {
      console.error("Error fetching users:", usersResult.error);
    } else {
      setAllUsers(usersResult.data || []);
    }

    setLoginAttempts(attemptsResult.data || []);
  };

  const fetchUserData = async (userId: string) => {
    setLoadingUserData(true);
    try {
      const [txResult, loanResult, bankResult, sessionResult] = await Promise.all([
        supabase.from("transactions").select("*").eq("user_id", userId).order("transaction_date", { ascending: false }),
        supabase.from("loans").select("*").eq("user_id", userId).order("loan_date", { ascending: false }),
        supabase.from("bank_accounts").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("user_sessions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
      ]);

      setUserTransactions(txResult.data || []);
      setUserLoans(loanResult.data || []);
      setUserBankAccounts(bankResult.data || []);
      setUserSessions(sessionResult.data || []);
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoadingUserData(false);
    }
  };

  const handleApprove = async (userId: string) => {
    setProcessing(userId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ 
          approved: true, 
          approved_at: new Date().toISOString(),
          approved_by: user?.id 
        })
        .eq("id", userId);

      if (error) throw error;

      await supabase.from("audit_logs").insert([{
        user_id: user?.id,
        table_name: "profiles",
        action: "approve_user",
        record_id: userId,
        new_values: { approved: true },
      }]);

      toast.success("User approved successfully");
      fetchAllUsers();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (userId: string) => {
    setProcessing(userId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ approved: false })
        .eq("id", userId);

      if (error) throw error;

      await supabase.from("audit_logs").insert([{
        user_id: user?.id,
        table_name: "profiles",
        action: "reject_user",
        record_id: userId,
        new_values: { approved: false },
      }]);

      toast.success("User access revoked");
      fetchAllUsers();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setProcessing(null);
    }
  };

  const isUserAdmin = async (userId: string): Promise<boolean> => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    return !!data;
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    setProcessing(userId);
    try {
      // Check if target user is admin - prevent deletion
      const targetIsAdmin = await isUserAdmin(userId);
      if (targetIsAdmin) {
        toast.error("Cannot delete admin users");
        setProcessing(null);
        return;
      }

      // Delete all related data first
      await Promise.all([
        supabase.from("transactions").delete().eq("user_id", userId),
        supabase.from("loans").delete().eq("user_id", userId),
        supabase.from("categories").delete().eq("user_id", userId),
        supabase.from("notes").delete().eq("user_id", userId),
        supabase.from("vault_items").delete().eq("user_id", userId),
        supabase.from("vault_settings").delete().eq("user_id", userId),
        supabase.from("user_sessions").delete().eq("user_id", userId),
        supabase.from("user_roles").delete().eq("user_id", userId),
      ]);

      // Delete bank transactions for this user's bank accounts
      const { data: bankAccounts } = await supabase
        .from("bank_accounts")
        .select("id")
        .eq("user_id", userId);
      
      if (bankAccounts && bankAccounts.length > 0) {
        const bankIds = bankAccounts.map(b => b.id);
        await supabase.from("bank_transactions").delete().in("bank_account_id", bankIds);
      }
      
      await supabase.from("bank_accounts").delete().eq("user_id", userId);

      // Delete profile
      const { error } = await supabase.from("profiles").delete().eq("id", userId);
      if (error) throw error;

      await supabase.from("audit_logs").insert([{
        user_id: user?.id,
        table_name: "profiles",
        action: "delete_user",
        record_id: userId,
        old_values: { email: userEmail },
      }]);

      toast.success(`User ${userEmail} deleted. They can re-register with the same email.`);
      fetchAllUsers();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleViewUser = (u: ProfileUser) => {
    setSelectedUser(u);
    fetchUserData(u.id);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  // All users are now auto-approved, filter by search only
  const filteredUsers = allUsers.filter(u =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.first_name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
    (u.last_name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
    (u.phone || "").includes(searchQuery)
  );

  const userTotalIncome = userTransactions.filter(t => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0);
  const userTotalExpenses = userTransactions.filter(t => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0);
  const userTotalLoans = userLoans.filter(l => l.status === "active").reduce((sum, l) => sum + Number(l.amount), 0);
  const userTotalBankBalance = userBankAccounts.reduce((sum, b) => sum + Number(b.current_balance), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/10">
      <header className="border-b bg-card/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            <h1 className="text-lg sm:text-xl font-bold">Admin Panel</h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Back to Dashboard</span>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="grid gap-3 sm:gap-6 grid-cols-2 lg:grid-cols-3 mb-4 sm:mb-8">
          <Card>
            <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Total Users</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-lg sm:text-2xl font-bold text-primary">{allUsers.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Login Attempts</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-lg sm:text-2xl font-bold text-blue-500">{loginAttempts.length}</div>
            </CardContent>
          </Card>

          <Card className="col-span-2 lg:col-span-1">
            <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Active Sessions</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-lg sm:text-2xl font-bold text-green-500">{userSessions.length}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users" className="text-xs sm:text-sm">
              All Users ({allUsers.length})
            </TabsTrigger>
            <TabsTrigger value="security" className="text-xs sm:text-sm">
              Security
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="text-base sm:text-lg">All Users</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  View and manage all registered users
                </CardDescription>
                <div className="relative mt-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by email, name, or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0 sm:p-6 sm:pt-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm">Email</TableHead>
                        <TableHead className="text-xs sm:text-sm">Name</TableHead>
                        <TableHead className="text-xs sm:text-sm">Phone</TableHead>
                        <TableHead className="text-xs sm:text-sm hidden lg:table-cell">Joined</TableHead>
                        <TableHead className="text-xs sm:text-sm text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No users found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredUsers.map((u) => (
                          <TableRow key={u.id}>
                            <TableCell className="text-xs sm:text-sm font-medium">{u.email}</TableCell>
                            <TableCell className="text-xs sm:text-sm">{u.first_name || ""} {u.last_name || ""}</TableCell>
                            <TableCell className="text-xs sm:text-sm font-mono">{u.phone || "-"}</TableCell>
                            <TableCell className="text-xs sm:text-sm hidden lg:table-cell">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-1 sm:gap-2 justify-end">
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleViewUser(u)}
                                      className="h-7 w-7 sm:h-8 sm:w-auto sm:px-3 p-0"
                                    >
                                      <Eye className="w-3 h-3 sm:mr-1" />
                                      <span className="hidden sm:inline">View</span>
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                                    <DialogHeader>
                                      <DialogTitle>
                                        {selectedUser?.first_name} {selectedUser?.last_name}'s Records
                                      </DialogTitle>
                                    </DialogHeader>
                                    
                                    {loadingUserData ? (
                                      <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                      </div>
                                    ) : (
                                      <div className="space-y-4">
                                        {/* User Info */}
                                        <Card>
                                          <CardContent className="p-4">
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                              <div>
                                                <p className="text-muted-foreground">Email</p>
                                                <p className="font-medium">{selectedUser?.email}</p>
                                              </div>
                                              <div>
                                                <p className="text-muted-foreground">Phone</p>
                                                <p className="font-medium">{selectedUser?.phone || "-"}</p>
                                              </div>
                                              <div>
                                                <p className="text-muted-foreground">Country</p>
                                                <p className="font-medium">{selectedUser?.country || "-"}</p>
                                              </div>
                                              <div>
                                                <p className="text-muted-foreground">Joined</p>
                                                <p className="font-medium">
                                                  {selectedUser ? new Date(selectedUser.created_at).toLocaleDateString() : "-"}
                                                </p>
                                              </div>
                                            </div>
                                          </CardContent>
                                        </Card>

                                        {/* Summary Cards */}
                                        <div className="grid grid-cols-4 gap-3">
                                          <Card>
                                            <CardContent className="p-3 text-center">
                                              <TrendingUp className="w-4 h-4 text-green-500 mx-auto mb-1" />
                                              <p className="text-xs text-muted-foreground">Income</p>
                                              <p className="font-bold text-green-500">NPR {userTotalIncome.toFixed(2)}</p>
                                            </CardContent>
                                          </Card>
                                          <Card>
                                            <CardContent className="p-3 text-center">
                                              <TrendingDown className="w-4 h-4 text-red-500 mx-auto mb-1" />
                                              <p className="text-xs text-muted-foreground">Expenses</p>
                                              <p className="font-bold text-red-500">NPR {userTotalExpenses.toFixed(2)}</p>
                                            </CardContent>
                                          </Card>
                                          <Card>
                                            <CardContent className="p-3 text-center">
                                              <CreditCard className="w-4 h-4 text-orange-500 mx-auto mb-1" />
                                              <p className="text-xs text-muted-foreground">Loans</p>
                                              <p className="font-bold text-orange-500">NPR {userTotalLoans.toFixed(2)}</p>
                                            </CardContent>
                                          </Card>
                                          <Card>
                                            <CardContent className="p-3 text-center">
                                              <Building2 className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                                              <p className="text-xs text-muted-foreground">Bank Balance</p>
                                              <p className="font-bold text-blue-500">NPR {userTotalBankBalance.toFixed(2)}</p>
                                            </CardContent>
                                          </Card>
                                        </div>

                                        {/* Bank Accounts Table */}
                                        <Card>
                                          <CardHeader className="p-3">
                                            <CardTitle className="text-sm">Bank Accounts ({userBankAccounts.length})</CardTitle>
                                          </CardHeader>
                                          <CardContent className="p-0">
                                            <Table>
                                              <TableHeader>
                                                <TableRow>
                                                  <TableHead className="text-xs">Bank Name</TableHead>
                                                  <TableHead className="text-xs">Account Number</TableHead>
                                                  <TableHead className="text-xs">Balance</TableHead>
                                                </TableRow>
                                              </TableHeader>
                                              <TableBody>
                                                {userBankAccounts.length === 0 ? (
                                                  <TableRow>
                                                    <TableCell colSpan={3} className="text-center py-4 text-muted-foreground text-xs">
                                                      No bank accounts
                                                    </TableCell>
                                                  </TableRow>
                                                ) : (
                                                  userBankAccounts.map((bank) => (
                                                    <TableRow key={bank.id}>
                                                      <TableCell className="text-xs font-medium">{bank.bank_name}</TableCell>
                                                      <TableCell className="text-xs">{bank.account_number}</TableCell>
                                                      <TableCell className="text-xs font-bold text-blue-500">NPR {Number(bank.current_balance).toFixed(2)}</TableCell>
                                                    </TableRow>
                                                  ))
                                                )}
                                              </TableBody>
                                            </Table>
                                          </CardContent>
                                        </Card>

                                        {/* Transactions Table */}
                                        <Card>
                                          <CardHeader className="p-3">
                                            <CardTitle className="text-sm">Transactions ({userTransactions.length})</CardTitle>
                                          </CardHeader>
                                          <CardContent className="p-0">
                                            <Table>
                                              <TableHeader>
                                                <TableRow>
                                                  <TableHead className="text-xs">Type</TableHead>
                                                  <TableHead className="text-xs">Amount</TableHead>
                                                  <TableHead className="text-xs">Description</TableHead>
                                                  <TableHead className="text-xs">Date</TableHead>
                                                </TableRow>
                                              </TableHeader>
                                              <TableBody>
                                                {userTransactions.slice(0, 10).map((tx) => (
                                                  <TableRow key={tx.id}>
                                                    <TableCell>
                                                      <Badge variant={tx.type === "income" ? "default" : "destructive"} className="text-[10px]">
                                                        {tx.type}
                                                      </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-xs">NPR {Number(tx.amount).toFixed(2)}</TableCell>
                                                    <TableCell className="text-xs max-w-[150px] truncate">{tx.description || "-"}</TableCell>
                                                    <TableCell className="text-xs">{new Date(tx.transaction_date).toLocaleDateString()}</TableCell>
                                                  </TableRow>
                                                ))}
                                              </TableBody>
                                            </Table>
                                          </CardContent>
                                        </Card>

                                        {/* Loans Table */}
                                        <Card>
                                          <CardHeader className="p-3">
                                            <CardTitle className="text-sm">Loans ({userLoans.length})</CardTitle>
                                          </CardHeader>
                                          <CardContent className="p-0">
                                            <Table>
                                              <TableHeader>
                                                <TableRow>
                                                  <TableHead className="text-xs">Status</TableHead>
                                                  <TableHead className="text-xs">Amount</TableHead>
                                                  <TableHead className="text-xs">Description</TableHead>
                                                  <TableHead className="text-xs">Date</TableHead>
                                                </TableRow>
                                              </TableHeader>
                                              <TableBody>
                                                {userLoans.map((loan) => (
                                                  <TableRow key={loan.id}>
                                                    <TableCell>
                                                      <Badge variant={loan.status === "active" ? "default" : "secondary"} className="text-[10px]">
                                                        {loan.status}
                                                      </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-xs">NPR {Number(loan.amount).toFixed(2)}</TableCell>
                                                    <TableCell className="text-xs max-w-[150px] truncate">{loan.description || "-"}</TableCell>
                                                    <TableCell className="text-xs">{new Date(loan.loan_date).toLocaleDateString()}</TableCell>
                                                  </TableRow>
                                                ))}
                                              </TableBody>
                                              </Table>
                                          </CardContent>
                                        </Card>

                                        {/* Login Sessions */}
                                        <Card>
                                          <CardHeader className="p-3">
                                            <CardTitle className="text-sm flex items-center gap-2">
                                              <Monitor className="h-4 w-4" />
                                              Login Sessions ({userSessions.length})
                                            </CardTitle>
                                          </CardHeader>
                                          <CardContent className="p-0">
                                            <Table>
                                              <TableHeader>
                                                <TableRow>
                                                  <TableHead className="text-xs">IP Address</TableHead>
                                                  <TableHead className="text-xs">Browser</TableHead>
                                                  <TableHead className="text-xs">Date</TableHead>
                                                </TableRow>
                                              </TableHeader>
                                              <TableBody>
                                                {userSessions.length === 0 ? (
                                                  <TableRow>
                                                    <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-4">
                                                      No sessions recorded
                                                    </TableCell>
                                                  </TableRow>
                                                ) : (
                                                  userSessions.map((session) => (
                                                    <TableRow key={session.id}>
                                                      <TableCell className="text-xs font-mono flex items-center gap-1">
                                                        <Globe className="h-3 w-3" />
                                                        {session.ip_address}
                                                      </TableCell>
                                                      <TableCell className="text-xs">
                                                        {session.user_agent?.includes('Chrome') ? 'Chrome' :
                                                         session.user_agent?.includes('Firefox') ? 'Firefox' :
                                                         session.user_agent?.includes('Safari') ? 'Safari' : 'Other'}
                                                      </TableCell>
                                                      <TableCell className="text-xs">{new Date(session.created_at).toLocaleString()}</TableCell>
                                                    </TableRow>
                                                  ))
                                                )}
                                              </TableBody>
                                            </Table>
                                          </CardContent>
                                        </Card>
                                      </div>
                                    )}
                                  </DialogContent>
                                </Dialog>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      disabled={processing === u.id}
                                      className="h-7 w-7 sm:h-8 sm:w-auto sm:px-3 p-0"
                                    >
                                      {processing === u.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <>
                                          <Trash2 className="w-3 h-3 sm:mr-1" />
                                          <span className="hidden sm:inline">Delete</span>
                                        </>
                                      )}
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete User</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will permanently delete {u.email} and all their data. They will be able to re-register with the same email after deletion.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteUser(u.id, u.email)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Delete User
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Login Attempts
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Monitor all login attempts and IP addresses
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 sm:p-6 sm:pt-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm">IP Address</TableHead>
                        <TableHead className="text-xs sm:text-sm">Email</TableHead>
                        <TableHead className="text-xs sm:text-sm">Status</TableHead>
                        <TableHead className="text-xs sm:text-sm hidden md:table-cell">Browser</TableHead>
                        <TableHead className="text-xs sm:text-sm">Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loginAttempts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No login attempts recorded
                          </TableCell>
                        </TableRow>
                      ) : (
                        loginAttempts.map((attempt) => (
                          <TableRow key={attempt.id}>
                            <TableCell className="text-xs sm:text-sm font-mono flex items-center gap-2">
                              <Globe className="h-4 w-4 text-muted-foreground" />
                              {attempt.ip_address}
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm">{attempt.email || "-"}</TableCell>
                            <TableCell>
                              <Badge variant={attempt.success ? "default" : "destructive"}>
                                {attempt.success ? "Success" : "Failed"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm hidden md:table-cell">
                              {attempt.user_agent?.includes('Chrome') ? 'Chrome' :
                               attempt.user_agent?.includes('Firefox') ? 'Firefox' :
                               attempt.user_agent?.includes('Safari') ? 'Safari' : 'Other'}
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm">
                              {new Date(attempt.created_at).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;

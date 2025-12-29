import React, { memo, useMemo, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useDashboardData, useInvalidateDashboard } from "@/hooks/useDashboardData";
import { useTelegramNotifications } from "@/hooks/useTelegramNotifications";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, TrendingUp, TrendingDown, LogOut, Plus, StickyNote, Loader2, Shield, History, Building2, BarChart3, Landmark, Lock, User as UserIcon, HandCoins, Banknote, FileText, Bell } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { TransactionForm } from "@/components/TransactionForm";
import { LoanForm } from "@/components/LoanForm";
import { TransactionList } from "@/components/TransactionList";
import { BankAccountForm } from "@/components/BankAccountForm";
import { TelegramConnect } from "@/components/TelegramConnect";
import { formatCurrency } from "@/lib/utils";
import { useState, useCallback } from "react";

// Lazy load heavy components
const AnalyticsChart = lazy(() => import("@/components/AnalyticsChart").then(m => ({ default: m.AnalyticsChart })));
const FinancialStatement = lazy(() => import("@/components/FinancialStatement").then(m => ({ default: m.FinancialStatement })));
const NotesPanel = lazy(() => import("@/components/NotesPanel").then(m => ({ default: m.NotesPanel })));
const SendReportDialog = lazy(() => import("@/components/SendReportDialog").then(m => ({ default: m.SendReportDialog })));
const RemindersPanel = lazy(() => import("@/components/RemindersPanel"));

// Memoized summary card component
const SummaryCard = memo(({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  iconColor,
  valueColor,
  className = ""
}: { 
  title: string; 
  value: string; 
  subtitle: string; 
  icon: React.ElementType;
  iconColor: string;
  valueColor?: string;
  className?: string;
}) => (
  <Card className={className}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
      <CardTitle className="text-xs sm:text-sm font-medium">{title}</CardTitle>
      <Icon className={`h-3 w-3 sm:h-4 sm:w-4 ${iconColor}`} />
    </CardHeader>
    <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
      <div className={`text-lg sm:text-2xl font-bold ${valueColor || ''}`}>{value}</div>
      <p className="text-[10px] sm:text-xs text-muted-foreground">{subtitle}</p>
    </CardContent>
  </Card>
));

SummaryCard.displayName = "SummaryCard";

// Component loader for lazy components
const ComponentLoader = () => (
  <div className="flex items-center justify-center py-8">
    <Loader2 className="w-6 h-6 animate-spin text-primary" />
  </div>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuthSession(true);
  const invalidateDashboard = useInvalidateDashboard();
  
  const { data: dashboardData, isLoading: dataLoading } = useDashboardData(user?.id);

  const [openDialog, setOpenDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const handleSignOut = useCallback(async () => {
    if (user) {
      try {
        await supabase.from("audit_logs").insert({
          user_id: user.id,
          table_name: "auth",
          action: "sign_out",
          new_values: { timestamp: new Date().toISOString() }
        });
      } catch (e) {
        console.log("Could not log sign out");
      }
    }
    
    toast.success("Signed out successfully");
    signOut();
  }, [user, signOut]);

  const handleRecordAdded = useCallback(() => {
    setOpenDialog(false);
    invalidateDashboard();
  }, [invalidateDashboard]);

  // Memoize derived values
  const { 
    totalIncome = 0, 
    totalExpenses = 0, 
    loansGiven = 0, 
    loansTaken = 0, 
    totalBankBalance = 0,
    currency = "NPR",
    isApproved = true,
    isAdmin = false,
    reportEmail = ""
  } = dashboardData || {};

  // Subscribe to real-time notifications for Telegram transactions
  useTelegramNotifications({
    userId: user?.id,
    currency,
    onNewTransaction: invalidateDashboard,
  });

  const netBalance = useMemo(() => totalIncome - totalExpenses, [totalIncome, totalExpenses]);
  const usableBalance = useMemo(() => totalBankBalance - loansTaken, [totalBankBalance, loansTaken]);

  if (authLoading || dataLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/10">
      <header className="border-b bg-card/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Finance Manager" className="w-6 h-6 sm:w-8 sm:h-8 object-contain" />
            <h1 className="text-lg sm:text-xl font-bold">Finance Manager</h1>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/profile")} className="px-2 sm:px-3">
              <UserIcon className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Profile</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/vault")} className="px-2 sm:px-3">
              <Lock className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Vault</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/transactions")} className="px-2 sm:px-3">
              <History className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">History</span>
            </Button>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => navigate("/admin")} className="px-2 sm:px-3">
                <Shield className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Admin</span>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleSignOut} className="px-2 sm:px-3">
              <LogOut className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Summary Cards - Memoized */}
        <div className="grid gap-3 sm:gap-6 grid-cols-2 lg:grid-cols-4 mb-4 sm:mb-8">
          <SummaryCard
            title="Total Income"
            value={formatCurrency(totalIncome, currency)}
            subtitle="Total"
            icon={TrendingUp}
            iconColor="text-green-500"
          />
          <SummaryCard
            title="Total Expenses"
            value={formatCurrency(totalExpenses, currency)}
            subtitle="Total"
            icon={TrendingDown}
            iconColor="text-red-500"
          />
          <SummaryCard
            title="Net Balance"
            value={formatCurrency(netBalance, currency)}
            subtitle="Available"
            icon={Wallet}
            iconColor="text-primary"
            valueColor={netBalance >= 0 ? 'text-green-600' : 'text-red-600'}
          />
          <SummaryCard
            title="Bank Balance"
            value={formatCurrency(totalBankBalance, currency)}
            subtitle="All accounts"
            icon={Landmark}
            iconColor="text-blue-500"
            valueColor="text-blue-600"
          />
          <SummaryCard
            title="Loans Given"
            value={formatCurrency(loansGiven, currency)}
            subtitle="Money Lent"
            icon={HandCoins}
            iconColor="text-purple-500"
            valueColor="text-purple-600"
          />
          <SummaryCard
            title="Loans Taken"
            value={formatCurrency(loansTaken, currency)}
            subtitle="Money Borrowed"
            icon={Banknote}
            iconColor="text-orange-500"
            valueColor="text-orange-600"
          />
          <SummaryCard
            title="Usable Balance"
            value={formatCurrency(usableBalance, currency)}
            subtitle="After Debts"
            icon={Wallet}
            iconColor="text-green-500"
            valueColor={usableBalance >= 0 ? 'text-green-600' : 'text-red-600'}
            className="col-span-2 lg:col-span-1"
          />
        </div>

        {/* Telegram Connect */}
        {user && (
          <div className="mb-4 sm:mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            <TelegramConnect userId={user.id} userEmail={user.email || ""} />
          </div>
        )}

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-flex">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">
              <Wallet className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs sm:text-sm">
              <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="statement" className="text-xs sm:text-sm">
              <FileText className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
              <span className="hidden sm:inline">Statement</span>
            </TabsTrigger>
            <TabsTrigger value="bank" className="text-xs sm:text-sm">
              <Building2 className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
              <span className="hidden sm:inline">Bank</span>
            </TabsTrigger>
            <TabsTrigger value="reminders" className="text-xs sm:text-sm">
              <Bell className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
              <span className="hidden sm:inline">Reminders</span>
            </TabsTrigger>
            <TabsTrigger value="notes" className="text-xs sm:text-sm">
              <StickyNote className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
              <span className="hidden sm:inline">Notes</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-3 sm:gap-6 md:grid-cols-2">
              <Card>
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-base sm:text-lg">
                    Quick Actions
                    <div className="flex gap-2 w-full sm:w-auto">
                      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                        <DialogTrigger asChild>
                          <Button size="sm" disabled={!isApproved} className="flex-1 sm:flex-none">
                            <Plus className="w-4 h-4 mr-1 sm:mr-2" />
                            <span className="text-xs sm:text-sm">Add Record</span>
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-[95vw] sm:max-w-md mx-2 sm:mx-auto max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Add New Record</DialogTitle>
                            <DialogDescription>
                              Add income, expense, or loan record
                            </DialogDescription>
                          </DialogHeader>
                          <Tabs defaultValue="transaction">
                            <TabsList className="grid w-full grid-cols-2">
                              <TabsTrigger value="transaction" className="text-xs sm:text-sm">Transaction</TabsTrigger>
                              <TabsTrigger value="loan" className="text-xs sm:text-sm">Loan</TabsTrigger>
                            </TabsList>
                            <TabsContent value="transaction">
                              <TransactionForm onSuccess={handleRecordAdded} />
                            </TabsContent>
                            <TabsContent value="loan">
                              <LoanForm onSuccess={handleRecordAdded} />
                            </TabsContent>
                          </Tabs>
                        </DialogContent>
                      </Dialog>
                      <Suspense fallback={null}>
                        <SendReportDialog userEmail={reportEmail} />
                      </Suspense>
                    </div>
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Manage your finances efficiently</CardDescription>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0">
                  <TransactionList onUpdate={invalidateDashboard} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="text-base sm:text-lg">Quick Summary</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Financial overview at a glance</CardDescription>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 space-y-3">
                  <div className="flex justify-between items-center p-2 rounded-lg bg-green-500/10">
                    <span className="text-sm">Savings Rate</span>
                    <span className="font-bold text-green-600">
                      {totalIncome > 0 ? ((netBalance / totalIncome) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded-lg bg-blue-500/10">
                    <span className="text-sm">Receivables</span>
                    <span className="font-bold text-blue-600">{formatCurrency(loansGiven, currency)}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded-lg bg-orange-500/10">
                    <span className="text-sm">Payables</span>
                    <span className="font-bold text-orange-600">{formatCurrency(loansTaken, currency)}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded-lg bg-purple-500/10">
                    <span className="text-sm">Net Worth</span>
                    <span className={`font-bold ${(totalBankBalance + loansGiven - loansTaken) >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                      {formatCurrency(totalBankBalance + loansGiven - loansTaken, currency)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analytics">
            <Suspense fallback={<ComponentLoader />}>
              <AnalyticsChart />
            </Suspense>
          </TabsContent>

          <TabsContent value="statement">
            {user && (
              <Suspense fallback={<ComponentLoader />}>
                <FinancialStatement userId={user.id} userEmail={user.email || ""} currency={currency} />
              </Suspense>
            )}
          </TabsContent>

          <TabsContent value="bank">
            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Bank Accounts</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Manage your bank accounts</CardDescription>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0">
                <BankAccountForm onUpdate={invalidateDashboard} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reminders">
            <Suspense fallback={<ComponentLoader />}>
              <RemindersPanel />
            </Suspense>
          </TabsContent>

          <TabsContent value="notes">
            <Suspense fallback={<ComponentLoader />}>
              <NotesPanel />
            </Suspense>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;

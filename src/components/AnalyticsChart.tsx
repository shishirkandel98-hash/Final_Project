import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { Loader2, Building2 } from "lucide-react";

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

interface ChartData {
  name: string;
  income: number;
  expense: number;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(142 76% 36%)', 'hsl(38 92% 50%)', 'hsl(262 83% 58%)', 'hsl(199 89% 48%)'];

export const AnalyticsChart = () => {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [txResult, bankResult] = await Promise.all([
        supabase.from("transactions").select("type, amount, transaction_date").order("transaction_date", { ascending: true }),
        supabase.from("bank_accounts").select("id, bank_name, current_balance"),
      ]);

      if (txResult.error) throw txResult.error;
      if (bankResult.error) throw bankResult.error;
      
      setTransactions(txResult.data || []);
      setBankAccounts(bankResult.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // Process data for monthly chart
  const monthlyData = transactions.reduce((acc: { [key: string]: { income: number; expense: number } }, tx) => {
    const date = new Date(tx.transaction_date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!acc[monthKey]) {
      acc[monthKey] = { income: 0, expense: 0 };
    }
    
    if (tx.type === 'income') {
      acc[monthKey].income += Number(tx.amount);
    } else {
      acc[monthKey].expense += Number(tx.amount);
    }
    
    return acc;
  }, {});

  const chartData: ChartData[] = Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([key]) => {
      const [year, month] = key.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return {
        name: date.toLocaleString('default', { month: 'short' }),
        income: monthlyData[key].income,
        expense: monthlyData[key].expense,
      };
    });

  // Pie chart data for income/expense
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);

  const pieData = [
    { name: 'Income', value: totalIncome },
    { name: 'Expenses', value: totalExpense },
  ];

  // Bank accounts pie chart data
  const totalBankBalance = bankAccounts.reduce((sum, b) => sum + Number(b.current_balance), 0);
  const bankPieData = bankAccounts.map(bank => ({
    name: bank.bank_name,
    value: Number(bank.current_balance),
  }));

  // Weekly data for line chart
  const weeklyData = transactions.reduce((acc: { [key: string]: { income: number; expense: number } }, tx) => {
    const date = new Date(tx.transaction_date);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];
    
    if (!acc[weekKey]) {
      acc[weekKey] = { income: 0, expense: 0 };
    }
    
    if (tx.type === 'income') {
      acc[weekKey].income += Number(tx.amount);
    } else {
      acc[weekKey].expense += Number(tx.amount);
    }
    
    return acc;
  }, {});

  const weeklyChartData = Object.entries(weeklyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([key]) => {
      const date = new Date(key);
      return {
        name: `${date.getDate()}/${date.getMonth() + 1}`,
        income: weeklyData[key].income,
        expense: weeklyData[key].expense,
      };
    });

  const hasData = transactions.length > 0 || bankAccounts.length > 0;

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Add transactions or bank accounts to see analytics
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="p-3 sm:p-6">
        <CardTitle className="text-base sm:text-lg">Financial Analytics</CardTitle>
      </CardHeader>
      <CardContent className="p-3 sm:p-6 pt-0">
        <Tabs defaultValue="monthly" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="monthly" className="text-xs sm:text-sm">Monthly</TabsTrigger>
            <TabsTrigger value="weekly" className="text-xs sm:text-sm">Weekly</TabsTrigger>
            <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
            <TabsTrigger value="bank" className="text-xs sm:text-sm">Bank</TabsTrigger>
          </TabsList>

          <TabsContent value="monthly">
            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No transaction data</p>
            ) : (
              <div className="h-[250px] sm:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip 
                      formatter={(value: number) => [`NPR ${value.toFixed(2)}`, '']}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    />
                    <Legend />
                    <Bar dataKey="income" fill="hsl(142 76% 36%)" name="Income" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" fill="hsl(var(--destructive))" name="Expense" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </TabsContent>

          <TabsContent value="weekly">
            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No transaction data</p>
            ) : (
              <div className="h-[250px] sm:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip 
                      formatter={(value: number) => [`NPR ${value.toFixed(2)}`, '']}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="income" stroke="hsl(142 76% 36%)" name="Income" strokeWidth={2} />
                    <Line type="monotone" dataKey="expense" stroke="hsl(var(--destructive))" name="Expense" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </TabsContent>

          <TabsContent value="overview">
            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No transaction data</p>
            ) : (
              <>
                <div className="h-[250px] sm:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? 'hsl(142 76% 36%)' : 'hsl(var(--destructive))'} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => [`NPR ${value.toFixed(2)}`, '']}
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="text-center p-3 bg-green-500/10 rounded-lg">
                    <p className="text-xs text-muted-foreground">Total Income</p>
                    <p className="text-lg font-bold text-green-500">NPR {totalIncome.toFixed(2)}</p>
                  </div>
                  <div className="text-center p-3 bg-red-500/10 rounded-lg">
                    <p className="text-xs text-muted-foreground">Total Expenses</p>
                    <p className="text-lg font-bold text-red-500">NPR {totalExpense.toFixed(2)}</p>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="bank">
            {bankAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No bank accounts added</p>
            ) : (
              <>
                <div className="h-[250px] sm:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={bankPieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {bankPieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => [`NPR ${value.toFixed(2)}`, '']}
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 p-4 bg-primary/10 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="w-5 h-5 text-primary" />
                    <p className="text-sm text-muted-foreground">Total Bank Balance</p>
                  </div>
                  <p className="text-2xl font-bold text-primary">NPR {totalBankBalance.toFixed(2)}</p>
                </div>
                <div className="grid gap-2 mt-4">
                  {bankAccounts.map((bank, index) => (
                    <div key={bank.id} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: `${COLORS[index % COLORS.length]}20` }}>
                      <span className="text-sm font-medium">{bank.bank_name}</span>
                      <span className="text-sm font-bold">NPR {Number(bank.current_balance).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
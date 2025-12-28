import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Loader2, FileText, ChevronDown } from "lucide-react";
import { formatIndianNumber } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logo from "@/assets/logo.png";

interface StatementEntry {
  date: string;
  ref_no: string;
  description: string;
  category: string;
  debit: number | null;
  credit: number | null;
  running_balance: number;
}

interface FinancialStatementProps {
  userId: string;
  userEmail: string;
  currency: string;
}

export const FinancialStatement = ({ userId, userEmail, currency }: FinancialStatementProps) => {
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<StatementEntry[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [period, setPeriod] = useState("30");
  const [summary, setSummary] = useState({
    totalCredits: 0,
    totalDebits: 0,
    netMovement: 0,
    loanReceivable: 0,
    loanPayable: 0,
    bankBalance: 0,
    usableBalance: 0,
  });

  useEffect(() => {
    if (userId) {
      fetchProfile();
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      generateStatement();
    }
  }, [userId, period]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (data) setProfile(data);
  };

  const generateStatement = async () => {
    setLoading(true);
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(period));
      const startDateStr = startDate.toISOString().split('T')[0];

      // Fetch all data sources
      const [transactionsRes, loansRes, bankAccountsRes, bankTxRes] = await Promise.all([
        supabase
          .from("transactions")
          .select("*")
          .eq("user_id", userId)
          .gte("transaction_date", startDateStr)
          .order("transaction_date", { ascending: true }),
        supabase
          .from("loans")
          .select("*")
          .eq("user_id", userId)
          .gte("loan_date", startDateStr)
          .order("loan_date", { ascending: true }),
        supabase
          .from("bank_accounts")
          .select("*")
          .eq("user_id", userId),
        supabase
          .from("bank_transactions")
          .select("*, bank_accounts!inner(user_id)")
          .eq("bank_accounts.user_id", userId)
          .gte("transaction_date", startDateStr)
          .order("transaction_date", { ascending: true }),
      ]);

      const transactions = transactionsRes.data || [];
      const loans = loansRes.data || [];
      const bankAccounts = bankAccountsRes.data || [];
      const bankTransactions = bankTxRes.data || [];

      // Combine all entries
      const allEntries: StatementEntry[] = [];
      let runningBalance = 0;

      // Process income transactions
      transactions.forEach((tx: any) => {
        const isIncome = tx.type === "income";
        const amount = parseFloat(tx.amount);
        
        if (isIncome) {
          runningBalance += amount;
          allEntries.push({
            date: tx.transaction_date,
            ref_no: `TX-${tx.id.slice(0, 8).toUpperCase()}`,
            description: tx.description || `${tx.type} transaction`,
            category: tx.type === "income" ? "Income" : "Expense",
            debit: null,
            credit: amount,
            running_balance: runningBalance,
          });
        } else {
          runningBalance -= amount;
          allEntries.push({
            date: tx.transaction_date,
            ref_no: `TX-${tx.id.slice(0, 8).toUpperCase()}`,
            description: tx.description || `${tx.type} transaction`,
            category: "Expense",
            debit: amount,
            credit: null,
            running_balance: runningBalance,
          });
        }
      });

      // Process loans
      loans.forEach((loan: any) => {
        const amount = parseFloat(loan.amount);
        const isLoanTaken = loan.loan_type === "take";
        
        if (isLoanTaken) {
          // Loan taken = money received = credit
          runningBalance += amount;
          allEntries.push({
            date: loan.loan_date,
            ref_no: `LN-${loan.id.slice(0, 8).toUpperCase()}`,
            description: loan.description || `Loan ${isLoanTaken ? "Taken" : "Given"}`,
            category: isLoanTaken ? "Loan Received" : "Loan Given",
            debit: null,
            credit: amount,
            running_balance: runningBalance,
          });
        } else {
          // Loan given = money out = debit
          runningBalance -= amount;
          allEntries.push({
            date: loan.loan_date,
            ref_no: `LN-${loan.id.slice(0, 8).toUpperCase()}`,
            description: loan.description || `Loan ${isLoanTaken ? "Taken" : "Given"}`,
            category: "Loan Given",
            debit: amount,
            credit: null,
            running_balance: runningBalance,
          });
        }

        // If loan is refunded, add refund entry
        if (loan.status === "refunded" && loan.refunded_at) {
          if (isLoanTaken) {
            // Paid back loan = debit
            runningBalance -= amount;
            allEntries.push({
              date: loan.refunded_at.split('T')[0],
              ref_no: `LR-${loan.id.slice(0, 8).toUpperCase()}`,
              description: `Loan Repayment - ${loan.description || ""}`,
              category: "Loan Repayment",
              debit: amount,
              credit: null,
              running_balance: runningBalance,
            });
          } else {
            // Received back loan = credit
            runningBalance += amount;
            allEntries.push({
              date: loan.refunded_at.split('T')[0],
              ref_no: `LR-${loan.id.slice(0, 8).toUpperCase()}`,
              description: `Loan Repayment Received - ${loan.description || ""}`,
              category: "Loan Repayment",
              debit: null,
              credit: amount,
              running_balance: runningBalance,
            });
          }
        }
      });

      // Sort all entries by date
      allEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Recalculate running balance after sorting
      let balance = 0;
      allEntries.forEach(entry => {
        if (entry.credit) balance += entry.credit;
        if (entry.debit) balance -= entry.debit;
        entry.running_balance = balance;
      });

      setEntries(allEntries);

      // Calculate summary
      const totalCredits = allEntries.reduce((sum, e) => sum + (e.credit || 0), 0);
      const totalDebits = allEntries.reduce((sum, e) => sum + (e.debit || 0), 0);
      const bankBalance = bankAccounts.reduce((sum, b: any) => sum + parseFloat(b.current_balance), 0);
      
      // Get current active loans
      const { data: activeLoans } = await supabase
        .from("loans")
        .select("amount, loan_type")
        .eq("user_id", userId)
        .eq("status", "active");
      
      const loanReceivable = activeLoans?.filter((l: any) => l.loan_type === "give").reduce((sum, l: any) => sum + parseFloat(l.amount), 0) || 0;
      const loanPayable = activeLoans?.filter((l: any) => l.loan_type === "take").reduce((sum, l: any) => sum + parseFloat(l.amount), 0) || 0;

      setSummary({
        totalCredits,
        totalDebits,
        netMovement: totalCredits - totalDebits,
        loanReceivable,
        loanPayable,
        bankBalance,
        usableBalance: bankBalance - loanPayable,
      });
    } catch (error: any) {
      console.error("Error generating statement:", error);
      toast.error("Failed to generate statement");
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ["Date", "Ref No", "Description", "Category", `Debit (${currency})`, `Credit (${currency})`, "Running Balance"];
    const rows = entries.map(e => [
      e.date,
      e.ref_no,
      e.description,
      e.category,
      e.debit ? formatIndianNumber(e.debit) : "",
      e.credit ? formatIndianNumber(e.credit) : "",
      formatIndianNumber(e.running_balance),
    ]);

    // Add metadata
    const fullName = `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim();
    const metadata = [
      ["FINANCE MANAGER - Consolidated Transaction Statement"],
      [""],
      [`Account Holder: ${fullName}`],
      [`User ID: ${userId.slice(0, 8).toUpperCase()}`],
      [`Email: ${userEmail}`],
      [`Phone: ${profile?.phone || "N/A"}`],
      [`Statement Period: ${period} days`],
      [`Generated On: ${new Date().toLocaleDateString()}`],
      [`Currency: ${currency}`],
      [""],
    ];

    // Add summary
    const summaryRows = [
      [""],
      ["STATEMENT SUMMARY"],
      [`Total Credits: ${currency} ${formatIndianNumber(summary.totalCredits)}`],
      [`Total Debits: ${currency} ${formatIndianNumber(summary.totalDebits)}`],
      [`Net Movement: ${currency} ${formatIndianNumber(summary.netMovement)}`],
      [`Loan Receivable: ${currency} ${formatIndianNumber(summary.loanReceivable)}`],
      [`Loan Payable: ${currency} ${formatIndianNumber(summary.loanPayable)}`],
      [`Bank Balance: ${currency} ${formatIndianNumber(summary.bankBalance)}`],
      [`Usable Balance: ${currency} ${formatIndianNumber(summary.usableBalance)}`],
    ];

    const csvContent = [
      ...metadata.map(row => row.join(",")),
      headers.join(","),
      ...rows.map(row => row.join(",")),
      ...summaryRows.map(row => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `financial_statement_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success("Statement exported as CSV");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const fullName = `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));
    
    // Add logo
    const img = new Image();
    img.src = logo;
    doc.addImage(img, 'PNG', 14, 10, 20, 20);

    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(37, 99, 235); // Blue color
    doc.text("FINANCE MANAGER", 40, 18);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("Consolidated Transaction Statement", 40, 25);

    // Line separator
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.5);
    doc.line(14, 35, 196, 35);

    // User Info Section
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.setFont("helvetica", "bold");
    doc.text("ACCOUNT DETAILS", 14, 45);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const leftCol = 14;
    const rightCol = 110;
    
    doc.text(`Account Holder:`, leftCol, 53);
    doc.setFont("helvetica", "bold");
    doc.text(fullName || "N/A", leftCol + 35, 53);
    
    doc.setFont("helvetica", "normal");
    doc.text(`User ID:`, rightCol, 53);
    doc.setFont("helvetica", "bold");
    doc.text(userId.slice(0, 8).toUpperCase(), rightCol + 20, 53);
    
    doc.setFont("helvetica", "normal");
    doc.text(`Email:`, leftCol, 60);
    doc.setFont("helvetica", "bold");
    doc.text(userEmail, leftCol + 35, 60);
    
    doc.setFont("helvetica", "normal");
    doc.text(`Phone:`, rightCol, 60);
    doc.setFont("helvetica", "bold");
    doc.text(profile?.phone || "N/A", rightCol + 20, 60);
    
    doc.setFont("helvetica", "normal");
    doc.text(`Statement Period:`, leftCol, 67);
    doc.setFont("helvetica", "bold");
    doc.text(`${startDate.toLocaleDateString('en-GB')} - ${new Date().toLocaleDateString('en-GB')}`, leftCol + 35, 67);
    
    doc.setFont("helvetica", "normal");
    doc.text(`Currency:`, rightCol, 67);
    doc.setFont("helvetica", "bold");
    doc.text(currency, rightCol + 20, 67);

    doc.setFont("helvetica", "normal");
    doc.text(`Generated On:`, leftCol, 74);
    doc.setFont("helvetica", "bold");
    doc.text(new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), leftCol + 35, 74);

    // Transaction Table
    const tableData = entries.map(e => [
      new Date(e.date).toLocaleDateString('en-GB'),
      e.ref_no,
      e.description.length > 30 ? e.description.slice(0, 30) + '...' : e.description,
      e.category,
      e.debit ? formatIndianNumber(e.debit) : '-',
      e.credit ? formatIndianNumber(e.credit) : '-',
      formatIndianNumber(e.running_balance),
    ]);

    autoTable(doc, {
      startY: 82,
      head: [['Date', 'Ref No', 'Description', 'Category', `Debit (${currency})`, `Credit (${currency})`, 'Balance']],
      body: tableData,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 25 },
        2: { cellWidth: 45 },
        3: { cellWidth: 25 },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 22, halign: 'right' },
        6: { cellWidth: 23, halign: 'right' },
      },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });

    // Summary Section
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    doc.setFillColor(245, 247, 250);
    doc.rect(14, finalY, 182, 45, 'F');
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(37, 99, 235);
    doc.text("STATEMENT SUMMARY", 20, finalY + 8);
    
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    
    const summaryLeft = 20;
    const summaryRight = 110;
    let summaryY = finalY + 16;
    
    doc.setFont("helvetica", "normal");
    doc.text("Total Credits:", summaryLeft, summaryY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 163, 74);
    doc.text(`${currency} ${formatIndianNumber(summary.totalCredits)}`, summaryLeft + 35, summaryY);
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text("Total Debits:", summaryRight, summaryY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(220, 38, 38);
    doc.text(`${currency} ${formatIndianNumber(summary.totalDebits)}`, summaryRight + 35, summaryY);
    
    summaryY += 7;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text("Net Movement:", summaryLeft, summaryY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(summary.netMovement >= 0 ? 22 : 220, summary.netMovement >= 0 ? 163 : 38, summary.netMovement >= 0 ? 74 : 38);
    doc.text(`${currency} ${formatIndianNumber(summary.netMovement)}`, summaryLeft + 35, summaryY);
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text("Bank Balance:", summaryRight, summaryY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(37, 99, 235);
    doc.text(`${currency} ${formatIndianNumber(summary.bankBalance)}`, summaryRight + 35, summaryY);
    
    summaryY += 7;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text("Loan Receivable:", summaryLeft, summaryY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(147, 51, 234);
    doc.text(`${currency} ${formatIndianNumber(summary.loanReceivable)}`, summaryLeft + 35, summaryY);
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text("Loan Payable:", summaryRight, summaryY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(234, 88, 12);
    doc.text(`${currency} ${formatIndianNumber(summary.loanPayable)}`, summaryRight + 35, summaryY);
    
    summaryY += 7;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 60);
    doc.text("Usable Balance:", summaryLeft, summaryY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(summary.usableBalance >= 0 ? 22 : 220, summary.usableBalance >= 0 ? 163 : 38, summary.usableBalance >= 0 ? 74 : 38);
    doc.setFontSize(10);
    doc.text(`${currency} ${formatIndianNumber(summary.usableBalance)}`, summaryLeft + 35, summaryY);

    // Footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    doc.text("This is a computer-generated statement and does not require a signature.", 14, pageHeight - 15);
    doc.text(`Generated by Finance Manager | ${new Date().toLocaleString()}`, 14, pageHeight - 10);

    doc.save(`financial_statement_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success("Statement exported as PDF");
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <Card className="w-full">
      <CardHeader className="p-3 sm:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="w-8 h-8 object-contain" />
            <div>
              <CardTitle className="text-base sm:text-lg">Financial Statement</CardTitle>
              <p className="text-xs text-muted-foreground">Consolidated Transaction Report</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last 1 year</SelectItem>
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" disabled={loading || entries.length === 0}>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                  <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToPDF}>
                  <FileText className="w-4 h-4 mr-2" />
                  Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToCSV}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Export as CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Header Info */}
        <div className="mt-4 p-3 bg-muted/50 rounded-lg text-xs sm:text-sm grid grid-cols-2 gap-2">
          <div>
            <span className="text-muted-foreground">Account Holder:</span>
            <span className="ml-2 font-medium">{profile?.first_name || ""} {profile?.last_name || ""}</span>
          </div>
          <div>
            <span className="text-muted-foreground">User ID:</span>
            <span className="ml-2 font-medium font-mono">{userId.slice(0, 8).toUpperCase()}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Email:</span>
            <span className="ml-2 font-medium">{userEmail}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Phone:</span>
            <span className="ml-2 font-medium">{profile?.phone || "N/A"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Currency:</span>
            <span className="ml-2 font-medium">{currency}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 sm:p-6 sm:pt-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No transactions found for the selected period</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Ref No</TableHead>
                    <TableHead className="text-xs">Description</TableHead>
                    <TableHead className="text-xs">Category</TableHead>
                    <TableHead className="text-xs text-right">Debit ({currency})</TableHead>
                    <TableHead className="text-xs text-right">Credit ({currency})</TableHead>
                    <TableHead className="text-xs text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-xs font-mono whitespace-nowrap">{formatDate(entry.date)}</TableCell>
                      <TableCell className="text-xs font-mono whitespace-nowrap">{entry.ref_no}</TableCell>
                      <TableCell className="text-xs max-w-[120px] sm:max-w-[200px]">
                        <span className="block truncate" title={entry.description}>{entry.description}</span>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{entry.category}</TableCell>
                      <TableCell className="text-xs text-right text-red-600 font-mono whitespace-nowrap">
                        {entry.debit ? formatIndianNumber(entry.debit) : "-"}
                      </TableCell>
                      <TableCell className="text-xs text-right text-green-600 font-mono whitespace-nowrap">
                        {entry.credit ? formatIndianNumber(entry.credit) : "-"}
                      </TableCell>
                      <TableCell className={`text-xs text-right font-mono font-medium whitespace-nowrap ${entry.running_balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatIndianNumber(entry.running_balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Summary Section */}
            <div className="mt-6 p-4 bg-muted/50 rounded-lg space-y-3">
              <h3 className="font-semibold text-sm">STATEMENT SUMMARY</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs sm:text-sm">
                <div>
                  <p className="text-muted-foreground">Total Credits</p>
                  <p className="font-bold text-green-600">{currency} {formatIndianNumber(summary.totalCredits)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Debits</p>
                  <p className="font-bold text-red-600">{currency} {formatIndianNumber(summary.totalDebits)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Net Movement</p>
                  <p className={`font-bold ${summary.netMovement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {currency} {formatIndianNumber(summary.netMovement)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Bank Balance</p>
                  <p className="font-bold text-blue-600">{currency} {formatIndianNumber(summary.bankBalance)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Loan Receivable</p>
                  <p className="font-bold text-purple-600">{currency} {formatIndianNumber(summary.loanReceivable)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Loan Payable</p>
                  <p className="font-bold text-orange-600">{currency} {formatIndianNumber(summary.loanPayable)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Usable Balance</p>
                  <p className={`font-bold text-lg ${summary.usableBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {currency} {formatIndianNumber(summary.usableBalance)}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
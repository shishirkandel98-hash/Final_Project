import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Building2, ArrowUpRight, ArrowDownLeft } from "lucide-react";

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  current_balance: number;
}

interface LoanFormProps {
  onSuccess: () => void;
}

export const LoanForm = ({ onSuccess }: LoanFormProps) => {
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [remarks, setRemarks] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [loanType, setLoanType] = useState<"give" | "take">("take");

  useEffect(() => {
    fetchBankAccounts();
  }, []);

  const fetchBankAccounts = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const { data } = await supabase.from("bank_accounts").select("id, bank_name, account_number, current_balance").eq("user_id", session.user.id);

    if (data) setBankAccounts(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Not authenticated");

      const user = session.user;

      let imageUrl = null;
      if (image) {
        const fileExt = image.name.split('.').pop();
        const fileName = `${user.id}/${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('transaction-images')
          .upload(fileName, image);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('transaction-images')
          .getPublicUrl(fileName);
        imageUrl = publicUrl;
      }

      const loanData = {
        user_id: user.id,
        amount: parseFloat(amount),
        description,
        remarks,
        image_url: imageUrl,
        status: "active",
        loan_type: loanType,
        bank_account_id: selectedBankId && selectedBankId !== "cash" ? selectedBankId : null,
      };

      const { data: newLoan, error } = await supabase.from("loans").insert(loanData).select().single();

      if (error) throw error;

      // Update bank balance based on loan type
      if (selectedBankId && selectedBankId !== "cash") {
        const bankAccount = bankAccounts.find(b => b.id === selectedBankId);
        if (bankAccount) {
          const newBalance = loanType === "take"
            ? bankAccount.current_balance + parseFloat(amount)  // Money received
            : bankAccount.current_balance - parseFloat(amount); // Money given out

          await supabase
            .from("bank_accounts")
            .update({ current_balance: newBalance })
            .eq("id", selectedBankId);
        }
      }

      // Log the activity
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        table_name: "loans",
        action: "insert",
        record_id: newLoan?.id,
        new_values: loanData,
      });

      toast.success(`Loan (${loanType === "give" ? "Given" : "Taken"}) added successfully`);
      setAmount("");
      setDescription("");
      setRemarks("");
      setImage(null);
      setSelectedBankId("");
      setLoanType("take");
      onSuccess();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Loan Type</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={loanType === "take" ? "default" : "outline"}
            onClick={() => setLoanType("take")}
            className="w-full"
          >
            <ArrowDownLeft className="w-4 h-4 mr-2" />
            Take (Borrow)
          </Button>
          <Button
            type="button"
            variant={loanType === "give" ? "default" : "outline"}
            onClick={() => setLoanType("give")}
            className="w-full"
          >
            <ArrowUpRight className="w-4 h-4 mr-2" />
            Give (Lend)
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {loanType === "take" ? "Money you borrowed from someone" : "Money you lent to someone"}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="loan-amount">Loan Amount (NPR)</Label>
        <Input
          id="loan-amount"
          type="number"
          step="0.01"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="loan-description">Description *</Label>
        <Input
          id="loan-description"
          placeholder={loanType === "take" ? "Who did you borrow from?" : "Who did you lend to?"}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="loan-remarks">Remarks (Optional)</Label>
        <Textarea
          id="loan-remarks"
          placeholder="Any additional notes..."
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="loan-bank">Payment Method</Label>
        <Select value={selectedBankId} onValueChange={setSelectedBankId}>
          <SelectTrigger>
            <SelectValue placeholder="Select payment method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cash">Cash</SelectItem>
            {bankAccounts.map((bank) => (
              <SelectItem key={bank.id} value={bank.id}>
                <div className="flex items-center gap-2">
                  <Building2 className="w-3 h-3" />
                  {bank.bank_name} - {bank.account_number}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {selectedBankId && selectedBankId !== "cash"
            ? loanType === "take"
              ? "Bank balance will increase (money received)"
              : "Bank balance will decrease (money given out)"
            : "Select cash or bank account"
          }
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="loan-image">Screenshot (Optional)</Label>
        <div className="flex items-center gap-2">
          <Input
            id="loan-image"
            type="file"
            accept="image/*"
            onChange={(e) => setImage(e.target.files?.[0] || null)}
            className="flex-1"
          />
          <Upload className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Adding..." : `Add ${loanType === "give" ? "Lend" : "Borrow"} Record`}
      </Button>
    </form>
  );
};
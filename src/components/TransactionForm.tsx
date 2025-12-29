import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Building2 } from "lucide-react";

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  current_balance: number;
}

interface TransactionFormProps {
  onSuccess: () => void;
}

export const TransactionForm = ({ onSuccess }: TransactionFormProps) => {
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<"income" | "expense">("income");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [remarks, setRemarks] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>("");

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
        const { error: uploadError, data } = await supabase.storage
          .from('transaction-images')
          .upload(fileName, image);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('transaction-images')
          .getPublicUrl(fileName);
        imageUrl = publicUrl;
      }

      const transactionData = {
        user_id: user.id,
        type,
        amount: parseFloat(amount),
        description,
        remarks,
        image_url: imageUrl,
        category_id: category || null,
        bank_account_id: selectedBankId && selectedBankId !== "cash" ? selectedBankId : null,
      };

      const { data: newTx, error } = await supabase.from("transactions").insert(transactionData).select().single();

      if (error) throw error;

      // Update bank balance if a bank account is selected
      if (selectedBankId && selectedBankId !== "cash") {
        const bankAccount = bankAccounts.find(b => b.id === selectedBankId);
        if (bankAccount) {
          const balanceChange = type === "income" ? parseFloat(amount) : -parseFloat(amount);
          await supabase
            .from("bank_accounts")
            .update({ current_balance: bankAccount.current_balance + balanceChange })
            .eq("id", selectedBankId);
        }
      }

      // Log the activity
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        table_name: "transactions",
        action: "insert",
        record_id: newTx?.id,
        new_values: transactionData,
      });

      toast.success(`${type === "income" ? "Income" : "Expense"} added successfully`);
      setAmount("");
      setCategory("");
      setDescription("");
      setRemarks("");
      setImage(null);
      setSelectedBankId("");
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
        <Label htmlFor="type">Type</Label>
        <Select value={type} onValueChange={(value: "income" | "expense") => setType(value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">Amount (NPR)</Label>
        <Input
          id="amount"
          type="number"
          step="0.01"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description *</Label>
        <Input
          id="description"
          placeholder="What is this transaction for?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="remarks">Remarks (Optional)</Label>
        <Textarea
          id="remarks"
          placeholder="Any additional notes..."
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bank">Payment Method</Label>
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
          {selectedBankId && selectedBankId !== "cash" ? `Bank balance will be ${type === "income" ? "increased" : "decreased"} automatically` : "Select cash or bank account"}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="image">Screenshot (Optional)</Label>
        <div className="flex items-center gap-2">
          <Input
            id="image"
            type="file"
            accept="image/*"
            onChange={(e) => setImage(e.target.files?.[0] || null)}
            className="flex-1"
          />
          <Upload className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Adding..." : `Add ${type === 'income' ? 'Income' : 'Expense'}`}
      </Button>
    </form>
  );
};
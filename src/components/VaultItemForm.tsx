import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { encryptData } from "@/lib/encryption";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Key, CreditCard, FileText, Globe } from "lucide-react";

interface VaultItemFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  pin: string;
  onItemAdded: () => void;
  editItem?: {
    id: string;
    title: string;
    item_type: string;
    decryptedData: any;
  } | null;
}

const ITEM_TYPES = [
  { value: 'credential', label: 'Login Credentials', icon: Globe },
  { value: 'card', label: 'Credit/Debit Card', icon: CreditCard },
  { value: 'key', label: 'Private Key/Secret', icon: Key },
  { value: 'note', label: 'Secure Note', icon: FileText },
  { value: 'file', label: 'File Upload', icon: Upload },
];

export function VaultItemForm({ open, onOpenChange, userId, pin, onItemAdded, editItem }: VaultItemFormProps) {
  const [title, setTitle] = useState(editItem?.title || "");
  const [itemType, setItemType] = useState(editItem?.item_type || "credential");
  const [loading, setLoading] = useState(false);
  
  // Credential fields
  const [website, setWebsite] = useState(editItem?.decryptedData?.website || "");
  const [username, setUsername] = useState(editItem?.decryptedData?.username || "");
  const [password, setPassword] = useState(editItem?.decryptedData?.password || "");
  
  // Card fields
  const [cardNumber, setCardNumber] = useState(editItem?.decryptedData?.cardNumber || "");
  const [cardHolder, setCardHolder] = useState(editItem?.decryptedData?.cardHolder || "");
  const [expiry, setExpiry] = useState(editItem?.decryptedData?.expiry || "");
  const [cvv, setCvv] = useState(editItem?.decryptedData?.cvv || "");
  
  // Key/Note fields
  const [secretContent, setSecretContent] = useState(editItem?.decryptedData?.content || "");
  
  // File
  const [file, setFile] = useState<File | null>(null);

  const resetForm = () => {
    setTitle("");
    setItemType("credential");
    setWebsite("");
    setUsername("");
    setPassword("");
    setCardNumber("");
    setCardHolder("");
    setExpiry("");
    setCvv("");
    setSecretContent("");
    setFile(null);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    setLoading(true);
    try {
      let dataToEncrypt: any = {};
      
      switch (itemType) {
        case 'credential':
          dataToEncrypt = { website, username, password };
          break;
        case 'card':
          dataToEncrypt = { cardNumber, cardHolder, expiry, cvv };
          break;
        case 'key':
        case 'note':
          dataToEncrypt = { content: secretContent };
          break;
        case 'file':
          if (file) {
            // Upload file to storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${userId}/${crypto.randomUUID()}.${fileExt}`;
            
            const { error: uploadError } = await supabase.storage
              .from('vault-files')
              .upload(fileName, file);
            
            if (uploadError) throw uploadError;
            
            dataToEncrypt = { 
              fileName: file.name, 
              filePath: fileName, 
              fileSize: file.size,
              fileType: file.type 
            };
          }
          break;
      }

      const encryptedData = await encryptData(JSON.stringify(dataToEncrypt), pin);

      if (editItem) {
        const { error } = await supabase
          .from('vault_items')
          .update({
            title,
            item_type: itemType,
            encrypted_data: encryptedData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editItem.id);

        if (error) throw error;
        toast.success("Vault item updated!");
      } else {
        const { error } = await supabase
          .from('vault_items')
          .insert({
            user_id: userId,
            title,
            item_type: itemType,
            encrypted_data: encryptedData
          });

        if (error) throw error;
        toast.success("Vault item added!");
      }

      resetForm();
      onItemAdded();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Vault item error:", error);
      toast.error(error.message || "Failed to save vault item");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editItem ? "Edit" : "Add"} Vault Item</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Gmail Login, Bank Card"
            />
          </div>

          <div className="space-y-2">
            <Label>Item Type</Label>
            <Select value={itemType} onValueChange={setItemType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ITEM_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <type.icon className="h-4 w-4" />
                      {type.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {itemType === 'credential' && (
            <>
              <div className="space-y-2">
                <Label>Website/App</Label>
                <Input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Username/Email</Label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </>
          )}

          {itemType === 'card' && (
            <>
              <div className="space-y-2">
                <Label>Card Number</Label>
                <Input
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
                  placeholder="1234 5678 9012 3456"
                />
              </div>
              <div className="space-y-2">
                <Label>Card Holder Name</Label>
                <Input
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value)}
                  placeholder="John Doe"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Expiry (MM/YY)</Label>
                  <Input
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    placeholder="12/25"
                    maxLength={5}
                  />
                </div>
                <div className="space-y-2">
                  <Label>CVV</Label>
                  <Input
                    type="password"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="•••"
                    maxLength={4}
                  />
                </div>
              </div>
            </>
          )}

          {(itemType === 'key' || itemType === 'note') && (
            <div className="space-y-2">
              <Label>{itemType === 'key' ? 'Private Key/Secret' : 'Secure Note'}</Label>
              <Textarea
                value={secretContent}
                onChange={(e) => setSecretContent(e.target.value)}
                placeholder={itemType === 'key' ? 'Paste your private key or secret here...' : 'Enter your secure note...'}
                rows={6}
                className="font-mono text-sm"
              />
            </div>
          )}

          {itemType === 'file' && (
            <div className="space-y-2">
              <Label>Upload File (Max 5MB)</Label>
              <Input
                type="file"
                onChange={(e) => {
                  const selectedFile = e.target.files?.[0];
                  if (selectedFile && selectedFile.size > 5 * 1024 * 1024) {
                    toast.error("File size must be less than 5MB");
                    return;
                  }
                  setFile(selectedFile || null);
                }}
                accept=".pdf,.doc,.docx,.txt,.zip,.rar,.7z"
              />
              <p className="text-xs text-muted-foreground">
                Supported: PDF, DOC, TXT, ZIP, RAR, 7Z
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : editItem ? "Update" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

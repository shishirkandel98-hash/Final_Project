import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { hashPin, isValidPin } from "@/lib/encryption";
import { supabase } from "@/integrations/supabase/client";

interface VaultSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onSetupComplete: () => void;
}

export function VaultSetupDialog({ open, onOpenChange, userId, onSetupComplete }: VaultSetupDialogProps) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSetup = async () => {
    if (!isValidPin(pin)) {
      toast.error("PIN must be exactly 4 digits");
      return;
    }

    if (pin !== confirmPin) {
      toast.error("PINs do not match");
      return;
    }

    setLoading(true);
    try {
      const pinHash = await hashPin(pin);
      
      const { error } = await supabase
        .from('vault_settings')
        .insert({
          user_id: userId,
          pin_hash: pinHash
        });

      if (error) throw error;

      toast.success("Vault PIN set successfully!");
      onSetupComplete();
      onOpenChange(false);
      setPin("");
      setConfirmPin("");
    } catch (error: any) {
      console.error("Vault setup error:", error);
      toast.error(error.message || "Failed to set up vault");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Set Up Secure Vault
          </DialogTitle>
          <DialogDescription>
            Create a 4-digit PIN to protect your sensitive data. This PIN will be required to access your vault.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="pin">Create 4-Digit PIN</Label>
            <div className="relative">
              <Input
                id="pin"
                type={showPin ? "text" : "password"}
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="text-center text-2xl tracking-widest"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() => setShowPin(!showPin)}
              >
                {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPin">Confirm PIN</Label>
            <Input
              id="confirmPin"
              type={showPin ? "text" : "password"}
              inputMode="numeric"
              maxLength={4}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className="text-center text-2xl tracking-widest"
            />
          </div>

          <p className="text-sm text-muted-foreground">
            ⚠️ Remember this PIN! If you forget it, you won't be able to access your vault data.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSetup} disabled={loading || pin.length !== 4 || confirmPin.length !== 4}>
            {loading ? "Setting up..." : "Set PIN"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

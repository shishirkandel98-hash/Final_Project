import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { verifyPin, isValidPin } from "@/lib/encryption";

interface VaultUnlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storedPinHash: string;
  onUnlock: (pin: string) => void;
}

export function VaultUnlockDialog({ open, onOpenChange, storedPinHash, onUnlock }: VaultUnlockDialogProps) {
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const handleUnlock = async () => {
    if (!isValidPin(pin)) {
      toast.error("PIN must be exactly 4 digits");
      return;
    }

    setLoading(true);
    try {
      const isValid = await verifyPin(pin, storedPinHash);
      
      if (isValid) {
        onUnlock(pin);
        onOpenChange(false);
        setPin("");
        setAttempts(0);
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        
        if (newAttempts >= 5) {
          toast.error("Too many failed attempts. Please try again later.");
          onOpenChange(false);
          setPin("");
        } else {
          toast.error(`Incorrect PIN. ${5 - newAttempts} attempts remaining.`);
        }
      }
    } catch (error: any) {
      console.error("Vault unlock error:", error);
      toast.error("Failed to verify PIN");
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
            Unlock Vault
          </DialogTitle>
          <DialogDescription>
            Enter your 4-digit PIN to access your secure vault.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="unlockPin">Enter PIN</Label>
            <div className="relative">
              <Input
                id="unlockPin"
                type={showPin ? "text" : "password"}
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                placeholder="••••"
                className="text-center text-2xl tracking-widest"
                autoFocus
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

          {attempts > 0 && (
            <p className="text-sm text-destructive">
              Failed attempts: {attempts}/5
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleUnlock} disabled={loading || pin.length !== 4}>
            {loading ? "Verifying..." : "Unlock"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

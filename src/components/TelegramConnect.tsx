import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Check, ExternalLink, Loader2, Unlink } from "lucide-react";
import { toast } from "sonner";

interface TelegramConnectProps {
  userId: string;
  userEmail: string;
}

export const TelegramConnect: React.FC<TelegramConnectProps> = ({ userId, userEmail }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [telegramUsername, setTelegramUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    checkTelegramConnection();
  }, [userId]);

  const checkTelegramConnection = async () => {
    try {
      const { data, error } = await supabase
        .from("telegram_links")
        .select("telegram_username, verified")
        .eq("user_id", userId)
        .eq("verified", true)
        .maybeSingle();

      if (data && !error) {
        setIsConnected(true);
        setTelegramUsername(data.telegram_username);
      } else {
        setIsConnected(false);
        setTelegramUsername(null);
      }
    } catch (error) {
      console.error("Error checking Telegram connection:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const { error } = await supabase
        .from("telegram_links")
        .delete()
        .eq("user_id", userId);

      if (error) throw error;

      setIsConnected(false);
      setTelegramUsername(null);
      toast.success("Telegram disconnected successfully! You can now connect from another device.");
    } catch (error: any) {
      console.error("Error disconnecting Telegram:", error);
      toast.error("Failed to disconnect Telegram");
    } finally {
      setDisconnecting(false);
    }
  };

  const openTelegramBot = () => {
    window.open("https://t.me/FinanceManagerRecordbot", "_blank");
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (isConnected) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardHeader className="p-3 sm:p-4 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-green-500" />
              Telegram Connected
            </CardTitle>
            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
              <Check className="w-3 h-3 mr-1" />
              Active
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 pt-0 space-y-2">
          <p className="text-xs text-muted-foreground">
            {telegramUsername ? `@${telegramUsername}` : "Connected"} - Record transactions via Telegram!
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={openTelegramBot}
            >
              <ExternalLink className="w-3 h-3 mr-2" />
              Open Bot
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={disconnecting}
                >
                  {disconnecting ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Unlink className="w-3 h-3" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-[95vw] sm:max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle>Disconnect Telegram?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will unlink your Telegram from Finance Manager. You can reconnect later from the same or a different device.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDisconnect}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Disconnect
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors">
          <CardHeader className="p-3 sm:p-4 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-blue-500" />
              Connect Telegram
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <p className="text-xs text-muted-foreground">
              Record transactions instantly from Telegram
            </p>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-blue-500" />
            Connect with Telegram
          </DialogTitle>
          <DialogDescription>
            Link your Telegram account to record transactions on the go
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">1</div>
              <p className="text-sm">Open our Telegram bot</p>
            </div>
            <Button onClick={openTelegramBot} className="w-full" variant="outline">
              <ExternalLink className="w-4 h-4 mr-2" />
              Open @FinanceManagerRecordbot
            </Button>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">2</div>
              <p className="text-sm">Click "Start" and enter your registered email</p>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">3</div>
              <p className="text-sm">Enter your password to verify</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Use the same password you use to login on the website
            </p>
          </div>

          <div className="border-t pt-4">
            <p className="text-xs text-muted-foreground text-center">
              Once verified, record income, expenses, loans & upload proof images directly from Telegram!
            </p>
            <p className="text-xs text-amber-600 text-center mt-2">
              Note: Only one device can be connected at a time.
            </p>
          </div>

          <Button onClick={checkTelegramConnection} variant="secondary" className="w-full">
            <Check className="w-4 h-4 mr-2" />
            I've Connected - Check Status
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
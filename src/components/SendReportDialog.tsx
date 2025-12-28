import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface SendReportDialogProps {
  userEmail?: string;
}

export const SendReportDialog = ({ userEmail }: SendReportDialogProps) => {
  const [email, setEmail] = useState(userEmail || "");
  const [reportType, setReportType] = useState<"daily" | "weekly" | "monthly">("monthly");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSendReport = async () => {
    if (!email) {
      toast.error("Please enter an email address");
      return;
    }

    if (!validateEmail(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in to send reports");
        return;
      }

      const { data, error } = await supabase.functions.invoke("send-report", {
        body: { userEmail: email, reportType },
      });

      if (error) throw error;

      toast.success(`Report sent successfully to ${email}`);
      setOpen(false);

      // Update profile with report email
      await supabase
        .from("profiles")
        .update({ report_email: email })
        .eq("id", session.user.id);
    } catch (error: any) {
      console.error("Error sending report:", error);
      toast.error(error.message || "Failed to send report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full sm:w-auto">
          <Mail className="w-4 h-4 mr-2" />
          Send Report
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm mx-4 sm:mx-auto">
        <DialogHeader>
          <DialogTitle>Send Financial Report</DialogTitle>
          <DialogDescription>
            Send your financial summary report to your email
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reportType">Report Type</Label>
            <Select value={reportType} onValueChange={(v: "daily" | "weekly" | "monthly") => setReportType(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select report type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily Report</SelectItem>
                <SelectItem value="weekly">Weekly Report</SelectItem>
                <SelectItem value="monthly">Monthly Report</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button 
            onClick={handleSendReport} 
            disabled={loading} 
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                Send Report
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

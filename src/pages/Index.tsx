import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Shield, ShieldCheck } from "lucide-react";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { toast } from "sonner";
import { getClientIP } from "@/lib/ipUtils";
import logo from "@/assets/logo.png";

const Index = () => {
  const navigate = useNavigate();
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [verificationError, setVerificationError] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [widgetStatus, setWidgetStatus] = useState<"loading" | "ready" | "verified" | "error">("loading");

  useEffect(() => {
    // Check if user is already authenticated
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // User is already logged in, redirect to dashboard
        navigate("/dashboard");
        return;
      }
      setIsLoading(false);
    };

    checkAuth();
  }, [navigate]);

  const handleTurnstileVerify = async (token: string) => {
    setTurnstileToken(token);
    
    try {
      const clientIP = await getClientIP();
      
      // Verify token server-side
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-turnstile`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token, ip: clientIP }),
        }
      );

      const result = await response.json();

      if (result.success) {
        setIsVerified(true);
        setVerificationError(false);
        // Store verification status in sessionStorage for the auth page
        sessionStorage.setItem('turnstile_verified', 'true');
        sessionStorage.setItem('turnstile_timestamp', Date.now().toString());
        toast.success("Security verification complete!");
        // Redirect to auth page after short delay
        setTimeout(() => {
          navigate("/auth");
        }, 500);
      } else {
        setVerificationError(true);
        toast.error("Verification failed. Please try again.");
      }
    } catch (error) {
      console.error("Turnstile verification error:", error);
      setVerificationError(true);
      toast.error("Verification failed. Please try again.");
    }
  };

  const handleTurnstileError = () => {
    setVerificationError(true);
    toast.error("Security check failed. Please refresh and try again.");
  };

  const handleTurnstileExpired = () => {
    setIsVerified(false);
    setTurnstileToken(null);
    sessionStorage.removeItem('turnstile_verified');
    sessionStorage.removeItem('turnstile_timestamp');
    toast.warning("Verification expired. Please verify again.");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-accent/10">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-accent/10 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto w-16 h-16 flex items-center justify-center">
            <img src={logo} alt="Finance Manager" className="w-16 h-16 object-contain" />
          </div>
          <CardTitle className="text-2xl font-bold">Finance Manager</CardTitle>
          <CardDescription className="flex items-center justify-center gap-2">
            <Shield className="h-4 w-4" />
            Secure Personal Finance Tracking
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!isVerified ? (
            <div className="space-y-4">
              <div className="text-center text-sm text-muted-foreground">
                <p>Complete the security verification to access the login portal.</p>
                <p className="mt-2 text-xs">
                  This protects against automated attacks and ensures secure access.
                </p>
              </div>
              
              <div className="border rounded-lg p-4 bg-muted/30">
                <div className="flex items-center justify-center">
                  <TurnstileWidget
                    onVerify={handleTurnstileVerify}
                    onError={handleTurnstileError}
                    onExpired={handleTurnstileExpired}
                    onStatusChange={(s) => setWidgetStatus(s)}
                  />
                </div>
              </div>

              {verificationError && (
                <p className="text-center text-sm text-destructive">
                  Verification failed. Please refresh the page and try again.
                </p>
              )}

              {widgetStatus === "error" && (
                <div className="mt-4 p-4 border rounded bg-red-50">
                  <p className="text-sm text-destructive mb-2">We couldn't load the Cloudflare security widget.</p>
                  <p className="text-xs text-muted-foreground mb-3">Possible causes: site key misconfiguration, Cloudflare interstitial (JS challenge / "Under Attack" mode), or the Turnstile script being blocked by an extension.</p>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      className="px-3 py-1 rounded bg-primary text-white"
                      onClick={() => window.location.reload()}
                    >
                      Retry
                    </button>
                    <button
                      className="px-3 py-1 rounded border"
                      onClick={() => {
                        // Open Cloudflare docs for troubleshooting in a new tab
                        window.open('https://developers.cloudflare.com/turnstile/get-started/overview/', '_blank');
                      }}
                    >
                      Troubleshoot
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2 text-green-500">
                <ShieldCheck className="h-6 w-6" />
                <span className="font-medium">Verified</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Redirecting to login...
              </p>
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
            </div>
          )}

          <div className="pt-4 border-t">
            <p className="text-xs text-center text-muted-foreground">
              Protected by Cloudflare Turnstile
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;

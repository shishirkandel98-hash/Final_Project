import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { storeCfClearance } from "@/lib/cookieUtils";

// Turnstile site key - this is a publishable key (safe to include in frontend code)
// Production site key for shishirkandel.page
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || "0x4AAAAAACGDQuGequM3V9ER";

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: TurnstileOptions) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

interface TurnstileOptions {
  sitekey: string;
  callback: (token: string) => void;
  "error-callback"?: () => void;
  "expired-callback"?: () => void;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact";
}

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onError?: () => void;
  onExpired?: () => void;
  onStatusChange?: (status: "loading" | "ready" | "verified" | "error") => void;
  onCfClearanceReceived?: (clearance: string) => void; // Called when cf_clearance is obtained from backend
}

export function TurnstileWidget({ onVerify, onError, onExpired, onStatusChange, onCfClearanceReceived }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<"loading" | "ready" | "verified" | "error">("loading");

  const handleCallback = useCallback(
    (token: string) => {
      setStatus("verified");
      onStatusChange?.("verified");
      onVerify(token);
      
      // After widget callback, verify token with backend to get cf_clearance
      verifyTokenAndGetClearance(token);
    },
    [onVerify, onStatusChange, onCfClearanceReceived],
  );

  const handleError = useCallback(() => {
    setStatus("error");
    onStatusChange?.("error");
    onError?.();
  }, [onError]);

  const handleExpired = useCallback(() => {
    setStatus("ready");
    onStatusChange?.("ready");
    onExpired?.();
  }, [onExpired, onStatusChange]);

  const verifyTokenAndGetClearance = async (token: string) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-turnstile`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        }
      );

      const result = await response.json();

      if (result.success && result.cf_clearance) {
        // Store cf_clearance cookie for use in login
        storeCfClearance(result.cf_clearance);
        console.log("CF Clearance obtained and stored");
        onCfClearanceReceived?.(result.cf_clearance);
      } else {
        console.error("Failed to get cf_clearance:", result);
      }
    } catch (error) {
      console.error("Error verifying token:", error);
    }
  };

  useEffect(() => {
    // Site key should always be available now (fallback to test key)
    console.log("Turnstile initializing with site key:", TURNSTILE_SITE_KEY ? "configured" : "missing");

    // Load Turnstile script if not already loaded
    let script: HTMLScriptElement | null = document.getElementById("turnstile-script") as HTMLScriptElement | null;
    let loadTimeout: number | null = null;

    const onLoad = () => {
      if (loadTimeout) {
        window.clearTimeout(loadTimeout);
        loadTimeout = null;
      }
      setIsLoading(false);
      setStatus("ready");
      onStatusChange?.("ready");

      if (containerRef.current && (window as any).turnstile && !widgetIdRef.current) {
        widgetIdRef.current = (window as any).turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: handleCallback,
          "error-callback": handleError,
          "expired-callback": handleExpired,
          theme: "auto",
          size: "normal",
        });
      }
    };

    const onErrorLoad = (ev?: any) => {
      console.error("Failed to load Turnstile script", ev);
      setIsLoading(false);
      setStatus("error");
      onStatusChange?.("error");
      onError?.();
    };

    // Set up global callback for Turnstile script
    (window as any).onTurnstileLoad = onLoad;

    if (!script) {
      script = document.createElement("script");
      script.id = "turnstile-script";
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad";
      script.async = true;
      script.defer = true;
      script.addEventListener("error", onErrorLoad);
      document.head.appendChild(script);

      // Fallback: if the script hasn't loaded in 15s, mark as error
      loadTimeout = window.setTimeout(() => {
        console.error("Turnstile script load timeout");
        setIsLoading(false);
        setStatus("error");
        onStatusChange?.("error");
        onError?.();
      }, 15000);
    } else if ((window as any).turnstile) {
      // Script already loaded, trigger onLoad directly
      onLoad();
    }

    return () => {
      if (widgetIdRef.current && (window as any).turnstile) {
        (window as any).turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }

      // remove attached listeners if we created the script
      const existing = document.getElementById("turnstile-script");
      if (existing) {
        existing.removeEventListener("load", onLoad);
        existing.removeEventListener("error", onErrorLoad);
      }
    };
  }, [handleCallback, handleError, handleExpired]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {status === "loading" && (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading security check...</span>
          </>
        )}
        {status === "ready" && (
          <>
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>Please complete the security verification</span>
          </>
        )}
        {status === "verified" && (
          <>
            <ShieldCheck className="h-4 w-4 text-green-500" />
            <span className="text-green-500">Verified successfully!</span>
          </>
        )}
        {status === "error" && (
          <>
            <ShieldAlert className="h-4 w-4 text-destructive" />
            <span className="text-destructive">Verification failed. Please try again.</span>
          </>
        )}
      </div>

      <div ref={containerRef} className="min-h-[65px] flex items-center justify-center" />

      {isLoading && (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Shield, Mail, ArrowRight } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { isValidEmail } from "@/lib/validation";
import { PasswordStrengthIndicator } from "@/components/PasswordStrengthIndicator";
import { getClientIP, getUserAgent } from "@/lib/ipUtils";
import logo from "@/assets/logo.png";

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [clientIP, setClientIP] = useState("unknown");


  // Forgot Password state
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);

  // Validation error states
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Check if user is authenticated on mount - Enhanced security
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          // User is already logged in, redirect to dashboard
          navigate("/dashboard", { replace: true });
          return;
        }

        setCheckingVerification(false);
      } catch (error) {
        console.error("Auth check error:", error);
        setCheckingVerification(false);
      }
    };

    checkAuth();

    // Also listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        navigate("/dashboard", { replace: true });
      }
    });

    return () => subscription?.unsubscribe();
  }, [navigate]);

  // Fetch client IP on mount
  useEffect(() => {
    getClientIP().then(setClientIP);
  }, []);

  const validateForm = (): boolean => {
    let isValid = true;

    // Validate email
    const emailValidation = isValidEmail(email);
    if (!emailValidation.valid) {
      setEmailError(emailValidation.error || "");
      isValid = false;
    } else {
      setEmailError("");
    }

    return isValid;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate inputs
    if (!email || !password) {
      toast.error("Please enter both email and password");
      return;
    }

    setLoading(true);

    try {
      // Attempt sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      // Always log the attempt for security auditing
      await supabase.from('login_attempts').insert({
        ip_address: clientIP,
        email,
        success: !error,
        user_agent: getUserAgent()
      });

      if (error) {
        // Don't reveal if email exists or password is wrong
        toast.error("Invalid email or password. Please try again.");
      } else if (data.user) {
        // Create session record for audit trail
        await supabase.from('user_sessions').insert({
          user_id: data.user.id,
          ip_address: clientIP,
          user_agent: getUserAgent()
        });

        toast.success("Signed in successfully!");
        // Navigate with replace to prevent back button access
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      console.error("Sign in error:", err);
      toast.error("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Generate random password: 6 digits + text mix
      const digits = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
      const textChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
      let textPart = '';
      for (let i = 0; i < 6; i++) {
        textPart += textChars.charAt(Math.floor(Math.random() * textChars.length));
      }
      const generatedPassword = digits + textPart; // 6 digits + 6 letters

      const { error } = await supabase.auth.signUp({
        email,
        password: generatedPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            first_name: '',
            last_name: '',
            phone: '',
            country: '',
            currency: 'NPR',
          },
        },
      });

      // Log the attempt
      await supabase.from('login_attempts').insert({
        ip_address: clientIP,
        email,
        success: !error,
        user_agent: getUserAgent()
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success(`Account created successfully! Your temporary password is: ${generatedPassword}. Please save it and login.`);
        navigate("/");
      }
    } catch (err) {
      toast.error("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;

    // Basic email validation
    const emailValidation = isValidEmail(resetEmail);
    if (!emailValidation.valid) {
      toast.error("Please enter a valid email address");
      return;
    }

    setResetLoading(true);
    try {
      // For password reset, we don't need authentication - it's public
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'reset_password_by_email',
          email: resetEmail.trim().toLowerCase()
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || "Password reset! Check your email for the new password.");
        setShowResetDialog(false);
        setResetEmail("");
      } else {
        toast.error(data.error || "Failed to reset password.");
      }
    } catch (error) {
      console.error("Reset error:", error);
      toast.error("Failed to reset password. Please try again.");
    } finally {
      setResetLoading(false);
    }
  };

  if (checkingVerification) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-accent/10">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Verifying security status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-accent/10 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto w-12 h-12 flex items-center justify-center">
            <img src={logo} alt="Finance Manager" className="w-12 h-12 object-contain" />
          </div>
          <CardTitle className="text-2xl font-bold">Finance Manager</CardTitle>
          <CardDescription className="flex items-center justify-center gap-2">
            <Shield className="h-4 w-4 text-green-500" />
            Secure personal finance tracking
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value.trim())}
                    required
                    maxLength={255}
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="flex justify-end">
                  <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
                    <DialogTrigger asChild>
                      <Button variant="link" className="px-0 font-normal text-xs text-muted-foreground">
                        Forgot password?
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Reset Password</DialogTitle>
                        <DialogDescription>
                          Enter your email address and we'll send you a temporary password.
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleResetPassword} className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label htmlFor="reset-email">Email Address</Label>
                          <Input
                            id="reset-email"
                            type="email"
                            placeholder="your@email.com"
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                            required
                          />
                        </div>
                        <Button type="submit" className="w-full" disabled={resetLoading}>
                          {resetLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          <Mail className="mr-2 h-4 w-4" />
                          Send New Password
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign In
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email *</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="your@gmail.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setEmailError("");
                    }}
                    required
                    className={emailError ? "border-destructive" : ""}
                  />
                  {emailError && (
                    <p className="text-xs text-destructive">{emailError}</p>
                  )}
                  <p className="text-xs text-muted-foreground">We'll generate a secure password for you</p>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Account
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;

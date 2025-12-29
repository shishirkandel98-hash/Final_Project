import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Shield } from "lucide-react";
import { isValidEmail, isValidPhone, isValidName } from "@/lib/validation";
import { PasswordStrengthIndicator } from "@/components/PasswordStrengthIndicator";
import { getClientIP, getUserAgent } from "@/lib/ipUtils";
import { COUNTRIES, CURRENCIES, getCountryFlag } from "@/lib/constants";
import logo from "@/assets/logo.png";

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState("NPR");
  const [currencySearch, setCurrencySearch] = useState("");
  const [countrySearch, setCountrySearch] = useState("");
  const [clientIP, setClientIP] = useState("unknown");

  // Validation error states
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [firstNameError, setFirstNameError] = useState("");
  const [lastNameError, setLastNameError] = useState("");
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

    // Validate first name
    const firstNameValidation = isValidName(firstName);
    if (!firstNameValidation.valid) {
      setFirstNameError(firstNameValidation.error || "");
      isValid = false;
    } else {
      setFirstNameError("");
    }

    // Validate last name
    const lastNameValidation = isValidName(lastName);
    if (!lastNameValidation.valid) {
      setLastNameError(lastNameValidation.error || "");
      isValid = false;
    } else {
      setLastNameError("");
    }

    // Validate email
    const emailValidation = isValidEmail(email);
    if (!emailValidation.valid) {
      setEmailError(emailValidation.error || "");
      isValid = false;
    } else {
      setEmailError("");
    }

    // Validate phone
    const phoneValidation = isValidPhone(phone);
    if (!phoneValidation.valid) {
      setPhoneError(phoneValidation.error || "");
      isValid = false;
    } else {
      setPhoneError("");
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

    // Validate passwords match
    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match. Please try again.");
      toast.error("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters long.");
      toast.error("Password too short");
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            phone: phone.trim(),
            country: country.trim(),
            currency: currency,
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
        toast.success("Account created successfully! You can now start using the app.");
        navigate("/");
      }
    } catch (err) {
      toast.error("An error occurred. Please try again.");
    } finally {
      setLoading(false);
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
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign In
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first-name">First Name *</Label>
                    <Input
                      id="first-name"
                      placeholder="John"
                      value={firstName}
                      onChange={(e) => {
                        setFirstName(e.target.value);
                        setFirstNameError("");
                      }}
                      required
                      className={firstNameError ? "border-destructive" : ""}
                    />
                    {firstNameError && (
                      <p className="text-xs text-destructive">{firstNameError}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last-name">Last Name *</Label>
                    <Input
                      id="last-name"
                      placeholder="Doe"
                      value={lastName}
                      onChange={(e) => {
                        setLastName(e.target.value);
                        setLastNameError("");
                      }}
                      required
                      className={lastNameError ? "border-destructive" : ""}
                    />
                    {lastNameError && (
                      <p className="text-xs text-destructive">{lastNameError}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number * (10 digits)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="9800000000"
                    value={phone}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setPhone(value);
                      setPhoneError("");
                    }}
                    required
                    maxLength={10}
                    className={phoneError ? "border-destructive" : ""}
                  />
                  {phoneError && (
                    <p className="text-xs text-destructive">{phoneError}</p>
                  )}
                  <p className="text-xs text-muted-foreground">Enter 10 digit phone number</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country *</Label>
                  <Select value={country} onValueChange={setCountry}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your country" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <div className="p-2">
                        <Input
                          placeholder="Search countries..."
                          value={countrySearch}
                          onChange={(e) => setCountrySearch(e.target.value)}
                          className="mb-2"
                        />
                      </div>
                      {COUNTRIES
                        .filter(country =>
                          country.toLowerCase().includes(countrySearch.toLowerCase())
                        )
                        .map(countryName => {
                          const flagEmoji = getCountryFlag(countryName);
                          return (
                            <SelectItem key={countryName} value={countryName}>
                              {flagEmoji} {countryName}
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency *</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <div className="p-2 sticky top-0 bg-popover z-10">
                        <Input
                          placeholder="Search currencies..."
                          value={currencySearch}
                          onChange={(e) => setCurrencySearch(e.target.value)}
                          className="mb-2"
                        />
                      </div>
                      {CURRENCIES
                        .filter(c =>
                          c.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
                          c.name.toLowerCase().includes(currencySearch.toLowerCase())
                        )
                        .sort((a, b) => a.code.localeCompare(b.code))
                        .map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            <span className="flex items-center gap-2">
                              <span>{c.code}</span>
                              <span className="text-muted-foreground">- {c.name} ({c.symbol})</span>
                            </span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email * (Gmail, business email)</Label>
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
                  <p className="text-xs text-muted-foreground">Temporary/disposable emails not allowed</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password *</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Enter password (min 8 characters)"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setPasswordError("");
                    }}
                    required
                    minLength={8}
                    className={passwordError ? "border-destructive" : ""}
                  />
                  <PasswordStrengthIndicator password={password} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password *</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Re-enter password to confirm"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setPasswordError("");
                    }}
                    required
                    minLength={8}
                    className={passwordError ? "border-destructive" : ""}
                  />
                  {passwordError && (
                    <p className="text-xs text-destructive">{passwordError}</p>
                  )}
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

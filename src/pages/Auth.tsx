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
  const [clientIP, setClientIP] = useState("unknown");
  const [rateLimited, setRateLimited] = useState(false);
  const [cooldownTime, setCooldownTime] = useState(0);

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

  // Cooldown timer
  useEffect(() => {
    if (cooldownTime > 0) {
      const timer = setTimeout(() => setCooldownTime(cooldownTime - 1), 1000);
      return () => clearTimeout(timer);
    } else if (cooldownTime === 0 && rateLimited) {
      setRateLimited(false);
    }
  }, [cooldownTime, rateLimited]);

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
    
    if (rateLimited) {
      toast.error(`Too many attempts. Please wait ${cooldownTime} seconds`);
      return;
    }

    setLoading(true);

    try {
      // Check rate limit first
      const { data: canProceed, error: rateLimitError } = await supabase
        .rpc('check_rate_limit', { check_ip: clientIP, window_minutes: 2, max_attempts: 5 });

      if (rateLimitError || !canProceed) {
        setRateLimited(true);
        setCooldownTime(120);
        toast.error("Too many login attempts. Please wait 2 minutes.");
        setLoading(false);
        return;
      }

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

    if (rateLimited) {
      toast.error(`Please wait ${cooldownTime} seconds before trying again`);
      return;
    }

    setLoading(true);

    try {
      // Check rate limit for signups too
      const { data: canProceed } = await supabase
        .rpc('check_rate_limit', { check_ip: clientIP, window_minutes: 2, max_attempts: 5 });

      if (!canProceed) {
        setRateLimited(true);
        setCooldownTime(120);
        toast.error("Too many attempts. Please wait 2 minutes.");
        setLoading(false);
        return;
      }

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
                      {/* Asia */}
                      <SelectItem value="Nepal">🇳🇵 Nepal</SelectItem>
                      <SelectItem value="India">🇮🇳 India</SelectItem>
                      <SelectItem value="China">🇨🇳 China</SelectItem>
                      <SelectItem value="Japan">🇯🇵 Japan</SelectItem>
                      <SelectItem value="South Korea">🇰🇷 South Korea</SelectItem>
                      <SelectItem value="Bangladesh">🇧🇩 Bangladesh</SelectItem>
                      <SelectItem value="Pakistan">🇵🇰 Pakistan</SelectItem>
                      <SelectItem value="Indonesia">🇮🇩 Indonesia</SelectItem>
                      <SelectItem value="Philippines">🇵🇭 Philippines</SelectItem>
                      <SelectItem value="Vietnam">🇻🇳 Vietnam</SelectItem>
                      <SelectItem value="Thailand">🇹🇭 Thailand</SelectItem>
                      <SelectItem value="Malaysia">🇲🇾 Malaysia</SelectItem>
                      <SelectItem value="Singapore">🇸🇬 Singapore</SelectItem>
                      <SelectItem value="Sri Lanka">🇱🇰 Sri Lanka</SelectItem>
                      <SelectItem value="Myanmar">🇲🇲 Myanmar</SelectItem>
                      <SelectItem value="Cambodia">🇰🇭 Cambodia</SelectItem>
                      <SelectItem value="Laos">🇱🇦 Laos</SelectItem>
                      <SelectItem value="Bhutan">🇧🇹 Bhutan</SelectItem>
                      <SelectItem value="Maldives">🇲🇻 Maldives</SelectItem>
                      <SelectItem value="Mongolia">🇲🇳 Mongolia</SelectItem>
                      <SelectItem value="Afghanistan">🇦🇫 Afghanistan</SelectItem>
                      <SelectItem value="Iran">🇮🇷 Iran</SelectItem>
                      <SelectItem value="Iraq">🇮🇶 Iraq</SelectItem>
                      <SelectItem value="Saudi Arabia">🇸🇦 Saudi Arabia</SelectItem>
                      <SelectItem value="United Arab Emirates">🇦🇪 UAE</SelectItem>
                      <SelectItem value="Qatar">🇶🇦 Qatar</SelectItem>
                      <SelectItem value="Kuwait">🇰🇼 Kuwait</SelectItem>
                      <SelectItem value="Bahrain">🇧🇭 Bahrain</SelectItem>
                      <SelectItem value="Oman">🇴🇲 Oman</SelectItem>
                      <SelectItem value="Yemen">🇾🇪 Yemen</SelectItem>
                      <SelectItem value="Jordan">🇯🇴 Jordan</SelectItem>
                      <SelectItem value="Lebanon">🇱🇧 Lebanon</SelectItem>
                      <SelectItem value="Syria">🇸🇾 Syria</SelectItem>
                      <SelectItem value="Israel">🇮🇱 Israel</SelectItem>
                      <SelectItem value="Palestine">🇵🇸 Palestine</SelectItem>
                      <SelectItem value="Turkey">🇹🇷 Turkey</SelectItem>
                      <SelectItem value="Armenia">🇦🇲 Armenia</SelectItem>
                      <SelectItem value="Azerbaijan">🇦🇿 Azerbaijan</SelectItem>
                      <SelectItem value="Georgia">🇬🇪 Georgia</SelectItem>
                      <SelectItem value="Kazakhstan">🇰🇿 Kazakhstan</SelectItem>
                      <SelectItem value="Uzbekistan">🇺🇿 Uzbekistan</SelectItem>
                      <SelectItem value="Turkmenistan">🇹🇲 Turkmenistan</SelectItem>
                      <SelectItem value="Tajikistan">🇹🇯 Tajikistan</SelectItem>
                      <SelectItem value="Kyrgyzstan">🇰🇬 Kyrgyzstan</SelectItem>
                      <SelectItem value="Taiwan">🇹🇼 Taiwan</SelectItem>
                      <SelectItem value="North Korea">🇰🇵 North Korea</SelectItem>
                      <SelectItem value="Brunei">🇧🇳 Brunei</SelectItem>
                      <SelectItem value="Timor-Leste">🇹🇱 Timor-Leste</SelectItem>
                      <SelectItem value="Cyprus">🇨🇾 Cyprus</SelectItem>
                      {/* Europe */}
                      <SelectItem value="United Kingdom">🇬🇧 United Kingdom</SelectItem>
                      <SelectItem value="Germany">🇩🇪 Germany</SelectItem>
                      <SelectItem value="France">🇫🇷 France</SelectItem>
                      <SelectItem value="Italy">🇮🇹 Italy</SelectItem>
                      <SelectItem value="Spain">🇪🇸 Spain</SelectItem>
                      <SelectItem value="Portugal">🇵🇹 Portugal</SelectItem>
                      <SelectItem value="Netherlands">🇳🇱 Netherlands</SelectItem>
                      <SelectItem value="Belgium">🇧🇪 Belgium</SelectItem>
                      <SelectItem value="Switzerland">🇨🇭 Switzerland</SelectItem>
                      <SelectItem value="Austria">🇦🇹 Austria</SelectItem>
                      <SelectItem value="Sweden">🇸🇪 Sweden</SelectItem>
                      <SelectItem value="Norway">🇳🇴 Norway</SelectItem>
                      <SelectItem value="Denmark">🇩🇰 Denmark</SelectItem>
                      <SelectItem value="Finland">🇫🇮 Finland</SelectItem>
                      <SelectItem value="Ireland">🇮🇪 Ireland</SelectItem>
                      <SelectItem value="Poland">🇵🇱 Poland</SelectItem>
                      <SelectItem value="Czech Republic">🇨🇿 Czech Republic</SelectItem>
                      <SelectItem value="Hungary">🇭🇺 Hungary</SelectItem>
                      <SelectItem value="Romania">🇷🇴 Romania</SelectItem>
                      <SelectItem value="Bulgaria">🇧🇬 Bulgaria</SelectItem>
                      <SelectItem value="Greece">🇬🇷 Greece</SelectItem>
                      <SelectItem value="Croatia">🇭🇷 Croatia</SelectItem>
                      <SelectItem value="Serbia">🇷🇸 Serbia</SelectItem>
                      <SelectItem value="Slovenia">🇸🇮 Slovenia</SelectItem>
                      <SelectItem value="Slovakia">🇸🇰 Slovakia</SelectItem>
                      <SelectItem value="Ukraine">🇺🇦 Ukraine</SelectItem>
                      <SelectItem value="Russia">🇷🇺 Russia</SelectItem>
                      <SelectItem value="Belarus">🇧🇾 Belarus</SelectItem>
                      <SelectItem value="Moldova">🇲🇩 Moldova</SelectItem>
                      <SelectItem value="Lithuania">🇱🇹 Lithuania</SelectItem>
                      <SelectItem value="Latvia">🇱🇻 Latvia</SelectItem>
                      <SelectItem value="Estonia">🇪🇪 Estonia</SelectItem>
                      <SelectItem value="Iceland">🇮🇸 Iceland</SelectItem>
                      <SelectItem value="Luxembourg">🇱🇺 Luxembourg</SelectItem>
                      <SelectItem value="Malta">🇲🇹 Malta</SelectItem>
                      <SelectItem value="Monaco">🇲🇨 Monaco</SelectItem>
                      <SelectItem value="Liechtenstein">🇱🇮 Liechtenstein</SelectItem>
                      <SelectItem value="Andorra">🇦🇩 Andorra</SelectItem>
                      <SelectItem value="San Marino">🇸🇲 San Marino</SelectItem>
                      <SelectItem value="Vatican City">🇻🇦 Vatican City</SelectItem>
                      <SelectItem value="Albania">🇦🇱 Albania</SelectItem>
                      <SelectItem value="North Macedonia">🇲🇰 North Macedonia</SelectItem>
                      <SelectItem value="Montenegro">🇲🇪 Montenegro</SelectItem>
                      <SelectItem value="Bosnia and Herzegovina">🇧🇦 Bosnia and Herzegovina</SelectItem>
                      <SelectItem value="Kosovo">🇽🇰 Kosovo</SelectItem>
                      {/* North America */}
                      <SelectItem value="United States">🇺🇸 United States</SelectItem>
                      <SelectItem value="Canada">🇨🇦 Canada</SelectItem>
                      <SelectItem value="Mexico">🇲🇽 Mexico</SelectItem>
                      <SelectItem value="Guatemala">🇬🇹 Guatemala</SelectItem>
                      <SelectItem value="Cuba">🇨🇺 Cuba</SelectItem>
                      <SelectItem value="Haiti">🇭🇹 Haiti</SelectItem>
                      <SelectItem value="Dominican Republic">🇩🇴 Dominican Republic</SelectItem>
                      <SelectItem value="Honduras">🇭🇳 Honduras</SelectItem>
                      <SelectItem value="Nicaragua">🇳🇮 Nicaragua</SelectItem>
                      <SelectItem value="El Salvador">🇸🇻 El Salvador</SelectItem>
                      <SelectItem value="Costa Rica">🇨🇷 Costa Rica</SelectItem>
                      <SelectItem value="Panama">🇵🇦 Panama</SelectItem>
                      <SelectItem value="Jamaica">🇯🇲 Jamaica</SelectItem>
                      <SelectItem value="Trinidad and Tobago">🇹🇹 Trinidad and Tobago</SelectItem>
                      <SelectItem value="Bahamas">🇧🇸 Bahamas</SelectItem>
                      <SelectItem value="Barbados">🇧🇧 Barbados</SelectItem>
                      <SelectItem value="Belize">🇧🇿 Belize</SelectItem>
                      {/* South America */}
                      <SelectItem value="Brazil">🇧🇷 Brazil</SelectItem>
                      <SelectItem value="Argentina">🇦🇷 Argentina</SelectItem>
                      <SelectItem value="Colombia">🇨🇴 Colombia</SelectItem>
                      <SelectItem value="Peru">🇵🇪 Peru</SelectItem>
                      <SelectItem value="Venezuela">🇻🇪 Venezuela</SelectItem>
                      <SelectItem value="Chile">🇨🇱 Chile</SelectItem>
                      <SelectItem value="Ecuador">🇪🇨 Ecuador</SelectItem>
                      <SelectItem value="Bolivia">🇧🇴 Bolivia</SelectItem>
                      <SelectItem value="Paraguay">🇵🇾 Paraguay</SelectItem>
                      <SelectItem value="Uruguay">🇺🇾 Uruguay</SelectItem>
                      <SelectItem value="Guyana">🇬🇾 Guyana</SelectItem>
                      <SelectItem value="Suriname">🇸🇷 Suriname</SelectItem>
                      {/* Africa */}
                      <SelectItem value="Nigeria">🇳🇬 Nigeria</SelectItem>
                      <SelectItem value="Egypt">🇪🇬 Egypt</SelectItem>
                      <SelectItem value="South Africa">🇿🇦 South Africa</SelectItem>
                      <SelectItem value="Kenya">🇰🇪 Kenya</SelectItem>
                      <SelectItem value="Ethiopia">🇪🇹 Ethiopia</SelectItem>
                      <SelectItem value="Ghana">🇬🇭 Ghana</SelectItem>
                      <SelectItem value="Tanzania">🇹🇿 Tanzania</SelectItem>
                      <SelectItem value="Morocco">🇲🇦 Morocco</SelectItem>
                      <SelectItem value="Algeria">🇩🇿 Algeria</SelectItem>
                      <SelectItem value="Uganda">🇺🇬 Uganda</SelectItem>
                      <SelectItem value="Sudan">🇸🇩 Sudan</SelectItem>
                      <SelectItem value="Rwanda">🇷🇼 Rwanda</SelectItem>
                      <SelectItem value="Tunisia">🇹🇳 Tunisia</SelectItem>
                      <SelectItem value="Zimbabwe">🇿🇼 Zimbabwe</SelectItem>
                      <SelectItem value="Senegal">🇸🇳 Senegal</SelectItem>
                      <SelectItem value="Cameroon">🇨🇲 Cameroon</SelectItem>
                      <SelectItem value="Ivory Coast">🇨🇮 Ivory Coast</SelectItem>
                      <SelectItem value="Madagascar">🇲🇬 Madagascar</SelectItem>
                      <SelectItem value="Angola">🇦🇴 Angola</SelectItem>
                      <SelectItem value="Mozambique">🇲🇿 Mozambique</SelectItem>
                      <SelectItem value="Zambia">🇿🇲 Zambia</SelectItem>
                      <SelectItem value="Malawi">🇲🇼 Malawi</SelectItem>
                      <SelectItem value="Mali">🇲🇱 Mali</SelectItem>
                      <SelectItem value="Burkina Faso">🇧🇫 Burkina Faso</SelectItem>
                      <SelectItem value="Niger">🇳🇪 Niger</SelectItem>
                      <SelectItem value="Chad">🇹🇩 Chad</SelectItem>
                      <SelectItem value="Somalia">🇸🇴 Somalia</SelectItem>
                      <SelectItem value="Congo">🇨🇬 Congo</SelectItem>
                      <SelectItem value="DR Congo">🇨🇩 DR Congo</SelectItem>
                      <SelectItem value="Libya">🇱🇾 Libya</SelectItem>
                      <SelectItem value="Mauritius">🇲🇺 Mauritius</SelectItem>
                      <SelectItem value="Botswana">🇧🇼 Botswana</SelectItem>
                      <SelectItem value="Namibia">🇳🇦 Namibia</SelectItem>
                      {/* Oceania */}
                      <SelectItem value="Australia">🇦🇺 Australia</SelectItem>
                      <SelectItem value="New Zealand">🇳🇿 New Zealand</SelectItem>
                      <SelectItem value="Papua New Guinea">🇵🇬 Papua New Guinea</SelectItem>
                      <SelectItem value="Fiji">🇫🇯 Fiji</SelectItem>
                      <SelectItem value="Samoa">🇼🇸 Samoa</SelectItem>
                      <SelectItem value="Tonga">🇹🇴 Tonga</SelectItem>
                      <SelectItem value="Vanuatu">🇻🇺 Vanuatu</SelectItem>
                      <SelectItem value="Solomon Islands">🇸🇧 Solomon Islands</SelectItem>
                      <SelectItem value="Kiribati">🇰🇮 Kiribati</SelectItem>
                      <SelectItem value="Micronesia">🇫🇲 Micronesia</SelectItem>
                      <SelectItem value="Palau">🇵🇼 Palau</SelectItem>
                      <SelectItem value="Marshall Islands">🇲🇭 Marshall Islands</SelectItem>
                      <SelectItem value="Nauru">🇳🇷 Nauru</SelectItem>
                      <SelectItem value="Tuvalu">🇹🇻 Tuvalu</SelectItem>
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
                      {/* Asia */}
                      <SelectItem value="NPR">🇳🇵 NPR - Nepali Rupee</SelectItem>
                      <SelectItem value="INR">🇮🇳 INR - Indian Rupee</SelectItem>
                      <SelectItem value="BDT">🇧🇩 BDT - Bangladeshi Taka</SelectItem>
                      <SelectItem value="PKR">🇵🇰 PKR - Pakistani Rupee</SelectItem>
                      <SelectItem value="LKR">🇱🇰 LKR - Sri Lankan Rupee</SelectItem>
                      <SelectItem value="THB">🇹🇭 THB - Thai Baht</SelectItem>
                      <SelectItem value="MYR">🇲🇾 MYR - Malaysian Ringgit</SelectItem>
                      <SelectItem value="SGD">🇸🇬 SGD - Singapore Dollar</SelectItem>
                      <SelectItem value="IDR">🇮🇩 IDR - Indonesian Rupiah</SelectItem>
                      <SelectItem value="PHP">🇵🇭 PHP - Philippine Peso</SelectItem>
                      <SelectItem value="VND">🇻🇳 VND - Vietnamese Dong</SelectItem>
                      <SelectItem value="KRW">🇰🇷 KRW - Korean Won</SelectItem>
                      <SelectItem value="JPY">🇯🇵 JPY - Japanese Yen</SelectItem>
                      <SelectItem value="CNY">🇨🇳 CNY - Chinese Yuan</SelectItem>
                      {/* Americas */}
                      <SelectItem value="USD">🇺🇸 USD - US Dollar</SelectItem>
                      <SelectItem value="CAD">🇨🇦 CAD - Canadian Dollar</SelectItem>
                      <SelectItem value="MXN">🇲🇽 MXN - Mexican Peso</SelectItem>
                      <SelectItem value="BRL">🇧🇷 BRL - Brazilian Real</SelectItem>
                      <SelectItem value="ARS">🇦🇷 ARS - Argentine Peso</SelectItem>
                      <SelectItem value="CLP">🇨🇱 CLP - Chilean Peso</SelectItem>
                      <SelectItem value="COP">🇨🇴 COP - Colombian Peso</SelectItem>
                      <SelectItem value="PEN">🇵🇪 PEN - Peruvian Sol</SelectItem>
                      {/* Europe */}
                      <SelectItem value="EUR">🇪🇺 EUR - Euro</SelectItem>
                      <SelectItem value="GBP">🇬🇧 GBP - British Pound</SelectItem>
                      <SelectItem value="CHF">🇨🇭 CHF - Swiss Franc</SelectItem>
                      <SelectItem value="SEK">🇸🇪 SEK - Swedish Krona</SelectItem>
                      <SelectItem value="NOK">🇳🇴 NOK - Norwegian Krone</SelectItem>
                      <SelectItem value="DKK">🇩🇰 DKK - Danish Krone</SelectItem>
                      <SelectItem value="PLN">🇵🇱 PLN - Polish Zloty</SelectItem>
                      <SelectItem value="CZK">🇨🇿 CZK - Czech Koruna</SelectItem>
                      <SelectItem value="HUF">🇭🇺 HUF - Hungarian Forint</SelectItem>
                      <SelectItem value="RON">🇷🇴 RON - Romanian Leu</SelectItem>
                      <SelectItem value="BGN">🇧🇬 BGN - Bulgarian Lev</SelectItem>
                      <SelectItem value="HRK">🇭🇷 HRK - Croatian Kuna</SelectItem>
                      {/* Oceania */}
                      <SelectItem value="AUD">🇦🇺 AUD - Australian Dollar</SelectItem>
                      <SelectItem value="NZD">🇳🇿 NZD - New Zealand Dollar</SelectItem>
                      <SelectItem value="FJD">🇫🇯 FJD - Fiji Dollar</SelectItem>
                      {/* Middle East & Africa */}
                      <SelectItem value="AED">🇦🇪 AED - UAE Dirham</SelectItem>
                      <SelectItem value="SAR">🇸🇦 SAR - Saudi Riyal</SelectItem>
                      <SelectItem value="QAR">🇶🇦 QAR - Qatari Riyal</SelectItem>
                      <SelectItem value="KWD">🇰🇼 KWD - Kuwaiti Dinar</SelectItem>
                      <SelectItem value="BHD">🇧🇭 BHD - Bahraini Dinar</SelectItem>
                      <SelectItem value="OMR">🇴🇲 OMR - Omani Rial</SelectItem>
                      <SelectItem value="ZAR">🇿🇦 ZAR - South African Rand</SelectItem>
                      <SelectItem value="EGP">🇪🇬 EGP - Egyptian Pound</SelectItem>
                      <SelectItem value="NGN">🇳🇬 NGN - Nigerian Naira</SelectItem>
                      <SelectItem value="KES">🇰🇪 KES - Kenyan Shilling</SelectItem>
                      <SelectItem value="GHS">🇬🇭 GHS - Ghanaian Cedi</SelectItem>
                      <SelectItem value="MAD">🇲🇦 MAD - Moroccan Dirham</SelectItem>
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

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, User, Save, Loader2, Monitor, Globe, Key, Mail, Eye, EyeOff } from "lucide-react";
import { isValidEmail, isValidPhone, isValidName } from "@/lib/validation";
import { format } from "date-fns";
import { CURRENCIES } from "@/lib/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface UserSession {
  id: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
  last_active: string;
}

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  // Profile fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState("NPR");
  const [currencySearch, setCurrencySearch] = useState("");

  // Password change
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Admin Gmail settings
  const [gmailUser, setGmailUser] = useState("kpoliking001@gmail.com");
  const [gmailAppPassword, setGmailAppPassword] = useState("");
  const [savingGmail, setSavingGmail] = useState(false);
  const [showGmailPassword, setShowGmailPassword] = useState(false);
  const [hasExistingPassword, setHasExistingPassword] = useState(false);

  // Validation errors
  const [firstNameError, setFirstNameError] = useState("");
  const [lastNameError, setLastNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setUser(session.user);
    await fetchProfile(session.user.id);
    await fetchSessions(session.user.id);
    await checkIfAdmin(session.user.id);
    setLoading(false);
  };

  const checkIfAdmin = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    // HARDCODED ADMIN CHECK
    const { data: userData } = await supabase.auth.getUser();
    const isHardcodedAdmin = userData?.user?.email === "shishirxkandel@gmail.com";

    // Check if user is the hardcoded admin or has admin role in DB
    const adminStatus = !!data || isHardcodedAdmin;
    setIsAdmin(adminStatus);

    // If admin, fetch Gmail settings
    if (adminStatus) {
      await fetchGmailSettings();
    }
  };

  const fetchGmailSettings = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-gmail-settings`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: 'get' }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setGmailUser(data.gmail_user || '');
        setHasExistingPassword(data.has_password || false);
      }
    } catch (error) {
      console.error('Error fetching Gmail settings:', error);
    }
  };

  const handleSaveGmailSettings = async () => {
    if (!gmailUser || !isValidEmail(gmailUser).valid) {
      toast.error("Please enter a valid Gmail address");
      return;
    }

    setSavingGmail(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Session expired. Please login again.");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-gmail-settings`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: 'update',
            gmail_user: gmailUser.trim(),
            gmail_app_password: gmailAppPassword || (!hasExistingPassword ? 'nrcd lxrl omvc rpfy' : undefined),
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        toast.success("Gmail settings update requested. Please update the secrets in your backend settings.");
        setGmailAppPassword("");
        setHasExistingPassword(true);
      } else {
        toast.error(data.error || "Failed to update Gmail settings");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to update Gmail settings");
    } finally {
      setSavingGmail(false);
    }
  };

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) {
      setFirstName(data.first_name || "");
      setLastName(data.last_name || "");
      setEmail(data.email || "");
      setPhone(data.phone || "");
      setCountry(data.country || "");
      setCurrency(data.currency || "NPR");
    }
  };

  const fetchSessions = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (data) {
      setSessions(data);
    }
  };

  const validateForm = (): boolean => {
    let isValid = true;

    const firstNameValidation = isValidName(firstName);
    if (!firstNameValidation.valid) {
      setFirstNameError(firstNameValidation.error || "");
      isValid = false;
    } else {
      setFirstNameError("");
    }

    const lastNameValidation = isValidName(lastName);
    if (!lastNameValidation.valid) {
      setLastNameError(lastNameValidation.error || "");
      isValid = false;
    } else {
      setLastNameError("");
    }

    const emailValidation = isValidEmail(email);
    if (!emailValidation.valid) {
      setEmailError(emailValidation.error || "");
      isValid = false;
    } else {
      setEmailError("");
    }

    if (phone) {
      const phoneValidation = isValidPhone(phone);
      if (!phoneValidation.valid) {
        setPhoneError(phoneValidation.error || "");
        isValid = false;
      } else {
        setPhoneError("");
      }
    }

    return isValid;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim(),
          country: country.trim(),
          currency: currency,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      // Update email in auth if changed
      if (email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email });
        if (emailError) {
          toast.error("Profile updated but email change requires verification");
        } else {
          toast.success("Profile updated! Check your email to verify the new address.");
        }
      } else {
        toast.success("Profile updated successfully!");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated successfully!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast.error(error.message || "Failed to update password");
    } finally {
      setChangingPassword(false);
    }
  };

  const parseUserAgent = (ua: string) => {
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return 'Unknown Browser';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <User className="h-6 w-6" />
              My Profile
            </h1>
            <p className="text-sm text-muted-foreground">
              Update your personal information
            </p>
          </div>
        </div>

        {/* Profile Form */}
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Update your account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    setFirstNameError("");
                  }}
                  className={firstNameError ? "border-destructive" : ""}
                />
                {firstNameError && <p className="text-xs text-destructive">{firstNameError}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => {
                    setLastName(e.target.value);
                    setLastNameError("");
                  }}
                  className={lastNameError ? "border-destructive" : ""}
                />
                {lastNameError && <p className="text-xs text-destructive">{lastNameError}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError("");
                }}
                className={emailError ? "border-destructive" : ""}
              />
              {emailError && <p className="text-xs text-destructive">{emailError}</p>}
              {email !== user?.email && (
                <p className="text-xs text-muted-foreground">
                  Changing your email will require verification
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                  setPhoneError("");
                }}
                maxLength={10}
                className={phoneError ? "border-destructive" : ""}
              />
              {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
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

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          </CardContent>
        </Card>

        {/* Password Change */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Change Password
            </CardTitle>
            <CardDescription>Update your login password</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>
            <Button
              onClick={handlePasswordChange}
              disabled={changingPassword || !newPassword || !confirmPassword}
              className="w-full"
            >
              {changingPassword ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Key className="w-4 h-4 mr-2" />}
              Update Password
            </Button>
          </CardContent>
        </Card>

        {/* Admin Gmail Settings - Only visible to admins */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                SMTP Email Settings
              </CardTitle>
              <CardDescription>
                Configure Gmail SMTP for sending reports (Admin only)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gmailUser">Gmail Address</Label>
                <Input
                  id="gmailUser"
                  type="email"
                  value={gmailUser}
                  onChange={(e) => setGmailUser(e.target.value)}
                  placeholder="kpoliking001@gmail.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gmailAppPassword">
                  App Password {hasExistingPassword && <span className="text-muted-foreground">(leave blank to keep current)</span>}
                </Label>
                <div className="relative">
                  <Input
                    id="gmailAppPassword"
                    type={showGmailPassword ? "text" : "password"}
                    value={gmailAppPassword}
                    onChange={(e) => setGmailAppPassword(e.target.value)}
                    placeholder={hasExistingPassword ? "••••••••••••••••" : "Enter app password"}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowGmailPassword(!showGmailPassword)}
                  >
                    {showGmailPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Generate an App Password from your Google Account settings
                </p>
              </div>
              <Button
                onClick={handleSaveGmailSettings}
                disabled={savingGmail || !gmailUser}
                className="w-full"
              >
                {savingGmail ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                Update Gmail Settings
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Login Sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Login Sessions
            </CardTitle>
            <CardDescription>
              Recent login activity from your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <p className="text-center py-4 text-muted-foreground">No login sessions recorded</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Browser</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell className="font-mono text-sm flex items-center gap-2">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          {session.ip_address}
                        </TableCell>
                        <TableCell>{parseUserAgent(session.user_agent || "")}</TableCell>
                        <TableCell>{format(new Date(session.created_at), "PPp")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

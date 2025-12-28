import { useMemo } from "react";
import { Check, X } from "lucide-react";

interface PasswordStrengthIndicatorProps {
  password: string;
}

interface Requirement {
  label: string;
  met: boolean;
}

export const PasswordStrengthIndicator = ({ password }: PasswordStrengthIndicatorProps) => {
  const requirements = useMemo((): Requirement[] => {
    return [
      { label: "At least 8 characters", met: password.length >= 8 },
      { label: "Contains uppercase letter", met: /[A-Z]/.test(password) },
      { label: "Contains lowercase letter", met: /[a-z]/.test(password) },
      { label: "Contains a number", met: /[0-9]/.test(password) },
      { label: "Contains special character (!@#$%^&*)", met: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
    ];
  }, [password]);

  const strength = useMemo(() => {
    const metCount = requirements.filter(r => r.met).length;
    if (metCount <= 1) return { level: "weak", color: "bg-red-500", text: "Weak" };
    if (metCount <= 3) return { level: "fair", color: "bg-orange-500", text: "Fair" };
    if (metCount <= 4) return { level: "good", color: "bg-yellow-500", text: "Good" };
    return { level: "strong", color: "bg-green-500", text: "Strong" };
  }, [requirements]);

  if (!password) return null;

  return (
    <div className="space-y-2 mt-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ${strength.color}`}
            style={{ width: `${(requirements.filter(r => r.met).length / requirements.length) * 100}%` }}
          />
        </div>
        <span className={`text-xs font-medium ${
          strength.level === "weak" ? "text-red-500" :
          strength.level === "fair" ? "text-orange-500" :
          strength.level === "good" ? "text-yellow-600" : "text-green-500"
        }`}>
          {strength.text}
        </span>
      </div>
      <ul className="space-y-1">
        {requirements.map((req, idx) => (
          <li key={idx} className="flex items-center gap-2 text-xs">
            {req.met ? (
              <Check className="w-3 h-3 text-green-500" />
            ) : (
              <X className="w-3 h-3 text-muted-foreground" />
            )}
            <span className={req.met ? "text-green-600" : "text-muted-foreground"}>
              {req.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
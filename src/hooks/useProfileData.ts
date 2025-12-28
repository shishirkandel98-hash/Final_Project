import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  isAdmin: boolean;
  sessions: UserSession[];
}

interface UserSession {
  id: string;
  ip_address: string;
  user_agent: string | null;
  created_at: string;
  last_active: string;
}

async function fetchProfileData(userId: string, userEmail: string): Promise<ProfileData> {
  const [profileResult, roleResult, sessionsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single(),
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle(),
    supabase
      .from("user_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const profile = profileResult.data;

  return {
    firstName: profile?.first_name || "",
    lastName: profile?.last_name || "",
    email: profile?.email || userEmail,
    phone: profile?.phone || "",
    country: profile?.country || "",
    isAdmin: !!roleResult.data,
    sessions: sessionsResult.data || [],
  };
}

export function useProfileData(userId: string | undefined, userEmail: string | undefined) {
  return useQuery({
    queryKey: ["profile", userId],
    queryFn: () => fetchProfileData(userId!, userEmail || ""),
    enabled: !!userId,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useUpdateProfile(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: {
      first_name: string;
      last_name: string;
      phone: string;
      country: string;
    }) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update profile");
    },
  });
}

export function useUpdatePassword() {
  return useMutation({
    mutationFn: async (newPassword: string) => {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Password updated successfully!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update password");
    },
  });
}

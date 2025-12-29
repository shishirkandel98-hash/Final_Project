import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Reminder {
  id: string;
  user_id: string;
  title: string;
  message: string;
  reminder_date: string;
  is_recurring: boolean;
  recurrence_count: number;
  recurrence_interval: string | null;
  recurrence_end_date: string | null;
  is_active: boolean;
  email_sent_count: number;
  last_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CreateReminderData {
  title: string;
  message: string;
  reminder_date: string;
  is_recurring?: boolean;
  recurrence_count?: number;
  recurrence_interval?: string;
  recurrence_end_date?: string;
}

interface UpdateReminderData extends Partial<CreateReminderData> {
  id: string;
  is_active?: boolean;
}

export const useRemindersData = (userId?: string) => {
  return useQuery({
    queryKey: ["reminders", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("reminders")
        .select("*")
        .eq("user_id", userId)
        .order("reminder_date", { ascending: true });

      if (error) {
        console.error("Error fetching reminders:", error);
        throw error;
      }

      return data as Reminder[];
    },
    enabled: !!userId,
  });
};

export const useCreateReminder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateReminderData & { user_id: string }) => {
      console.log("Attempting to create reminder with data:", data);

      const { data: result, error } = await supabase
        .from("reminders")
        .insert(data)
        .select()
        .single();

      if (error) {
        console.error("Supabase error creating reminder:", error);
        console.error("Error details:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      console.log("Reminder created successfully:", result);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      toast.success("Reminder created successfully!");
    },
    onError: (error: any) => {
      console.error("Failed to create reminder - full error:", error);
      console.error("Error message:", error.message);
      console.error("Error code:", error.code);

      // Show more specific error message
      if (error.code === '42501') {
        toast.error("Permission denied. Please check your account permissions.");
      } else if (error.code === '23505') {
        toast.error("This reminder already exists.");
      } else if (error.code === '23503') {
        toast.error("Invalid data provided.");
      } else if (error.code === 'PGRST205') {
        toast.error("Reminders feature is not available yet. Please contact support or try again later.");
      } else {
        toast.error(`Failed to create reminder: ${error.message || "Please try again."}`);
      }
    },
  });
};

export const useUpdateReminder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateReminderData) => {
      const { id, ...updateData } = data;
      const { data: result, error } = await supabase
        .from("reminders")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Error updating reminder:", error);
        throw error;
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      toast.success("Reminder updated successfully!");
    },
    onError: (error) => {
      console.error("Failed to update reminder:", error);
      toast.error("Failed to update reminder. Please try again.");
    },
  });
};

export const useDeleteReminder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("reminders")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Error deleting reminder:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      toast.success("Reminder deleted successfully!");
    },
    onError: (error) => {
      console.error("Failed to delete reminder:", error);
      toast.error("Failed to delete reminder. Please try again.");
    },
  });
};

export const useInvalidateReminders = () => {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: ["reminders"] });
  };
};
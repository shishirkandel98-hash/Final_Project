import React, { useState } from "react";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useRemindersData, useCreateReminder, useUpdateReminder, useDeleteReminder, type Reminder } from "@/hooks/useRemindersData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Bell, Plus, Edit, Trash2, Clock, Calendar, Repeat, Mail } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface ReminderFormData {
  title: string;
  subject: string;
  message: string;
  reminder_email: string;
  reminder_date: string;
  reminder_time: string;
  is_recurring: boolean;
  recurrence_count: number;
  recurrence_interval: string;
  recurrence_end_date: string;
}

const RemindersPanel = () => {
  const { user } = useAuthSession();
  const { data: reminders = [], isLoading } = useRemindersData(user?.id);
  const createReminder = useCreateReminder();
  const updateReminder = useUpdateReminder();
  const deleteReminder = useDeleteReminder();

  const isOverdue = (reminder: Reminder) => {
    const reminderDate = new Date(reminder.reminder_date);
    const now = new Date();
    return reminderDate < now && reminder.is_active;
  };

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [formData, setFormData] = useState<ReminderFormData>({
    title: "",
    message: "",
    reminder_date: "",
    reminder_time: "",
    is_recurring: false,
    recurrence_count: 1,
    recurrence_interval: "daily",
    recurrence_end_date: "",
  });

  const resetForm = () => {
    setFormData({
      title: "",
      subject: "",
      message: "",
      reminder_email: user?.email || "",
      reminder_date: "",
      reminder_time: "",
      is_recurring: false,
      recurrence_count: 1,
      recurrence_interval: "daily",
      recurrence_end_date: "",
    });
    setEditingReminder(null);
  };

  const handleCreateReminder = async () => {
    if (!user) return;

    // Validate required fields
    if (!formData.title.trim()) {
      toast.error("Please enter a reminder title");
      return;
    }
    if (!formData.subject.trim()) {
      toast.error("Please enter an email subject");
      return;
    }
    if (!formData.message.trim()) {
      toast.error("Please enter a reminder message");
      return;
    }
    if (!formData.reminder_email.trim()) {
      toast.error("Please enter an email address for the reminder");
      return;
    }
    if (!formData.reminder_date) {
      toast.error("Please select a reminder date");
      return;
    }
    if (!formData.reminder_time) {
      toast.error("Please select a reminder time");
      return;
    }

    try {
      console.log("Creating reminder with data:", {
        title: formData.title,
        message: formData.message,
        reminder_date: formData.reminder_date,
        reminder_time: formData.reminder_time,
        is_recurring: formData.is_recurring
      });

      // Parse the date more robustly
      let reminderDateTime: Date;

      // If the date is in MM/DD/YYYY format, convert it to YYYY-MM-DD
      let formattedDate = formData.reminder_date;
      if (formData.reminder_date.includes('/')) {
        const [month, day, year] = formData.reminder_date.split('/');
        formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        console.log("Converted date from MM/DD/YYYY to YYYY-MM-DD:", formattedDate);
      }

      // Handle time format - if it contains AM/PM, convert to 24-hour format
      let formattedTime = formData.reminder_time;
      if (formData.reminder_time.includes(' ')) {
        // This is likely a formatted time like "11:07 PM"
        const timeParts = formData.reminder_time.split(' ');
        if (timeParts.length === 2) {
          const [time, period] = timeParts;
          const [hours, minutes] = time.split(':').map(Number);
          let hour24 = hours;
          if (period.toUpperCase() === 'PM' && hours !== 12) {
            hour24 = hours + 12;
          } else if (period.toUpperCase() === 'AM' && hours === 12) {
            hour24 = 0;
          }
          formattedTime = `${hour24.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
          console.log("Converted time from 12-hour to 24-hour:", formattedTime);
        }
      }

      reminderDateTime = new Date(`${formattedDate}T${formattedTime}`);
      console.log("Parsed reminder date/time:", reminderDateTime);

      // Check if the date is valid
      if (isNaN(reminderDateTime.getTime())) {
        console.error("Invalid date/time parsed:", reminderDateTime);
        toast.error("Please enter a valid date and time");
        return;
      }

      // Allow reminders at least 30 seconds in the future (very lenient for testing)
      const thirtySecondsFromNow = new Date(Date.now() + 30 * 1000);
      console.log("Current time + 30 sec:", thirtySecondsFromNow);
      console.log("Reminder time:", reminderDateTime);

      if (reminderDateTime <= thirtySecondsFromNow) {
        console.log("Reminder time is too soon - allowing anyway for testing");
        // Don't block creation, just log it
      }

      console.log("Creating reminder...");

      await createReminder.mutateAsync({
        user_id: user.id,
        title: formData.title.trim(),
        subject: formData.subject.trim(),
        message: formData.message.trim(),
        reminder_email: formData.reminder_email.trim(),
        reminder_date: reminderDateTime.toISOString(),
        is_recurring: formData.is_recurring,
        recurrence_count: formData.is_recurring ? formData.recurrence_count : 1,
        recurrence_interval: formData.is_recurring ? formData.recurrence_interval : null,
        recurrence_end_date: formData.is_recurring && formData.recurrence_end_date
          ? new Date(formData.recurrence_end_date).toISOString()
          : null,
      });

      console.log("Reminder created successfully");
      setIsCreateDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error creating reminder:", error);
      toast.error("Failed to create reminder. Please try again.");
    }
  };

  const handleUpdateReminder = async () => {
    if (!editingReminder) return;

    // Validate required fields
    if (!formData.title.trim()) {
      toast.error("Please enter a reminder title");
      return;
    }
    if (!formData.subject.trim()) {
      toast.error("Please enter an email subject");
      return;
    }
    if (!formData.message.trim()) {
      toast.error("Please enter a reminder message");
      return;
    }
    if (!formData.reminder_email.trim()) {
      toast.error("Please enter an email address for the reminder");
      return;
    }
    if (!formData.reminder_date) {
      toast.error("Please select a reminder date");
      return;
    }
    if (!formData.reminder_time) {
      toast.error("Please select a reminder time");
      return;
    }

    try {
      const reminderDateTime = new Date(`${formData.reminder_date}T${formData.reminder_time}`);

      // Check if the date is valid
      if (isNaN(reminderDateTime.getTime())) {
        toast.error("Please enter a valid date and time");
        return;
      }

      // For updates, allow past dates (in case user wants to reschedule)
      await updateReminder.mutateAsync({
        id: editingReminder.id,
        title: formData.title.trim(),
        subject: formData.subject.trim(),
        message: formData.message.trim(),
        reminder_email: formData.reminder_email.trim(),
        reminder_date: reminderDateTime.toISOString(),
        is_recurring: formData.is_recurring,
        recurrence_count: formData.is_recurring ? formData.recurrence_count : 1,
        recurrence_interval: formData.is_recurring ? formData.recurrence_interval : null,
        recurrence_end_date: formData.is_recurring && formData.recurrence_end_date
          ? new Date(formData.recurrence_end_date).toISOString()
          : null,
      });

      setEditingReminder(null);
      resetForm();
    } catch (error) {
      console.error("Error updating reminder:", error);
      toast.error("Failed to update reminder. Please try again.");
    }
  };

  const handleEditReminder = (reminder: Reminder) => {
    const reminderDate = new Date(reminder.reminder_date);
    setFormData({
      title: reminder.title,
      subject: reminder.subject || "",
      message: reminder.message,
      reminder_email: reminder.reminder_email || user?.email || "",
      reminder_date: reminderDate.toISOString().split('T')[0],
      reminder_time: reminderDate.toTimeString().slice(0, 5),
      is_recurring: reminder.is_recurring,
      recurrence_count: reminder.recurrence_count,
      recurrence_interval: reminder.recurrence_interval || "daily",
      recurrence_end_date: reminder.recurrence_end_date
        ? new Date(reminder.recurrence_end_date).toISOString().split('T')[0]
        : "",
    });
    setEditingReminder(reminder);
  };

  const handleDeleteReminder = async (id: string) => {
    try {
      await deleteReminder.mutateAsync(id);
    } catch (error) {
      console.error("Error deleting reminder:", error);
    }
  };

  const handleToggleActive = async (reminder: Reminder) => {
    try {
      await updateReminder.mutateAsync({
        id: reminder.id,
        is_active: !reminder.is_active,
      });
    } catch (error) {
      console.error("Error toggling reminder status:", error);
    }
  };

  const getRecurrenceLabel = (reminder: Reminder) => {
    if (!reminder.is_recurring) return null;

    const interval = reminder.recurrence_interval;
    const count = reminder.recurrence_count;

    if (count === 1) {
      return `Every ${interval.slice(0, -2)}`; // Remove 'ly' from daily/weekly/monthly
    }

    return `Every ${count} ${interval.slice(0, -2)}${count > 1 ? 's' : ''}`;
  };

  const isFormValid = () => {
    // Basic field validation - only require title and message for now
    return formData.title.trim() && formData.message.trim();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <Bell className="w-8 h-8 animate-pulse mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading reminders...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Reminders
            </CardTitle>
            <CardDescription>
              Schedule email reminders for important dates and tasks
            </CardDescription>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Reminder
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Reminder</DialogTitle>
                <DialogDescription>
                  Set up a scheduled email reminder
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Reminder title"
                  />
                </div>
                <div>
                  <Label htmlFor="subject">Email Subject</Label>
                  <Input
                    id="subject"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="Email subject line"
                  />
                </div>
                <div>
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Reminder message"
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.reminder_email}
                    onChange={(e) => setFormData({ ...formData, reminder_email: e.target.value })}
                    placeholder="email@example.com"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.reminder_date}
                      onChange={(e) => setFormData({ ...formData, reminder_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="time">Time</Label>
                    <Input
                      id="time"
                      type="time"
                      value={formData.reminder_time}
                      onChange={(e) => setFormData({ ...formData, reminder_time: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="recurring"
                    checked={formData.is_recurring}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_recurring: checked as boolean })}
                  />
                  <Label htmlFor="recurring">Recurring reminder</Label>
                </div>
                {formData.is_recurring && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="count">Repeat every</Label>
                        <Input
                          id="count"
                          type="number"
                          min="1"
                          value={formData.recurrence_count}
                          onChange={(e) => setFormData({ ...formData, recurrence_count: parseInt(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="interval">Interval</Label>
                        <Select
                          value={formData.recurrence_interval}
                          onValueChange={(value) => setFormData({ ...formData, recurrence_interval: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Days</SelectItem>
                            <SelectItem value="weekly">Weeks</SelectItem>
                            <SelectItem value="monthly">Months</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="end_date">End date (optional)</Label>
                      <Input
                        id="end_date"
                        type="date"
                        value={formData.recurrence_end_date}
                        onChange={(e) => setFormData({ ...formData, recurrence_end_date: e.target.value })}
                      />
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateReminder} disabled={createReminder.isPending || !isFormValid()}>
                    Create Reminder
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {reminders.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No reminders yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first reminder to stay organized
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {reminders.map((reminder) => (
                <Card key={reminder.id} className={`p-4 ${isOverdue(reminder) ? 'border-red-200 bg-red-50' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">{reminder.title}</h4>
                        {isOverdue(reminder) && (
                          <Badge variant="destructive" className="text-xs">Overdue</Badge>
                        )}
                        {!reminder.is_active && (
                          <Badge variant="secondary" className="text-xs">Inactive</Badge>
                        )}
                        {reminder.is_recurring && (
                          <Badge variant="outline" className="text-xs">
                            <Repeat className="w-3 h-3 mr-1" />
                            {getRecurrenceLabel(reminder)}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{reminder.message}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(reminder.reminder_date), "PPP")}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(reminder.reminder_date), "p")}
                        </div>
                        {reminder.email_sent_count > 0 && (
                          <div className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            Sent {reminder.email_sent_count} time{reminder.email_sent_count !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(reminder)}
                        className="h-8 w-8 p-0"
                      >
                        {reminder.is_active ? (
                          <Bell className="w-4 h-4" />
                        ) : (
                          <Bell className="w-4 h-4 opacity-50" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditReminder(reminder)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600 hover:text-red-700">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Reminder</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this reminder? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteReminder(reminder.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editingReminder && (
        <Dialog open={!!editingReminder} onOpenChange={() => setEditingReminder(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Reminder</DialogTitle>
              <DialogDescription>
                Update your reminder settings
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Reminder title"
                />
              </div>
              <div>
                <Label htmlFor="edit-message">Message</Label>
                <Textarea
                  id="edit-message"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Reminder message"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="edit-date">Date</Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={formData.reminder_date}
                    onChange={(e) => setFormData({ ...formData, reminder_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-time">Time</Label>
                  <Input
                    id="edit-time"
                    type="time"
                    value={formData.reminder_time}
                    onChange={(e) => setFormData({ ...formData, reminder_time: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-recurring"
                  checked={formData.is_recurring}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_recurring: checked as boolean })}
                />
                <Label htmlFor="edit-recurring">Recurring reminder</Label>
              </div>
              {formData.is_recurring && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="edit-count">Repeat every</Label>
                      <Input
                        id="edit-count"
                        type="number"
                        min="1"
                        value={formData.recurrence_count}
                        onChange={(e) => setFormData({ ...formData, recurrence_count: parseInt(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-interval">Interval</Label>
                      <Select
                        value={formData.recurrence_interval}
                        onValueChange={(value) => setFormData({ ...formData, recurrence_interval: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Days</SelectItem>
                          <SelectItem value="weekly">Weeks</SelectItem>
                          <SelectItem value="monthly">Months</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="edit-end_date">End date (optional)</Label>
                    <Input
                      id="edit-end_date"
                      type="date"
                      value={formData.recurrence_end_date}
                      onChange={(e) => setFormData({ ...formData, recurrence_end_date: e.target.value })}
                    />
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingReminder(null)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateReminder} disabled={updateReminder.isPending || !isFormValid()}>
                  Update Reminder
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default RemindersPanel;
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Calendar, Clock, User, Plus, CheckCircle, XCircle, Upload, MessageSquare, FileText, File, Edit, Trash2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface AgendaItem {
  id: number;
  meetingId: number;
  submittedBy: string;
  title: string;
  description: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
}

interface Meeting {
  id: number;
  title: string;
  type: string;
  date: string;
  time: string;
  location?: string;
  description?: string;
  finalAgenda?: string;
  status: "planning" | "agenda_set" | "completed";
}

export default function MeetingAgenda() {
  const { toast } = useToast();
  const [selectedMeetingId, setSelectedMeetingId] = useState<number | null>(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    submittedBy: "",
    title: "",
    description: ""
  });
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "" });

  const { data: meetings = [], isLoading: meetingsLoading } = useQuery<Meeting[]>({
    queryKey: ['/api/meetings']
  });

  const { data: agendaItems = [], isLoading: itemsLoading } = useQuery<AgendaItem[]>({
    queryKey: ['/api/agenda-items']
  });

  // Filter agenda items for selected meeting
  const selectedMeetingAgendaItems = selectedMeetingId 
    ? agendaItems.filter(item => item.meetingId === selectedMeetingId)
    : [];

  // Get selected meeting details
  const selectedMeeting = selectedMeetingId 
    ? meetings.find(m => m.id === selectedMeetingId)
    : null;

  // Auto-select first upcoming meeting if none selected
  useEffect(() => {
    if (!selectedMeetingId && meetings.length > 0) {
      const upcomingMeeting = meetings.find(m => m.status === "planning" || m.status === "agenda_set") || meetings[0];
      setSelectedMeetingId(upcomingMeeting.id);
    }
  }, [meetings, selectedMeetingId]);

  const submitItemMutation = useMutation({
    mutationFn: async (data: typeof newItem) => {
      if (!selectedMeetingId) throw new Error('No meeting selected');
      const response = await fetch('/api/agenda-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, meetingId: selectedMeetingId })
      });
      if (!response.ok) throw new Error('Failed to submit agenda item');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agenda-items'] });
      setNewItem({ submittedBy: "", title: "", description: "" });
      setIsSubmitModalOpen(false);
      toast({
        title: "Agenda item submitted",
        description: "Your agenda item has been submitted for review.",
      });
    }
  });

  const updateItemStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "approved" | "rejected" }) => {
      const response = await fetch(`/api/agenda-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!response.ok) throw new Error('Failed to update status');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agenda-items'] });
      toast({
        title: "Status updated",
        description: "Agenda item status has been updated.",
      });
    }
  });

  const uploadAgendaMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedMeetingId) throw new Error('No meeting selected');
      const formData = new FormData();
      formData.append('agenda', file);
      const response = await fetch(`/api/meetings/${selectedMeetingId}/upload-agenda`, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) throw new Error('Failed to upload agenda');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
      setIsUploadModalOpen(false);
      setUploadedFile(null);
      toast({
        title: "Agenda uploaded",
        description: "The meeting agenda has been uploaded successfully.",
      });
    }
  });

  const editItemMutation = useMutation({
    mutationFn: async ({ id, title, description }: { id: number; title: string; description: string }) => {
      const response = await fetch(`/api/agenda-items/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description })
      });
      if (!response.ok) throw new Error('Failed to update agenda item');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agenda-items'] });
      setEditingItem(null);
      setEditForm({ title: "", description: "" });
      toast({
        title: "Agenda item updated",
        description: "The agenda item has been updated successfully.",
      });
    }
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/agenda-items/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete agenda item');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agenda-items'] });
      toast({
        title: "Agenda item deleted",
        description: "The agenda item has been deleted successfully.",
      });
    }
  });

  const handleSubmitItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeetingId) {
      toast({
        title: "No meeting selected",
        description: "Please select a meeting before submitting agenda items.",
        variant: "destructive"
      });
      return;
    }
    submitItemMutation.mutate(newItem);
  };

  const handleUploadAgenda = (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadedFile) {
      uploadAgendaMutation.mutate(uploadedFile);
    }
  };

  const handleEditItem = (item: AgendaItem) => {
    setEditingItem(item.id);
    setEditForm({ title: item.title, description: item.description });
  };

  const handleSaveEdit = () => {
    if (editingItem && editForm.title.trim() && editForm.description.trim()) {
      editItemMutation.mutate({
        id: editingItem,
        title: editForm.title,
        description: editForm.description
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setEditForm({ title: "", description: "" });
  };

  const handleDeleteItem = (id: number) => {
    if (confirm('Are you sure you want to delete this agenda item?')) {
      deleteItemMutation.mutate(id);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge variant="default" className="bg-green-100 text-green-800">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const getMeetingTypeColor = (type: string) => {
    switch (type) {
      case "weekly": return "bg-blue-100 text-blue-800";
      case "marketing_committee": return "bg-purple-100 text-purple-800";
      case "grant_committee": return "bg-green-100 text-green-800";
      case "core_group": return "bg-orange-100 text-orange-800";
      case "all_team": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (itemsLoading || meetingsLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900 flex items-center">
              <Calendar className="text-blue-500 mr-3 w-6 h-6" />
              Meeting Agenda Management
            </h1>
            <Dialog open={isSubmitModalOpen} onOpenChange={setIsSubmitModalOpen}>
              <DialogTrigger asChild>
                <Button size="lg" disabled={!selectedMeetingId}>
                  <Plus className="w-5 h-5 mr-2" />
                  Submit Agenda Item
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Submit Agenda Item</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmitItem} className="space-y-4">
                  <div>
                    <Label htmlFor="submittedBy">Your Name</Label>
                    <Input
                      id="submittedBy"
                      value={newItem.submittedBy}
                      onChange={(e) => setNewItem({ ...newItem, submittedBy: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="title">Agenda Item Title</Label>
                    <Input
                      id="title"
                      value={newItem.title}
                      onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={newItem.description}
                      onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                      required
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsSubmitModalOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={submitItemMutation.isPending}>
                      Submit Item
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        
        <div className="p-6">
          {/* Meeting Selector */}
          <div className="mb-6">
            <Label htmlFor="meeting-select" className="text-sm font-medium text-slate-700 mb-2 block">
              Select Meeting
            </Label>
            <Select value={selectedMeetingId?.toString() || ""} onValueChange={(value) => setSelectedMeetingId(parseInt(value))}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Choose a meeting..." />
              </SelectTrigger>
              <SelectContent>
                {meetings.map((meeting) => (
                  <SelectItem key={meeting.id} value={meeting.id.toString()}>
                    {meeting.title} - {new Date(meeting.date).toLocaleDateString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedMeeting && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-900">{selectedMeeting.title}</h2>
                    <Badge className={getMeetingTypeColor(selectedMeeting.type)}>
                      {selectedMeeting.type.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-600 mt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(selectedMeeting.date).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {selectedMeeting.time}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline">
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Final Agenda
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Upload Final Agenda</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleUploadAgenda} className="space-y-4">
                        <div>
                          <Label htmlFor="agenda-file">Select Agenda File</Label>
                          <Input
                            id="agenda-file"
                            type="file"
                            accept=".pdf,.doc,.docx"
                            onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
                            required
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" onClick={() => setIsUploadModalOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" disabled={uploadAgendaMutation.isPending}>
                            Upload
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Submitted Items for Review */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center">
            <MessageSquare className="text-orange-500 mr-2 w-5 h-5" />
            Submitted Agenda Items
          </h2>
        </div>
        <div className="p-6">
          {selectedMeetingAgendaItems.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              {selectedMeeting ? `No agenda items submitted for ${selectedMeeting.title} yet.` : 'Select a meeting to view agenda items.'}
            </div>
          ) : (
            <div className="space-y-4">
              {selectedMeetingAgendaItems.map((item) => (
                <Card key={item.id} className="border border-slate-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {editingItem === item.id ? (
                          <div className="space-y-2">
                            <Input
                              value={editForm.title}
                              onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                              placeholder="Item title"
                              className="text-base font-semibold"
                            />
                          </div>
                        ) : (
                          <>
                            <CardTitle className="text-base">{item.title}</CardTitle>
                            <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                              <User className="w-3 h-3" />
                              <span>{item.submittedBy}</span>
                              <span>•</span>
                              <span>{new Date(item.submittedAt).toLocaleDateString()}</span>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {editingItem === item.id ? (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleSaveEdit}
                              disabled={editItemMutation.isPending}
                              className="text-green-600 hover:text-green-700"
                            >
                              <Save className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCancelEdit}
                              className="text-gray-600 hover:text-gray-700"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            {getStatusBadge(item.status)}
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditItem(item)}
                                className="text-blue-600 hover:text-blue-700"
                                title="Edit item"
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteItem(item.id)}
                                disabled={deleteItemMutation.isPending}
                                className="text-red-600 hover:text-red-700"
                                title="Delete item"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                              {item.status === "pending" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateItemStatusMutation.mutate({ id: item.id, status: "approved" })}
                                    className="text-green-600 hover:text-green-700"
                                    title="Approve item"
                                  >
                                    <CheckCircle className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateItemStatusMutation.mutate({ id: item.id, status: "rejected" })}
                                    className="text-red-600 hover:text-red-700"
                                    title="Reject item"
                                  >
                                    <XCircle className="w-3 h-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {editingItem === item.id ? (
                      <Textarea
                        value={editForm.description}
                        onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Item description"
                        className="text-sm"
                        rows={3}
                      />
                    ) : (
                      <p className="text-sm text-slate-600">{item.description}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Final Agenda */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center">
            <FileText className="text-green-500 mr-2 w-5 h-5" />
            Final Meeting Agenda
          </h2>
        </div>
        <div className="p-6">
          {selectedMeeting?.finalAgenda ? (
            <div className="bg-slate-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <File className="w-4 h-4 text-slate-600" />
                <span className="text-sm font-medium text-slate-700">Uploaded Agenda</span>
              </div>
              <div className="text-sm text-slate-600">
                Final agenda file has been uploaded and is available for {selectedMeeting.title}.
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              {selectedMeeting ? `No final agenda uploaded for ${selectedMeeting.title} yet.` : 'Select a meeting to view final agenda status.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2, Calendar, Users, AlertCircle, Eye, EyeOff } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Announcement {
  id: number;
  title: string;
  message: string;
  type: 'event' | 'position' | 'alert' | 'general';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  startDate: string;
  endDate: string;
  isActive: boolean;
  link?: string;
  linkText?: string;
  createdAt: string;
  updatedAt: string;
}

export default function AnnouncementManager() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    message: '',
    type: 'general' as const,
    priority: 'medium' as const,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    isActive: true,
    link: '',
    linkText: ''
  });

  // Fetch announcements
  const { data: announcements = [], isLoading } = useQuery<Announcement[]>({
    queryKey: ["/api/announcements"],
  });

  // Create announcement mutation
  const createAnnouncementMutation = useMutation({
    mutationFn: (data: typeof newAnnouncement) => {
      const formattedData = {
        ...data,
        startDate: new Date(data.startDate).toISOString(),
        endDate: new Date(data.endDate).toISOString(),
        link: data.link?.trim() || undefined,
        linkText: data.linkText?.trim() || undefined
      };
      return apiRequest("POST", "/api/announcements", formattedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
      setShowCreateDialog(false);
      resetForm();
      toast({
        title: "Announcement created!",
        description: "The announcement has been added successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create announcement. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update announcement mutation
  const updateAnnouncementMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Announcement> }) => {
      const formattedData = { ...data };
      if (data.startDate) {
        formattedData.startDate = new Date(data.startDate).toISOString();
      }
      if (data.endDate) {
        formattedData.endDate = new Date(data.endDate).toISOString();
      }
      if ('link' in data) {
        formattedData.link = data.link?.trim() || undefined;
      }
      if ('linkText' in data) {
        formattedData.linkText = data.linkText?.trim() || undefined;
      }
      return apiRequest("PATCH", `/api/announcements/${id}`, formattedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
      setEditingAnnouncement(null);
      toast({
        title: "Announcement updated!",
        description: "The announcement has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update announcement. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete announcement mutation
  const deleteAnnouncementMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/announcements/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
      toast({
        title: "Announcement deleted!",
        description: "The announcement has been removed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete announcement. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setNewAnnouncement({
      title: '',
      message: '',
      type: 'general',
      priority: 'medium',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      isActive: true,
      link: '',
      linkText: ''
    });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnouncement.title.trim() || !newAnnouncement.message.trim()) {
      toast({
        title: "Error",
        description: "Title and message are required.",
        variant: "destructive",
      });
      return;
    }
    createAnnouncementMutation.mutate(newAnnouncement);
  };

  const handleEdit = (announcement: Announcement) => {
    setEditingAnnouncement({
      ...announcement,
      startDate: announcement.startDate.split('T')[0],
      endDate: announcement.endDate.split('T')[0]
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAnnouncement) return;
    
    updateAnnouncementMutation.mutate({
      id: editingAnnouncement.id,
      data: editingAnnouncement
    });
  };

  const toggleActive = (id: number, isActive: boolean) => {
    updateAnnouncementMutation.mutate({
      id,
      data: { isActive }
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'event': return <Calendar className="w-4 h-4" />;
      case 'position': return <Users className="w-4 h-4" />;
      case 'alert': return <AlertCircle className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-blue-100 text-blue-800';
      case 'low': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const isCurrentlyActive = (announcement: Announcement) => {
    if (!announcement.isActive) return false;
    const now = new Date();
    const start = new Date(announcement.startDate);
    const end = new Date(announcement.endDate);
    return now >= start && now <= end;
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading announcements...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Announcement Manager</h2>
          <p className="text-slate-600 mt-1">Manage website banners for events and position openings</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Announcement
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Announcement</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={newAnnouncement.title}
                    onChange={(e) => setNewAnnouncement(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Announcement title"
                    required
                  />
                </div>
                
                <div className="col-span-2">
                  <Label htmlFor="message">Message *</Label>
                  <Textarea
                    id="message"
                    value={newAnnouncement.message}
                    onChange={(e) => setNewAnnouncement(prev => ({ ...prev, message: e.target.value }))}
                    placeholder="Announcement message"
                    required
                    rows={3}
                  />
                </div>
                
                <div>
                  <Label htmlFor="type">Type</Label>
                  <Select value={newAnnouncement.type} onValueChange={(value: any) => setNewAnnouncement(prev => ({ ...prev, type: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                      <SelectItem value="position">Position Opening</SelectItem>
                      <SelectItem value="alert">Alert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={newAnnouncement.priority} onValueChange={(value: any) => setNewAnnouncement(prev => ({ ...prev, priority: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={newAnnouncement.startDate}
                    onChange={(e) => setNewAnnouncement(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={newAnnouncement.endDate}
                    onChange={(e) => setNewAnnouncement(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="link">Link (optional)</Label>
                  <Input
                    id="link"
                    value={newAnnouncement.link}
                    onChange={(e) => setNewAnnouncement(prev => ({ ...prev, link: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
                
                <div>
                  <Label htmlFor="linkText">Link Text</Label>
                  <Input
                    id="linkText"
                    value={newAnnouncement.linkText}
                    onChange={(e) => setNewAnnouncement(prev => ({ ...prev, linkText: e.target.value }))}
                    placeholder="Learn More"
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createAnnouncementMutation.isPending}>
                  {createAnnouncementMutation.isPending ? "Creating..." : "Create Announcement"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {announcements.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No announcements</h3>
              <p className="text-slate-500">Create your first announcement to get started.</p>
            </CardContent>
          </Card>
        ) : (
          announcements.map((announcement) => (
            <Card key={announcement.id} className={`${isCurrentlyActive(announcement) ? 'ring-2 ring-blue-500' : ''}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {getTypeIcon(announcement.type)}
                    <div>
                      <CardTitle className="text-lg">{announcement.title}</CardTitle>
                      <CardDescription className="mt-1">{announcement.message}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getPriorityColor(announcement.priority)}>
                      {announcement.priority}
                    </Badge>
                    <div className="flex items-center gap-1">
                      {isCurrentlyActive(announcement) ? (
                        <Eye className="w-4 h-4 text-green-600" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-600">
                    <div>Start: {new Date(announcement.startDate).toLocaleDateString()}</div>
                    <div>End: {new Date(announcement.endDate).toLocaleDateString()}</div>
                    {announcement.link && (
                      <div>Link: <a href={announcement.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{announcement.linkText || 'View'}</a></div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={announcement.isActive}
                        onCheckedChange={(checked) => toggleActive(announcement.id, checked)}
                      />
                      <Label className="text-sm">Active</Label>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(announcement)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteAnnouncementMutation.mutate(announcement.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingAnnouncement} onOpenChange={(open) => !open && setEditingAnnouncement(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Announcement</DialogTitle>
          </DialogHeader>
          {editingAnnouncement && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="edit-title">Title *</Label>
                  <Input
                    id="edit-title"
                    value={editingAnnouncement.title}
                    onChange={(e) => setEditingAnnouncement(prev => prev ? ({ ...prev, title: e.target.value }) : null)}
                    required
                  />
                </div>
                
                <div className="col-span-2">
                  <Label htmlFor="edit-message">Message *</Label>
                  <Textarea
                    id="edit-message"
                    value={editingAnnouncement.message}
                    onChange={(e) => setEditingAnnouncement(prev => prev ? ({ ...prev, message: e.target.value }) : null)}
                    required
                    rows={3}
                  />
                </div>
                
                <div>
                  <Label htmlFor="edit-type">Type</Label>
                  <Select value={editingAnnouncement.type} onValueChange={(value: any) => setEditingAnnouncement(prev => prev ? ({ ...prev, type: value }) : null)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                      <SelectItem value="position">Position Opening</SelectItem>
                      <SelectItem value="alert">Alert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="edit-priority">Priority</Label>
                  <Select value={editingAnnouncement.priority} onValueChange={(value: any) => setEditingAnnouncement(prev => prev ? ({ ...prev, priority: value }) : null)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="edit-startDate">Start Date</Label>
                  <Input
                    id="edit-startDate"
                    type="date"
                    value={editingAnnouncement.startDate}
                    onChange={(e) => setEditingAnnouncement(prev => prev ? ({ ...prev, startDate: e.target.value }) : null)}
                  />
                </div>
                
                <div>
                  <Label htmlFor="edit-endDate">End Date</Label>
                  <Input
                    id="edit-endDate"
                    type="date"
                    value={editingAnnouncement.endDate}
                    onChange={(e) => setEditingAnnouncement(prev => prev ? ({ ...prev, endDate: e.target.value }) : null)}
                  />
                </div>
                
                <div>
                  <Label htmlFor="edit-link">Link (optional)</Label>
                  <Input
                    id="edit-link"
                    value={editingAnnouncement.link || ''}
                    onChange={(e) => setEditingAnnouncement(prev => prev ? ({ ...prev, link: e.target.value }) : null)}
                    placeholder="https://..."
                  />
                </div>
                
                <div>
                  <Label htmlFor="edit-linkText">Link Text</Label>
                  <Input
                    id="edit-linkText"
                    value={editingAnnouncement.linkText || ''}
                    onChange={(e) => setEditingAnnouncement(prev => prev ? ({ ...prev, linkText: e.target.value }) : null)}
                    placeholder="Learn More"
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setEditingAnnouncement(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateAnnouncementMutation.isPending}>
                  {updateAnnouncementMutation.isPending ? "Updating..." : "Update Announcement"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
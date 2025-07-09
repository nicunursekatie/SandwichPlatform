import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Calendar, Clock, MapPin, Users, Plus, Filter, Upload, FileText, Edit, Trash2, Video } from "lucide-react";
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

interface Meeting {
  id: number;
  title: string;
  type: string;
  date: string;
  time: string;
  location?: string;
  description?: string;
  status: "planning" | "agenda_set" | "completed";
  finalAgenda?: string;
}

const meetingTypes = [
  { value: "weekly", label: "Weekly Team Meeting", color: "bg-blue-100 text-blue-800" },
  { value: "marketing_committee", label: "Marketing Committee", color: "bg-purple-100 text-purple-800" },
  { value: "grant_committee", label: "Grant Committee", color: "bg-green-100 text-green-800" },
  { value: "core_group", label: "Core Group Meeting", color: "bg-orange-100 text-orange-800" },
  { value: "all_team", label: "All Team Meeting", color: "bg-red-100 text-red-800" }
];

export default function MeetingsCalendar() {
  const { toast } = useToast();
  const [selectedType, setSelectedType] = useState<string>("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [newMeeting, setNewMeeting] = useState({
    title: "",
    type: "",
    date: "",
    time: "",
    location: "",
    description: ""
  });

  const { data: allMeetings = [], isLoading } = useQuery({
    queryKey: ['/api/meetings'],
    queryFn: () => fetch('/api/meetings').then(res => res.json())
  });

  const createMeetingMutation = useMutation({
    mutationFn: async (data: typeof newMeeting) => {
      const response = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to create meeting');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
      setNewMeeting({ title: "", type: "", date: "", time: "", location: "", description: "" });
      setIsCreateModalOpen(false);
      toast({
        title: "Meeting created",
        description: "New meeting has been scheduled successfully.",
      });
    }
  });

  const uploadAgendaMutation = useMutation({
    mutationFn: async ({ meetingId, file }: { meetingId: number; file: File }) => {
      const formData = new FormData();
      formData.append('agenda', file);
      const response = await fetch(`/api/meetings/${meetingId}/upload-agenda`, {
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
      setSelectedMeeting(null);
      toast({
        title: "Agenda uploaded",
        description: "The meeting agenda has been uploaded successfully.",
      });
    }
  });

  const handleCreateMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMeeting.title || !newMeeting.type || !newMeeting.date || !newMeeting.time) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }
    createMeetingMutation.mutate(newMeeting);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const handleUploadAgenda = () => {
    if (uploadedFile && selectedMeeting) {
      uploadAgendaMutation.mutate({ meetingId: selectedMeeting.id, file: uploadedFile });
    }
  };

  const getTypeConfig = (type: string) => {
    return meetingTypes.find(t => t.value === type) || { value: type, label: type, color: "bg-gray-100 text-gray-800" };
  };

  const filteredMeetings = selectedType === "all" 
    ? allMeetings 
    : allMeetings.filter((meeting: Meeting) => meeting.type === selectedType);

  const upcomingMeetings = filteredMeetings.filter((meeting: Meeting) => 
    new Date(meeting.date) >= new Date()
  ).sort((a: Meeting, b: Meeting) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const pastMeetings = filteredMeetings.filter((meeting: Meeting) => 
    new Date(meeting.date) < new Date()
  ).sort((a: Meeting, b: Meeting) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading meetings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Meetings Calendar</h1>
          <p className="text-slate-600">Schedule meetings and upload agendas for your team</p>
        </div>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
              <Plus className="w-5 h-5" />
              Schedule New Meeting
            </Button>
          </DialogTrigger>
          <DialogContent aria-describedby="create-meeting-description">
            <DialogHeader>
              <DialogTitle>Schedule New Meeting</DialogTitle>
            </DialogHeader>
            <p id="create-meeting-description" className="text-sm text-slate-600 mb-6">
              Schedule a new meeting for your team or committee. All fields marked with * are required.
            </p>
            <form onSubmit={handleCreateMeeting} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="meeting-title" className="text-sm font-medium text-slate-700">Meeting Title *</Label>
                  <Input
                    id="meeting-title"
                    value={newMeeting.title}
                    onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })}
                    placeholder="e.g., Weekly Team Sync"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="meeting-type" className="text-sm font-medium text-slate-700">Meeting Type *</Label>
                  <Select value={newMeeting.type} onValueChange={(value) => setNewMeeting({ ...newMeeting, type: value })}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Choose type" />
                    </SelectTrigger>
                    <SelectContent>
                      {meetingTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="meeting-date" className="text-sm font-medium text-slate-700">Date *</Label>
                  <Input
                    id="meeting-date"
                    type="date"
                    value={newMeeting.date}
                    onChange={(e) => setNewMeeting({ ...newMeeting, date: e.target.value })}
                    className="mt-1"
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <Label htmlFor="meeting-time" className="text-sm font-medium text-slate-700">Time *</Label>
                  <Input
                    id="meeting-time"
                    type="time"
                    value={newMeeting.time}
                    onChange={(e) => setNewMeeting({ ...newMeeting, time: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="meeting-location" className="text-sm font-medium text-slate-700">Location / Google Meet Link (optional)</Label>
                <Input
                  id="meeting-location"
                  value={newMeeting.location}
                  onChange={(e) => setNewMeeting({ ...newMeeting, location: e.target.value })}
                  placeholder="e.g., https://meet.google.com/xyz-abc-def or Conference Room A"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="meeting-description" className="text-sm font-medium text-slate-700">Description (optional)</Label>
                <Textarea
                  id="meeting-description"
                  value={newMeeting.description}
                  onChange={(e) => setNewMeeting({ ...newMeeting, description: e.target.value })}
                  placeholder="Brief description of meeting topics or agenda items"
                  className="mt-1"
                  rows={3}
                />
              </div>
              
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMeetingMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                  {createMeetingMutation.isPending ? "Scheduling..." : "Schedule Meeting"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700">Filter by type:</span>
          </div>
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select meeting type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Meetings</SelectItem>
              {meetingTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm text-slate-600">
          {filteredMeetings.length} meeting{filteredMeetings.length !== 1 ? 's' : ''} found
        </div>
      </div>

      {/* Upcoming Meetings */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Upcoming Meetings</h2>
        {upcomingMeetings.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
            <Calendar className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-slate-900 mb-2">No upcoming meetings</h3>
            <p className="text-slate-500 mb-6 max-w-md mx-auto">
              {selectedType === "all" 
                ? "Ready to schedule your first meeting? Click the button below to get started."
                : `No upcoming ${getTypeConfig(selectedType).label.toLowerCase()} meetings found. Schedule a new one to get organized.`
              }
            </p>
            <Button 
              size="lg" 
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-5 h-5 mr-2" />
              Schedule Your First Meeting
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {upcomingMeetings.map((meeting: Meeting) => {
              const typeConfig = getTypeConfig(meeting.type);
              return (
                <Card key={meeting.id} className="border border-slate-200 hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base font-semibold text-slate-900 mb-1">
                          {meeting.title}
                        </CardTitle>
                        <Badge className={`${typeConfig.color} text-xs mb-2`}>
                          {typeConfig.label}
                        </Badge>
                      </div>
                      <Badge variant={meeting.status === "completed" ? "default" : meeting.status === "agenda_set" ? "secondary" : "outline"}>
                        {meeting.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2 text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {new Date(meeting.date).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {meeting.time}
                      </div>
                      {meeting.location && (
                        <div className="flex items-center gap-2">
                          {meeting.location.includes('meet.google.com') ? (
                            <>
                              <Video className="w-4 h-4" />
                              <a 
                                href={meeting.location} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 underline"
                              >
                                Join Google Meet
                              </a>
                            </>
                          ) : (
                            <>
                              <MapPin className="w-4 h-4" />
                              {meeting.location}
                            </>
                          )}
                        </div>
                      )}
                      {meeting.description && (
                        <p className="text-slate-600 text-sm mt-2 line-clamp-2">
                          {meeting.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedMeeting(meeting);
                            setIsUploadModalOpen(true);
                          }}
                          className="flex items-center gap-1"
                        >
                          <Upload className="w-3 h-3" />
                          Upload Agenda
                        </Button>
                        {meeting.finalAgenda && (
                          <Badge variant="secondary" className="text-xs">
                            <FileText className="w-3 h-3 mr-1" />
                            Agenda Ready
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Past Meetings */}
      {pastMeetings.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Past Meetings</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pastMeetings.slice(0, 6).map((meeting: Meeting) => {
              const typeConfig = getTypeConfig(meeting.type);
              return (
                <Card key={meeting.id} className="border border-slate-200 opacity-75">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base font-semibold text-slate-900 mb-1">
                          {meeting.title}
                        </CardTitle>
                        <Badge className={`${typeConfig.color} text-xs`}>
                          {typeConfig.label}
                        </Badge>
                      </div>
                      <Badge variant="secondary">Completed</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2 text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {new Date(meeting.date).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {meeting.time}
                      </div>
                      {meeting.finalAgenda && (
                        <Badge variant="outline" className="text-xs mt-2">
                          <FileText className="w-3 h-3 mr-1" />
                          Agenda Available
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Upload Agenda Modal */}
      <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
        <DialogContent className="sm:max-w-md" aria-describedby="upload-agenda-description">
          <DialogHeader>
            <DialogTitle>Upload Meeting Agenda</DialogTitle>
          </DialogHeader>
          <p id="upload-agenda-description" className="text-sm text-slate-600 mb-4">
            Upload the agenda file for {selectedMeeting?.title}.
          </p>
          <div className="space-y-4">
            <div>
              <Label htmlFor="agenda-upload">Agenda File</Label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-gray-400 transition-colors">
                <div className="space-y-1 text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600">
                    <label
                      htmlFor="agenda-upload"
                      className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none"
                    >
                      <span>Upload agenda file</span>
                      <input
                        id="agenda-upload"
                        name="agenda-upload"
                        type="file"
                        className="sr-only"
                        accept=".pdf,.doc,.docx,.txt"
                        onChange={handleFileChange}
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">PDF, DOC, DOCX, TXT up to 10MB</p>
                </div>
              </div>
              {uploadedFile && (
                <p className="mt-2 text-sm text-green-600">Selected: {uploadedFile.name}</p>
              )}
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsUploadModalOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleUploadAgenda} 
                disabled={!uploadedFile || uploadAgendaMutation.isPending}
              >
                {uploadAgendaMutation.isPending ? "Uploading..." : "Upload Agenda"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
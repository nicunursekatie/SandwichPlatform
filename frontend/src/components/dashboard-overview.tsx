import { useQuery } from "@tanstack/react-query";
import { ListTodo, MessageCircle, ClipboardList, FolderOpen, BarChart3, Users, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import SandwichCollectionForm from "@/components/sandwich-collection-form";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, PERMISSIONS } from "@shared/auth-utils";
import type { Project, Message, MeetingMinutes, DriveLink, WeeklyReport, SandwichCollection, Meeting } from "@shared/schema";

interface DashboardOverviewProps {
  onSectionChange: (section: string) => void;
}

export default function DashboardOverview({ onSectionChange }: DashboardOverviewProps) {
  const { user } = useAuth();
  
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: hasPermission(user, PERMISSIONS.VIEW_PROJECTS)
  });

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/messages"],
    enabled: hasPermission(user, PERMISSIONS.GENERAL_CHAT)
  });

  const { data: driveLinks = [] } = useQuery<DriveLink[]>({
    queryKey: ["/api/drive-links"]
  });

  const { data: reports = [] } = useQuery<WeeklyReport[]>({
    queryKey: ["/api/weekly-reports"],
    enabled: hasPermission(user, PERMISSIONS.VIEW_REPORTS)
  });

  const { data: meetings = [] } = useQuery<Meeting[]>({
    queryKey: ["/api/meetings"],
    enabled: hasPermission(user, PERMISSIONS.VIEW_MEETINGS)
  });

  const { data: statsData } = useQuery({
    queryKey: ["/api/sandwich-collections/stats"],
    queryFn: async () => {
      const response = await fetch('/api/sandwich-collections/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
    staleTime: 0, // Always fetch fresh data to show corrected totals
    refetchOnWindowFocus: true
  });

  const getProjectStatusCounts = () => {
    const counts = {
      available: 0,
      in_progress: 0,
      planning: 0,
      completed: 0,
    };
    
    projects.forEach(project => {
      if (counts.hasOwnProperty(project.status)) {
        counts[project.status as keyof typeof counts]++;
      }
    });
    
    return counts;
  };

  const statusCounts = getProjectStatusCounts();
  const totalSandwiches = reports.reduce((sum, report) => sum + report.sandwichCount, 0);
  const totalCollectedSandwiches = statsData?.completeTotalSandwiches || 0;
  const activeProjects = projects.filter(p => p.status === "in_progress" || p.status === "available" || p.status === "planning");
  const recentMessages = messages.slice(0, 3);

  
  // Filter upcoming meetings (not completed and future or current dates)
  const upcomingMeetings = meetings
    .filter(meeting => meeting.status !== "completed")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 3);

  return (
    <div className="space-y-6 font-body">
      {/* Total Collections Card */}
      <div className="bg-gradient-to-r from-primary to-brand-teal rounded-lg shadow-md p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-sub-heading">Total Collections</h3>
            <p className="text-xl font-main-heading">{totalCollectedSandwiches.toLocaleString()}</p>
            <p className="text-xs font-body text-white/80">sandwiches collected</p>
          </div>
          <div className="bg-white bg-opacity-20 p-2 rounded-full">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Sandwich Collection Form */}
      <SandwichCollectionForm />



      {/* Active Projects - Only show if user has permission */}
      {hasPermission(user, PERMISSIONS.VIEW_PROJECTS) && (
        <div className="bg-card rounded-lg border border-border">
          <div className="px-4 py-3 border-b border-border flex justify-between items-center">
            <h2 className="text-base font-sub-heading text-primary">Active Projects</h2>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onSectionChange("projects")}
              className="text-xs px-2 py-1"
            >
              View All
            </Button>
          </div>
          <div className="p-4">
            <div className="space-y-2">
              {activeProjects.map((project) => (
                <div 
                  key={project.id} 
                  className="p-2 border border-slate-200 rounded hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => onSectionChange("projects")}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-sm font-medium text-slate-900">{project.title}</h3>
                      <p className="text-xs text-slate-600">{project.description}</p>
                    </div>
                    <span className="text-xs text-slate-500">
                      {project.status === "in_progress" ? "In Progress" : 
                       project.status === "available" ? "Available" : "Planning"}
                    </span>
                  </div>
                </div>
              ))}
              
              {activeProjects.length === 0 && (
                <p className="text-slate-500 text-center py-3 text-sm">No active projects</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upcoming Meetings - Only show if user has permission */}
      {hasPermission(user, PERMISSIONS.VIEW_MEETINGS) && (
        <div className="bg-white rounded-lg border border-slate-200">
          <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-base font-semibold text-slate-900">Upcoming Meetings</h2>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onSectionChange("meetings")}
              className="text-xs px-2 py-1"
            >
              View All
            </Button>
          </div>
          <div className="p-4">
            <div className="space-y-2">
              {upcomingMeetings.map((meeting) => (
                <div 
                  key={meeting.id} 
                  className="p-2 border border-slate-200 rounded hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => onSectionChange("meetings")}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-sm font-medium text-slate-900">{meeting.title}</h3>
                      <p className="text-xs text-slate-600">
                        {new Date(meeting.date).toLocaleDateString()} at {meeting.time}
                      </p>
                      {meeting.location && (
                        <p className="text-xs text-slate-500 mt-1">📍 {meeting.location}</p>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 capitalize">
                      {meeting.status === "planning" ? "Planning" : 
                       meeting.status === "agenda_set" ? "Agenda Set" : meeting.status}
                    </span>
                  </div>
                </div>
              ))}
              
              {upcomingMeetings.length === 0 && (
                <p className="text-slate-500 text-center py-3 text-sm">No upcoming meetings</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recent Messages - Only show if user has permission */}
      {hasPermission(user, PERMISSIONS.GENERAL_CHAT) && (
        <div className="bg-white rounded-lg border border-slate-200">
          <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-base font-semibold text-slate-900">Recent Messages</h2>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onSectionChange("messages")}
              className="text-xs px-2 py-1"
            >
              View All
            </Button>
          </div>
          <div className="p-4">
            <div className="space-y-2">
              {recentMessages.map((message) => (
                <div 
                  key={message.id} 
                  className="p-2 border border-slate-200 rounded hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => onSectionChange("messages")}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-sm font-medium text-slate-900">{message.sender}</span>
                    <span className="text-xs text-slate-500">
                      {new Date(message.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    {message.content.length > 60 
                      ? message.content.substring(0, 60) + "..." 
                      : message.content}
                  </p>
                </div>
              ))}
              
              {recentMessages.length === 0 && (
                <p className="text-slate-500 text-center py-3 text-sm">No recent messages</p>
              )}
            </div>
          </div>
        </div>
      )}



    </div>
  );
}
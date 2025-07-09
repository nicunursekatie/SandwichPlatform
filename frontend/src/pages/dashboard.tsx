import { Sandwich, LogOut, LayoutDashboard, ListTodo, MessageCircle, ClipboardList, FolderOpen, BarChart3, TrendingUp, Users, Car, Building2, FileText, Phone, ChevronDown, ChevronRight, Menu, X, UserCog } from "lucide-react";
import sandwichLogo from "@assets/LOGOS/sandwich logo.png";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProjectList from "@/components/project-list";
import WeeklySandwichForm from "@/components/weekly-sandwich-form";
import ChatHub from "@/components/chat-hub";
import CommitteeChat from "@/components/committee-chat";
import GoogleDriveLinks from "@/components/google-drive-links";
import DashboardOverview from "@/components/dashboard-overview";
import SandwichCollectionLog from "@/components/sandwich-collection-log";
import RecipientsManagement from "@/components/recipients-management";
import DriversManagement from "@/components/drivers-management";
import HostsManagement from "@/components/hosts-management-consolidated";
import { DocumentsBrowser } from "@/components/documents-browser";
import PhoneDirectory from "@/components/phone-directory";
import BulkDataManager from "@/components/bulk-data-manager";
import AnalyticsDashboard from "@/components/analytics-dashboard";
import Development from "@/pages/development";
import MeetingsLandingPage from "@/pages/meetings";
import MeetingMinutesPage from "@/pages/meeting-minutes";
import MeetingAgendaPage from "@/pages/meeting-agenda";
import MeetingCalendarPage from "@/pages/meeting-calendar";
import RoleDemo from "@/pages/role-demo";
import ProjectsClean from "@/pages/projects-clean";
import ProjectDetailClean from "@/pages/project-detail-clean";
import Analytics from "@/pages/analytics";
import ImpactDashboard from "@/pages/impact-dashboard";
import DataManagement from "@/pages/data-management";
import PerformanceDashboard from "@/pages/performance-dashboard";
import ReportingDashboard from "@/pages/reporting-dashboard";
import UserManagement from "@/components/user-management";
import UserProfile from "@/components/user-profile";
import { useState } from "react";
import * as React from "react";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, PERMISSIONS } from "@shared/auth-utils";
import { queryClient } from "@/lib/queryClient";
import SimpleNav from "@/components/simple-nav";
import AnnouncementBanner from "@/components/announcement-banner";
import MessageNotifications from "@/components/message-notifications";
import WorkLogPage from "@/pages/work-log";

export default function Dashboard({ initialSection = "dashboard" }: { initialSection?: string }) {
  const [activeSection, setActiveSection] = useState(initialSection);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user } = useAuth();

  // Make setActiveSection available globally for embedded components
  React.useEffect(() => {
    (window as any).dashboardSetActiveSection = setActiveSection;
    
    // Check URL params on load for direct navigation
    const urlParams = new URLSearchParams(window.location.search);
    const section = urlParams.get('section');
    if (section) {
      setActiveSection(section);
    }
    
    return () => {
      delete (window as any).dashboardSetActiveSection;
    };
  }, []);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  // Simplified navigation structure
  const navigationItems = [
    // Core section
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "collections", label: "Collections", icon: Sandwich },
    { id: "messages", label: "Messages", icon: MessageCircle },
    
    // Data section (filtered by permissions)
    ...(hasPermission(user, PERMISSIONS.VIEW_HOSTS) ? [{ id: "hosts", label: "Hosts", icon: Building2 }] : []),
    ...(hasPermission(user, PERMISSIONS.VIEW_RECIPIENTS) ? [{ id: "recipients", label: "Recipients", icon: Users }] : []),
    ...(hasPermission(user, PERMISSIONS.VIEW_DRIVERS) ? [{ id: "drivers", label: "Drivers", icon: Car }] : []),
    
    // Operations section
    ...(hasPermission(user, PERMISSIONS.VIEW_MEETINGS) ? [{ id: "meetings", label: "Meetings", icon: ClipboardList }] : []),
    ...(hasPermission(user, PERMISSIONS.VIEW_ANALYTICS) ? [{ id: "analytics", label: "Analytics", icon: BarChart3 }] : []),
    ...(hasPermission(user, PERMISSIONS.VIEW_REPORTS) ? [{ id: "reports", label: "Reports", icon: FileText }] : []),
    ...(hasPermission(user, PERMISSIONS.VIEW_PROJECTS) ? [{ id: "projects", label: "Projects", icon: ListTodo }] : []),
    
    // Communication section
    ...(hasPermission(user, PERMISSIONS.VIEW_COMMITTEE) ? [{ id: "committee", label: "Committee", icon: MessageCircle }] : []),
    { id: "directory", label: "Directory", icon: Phone },
    
    // Resources section
    { id: "toolkit", label: "Toolkit", icon: FolderOpen },
    { id: "development", label: "Development", icon: FileText },
    { id: "work-log", label: "Work Log", icon: ClipboardList },
    
    // Admin section
    ...(hasPermission(user, PERMISSIONS.MANAGE_USERS) ? [{ id: "user-management", label: "Admin", icon: UserCog }] : []),
  ];

  // Navigation is already filtered by permissions above

  const renderContent = () => {
    // Extract project ID from activeSection if it's a project detail page
    const projectIdMatch = activeSection.match(/^project-(\d+)$/);
    const projectId = projectIdMatch ? parseInt(projectIdMatch[1]) : null;

    switch (activeSection) {
      case "dashboard":
        return <DashboardOverview onSectionChange={setActiveSection} />;
      case "projects":
        return <ProjectsClean />;
      case "messages":
        return <ChatHub />;
      case "profile":
        return <UserProfile />;
      case "meetings":
        return <MeetingsLandingPage onNavigate={setActiveSection} />;
      case "minutes":
        return <MeetingMinutesPage />;
      case "agenda":
        return <MeetingAgendaPage />;
      case "calendar":
        return <MeetingCalendarPage />;
      case "reports":
        return <ReportingDashboard isEmbedded={true} />;
      case "toolkit":
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-xl">
                <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-main-heading text-primary dark:text-secondary">Group Toolkit</h1>
                <p className="font-body text-muted-foreground">Essential training documents and resources</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  title: "Summer Food Safety Guidelines",
                  description: "Important summer food safety guidelines for home hosts",
                  path: "/attached_assets/Summer Food Safety Guidelines_1751569876472.pdf",
                  category: "Safety"
                },
                {
                  title: "Food Safety Volunteers Guide",
                  description: "Essential food safety guidelines for all volunteers",
                  path: "/documents/20230525-TSP-Food Safety Volunteers.pdf",
                  category: "Safety"
                },
                {
                  title: "Deli Sandwich Making 101",
                  description: "Step-by-step guide for preparing deli sandwiches",
                  path: "/documents/20240622-TSP-Deli Sandwich Making 101.pdf",
                  category: "Training"
                },
                {
                  title: "PBJ Sandwich Making 101", 
                  description: "Instructions for peanut butter and jelly sandwich preparation",
                  path: "/documents/20250622-TSP-PBJ Sandwich Making 101.pdf",
                  category: "Training"
                },
                {
                  title: "Deli Labels",
                  description: "Printable labels for deli sandwich packaging",
                  path: "/documents/Deli labels.pdf",
                  category: "Resources"
                },
                {
                  title: "PBJ Labels",
                  description: "Printable labels for PBJ sandwich packaging", 
                  path: "/documents/Pbj labels.pdf",
                  category: "Resources"
                },
                {
                  title: "Sandwich Inventory List",
                  description: "Current inventory tracking spreadsheet for 3 oz portions",
                  path: "/documents/TSP Sandwich Inventory List for 3 ozs.xlsx",
                  category: "Operations"
                },
                {
                  title: "501c3 Determination Letter",
                  description: "Official nonprofit status documentation",
                  path: "/documents/501c3-determination-letter.pdf",
                  category: "Legal"
                }
              ].map((doc, index) => (
                <div
                  key={index}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{doc.title}</h3>
                        <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                          doc.category === 'Safety' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' :
                          doc.category === 'Training' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' :
                          doc.category === 'Resources' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                          'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
                        }`}>
                          {doc.category}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{doc.description}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = doc.path;
                        link.download = doc.title;
                        link.click();
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      Download
                    </button>
                    <button
                      onClick={() => window.open(doc.path, '_blank')}
                      className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case "collections":
        return <SandwichCollectionLog />;
      case "hosts":
        return <HostsManagement />;
      case "recipients":
        return <RecipientsManagement />;
      case "drivers":
        return <DriversManagement />;
      case "phone-directory":
        return <PhoneDirectory />;
      case "analytics":
        return (
          <div className="p-6">
            <div className="mb-6">
              <h1 className="text-2xl font-main-heading text-primary dark:text-secondary">Analytics Dashboard</h1>
              <p className="font-body text-muted-foreground">Data insights and impact visualization</p>
            </div>
            <Tabs defaultValue="data" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="data">Data Analytics</TabsTrigger>
                <TabsTrigger value="impact">Impact Dashboard</TabsTrigger>
              </TabsList>
              <TabsContent value="data" className="mt-6">
                <AnalyticsDashboard />
              </TabsContent>
              <TabsContent value="impact" className="mt-6">
                <ImpactDashboard />
              </TabsContent>
            </Tabs>
          </div>
        );
      case "role-demo":
        return <RoleDemo />;
      case "work-log":
        return <WorkLogPage />;

      case "committee":
      case "committee-chat":
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl" style={{backgroundColor: 'var(--tsp-teal-light)'}}>
                <MessageCircle className="w-6 h-6" style={{color: 'var(--tsp-teal)'}} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Committee Communications</h1>
                <p className="text-gray-600 dark:text-gray-300">Internal committee discussions and collaboration</p>
              </div>
            </div>
            <CommitteeChat />
          </div>
        );
      case "user-management":
        return <UserManagement />;
      case "development":
        return <Development />;
      default:
        // Handle project detail pages
        if (projectId) {
          return <ProjectDetailClean projectId={projectId} onBack={() => setActiveSection("projects")} />;
        }
        // Handle legacy project routes
        if (activeSection.startsWith("project-")) {
          const legacyProjectId = parseInt(activeSection.replace("project-", ""));
          if (!isNaN(legacyProjectId)) {
            return <ProjectDetailClean projectId={legacyProjectId} onBack={() => setActiveSection("projects")} />;
          }
        }
        return <DashboardOverview onSectionChange={setActiveSection} />;
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen flex flex-col">
      {/* Announcement Banner */}
      <AnnouncementBanner />
      
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          {/* Mobile menu button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <img src={sandwichLogo} alt="Sandwich Logo" className="w-6 h-6" />
          <h1 className="text-lg font-semibold text-slate-900 hidden sm:block">The Sandwich Project</h1>
          <h1 className="text-sm font-semibold text-slate-900 sm:hidden">TSP</h1>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-4">
          <button
            onClick={() => setActiveSection("messages")}
            className={`p-2 rounded-lg transition-colors ${
              activeSection === "messages"
                ? "bg-blue-50 text-blue-700 border border-blue-200"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
            title="Messages"
          >
            <MessageCircle className="w-5 h-5" />
          </button>
          <MessageNotifications user={user} />
          <button
            onClick={() => setActiveSection("profile")}
            className={`p-2 rounded-lg transition-colors ${
              activeSection === "profile"
                ? "bg-blue-50 text-blue-700 border border-blue-200"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
            title="Account Settings"
          >
            <UserCog className="w-5 h-5" />
          </button>
          <button 
            onClick={async () => {
              try {
                // Call logout API to clear session
                await fetch('/api/logout', {
                  method: 'POST',
                  credentials: 'include'
                });
                // Clear query cache
                queryClient.clear();
                // Redirect to landing page
                window.location.href = "/";
              } catch (error) {
                console.error('Logout error:', error);
                // Fallback: clear cache and redirect anyway
                queryClient.clear();
                window.location.href = "/";
              }
            }}
            className="flex items-center space-x-2 px-2 sm:px-3 py-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm hidden sm:block">Logout</span>
          </button>
        </div>
      </div>

      <div className="flex flex-1 relative">
        {/* Mobile overlay */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
        
        {/* Sidebar */}
        <div className={`${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 fixed md:relative z-50 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 ease-in-out h-screen max-h-screen`}>
          {/* Simple Navigation with enhanced mobile scrolling */}
          <div className="flex-1 overflow-y-auto pb-6 touch-pan-y">
            <SimpleNav onSectionChange={setActiveSection} />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto w-full md:w-auto">
          <div className="p-4 sm:p-6 pb-20">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}

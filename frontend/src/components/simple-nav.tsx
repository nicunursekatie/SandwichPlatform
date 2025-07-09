import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Sandwich, 
  LayoutDashboard, 
  ListTodo, 
  MessageCircle, 
  ClipboardList, 
  FolderOpen, 
  BarChart3, 
  Users, 
  Car, 
  Building2, 
  FileText, 
  Phone,
  Settings,
  Sheet
} from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, PERMISSIONS } from "@shared/auth-utils";

interface NavigationItem {
  id: string;
  label: string;
  icon: any;
  href: string;
  permission?: string;
  group?: string;
}

export default function SimpleNav({ onSectionChange }: { onSectionChange: (section: string) => void }) {
  const { user } = useAuth();
  const [location] = useLocation();

  // Flat navigation with smart grouping using visual separators
  const navigationItems: NavigationItem[] = [
    // Core section
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "dashboard" },
    { id: "collections", label: "Collections", icon: Sandwich, href: "collections" },
    
    // Data section (filtered by permissions)
    ...(hasPermission(user, PERMISSIONS.VIEW_HOSTS) ? [{ id: "hosts", label: "Hosts", icon: Building2, href: "hosts", group: "data" }] : []),
    ...(hasPermission(user, PERMISSIONS.VIEW_RECIPIENTS) ? [{ id: "recipients", label: "Recipients", icon: Users, href: "recipients", group: "data" }] : []),
    ...(hasPermission(user, PERMISSIONS.VIEW_DRIVERS) ? [{ id: "drivers", label: "Drivers", icon: Car, href: "drivers", group: "data" }] : []),
    
    // Operations section (filtered by permissions)
    ...(hasPermission(user, PERMISSIONS.VIEW_MEETINGS) ? [{ id: "meetings", label: "Meetings", icon: ClipboardList, href: "meetings", group: "ops" }] : []),
    ...(hasPermission(user, PERMISSIONS.VIEW_ANALYTICS) ? [{ id: "analytics", label: "Analytics", icon: BarChart3, href: "analytics", group: "ops" }] : []),
    ...(hasPermission(user, PERMISSIONS.VIEW_REPORTS) ? [{ id: "reports", label: "Reports", icon: FileText, href: "reports", group: "ops" }] : []),
    ...(hasPermission(user, PERMISSIONS.VIEW_PROJECTS) ? [{ id: "projects", label: "Projects", icon: ClipboardList, href: "projects", group: "ops" }] : []),
    
    // Communication section  
    ...(hasPermission(user, PERMISSIONS.VIEW_COMMITTEE) ? [{ id: "committee-chat", label: "Committee", icon: MessageCircle, href: "committee-chat", group: "comm" }] : []),
    { id: "messages", label: "Messages", icon: MessageCircle, href: "messages", group: "comm" },
    { id: "phone-directory", label: "Directory", icon: Phone, href: "phone-directory", group: "comm" },
    
    // Resources section
    { id: "toolkit", label: "Toolkit", icon: FolderOpen, href: "toolkit", group: "resources" },
    { id: "development", label: "Development", icon: FileText, href: "development", group: "resources" },
    ...(hasPermission(user, 'log_work') ? [{ id: "work-log", label: "Work Log", icon: ListTodo, href: "work-log", group: "resources" }] : []),
    
    // Admin section (filtered by permissions)
    ...(hasPermission(user, PERMISSIONS.MANAGE_USERS) ? [{ id: "user-management", label: "Admin", icon: Settings, href: "user-management", group: "admin" }] : [])
  ];

  const isActive = (href: string) => {
    // For dashboard, check if we're on root or dashboard
    if (href === "dashboard") return location === "/" || location === "/dashboard";
    return location === `/${href}`;
  };

  // Group items for visual separation
  const groupedItems = navigationItems.reduce((acc, item, index) => {
    const prevItem = navigationItems[index - 1];
    const showSeparator = prevItem && prevItem.group !== item.group && item.group;
    
    if (showSeparator) {
      acc.push({ type: 'separator', group: item.group });
    }
    acc.push({ type: 'item', ...item });
    return acc;
  }, [] as any[]);

  const getGroupLabel = (group: string) => {
    const labels = {
      data: "Data",
      ops: "Operations", 
      comm: "Communication",
      resources: "Resources",
      admin: "Admin"
    };
    return labels[group as keyof typeof labels] || group;
  };

  return (
    <nav className="space-y-1 p-4 pb-8">
      {groupedItems.map((item, index) => {
        if (item.type === 'separator') {
          return (
            <div key={`sep-${index}`} className="pt-4 pb-2">
              <div className="flex items-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                <div className="h-px bg-slate-200 flex-1 mr-3" />
                {getGroupLabel(item.group)}
              </div>
            </div>
          );
        }

        const isCurrentlyActive = isActive(item.href);
        
        return (
          <Button
            key={item.id}
            variant={isCurrentlyActive ? "default" : "ghost"}
            className={`
              w-full justify-start text-left h-10 px-3
              ${isCurrentlyActive 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "hover:bg-slate-100 text-slate-700"
              }
            `}
            onClick={() => onSectionChange(item.href)}
          >
            <item.icon className="h-4 w-4 mr-3 flex-shrink-0" />
            <span className="truncate">{item.label}</span>
          </Button>
        );
      })}
    </nav>
  );
}
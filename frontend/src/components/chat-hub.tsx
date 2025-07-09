import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import MessageLog from "@/components/message-log";
import CommitteeChat from "@/components/committee-chat";
import HostChat from "@/components/host-chat";
import DriverChat from "@/components/driver-chat";
import RecipientChat from "@/components/recipient-chat";
import CoreTeamChat from "@/components/core-team-chat";
import { GroupMessaging } from "@/components/group-messaging";
import DirectMessaging from "@/components/direct-messaging";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, USER_ROLES, PERMISSIONS } from "@shared/auth-utils";
import {
  MessageSquare,
  Users,
  Building2,
  Truck,
  Heart,
  Shield,
  Mail,
  UsersRound,
  ChevronLeft,
  ChevronRight,
  Hash,
} from "lucide-react";

interface ChatChannel {
  value: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  component: React.ReactNode;
  badge?: string;
  color: string;
}

export default function ChatHub() {
  const { user } = useAuth();
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Determine available chat channels based on user role
  const availableChannels: ChatChannel[] = [];

  if (hasPermission(user, PERMISSIONS.GENERAL_CHAT)) {
    availableChannels.push({
      value: "general",
      label: "General Chat",
      description: "Open discussion for all team members",
      icon: <MessageSquare className="h-4 w-4" />,
      component: <MessageLog />,
      color: "bg-primary/10 text-primary",
    });
  }

  if (hasPermission(user, PERMISSIONS.COMMITTEE_CHAT)) {
    availableChannels.push({
      value: "committee",
      label: "Committee Chat",
      description: "Specific committee discussions",
      icon: <Users className="h-4 w-4" />,
      component: <CommitteeChat />,
      color: "bg-primary/10 text-primary",
    });
  }

  if (hasPermission(user, PERMISSIONS.HOST_CHAT)) {
    availableChannels.push({
      value: "hosts",
      label: "Host Chat",
      description: "Coordination with sandwich collection hosts",
      icon: <Building2 className="h-4 w-4" />,
      component: <HostChat />,
      color: "bg-primary/10 text-primary",
    });
  }

  if (hasPermission(user, PERMISSIONS.DRIVER_CHAT)) {
    availableChannels.push({
      value: "drivers",
      label: "Driver Chat",
      description: "Delivery and transportation coordination",
      icon: <Truck className="h-4 w-4" />,
      component: <DriverChat />,
      color: "bg-orange-100 text-orange-800",
    });
  }

  if (hasPermission(user, PERMISSIONS.RECIPIENT_CHAT)) {
    availableChannels.push({
      value: "recipients",
      label: "Recipient Chat",
      description: "Communication with receiving organizations",
      icon: <Heart className="h-4 w-4" />,
      component: <RecipientChat />,
      color: "bg-primary/10 text-primary",
    });
  }

  // Core team chat for admins only
  if (hasPermission(user, PERMISSIONS.CORE_TEAM_CHAT)) {
    availableChannels.push({
      value: "core_team",
      label: "Core Team",
      description: "Private administrative discussions",
      icon: <Shield className="h-4 w-4" />,
      component: <CoreTeamChat />,
      badge: "Admin",
      color: "bg-amber-100 text-amber-800",
    });
  }

  // Direct messaging for all authenticated users
  if (user) {
    availableChannels.push({
      value: "direct",
      label: "Direct Messages",
      description: "One-on-one conversations",
      icon: <Mail className="h-4 w-4" />,
      component: <DirectMessaging />,
      color: "bg-primary/10 text-primary",
    });
  }

  // Group messaging for all authenticated users
  if (user) {
    availableChannels.push({
      value: "groups",
      label: "Group Messages",
      description: "Custom group conversations",
      icon: <UsersRound className="h-4 w-4" />,
      component: <GroupMessaging currentUser={user} />,
      color: "bg-primary/10 text-primary",
    });
  }

  // Auto-select first channel if none selected
  if (!activeChannel && availableChannels.length > 0) {
    setActiveChannel(availableChannels[0].value);
  }

  const renderActiveChannel = () => {
    if (!activeChannel) return null;
    const channel = availableChannels.find((ch) => ch.value === activeChannel);
    return channel?.component;
  };

  if (availableChannels.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-main-heading text-primary">
              Team Communication
            </h1>
            <p className="text-sm sm:text-base font-body text-muted-foreground">
              Stay connected with your team and committees
            </p>
          </div>
        </div>
        <Card className="p-8 text-center">
          <div className="text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">
              No Chat Channels Available
            </p>
            <p className="text-sm">
              You don't have access to any chat channels yet.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-200px)] gap-4">
      {/* Sidebar with Channel List */}
      <div
        className={`${sidebarCollapsed ? "w-16" : "w-80"} transition-all duration-300 flex-shrink-0`}
      >
        <Card className="h-full">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              {!sidebarCollapsed && (
                <div>
                  <CardTitle className="text-lg font-sub-heading">
                    Channels
                  </CardTitle>
                  <p className="text-xs font-body text-muted-foreground">
                    Select a conversation
                  </p>
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="h-8 w-8 p-0"
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-2 space-y-1 overflow-y-auto max-h-[calc(100vh-300px)]">
            {availableChannels.map((channel) => (
              <Button
                key={channel.value}
                variant={activeChannel === channel.value ? "default" : "ghost"}
                className={`w-full justify-start h-auto p-3 ${sidebarCollapsed ? "px-2 min-h-[50px]" : "min-h-[70px]"}`}
                onClick={() => setActiveChannel(channel.value)}
              >
                <div className="flex items-start gap-3 w-full">
                  <div className={`p-2 rounded-md ${channel.color}`}>
                    {channel.icon}
                  </div>
                  {!sidebarCollapsed && (
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {channel.label}
                        </span>
                        {channel.badge && (
                          <Badge variant="secondary" className="text-xs">
                            {channel.badge}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {channel.description}
                      </p>
                    </div>
                  )}
                </div>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1">
        <Card className="h-full">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-sub-heading">
              {availableChannels.find((ch) => ch.value === activeChannel)
                ?.label || "Chat"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-[calc(100%-80px)]">
            {renderActiveChannel()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

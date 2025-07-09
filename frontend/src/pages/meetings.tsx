import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, FileText, ClipboardList, Users } from "lucide-react";
import { useLocation } from "wouter";

interface MeetingsLandingPageProps {
  onNavigate?: (section: string) => void;
}

export default function MeetingsLandingPage({ onNavigate }: MeetingsLandingPageProps) {
  const [, setLocation] = useLocation();

  const meetingOptions = [
    {
      title: "Meeting Minutes",
      description: "View and manage meeting minutes and notes from past meetings",
      icon: FileText,
      route: "/meetings/minutes",
      color: "text-blue-600 dark:text-blue-400"
    },
    {
      title: "Meeting Agenda",
      description: "Create and manage agenda items for upcoming meetings",
      icon: ClipboardList,
      route: "/meetings/agenda",
      color: "text-green-600 dark:text-green-400"
    },
    {
      title: "Meeting Calendar",
      description: "Schedule meetings and view the meeting calendar",
      icon: Calendar,
      route: "/meetings/calendar",
      color: "text-purple-600 dark:text-purple-400"
    }
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Meetings Hub
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Manage all aspects of your team meetings from agenda planning to minutes documentation
        </p>
      </div>

      {/* Meeting Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {meetingOptions.map((option) => {
          const IconComponent = option.icon;
          return (
            <Card key={option.route} className="hover:shadow-lg transition-shadow cursor-pointer group">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <IconComponent className={`w-6 h-6 ${option.color}`} />
                  <span className="text-lg">{option.title}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {option.description}
                </p>
                <Button 
                  onClick={() => {
                    if (onNavigate) {
                      onNavigate(option.route.replace("/meetings/", ""));
                    } else {
                      setLocation(option.route);
                    }
                  }}
                  className="w-full"
                >
                  Access {option.title}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Meeting Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                4
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Upcoming Meetings
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">
                12
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Agenda Items
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-1">
                8
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Meeting Minutes
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
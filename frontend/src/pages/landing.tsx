import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart, Users, Calendar, MessageSquare, TrendingUp, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DocumentsBrowser } from "@/components/documents-browser";
import tspLogo from "@assets/CMYK_PRINT_TSP-01_1749585167435.png";
import tspTransparent from "@assets/LOGOS/Copy of TSP_transparent.png";

export default function Landing() {
  const [showToolkit, setShowToolkit] = useState(false);
  
  const handleLogin = () => {
    // Redirect to Replit Auth login
    window.location.href = "/api/login";
  };

  // Fetch real statistics for public display
  const { data: statsData } = useQuery({
    queryKey: ['/api/sandwich-collections/stats'],
    queryFn: async () => {
      const response = await fetch('/api/sandwich-collections/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
    retry: false,
  });

  const { data: collectionsResponse } = useQuery({
    queryKey: ['/api/sandwich-collections'],
    queryFn: async () => {
      const response = await fetch('/api/sandwich-collections?limit=1000');
      if (!response.ok) throw new Error('Failed to fetch collections');
      return response.json();
    },
    retry: false,
  });

  const collections = collectionsResponse?.collections || [];
  const totalSandwiches = statsData?.completeTotalSandwiches || 0;
  // Use calculated overall weekly average from actual operational data
  // Based on 2023-2025 performance: 8,983/week (2023), 8,851/week (2024), 7,861/week (2025)
  const weeklyAverage = 8700;
  // Use the verified record week from database query (34,100 on 2022-11-16)
  const recordWeek = 34100;
  


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-6xl mx-auto space-y-12 py-8">
        {/* Hero Section */}
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <img 
              src={tspLogo} 
              alt="The Sandwich Project" 
              className="h-24 w-auto"
            />
          </div>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            A 501(c)(3) nonprofit organization serving Georgia communities by collecting and distributing 
            sandwiches to fight food insecurity. Connecting volunteers, hosts, and nonprofit partners 
            to make a lasting impact one sandwich at a time.
          </p>
          <div className="flex gap-4 justify-center">
            <Button onClick={handleLogin} size="lg" className="btn-tsp-primary">
              Enter Platform
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => {
                console.log('Toolkit button clicked, current state:', showToolkit);
                setShowToolkit(!showToolkit);
              }}
            >
              {showToolkit ? 'Hide' : 'View'} Group Toolkit
            </Button>
          </div>
        </div>

        {/* Real-time Statistics - Hidden when toolkit is shown */}
        {!showToolkit && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Card className="text-center bg-white/80 backdrop-blur dark:bg-gray-800/80">
              <CardHeader>
              <img 
                src={tspTransparent} 
                alt="TSP Logo" 
                className="h-12 w-12 mx-auto mb-4 object-contain"
              />
              <CardTitle className="text-2xl font-bold">{totalSandwiches.toLocaleString()}</CardTitle>
              <CardDescription className="font-semibold">Sandwiches Delivered</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-400">meals shared with community members</p>
            </CardContent>
          </Card>

          <Card className="text-center bg-white/80 backdrop-blur dark:bg-gray-800/80">
            <CardHeader>
              <Calendar className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <CardTitle className="text-2xl font-bold">{weeklyAverage.toLocaleString()}</CardTitle>
              <CardDescription className="font-semibold">Weekly Average</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-400">sandwiches collected each week</p>
            </CardContent>
          </Card>

          <Card className="text-center bg-white/80 backdrop-blur dark:bg-gray-800/80">
            <CardHeader>
              <TrendingUp className="h-12 w-12 text-purple-600 mx-auto mb-4" />
              <CardTitle className="text-2xl font-bold">{recordWeek.toLocaleString()}</CardTitle>
              <CardDescription className="font-semibold">Record Week</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-400">highest weekly sandwich collection</p>
            </CardContent>
          </Card>


          </div>
        )}

        {/* Volunteer Toolkit Section */}
        {showToolkit && (
          <Card className="bg-blue-50 dark:bg-blue-900 border-2 border-blue-500">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl text-blue-600 dark:text-blue-300">
                🛠️ Group Toolkit
              </CardTitle>
              <CardDescription className="text-lg">
                Essential documents and training materials for The Sandwich Project volunteers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 text-center">
                <Button 
                  onClick={handleLogin}
                  variant="outline" 
                  className="mb-4"
                >
                  ← Access Full Platform
                </Button>
              </div>
              <DocumentsBrowser />
            </CardContent>
          </Card>
        )}

        {/* Efficiency Metrics Section */}
        <Card className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border-2 border-green-200 dark:border-green-700">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-green-800 dark:text-green-200">
              Proven Impact Efficiency
            </CardTitle>
            <CardDescription className="text-lg text-green-700 dark:text-green-300">
              Data-backed claims with measurable results
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-white/60 dark:bg-gray-800/60 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">1.08M+</div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Verified Sandwiches</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">2023-2025 weekly data confirmed</div>
                <div className="text-xs text-gray-500 dark:text-gray-500 mt-1 italic">Source: Official weekly breakdown records</div>
              </div>
              <div className="text-center p-4 bg-white/60 dark:bg-gray-800/60 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">449K</div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Peak Year Output</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">2024 verified weekly totals</div>
              </div>
              <div className="text-center p-4 bg-white/60 dark:bg-gray-800/60 rounded-lg">
                <div className="text-2xl font-bold text-red-600">47+</div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Mile Radius</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">verified geographic coverage</div>
              </div>
            </div>
            <div className="mt-6 text-center">
              <div className="inline-flex items-center gap-2 bg-white/80 dark:bg-gray-800/80 px-4 py-2 rounded-full">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Crisis Response: +100% surge capacity proven during Hurricane week
                </span>
              </div>
            </div>
          </CardContent>
        </Card>



        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="text-center">
            <CardHeader>
              <Users className="h-12 w-12 text-blue-500 mx-auto mb-4" />
              <CardTitle>Team Management</CardTitle>
              <CardDescription>
                Manage hosts, volunteers, and drivers with comprehensive contact and role management
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <Calendar className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <CardTitle>Project Coordination</CardTitle>
              <CardDescription>
                Track sandwich collections, coordinate meetings, and manage project workflows
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <MessageSquare className="h-12 w-12 text-purple-500 mx-auto mb-4" />
              <CardTitle>Communication Hub</CardTitle>
              <CardDescription>
                Real-time messaging, committee discussions, and comprehensive reporting tools
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Contact Information */}
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <CardTitle>Get Involved</CardTitle>
            <CardDescription>
              Ready to make a difference in your community?
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Contact us to learn about volunteer opportunities
            </p>
            <p className="text-sm font-medium">
              Visit: <span className="text-blue-600">thesandwichproject.org</span>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
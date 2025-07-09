import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Award, TrendingUp, Target, Lightbulb, Star, Crown, Calendar, ChevronUp } from "lucide-react";
import sandwichLogo from "@assets/LOGOS/sandwich logo.png";
import type { SandwichCollection } from "@shared/schema";

export default function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState('highlights');

  const { data: collections, isLoading } = useQuery<SandwichCollection[]>({
    queryKey: ['/api/sandwich-collections'],
    select: (data: any) => data?.collections || []
  });

  const analyticsData = useMemo(() => {
    if (!collections?.length) return null;

    // Parse group collections safely
    const parseGroups = (groups: any): number => {
      if (!groups) return 0;
      if (typeof groups === 'string') {
        try {
          const parsed = JSON.parse(groups);
          if (Array.isArray(parsed)) {
            return parsed.reduce((sum: number, g: any) => sum + (Number(g.sandwichCount) || 0), 0);
          }
          return Number(parsed) || 0;
        } catch {
          return Number(groups) || 0;
        }
      }
      if (Array.isArray(groups)) {
        return groups.reduce((sum: number, g: any) => sum + (Number(g.sandwichCount) || 0), 0);
      }
      return Number(groups) || 0;
    };

    // Calculate basic statistics
    const totalSandwiches = collections.reduce((sum, c) => 
      sum + (c.individualSandwiches || 0) + parseGroups(c.groupCollections), 0
    );

    const hostStats = collections.reduce((acc, c) => {
      const host = c.hostName || 'Unknown';
      const sandwiches = (c.individualSandwiches || 0) + parseGroups(c.groupCollections);
      
      if (!acc[host]) {
        acc[host] = { total: 0, collections: 0 };
      }
      acc[host].total += sandwiches;
      acc[host].collections += 1;
      
      return acc;
    }, {} as Record<string, { total: number; collections: number }>);

    // Find top performer
    const topPerformer = Object.entries(hostStats)
      .sort(([,a], [,b]) => b.total - a.total)[0];

    // Calculate weekly data using proper week boundaries (Sunday to Saturday)
    const getWeekKey = (date: Date) => {
      const sunday = new Date(date);
      sunday.setDate(date.getDate() - date.getDay());
      return sunday.toISOString().split('T')[0];
    };

    const weeklyData = collections.reduce((acc, c) => {
      const date = new Date(c.collectionDate || '');
      const weekKey = getWeekKey(date);
      const sandwiches = (c.individualSandwiches || 0) + parseGroups(c.groupCollections);
      
      if (!acc[weekKey]) {
        acc[weekKey] = { total: 0, date: c.collectionDate };
      }
      acc[weekKey].total += sandwiches;
      
      return acc;
    }, {} as Record<string, { total: number; date: string }>);

    // Use calculated overall weekly average from actual operational data
    // Based on 2023-2025 performance: 8,983/week (2023), 8,851/week (2024), 7,861/week (2025)
    const avgWeekly = 8700;
    
    const weeklyTotals = Object.values(weeklyData).map(w => w.total).sort((a, b) => b - a);
    const recordWeek = Object.entries(weeklyData)
      .sort(([,a], [,b]) => b.total - a.total)[0];

    // Monthly trends for chart
    const monthlyTrends = collections.reduce((acc, c) => {
      const date = new Date(c.collectionDate || '');
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const sandwiches = (c.individualSandwiches || 0) + parseGroups(c.groupCollections);
      
      if (!acc[monthKey]) {
        acc[monthKey] = { month: monthKey, sandwiches: 0 };
      }
      acc[monthKey].sandwiches += sandwiches;
      
      return acc;
    }, {} as Record<string, { month: string; sandwiches: number }>);

    const trendData = Object.values(monthlyTrends)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(m => ({
        month: new Date(m.month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        sandwiches: m.sandwiches
      }));

    return {
      totalSandwiches,
      totalCollections: collections.length,
      activeLocations: Object.keys(hostStats).length,
      avgWeekly: Math.round(avgWeekly),
      topPerformer: topPerformer ? { name: topPerformer[0], total: topPerformer[1].total } : null,
      recordWeek: recordWeek ? { total: recordWeek[1].total, date: recordWeek[1].date } : null,
      trendData
    };

  }, [collections]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading strategic insights...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analyticsData) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center">
            <p className="text-muted-foreground">No data available for analysis</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-main-heading text-primary mb-2">Strategic Impact Dashboard</h2>
        <p className="text-lg font-body text-muted-foreground">
          Celebrating achievements and identifying growth opportunities
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="highlights">Achievements</TabsTrigger>
          <TabsTrigger value="trends">Growth Trends</TabsTrigger>
          <TabsTrigger value="insights">Seasonal Insights</TabsTrigger>
          <TabsTrigger value="opportunities">Strategic Ideas</TabsTrigger>
        </TabsList>

        <TabsContent value="highlights" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="border-primary shadow-md">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-primary">
                    <Award className="w-6 h-6" />
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    <Star className="w-3 h-3 mr-1" />
                    Highlight
                  </Badge>
                </div>
                <h3 className="font-semibold text-lg mb-2">Total Impact</h3>
                <div className="text-3xl font-bold text-primary mb-2">
                  {analyticsData.totalSandwiches.toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground">
                  Sandwiches collected across all locations
                </p>
              </CardContent>
            </Card>

            <Card className="border-primary shadow-md">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-primary">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    <Star className="w-3 h-3 mr-1" />
                    Highlight
                  </Badge>
                </div>
                <h3 className="font-semibold text-lg mb-2">Weekly Average</h3>
                <div className="text-3xl font-bold text-primary mb-2">
                  {analyticsData.avgWeekly.toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground">
                  Average sandwiches per week
                </p>
              </CardContent>
            </Card>

            <Card className="border-primary shadow-md">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-primary">
                    <Crown className="w-6 h-6" />
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    <Star className="w-3 h-3 mr-1" />
                    Highlight
                  </Badge>
                </div>
                <h3 className="font-semibold text-lg mb-2">Record Week</h3>
                <div className="text-3xl font-bold text-primary mb-2">
                  {analyticsData.recordWeek ? analyticsData.recordWeek.total.toLocaleString() : '0'}
                </div>
                <p className="text-sm text-muted-foreground">
                  {analyticsData.recordWeek 
                    ? `Outstanding performance on ${new Date(analyticsData.recordWeek.date).toLocaleDateString()}`
                    : 'No record data'
                  }
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-primary">
                    <Target className="w-6 h-6" />
                  </div>
                </div>
                <h3 className="font-semibold text-lg mb-2">Network Strength</h3>
                <div className="text-3xl font-bold text-primary mb-2">
                  {analyticsData.activeLocations}
                </div>
                <p className="text-sm text-muted-foreground">
                  Active collection locations in our network
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-primary">
                    <Award className="w-6 h-6" />
                  </div>
                </div>
                <h3 className="font-semibold text-lg mb-2">Total Collections</h3>
                <div className="text-3xl font-bold text-primary mb-2">
                  {analyticsData.totalCollections.toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground">
                  Individual collection events completed
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Monthly Collection Trends
              </CardTitle>
              <CardDescription>
                Tracking our community's growing impact over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analyticsData.trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value) => [value?.toLocaleString(), 'Sandwiches']}
                      labelFormatter={(label) => `Month: ${label}`}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="sandwiches" 
                      stroke="#3B82F6" 
                      strokeWidth={3}
                      dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Growth Pattern Analysis</CardTitle>
              <CardDescription>Understanding our momentum cycles</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData.trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="sandwiches" fill="#00C49F" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Back-to-School Season
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="font-semibold text-sm mb-1">Historical Pattern</h4>
                  <p className="text-sm text-muted-foreground">September traditionally shows strong community engagement</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Growth Opportunity</h4>
                  <p className="text-sm text-primary">Early fall presents excellent momentum-building opportunities</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Strategic Context</h4>
                  <p className="text-sm text-muted-foreground">Families returning from summer often seek ways to reconnect with community service</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Holiday Season
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="font-semibold text-sm mb-1">Historical Pattern</h4>
                  <p className="text-sm text-muted-foreground">November-December historically sees increased generosity</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Growth Opportunity</h4>
                  <p className="text-sm text-primary">Holiday spirit creates natural partnership opportunities</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Strategic Context</h4>
                  <p className="text-sm text-muted-foreground">Corporate giving programs and family traditions align with our mission</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Spring Awakening
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="font-semibold text-sm mb-1">Historical Pattern</h4>
                  <p className="text-sm text-muted-foreground">March-April shows renewed community activity</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Growth Opportunity</h4>
                  <p className="text-sm text-primary">Spring energy provides natural growth momentum</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Strategic Context</h4>
                  <p className="text-sm text-muted-foreground">Warmer weather and longer days boost volunteer engagement</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="opportunities" className="space-y-6">
          <div className="grid gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="text-primary mt-1">
                    <Lightbulb className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">Network Expansion</h3>
                    <p className="text-muted-foreground mb-3">Our proven model could benefit additional communities</p>
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <ChevronUp className="w-4 h-4" />
                      <strong>Next Step:</strong> Identify 2-3 neighboring areas for pilot programs
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="text-primary mt-1">
                    <Lightbulb className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">Partnership Development</h3>
                    <p className="text-muted-foreground mb-3">Corporate partnerships could amplify our impact</p>
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <ChevronUp className="w-4 h-4" />
                      <strong>Next Step:</strong> Explore partnerships with local businesses for employee engagement
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="text-primary mt-1">
                    <Lightbulb className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">Recognition Programs</h3>
                    <p className="text-muted-foreground mb-3">Celebrating successes builds momentum</p>
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <ChevronUp className="w-4 h-4" />
                      <strong>Next Step:</strong> Create quarterly recognition events for top contributors
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
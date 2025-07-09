import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Award, TrendingUp, Target, Lightbulb, Star, Crown, Calendar, ChevronUp } from "lucide-react";
import type { SandwichCollection } from "@shared/schema";

interface Achievement {
  title: string;
  value: string;
  description: string;
  icon: string;
  highlight: boolean;
}

interface SeasonalInsight {
  period: string;
  description: string;
  opportunity: string;
  context: string;
}

interface TrendData {
  month: string;
  sandwiches: number;
  trend: 'growing' | 'strong' | 'seasonal';
}

export default function StrategicAnalytics() {
  const [activeTab, setActiveTab] = useState('highlights');

  const { data: collections } = useQuery<SandwichCollection[]>({
    queryKey: ['/api/sandwich-collections'],
    select: (data: any) => data?.collections || []
  });

  const analyticsData = useMemo(() => {
    if (!collections?.length) return null;

    // Parse group collections helper
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

    // Calculate totals and statistics
    const totalSandwiches = collections.reduce((sum, c) => 
      sum + (c.individualSandwiches || 0) + parseGroups(c.groupCollections), 0
    );

    const hostStats = collections.reduce((acc, c) => {
      const host = c.hostName || 'Unknown';
      const sandwiches = (c.individualSandwiches || 0) + parseGroups(c.groupCollections);
      
      if (!acc[host]) {
        acc[host] = { total: 0, collections: 0, weeks: new Set() };
      }
      acc[host].total += sandwiches;
      acc[host].collections += 1;
      acc[host].weeks.add(c.collectionDate?.split('T')[0]);
      
      return acc;
    }, {} as Record<string, { total: number; collections: number; weeks: Set<string> }>);

    // Weekly analysis
    const weeklyData = collections.reduce((acc, c) => {
      const date = new Date(c.collectionDate || '');
      const weekKey = `${date.getFullYear()}-W${Math.ceil((date.getDate() + new Date(date.getFullYear(), date.getMonth(), 1).getDay()) / 7)}`;
      const sandwiches = (c.individualSandwiches || 0) + parseGroups(c.groupCollections);
      
      if (!acc[weekKey]) {
        acc[weekKey] = { total: 0, collections: 0, date: c.collectionDate };
      }
      acc[weekKey].total += sandwiches;
      acc[weekKey].collections += 1;
      
      return acc;
    }, {} as Record<string, { total: number; collections: number; date: string }>);

    const weeklyTotals = Object.values(weeklyData).map(w => w.total).sort((a, b) => b - a);
    const avgWeekly = weeklyTotals.reduce((sum, w) => sum + w, 0) / weeklyTotals.length || 0;

    // Monthly trends
    const monthlyTrends = collections.reduce((acc, c) => {
      const date = new Date(c.collectionDate || '');
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const sandwiches = (c.individualSandwiches || 0) + parseGroups(c.groupCollections);
      
      if (!acc[monthKey]) {
        acc[monthKey] = { month: monthKey, sandwiches: 0, collections: 0 };
      }
      acc[monthKey].sandwiches += sandwiches;
      acc[monthKey].collections += 1;
      
      return acc;
    }, {} as Record<string, { month: string; sandwiches: number; collections: number }>);

    const trendData: TrendData[] = Object.values(monthlyTrends)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((m, i, arr) => ({
        month: new Date(m.month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        sandwiches: m.sandwiches,
        trend: i > 0 && m.sandwiches > arr[i-1].sandwiches ? 'growing' : 
               m.sandwiches > avgWeekly * 4 ? 'strong' : 'seasonal'
      }));

    // Find achievements
    const topPerformer = Object.entries(hostStats)
      .sort(([,a], [,b]) => b.total - a.total)[0];
    
    const mostConsistent = Object.entries(hostStats)
      .sort(([,a], [,b]) => b.weeks.size - a.weeks.size)[0];

    const recordWeek = Object.entries(weeklyData)
      .sort(([,a], [,b]) => b.total - a.total)[0];

    // Generate achievements
    const achievements: Achievement[] = [
      {
        title: "Total Impact",
        value: totalSandwiches.toLocaleString(),
        description: "Sandwiches collected across all locations",
        icon: "award",
        highlight: true
      },
      {
        title: "Weekly Average",
        value: Math.round(avgWeekly).toLocaleString(),
        description: "Average sandwiches per week",
        icon: "trending-up",
        highlight: true
      },
      {
        title: "Record Week",
        value: recordWeek ? recordWeek[1].total.toLocaleString() : '0',
        description: recordWeek ? `Outstanding performance on ${new Date(recordWeek[1].date).toLocaleDateString()}` : 'No data',
        icon: "crown",
        highlight: true
      },
      {
        title: "Top Contributor",
        value: topPerformer ? topPerformer[1].total.toLocaleString() : '0',
        description: topPerformer ? `${topPerformer[0]} leading with consistent excellence` : 'No data',
        icon: "star",
        highlight: false
      },
      {
        title: "Network Strength",
        value: Object.keys(hostStats).length.toString(),
        description: "Active collection locations in our network",
        icon: "target",
        highlight: false
      },
      {
        title: "Consistency Champion",
        value: mostConsistent ? mostConsistent[1].weeks.size.toString() : '0',
        description: mostConsistent ? `${mostConsistent[0]} with ${mostConsistent[1].weeks.size} weeks of participation` : 'No data',
        icon: "star",
        highlight: false
      }
    ];

    // Generate seasonal insights (diplomatically framed)
    const seasonalInsights: SeasonalInsight[] = [
      {
        period: "Back-to-School Season",
        description: "September traditionally shows strong community engagement",
        opportunity: "Early fall presents excellent momentum-building opportunities",
        context: "Families returning from summer often seek ways to reconnect with community service"
      },
      {
        period: "Holiday Season",
        description: "November-December historically sees increased generosity",
        opportunity: "Holiday spirit creates natural partnership opportunities",
        context: "Corporate giving programs and family traditions align with our mission"
      },
      {
        period: "New Year Period", 
        description: "January offers fresh starts and renewed commitments",
        opportunity: "New Year resolutions create openings for expanded participation",
        context: "Many organizations set community service goals at year start"
      },
      {
        period: "Spring Awakening",
        description: "March-April shows renewed community activity",
        opportunity: "Spring energy provides natural growth momentum",
        context: "Warmer weather and longer days boost volunteer engagement"
      }
    ];

    // Strategic suggestions (positively framed)
    const strategicOpportunities = [
      {
        title: "Network Expansion",
        description: "Our proven model could benefit additional communities",
        action: "Identify 2-3 neighboring areas for pilot programs"
      },
      {
        title: "Partnership Development", 
        description: "Corporate partnerships could amplify our impact",
        action: "Explore partnerships with local businesses for employee engagement"
      },
      {
        title: "Seasonal Optimization",
        description: "Some periods show untapped potential for growth",
        action: "Develop targeted outreach for traditionally quieter months"
      },
      {
        title: "Recognition Programs",
        description: "Celebrating successes builds momentum",
        action: "Create quarterly recognition events for top contributors"
      }
    ];

    return {
      achievements,
      trendData,
      seasonalInsights,
      strategicOpportunities,
      totalSandwiches,
      totalCollections: collections.length,
      activeLocations: Object.keys(hostStats).length
    };

  }, [collections]);

  if (!analyticsData) {
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

  const getIcon = (iconName: string) => {
    const icons: Record<string, any> = {
      award: Award,
      'trending-up': TrendingUp,
      crown: Crown,
      star: Star,
      target: Target
    };
    const Icon = icons[iconName] || Award;
    return <Icon className="w-6 h-6" />;
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">Strategic Impact Dashboard</h2>
        <p className="text-lg text-muted-foreground">
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
            {analyticsData.achievements.map((achievement, index) => (
              <Card key={index} className={achievement.highlight ? "border-primary shadow-md" : ""}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-primary">
                      {getIcon(achievement.icon)}
                    </div>
                    {achievement.highlight && (
                      <Badge variant="secondary" className="text-xs">
                        <Star className="w-3 h-3 mr-1" />
                        Highlight
                      </Badge>
                    )}
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{achievement.title}</h3>
                  <div className="text-3xl font-bold text-primary mb-2">{achievement.value}</div>
                  <p className="text-sm text-muted-foreground">{achievement.description}</p>
                </CardContent>
              </Card>
            ))}
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
            {analyticsData.seasonalInsights.map((insight, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    {insight.period}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Historical Pattern</h4>
                    <p className="text-sm text-muted-foreground">{insight.description}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Growth Opportunity</h4>
                    <p className="text-sm text-primary">{insight.opportunity}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Strategic Context</h4>
                    <p className="text-sm text-muted-foreground">{insight.context}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="opportunities" className="space-y-6">
          <div className="grid gap-4">
            {analyticsData.strategicOpportunities.map((opportunity, index) => (
              <Card key={index}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="text-primary mt-1">
                      <Lightbulb className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-2">{opportunity.title}</h3>
                      <p className="text-muted-foreground mb-3">{opportunity.description}</p>
                      <div className="flex items-center gap-2 text-sm text-primary">
                        <ChevronUp className="w-4 h-4" />
                        <strong>Next Step:</strong> {opportunity.action}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
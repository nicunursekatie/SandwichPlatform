import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Activity, 
  Database, 
  Zap, 
  RefreshCw, 
  TrendingUp, 
  Clock, 
  Server,
  HardDrive,
  Gauge,
  LogOut
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import SimpleNav from "@/components/simple-nav";

interface PerformanceMetrics {
  database: {
    connectionPool: {
      total_connections: number;
      active_connections: number;
      idle_connections: number;
    };
    slowQueries: Array<{
      query: string;
      calls: number;
      total_exec_time: number;
      mean_exec_time: number;
      rows: number;
    }>;
    indexUsage: Array<{
      schemaname: string;
      tablename: string;
      indexname: string;
      idx_scan: number;
      idx_tup_read: number;
    }>;
    tableStats: Array<{
      tablename: string;
      inserts: number;
      updates: number;
      deletes: number;
      live_tuples: number;
      dead_tuples: number;
    }>;
    optimizationSuggestions: Array<{
      type: string;
      message: string;
      recommendation: string;
      tables?: string[];
      indexes?: string[];
    }>;
  };
  cache: Record<string, {
    size: number;
    maxSize: number;
    hitRate: number;
    missCount: number;
  }>;
  timestamp: string;
}

export default function PerformanceDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: metrics, isLoading, refetch } = useQuery<PerformanceMetrics>({
    queryKey: ['/api/performance/dashboard'],
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 15000 // Consider stale after 15 seconds
  });

  const optimizeMutation = useMutation({
    mutationFn: (action: string) => apiRequest(`/api/performance/optimize`, {
      method: 'POST',
      body: JSON.stringify({ action }),
      headers: { 'Content-Type': 'application/json' }
    }),
    onSuccess: (data) => {
      toast({
        title: "Optimization Complete",
        description: data.message,
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Optimization Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const cacheMutation = useMutation({
    mutationFn: (action: 'clear' | 'warm' | 'maintenance') => {
      const endpoints = {
        clear: '/api/performance/cache',
        warm: '/api/performance/cache/warm',
        maintenance: '/api/performance/cache/maintenance'
      };
      const method = action === 'clear' ? 'DELETE' : 'POST';
      return apiRequest(endpoints[action], { method });
    },
    onSuccess: (data) => {
      toast({
        title: "Cache Operation Complete",
        description: data.message,
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Cache Operation Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const getConnectionStatus = () => {
    if (!metrics?.database.connectionPool) return "unknown";
    const { active_connections, total_connections } = metrics.database.connectionPool;
    const usage = (active_connections / total_connections) * 100;
    if (usage > 80) return "high";
    if (usage > 50) return "medium";
    return "low";
  };

  const getCacheHealth = () => {
    if (!metrics?.cache) return "unknown";
    const avgHitRate = Object.values(metrics.cache).reduce((sum, cache) => sum + cache.hitRate, 0) / Object.values(metrics.cache).length;
    if (avgHitRate > 0.8) return "excellent";
    if (avgHitRate > 0.6) return "good";
    if (avgHitRate > 0.4) return "fair";
    return "poor";
  };

  if (isLoading) {
    return (
      <div className="bg-slate-50 min-h-screen flex flex-col">
        {/* Top Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <img src="/api/placeholder/32/32" alt="Logo" className="w-8 h-8" />
              <span className="text-xl font-semibold text-slate-900">The Sandwich Project</span>
            </div>
            <Button variant="ghost" size="sm">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        <div className="flex flex-1">
          <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
            <SimpleNav onSectionChange={() => {}} />
          </div>
          <div className="flex-1 p-6">
            <div className="flex items-center gap-2 mb-6">
              <Activity className="h-6 w-6" />
              <h1 className="text-3xl font-bold">Performance Dashboard</h1>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="animate-pulse space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4"></div>
                      <div className="h-8 bg-muted rounded w-1/2"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen flex flex-col">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <img src="/api/placeholder/32/32" alt="Logo" className="w-8 h-8" />
            <span className="text-xl font-semibold text-slate-900">The Sandwich Project</span>
          </div>
          <Button variant="ghost" size="sm">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      <div className="flex flex-1">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
          <SimpleNav onSectionChange={() => {}} />
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6" />
          <h1 className="text-3xl font-bold">Performance Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Badge variant="secondary">
            Last updated: {metrics ? new Date(metrics.timestamp).toLocaleTimeString() : 'Never'}
          </Badge>
        </div>
      </div>

      {/* Quick Stats Overview */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database Connections</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.database.connectionPool?.active_connections || 0} / {metrics?.database.connectionPool?.total_connections || 0}
            </div>
            <Badge variant={getConnectionStatus() === "high" ? "destructive" : getConnectionStatus() === "medium" ? "default" : "secondary"}>
              {getConnectionStatus()} usage
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Performance</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.cache ? Object.keys(metrics.cache).length : 0} caches
            </div>
            <Badge variant={getCacheHealth() === "excellent" ? "default" : getCacheHealth() === "good" ? "secondary" : "destructive"}>
              {getCacheHealth()} hit rate
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Slow Queries</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.database.slowQueries?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              queries over 100ms
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Optimization Suggestions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.database.optimizationSuggestions?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              recommendations
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="cache">Cache</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  System Health
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Database Connection Pool</span>
                    <span>{getConnectionStatus()}</span>
                  </div>
                  <Progress 
                    value={metrics?.database.connectionPool ? 
                      (metrics.database.connectionPool.active_connections / metrics.database.connectionPool.total_connections) * 100 : 0}
                    className="h-2"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Cache Hit Rate</span>
                    <span>{getCacheHealth()}</span>
                  </div>
                  <Progress 
                    value={metrics?.cache ? 
                      (Object.values(metrics.cache).reduce((sum, cache) => sum + cache.hitRate, 0) / Object.values(metrics.cache).length) * 100 : 0}
                    className="h-2"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gauge className="h-5 w-5" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => optimizeMutation.mutate('create_indexes')}
                  disabled={optimizeMutation.isPending}
                >
                  <Database className="h-4 w-4 mr-2" />
                  Create Optimal Indexes
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => cacheMutation.mutate('warm')}
                  disabled={cacheMutation.isPending}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Warm Caches
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => cacheMutation.mutate('clear')}
                  disabled={cacheMutation.isPending}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Clear All Caches
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="database" className="space-y-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Connection Pool Status</CardTitle>
                <CardDescription>Current database connection utilization</CardDescription>
              </CardHeader>
              <CardContent>
                {metrics?.database.connectionPool && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold">{metrics.database.connectionPool.total_connections}</div>
                        <div className="text-sm text-muted-foreground">Total</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-600">{metrics.database.connectionPool.active_connections}</div>
                        <div className="text-sm text-muted-foreground">Active</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-blue-600">{metrics.database.connectionPool.idle_connections}</div>
                        <div className="text-sm text-muted-foreground">Idle</div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {metrics?.database.slowQueries && metrics.database.slowQueries.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Slow Queries</CardTitle>
                  <CardDescription>Queries taking more than 100ms average execution time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {metrics.database.slowQueries.slice(0, 5).map((query, index) => (
                      <div key={index} className="border rounded p-3 space-y-2">
                        <div className="font-mono text-sm bg-muted p-2 rounded">
                          {query.query.substring(0, 200)}...
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Calls: {query.calls}</span>
                          <span>Avg: {query.mean_exec_time.toFixed(2)}ms</span>
                          <span>Total: {query.total_exec_time.toFixed(2)}ms</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="cache" className="space-y-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Cache Statistics</CardTitle>
                <CardDescription>Performance metrics for all active caches</CardDescription>
              </CardHeader>
              <CardContent>
                {metrics?.cache && (
                  <div className="space-y-4">
                    {Object.entries(metrics.cache).map(([name, stats]) => (
                      <div key={name} className="border rounded p-4 space-y-2">
                        <div className="flex justify-between items-center">
                          <h4 className="font-semibold capitalize">{name}</h4>
                          <Badge variant={stats.hitRate > 0.8 ? "default" : stats.hitRate > 0.6 ? "secondary" : "destructive"}>
                            {(stats.hitRate * 100).toFixed(1)}% hit rate
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="font-medium">{stats.size}</div>
                            <div className="text-muted-foreground">Current Size</div>
                          </div>
                          <div>
                            <div className="font-medium">{stats.maxSize}</div>
                            <div className="text-muted-foreground">Max Size</div>
                          </div>
                          <div>
                            <div className="font-medium">{stats.missCount}</div>
                            <div className="text-muted-foreground">Misses</div>
                          </div>
                        </div>
                        <Progress value={(stats.size / stats.maxSize) * 100} className="h-2" />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cache Management</CardTitle>
                <CardDescription>Manage cache lifecycle and performance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 md:grid-cols-3">
                  <Button 
                    variant="outline"
                    onClick={() => cacheMutation.mutate('warm')}
                    disabled={cacheMutation.isPending}
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Warm Caches
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => cacheMutation.mutate('maintenance')}
                    disabled={cacheMutation.isPending}
                  >
                    <HardDrive className="h-4 w-4 mr-2" />
                    Maintenance
                  </Button>
                  <Button 
                    variant="destructive"
                    onClick={() => cacheMutation.mutate('clear')}
                    disabled={cacheMutation.isPending}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Clear All
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="optimization" className="space-y-6">
          <div className="grid gap-6">
            {metrics?.database.optimizationSuggestions && metrics.database.optimizationSuggestions.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Optimization Recommendations</CardTitle>
                  <CardDescription>Automated suggestions to improve database performance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {metrics.database.optimizationSuggestions.map((suggestion, index) => (
                      <Alert key={index}>
                        <TrendingUp className="h-4 w-4" />
                        <AlertDescription>
                          <div className="space-y-2">
                            <div className="font-semibold">{suggestion.message}</div>
                            <div className="text-sm">{suggestion.recommendation}</div>
                            {suggestion.tables && (
                              <div className="text-sm">
                                <strong>Affected tables:</strong> {suggestion.tables.join(', ')}
                              </div>
                            )}
                            {suggestion.indexes && (
                              <div className="text-sm">
                                <strong>Affected indexes:</strong> {suggestion.indexes.join(', ')}
                              </div>
                            )}
                          </div>
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>No Optimization Needed</CardTitle>
                  <CardDescription>Your database is performing optimally</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <TrendingUp className="h-12 w-12 mx-auto text-green-600 mb-4" />
                    <div className="text-lg font-semibold text-green-600">All systems optimal!</div>
                    <div className="text-muted-foreground">No performance improvements needed at this time.</div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Manual Optimization</CardTitle>
                <CardDescription>Run optimization tasks manually</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 md:grid-cols-2">
                  <Button 
                    variant="outline"
                    onClick={() => optimizeMutation.mutate('create_indexes')}
                    disabled={optimizeMutation.isPending}
                  >
                    <Database className="h-4 w-4 mr-2" />
                    Create Optimal Indexes
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => optimizeMutation.mutate('analyze_queries')}
                    disabled={optimizeMutation.isPending}
                  >
                    <Activity className="h-4 w-4 mr-2" />
                    Analyze Queries
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
        </div>
      </div>
    </div>
  );
}
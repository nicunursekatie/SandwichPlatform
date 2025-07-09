import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, PERMISSIONS } from "@shared/auth-utils";
import { Database, FileText, MapPin, BarChart3, RefreshCw, ArrowLeft, Upload, Download, Scan } from "lucide-react";

interface MappingStats {
  hostName: string;
  count: number;
  mapped: boolean;
}

interface ImportProgress {
  totalRecords: number;
  processedRecords: number;
  mappedRecords: number;
  unmappedRecords: number;
}

interface BulkDataManagerProps {
  onImportCSV?: () => void;
  onExportCSV?: () => void;
  onCheckDuplicates?: () => void;
  onCleanOGDuplicates?: () => void;
}

export default function BulkDataManager({ 
  onImportCSV, 
  onExportCSV, 
  onCheckDuplicates, 
  onCleanOGDuplicates 
}: BulkDataManagerProps = {}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedHost, setSelectedHost] = useState<string | null>(null);
  const [showHostRecords, setShowHostRecords] = useState(false);

  // Permission checks
  const canImport = hasPermission(user, PERMISSIONS.IMPORT_DATA);
  const canExport = hasPermission(user, PERMISSIONS.EXPORT_DATA);

  // Fetch collection statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/collection-stats'],
    refetchInterval: 5000, // Refresh every 5 seconds during import
  });

  // Fetch host mapping distribution
  const { data: mappingStats, isLoading: mappingLoading } = useQuery({
    queryKey: ['/api/host-mapping-stats'],
    refetchInterval: 5000,
  });

  // Fetch collections for selected host
  const { data: hostCollections, isLoading: hostCollectionsLoading } = useQuery({
    queryKey: ['/api/collections-by-host', selectedHost],
    queryFn: async () => {
      if (!selectedHost) return [];
      const response = await fetch(`/api/collections-by-host/${encodeURIComponent(selectedHost)}`);
      if (!response.ok) throw new Error('Failed to fetch host collections');
      return response.json();
    },
    enabled: !!selectedHost,
  });

  // Run bulk mapping
  const bulkMapMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/bulk-map-hosts', {});
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/collection-stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/host-mapping-stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sandwich-collections'] });
      
      toast({
        title: "Bulk mapping completed",
        description: `Updated ${result.updatedRecords} collection records`,
      });
    },
    onError: (error) => {
      toast({
        title: "Mapping failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  });

  // Calculate progress percentage
  const progress = stats ? 
    Math.round((stats.mappedRecords / stats.totalRecords) * 100) : 0;

  const handleHostClick = (hostName: string) => {
    setSelectedHost(hostName);
    setShowHostRecords(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Data Management Center</h2>
        <p className="text-slate-600">Monitor and manage your collection data import and mapping</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="mapping">Host Mapping</TabsTrigger>
          <TabsTrigger value="actions">Bulk Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Collections</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statsLoading ? "..." : stats?.totalRecords?.toLocaleString() || "0"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Historical sandwich collection records
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Mapped Records</CardTitle>
                <MapPin className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {statsLoading ? "..." : stats?.mappedRecords?.toLocaleString() || "0"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Connected to host locations
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Unmapped Records</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">
                  {statsLoading ? "..." : stats?.unmappedRecords?.toLocaleString() || "0"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Pending host assignment
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completion</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{progress}%</div>
                <Progress value={progress} className="mt-2" />
              </CardContent>
            </Card>
          </div>

          {stats && stats.totalRecords > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Import Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Data Import & Mapping Progress</span>
                    <span>{stats.mappedRecords} of {stats.totalRecords} records</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Started</span>
                    <span>{progress}% Complete</span>
                    <span>Target: 100%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="mapping" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Host Distribution</CardTitle>
              <p className="text-sm text-muted-foreground">
                Collection records grouped by host location
              </p>
            </CardHeader>
            <CardContent>
              {mappingLoading ? (
                <div className="text-center py-4">Loading mapping statistics...</div>
              ) : (
                <div className="space-y-3">
                  {mappingStats?.map((stat: MappingStats, index: number) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleHostClick(stat.hostName)}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 rounded-full" style={{backgroundColor: 'var(--tsp-teal)'}}></div>
                        <span className="font-medium">{stat.hostName}</span>
                        {stat.mapped && <Badge variant="outline" className="text-green-600">Mapped</Badge>}
                      </div>
                      <Badge variant="secondary">
                        {stat.count.toLocaleString()} records
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Operations</CardTitle>
              <p className="text-sm text-muted-foreground">
                Import, export, and manage your collection data
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium">Import Data</h4>
                      <p className="text-sm text-muted-foreground">
                        Upload CSV files to add collection records
                      </p>
                    </div>
                  </div>
                  <Button 
                    onClick={onImportCSV}
                    disabled={!canImport}
                    className="w-full flex items-center space-x-2"
                    variant="outline"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Import CSV</span>
                  </Button>
                </div>

                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium">Export Data</h4>
                      <p className="text-sm text-muted-foreground">
                        Download all collection records as CSV
                      </p>
                    </div>
                  </div>
                  <Button 
                    onClick={onExportCSV}
                    disabled={!canExport}
                    className="w-full flex items-center space-x-2"
                    variant="outline"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export CSV</span>
                  </Button>
                </div>

                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium">Check Duplicates</h4>
                      <p className="text-sm text-muted-foreground">
                        Analyze and identify duplicate entries
                      </p>
                    </div>
                  </div>
                  <Button 
                    onClick={onCheckDuplicates}
                    className="w-full flex items-center space-x-2"
                    variant="outline"
                  >
                    <Scan className="w-4 h-4" />
                    <span>Check Duplicates</span>
                  </Button>
                </div>

                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium">Clean OG Duplicates</h4>
                      <p className="text-sm text-muted-foreground">
                        Remove original sandwich project duplicates
                      </p>
                    </div>
                  </div>
                  <Button 
                    onClick={onCleanOGDuplicates}
                    className="w-full flex items-center space-x-2 bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100"
                    variant="outline"
                  >
                    <span className="mr-2">👑</span>
                    <span>Clean OG Duplicates</span>
                  </Button>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Run Host Mapping</h4>
                    <p className="text-sm text-muted-foreground">
                      Map collection records to their appropriate host locations
                    </p>
                  </div>
                  <Button 
                    onClick={() => bulkMapMutation.mutate()}
                    disabled={bulkMapMutation.isPending}
                    className="flex items-center space-x-2"
                  >
                    {bulkMapMutation.isPending && <RefreshCw className="w-4 h-4 animate-spin" />}
                    <span>
                      {bulkMapMutation.isPending ? "Mapping..." : "Run Mapping"}
                    </span>
                  </Button>
                </div>
              </div>

              <div className="border rounded-lg p-4 bg-blue-50">
                <div className="flex items-start space-x-3">
                  <Database className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900">Data Import Status</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      Your CSV data import is running in the background. The system automatically
                      maps new records as they're imported. You can manually trigger mapping
                      above if needed.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Host Records Dialog */}
      <Dialog open={showHostRecords} onOpenChange={setShowHostRecords}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center space-x-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowHostRecords(false)}
                className="p-1"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <DialogTitle>Records for {selectedHost}</DialogTitle>
            </div>
          </DialogHeader>
          <div className="space-y-4">
            {hostCollectionsLoading ? (
              <div className="text-center py-8">Loading records...</div>
            ) : (
              <div className="space-y-3">
                {hostCollections?.map((collection: any, index: number) => (
                  <div key={collection.id || index} className="border rounded-lg p-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-600">Date:</span>
                        <div>{collection.collectionDate}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Host:</span>
                        <div>{collection.hostName}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Individual:</span>
                        <div>{collection.individualSandwiches || 0}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Groups:</span>
                        <div>{collection.groupCollections || 0}</div>
                      </div>
                      {collection.notes && (
                        <div className="col-span-2 md:col-span-4">
                          <span className="font-medium text-gray-600">Notes:</span>
                          <div className="text-gray-700">{collection.notes}</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {hostCollections && hostCollections.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No records found for this host
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
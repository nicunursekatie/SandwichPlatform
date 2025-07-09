import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { LoadingState } from "@/components/ui/loading";
import { apiRequest } from "@/lib/queryClient";
import { 
  Download, 
  Search, 
  Database, 
  FileText, 
  Shield, 
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Trash2
} from "lucide-react";

export function DataManagementDashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<string>("all");
  const [exportFormat, setExportFormat] = useState<"csv" | "json">("csv");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch data summary
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["/api/data/summary"],
  });

  // Fetch data integrity status
  const { data: integrityData, isLoading: integrityLoading } = useQuery({
    queryKey: ["/api/data/integrity/check"],
  });

  // Search functionality
  const { data: searchResults, isLoading: searchLoading, refetch: performSearch } = useQuery({
    queryKey: ["/api/search", searchQuery, searchType],
    enabled: false, // Manual trigger
  });

  // Export mutations
  const exportCollectionsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/data/export/collections?format=${exportFormat}`);
      if (!response.ok) throw new Error('Export failed');
      
      if (exportFormat === 'csv') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sandwich_collections.csv';
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sandwich_collections.json';
        a.click();
        window.URL.revokeObjectURL(url);
      }
    },
    onSuccess: () => {
      toast({
        title: "Export Complete",
        description: "Collections data exported successfully",
      });
    },
    onError: () => {
      toast({
        title: "Export Failed",
        description: "Failed to export collections data",
        variant: "destructive",
      });
    }
  });

  const exportHostsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/data/export/hosts?format=${exportFormat}`);
      if (!response.ok) throw new Error('Export failed');
      
      if (exportFormat === 'csv') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'hosts.csv';
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        a.href = url;
        a.download = 'hosts.json';
        a.click();
        window.URL.revokeObjectURL(url);
      }
    },
    onSuccess: () => {
      toast({
        title: "Export Complete",
        description: "Hosts data exported successfully",
      });
    }
  });

  // Bulk operations
  const deduplicateHostsMutation = useMutation({
    mutationFn: () => apiRequest("/api/data/bulk/deduplicate-hosts", { method: "POST" }),
    onSuccess: (data: any) => {
      toast({
        title: "Deduplication Complete",
        description: `Removed ${data.deleted || 0} duplicate hosts`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/data/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/data/integrity/check"] });
    },
    onError: () => {
      toast({
        title: "Deduplication Failed",
        description: "Failed to deduplicate hosts",
        variant: "destructive",
      });
    }
  });

  const handleSearch = () => {
    if (searchQuery.trim()) {
      performSearch();
    }
  };

  if (summaryLoading || integrityLoading) {
    return <LoadingState text="Loading data management dashboard..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Data Management</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Export, search, and manage your data with professional tools
          </p>
        </div>
        <Badge variant="secondary" className="flex items-center gap-2">
          <Database className="w-4 h-4" />
          Professional Tools
        </Badge>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="search">Search</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
          <TabsTrigger value="integrity">Data Integrity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Data Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summary && (
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Collections:</span>
                      <Badge>{summary.collections?.toLocaleString() || 0}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Hosts:</span>
                      <Badge>{summary.hosts?.toLocaleString() || 0}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Projects:</span>
                      <Badge>{summary.projects?.toLocaleString() || 0}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Sandwiches:</span>
                      <Badge variant="secondary">
                        {summary.totalSandwiches?.toLocaleString() || 0}
                      </Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Data Quality
                </CardTitle>
              </CardHeader>
              <CardContent>
                {integrityData && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span>Total Issues:</span>
                      <Badge variant={integrityData.summary.totalIssues > 0 ? "destructive" : "secondary"}>
                        {integrityData.summary.totalIssues}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Critical Issues:</span>
                      <Badge variant={integrityData.summary.criticalIssues > 0 ? "destructive" : "secondary"}>
                        {integrityData.summary.criticalIssues}
                      </Badge>
                    </div>
                    {integrityData.summary.totalIssues === 0 && (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-sm">Data integrity excellent</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  onClick={() => deduplicateHostsMutation.mutate()}
                  disabled={deduplicateHostsMutation.isPending}
                  className="w-full"
                  variant="outline"
                >
                  {deduplicateHostsMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  Remove Duplicates
                </Button>
                <Button
                  onClick={() => queryClient.invalidateQueries()}
                  className="w-full"
                  variant="outline"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Data
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="search" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Global Search
              </CardTitle>
              <CardDescription>
                Search across all data types with advanced filtering
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-4">
                <Input
                  placeholder="Search collections, hosts, projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="flex-1"
                />
                <Select value={searchType} onValueChange={setSearchType}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="collections">Collections</SelectItem>
                    <SelectItem value="hosts">Hosts</SelectItem>
                    <SelectItem value="projects">Projects</SelectItem>
                    <SelectItem value="contacts">Contacts</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleSearch} disabled={searchLoading}>
                  {searchLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                </Button>
              </div>

              {searchResults && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {searchResults.summary?.total || searchResults.results?.length || 0} results
                    </Badge>
                    {searchResults.summary && (
                      <div className="flex gap-2">
                        {searchResults.summary.collections > 0 && (
                          <Badge variant="outline">Collections: {searchResults.summary.collections}</Badge>
                        )}
                        {searchResults.summary.hosts > 0 && (
                          <Badge variant="outline">Hosts: {searchResults.summary.hosts}</Badge>
                        )}
                        {searchResults.summary.projects > 0 && (
                          <Badge variant="outline">Projects: {searchResults.summary.projects}</Badge>
                        )}
                        {searchResults.summary.contacts > 0 && (
                          <Badge variant="outline">Contacts: {searchResults.summary.contacts}</Badge>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {(searchResults.results || []).map((result: any, index: number) => (
                      <Card key={index} className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="capitalize">
                                {result.type}
                              </Badge>
                              <span className="font-medium">{result.title}</span>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {result.description}
                            </p>
                          </div>
                          <Badge variant="secondary" className="ml-2">
                            {Math.round(result.relevance * 100)}% match
                          </Badge>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="w-5 h-5" />
                  Export Data
                </CardTitle>
                <CardDescription>
                  Download your data in CSV or JSON format
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Export Format</label>
                  <Select value={exportFormat} onValueChange={(value: "csv" | "json") => setExportFormat(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV (Spreadsheet)</SelectItem>
                      <SelectItem value="json">JSON (Developer)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Button
                    onClick={() => exportCollectionsMutation.mutate()}
                    disabled={exportCollectionsMutation.isPending}
                    className="w-full"
                    variant="outline"
                  >
                    {exportCollectionsMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <FileText className="w-4 h-4 mr-2" />
                    )}
                    Export Collections
                  </Button>

                  <Button
                    onClick={() => exportHostsMutation.mutate()}
                    disabled={exportHostsMutation.isPending}
                    className="w-full"
                    variant="outline"
                  >
                    {exportHostsMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <FileText className="w-4 h-4 mr-2" />
                    )}
                    Export Hosts
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Full Dataset
                </CardTitle>
                <CardDescription>
                  Complete backup with all data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/data/export/full-dataset');
                      if (!response.ok) throw new Error('Export failed');
                      
                      const blob = await response.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'full_dataset.json';
                      a.click();
                      window.URL.revokeObjectURL(url);
                      
                      toast({
                        title: "Export Complete",
                        description: "Full dataset exported successfully",
                      });
                    } catch (error) {
                      toast({
                        title: "Export Failed",
                        description: "Failed to export full dataset",
                        variant: "destructive",
                      });
                    }
                  }}
                  className="w-full"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Full Dataset
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="integrity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Data Integrity Report
              </CardTitle>
              <CardDescription>
                Identify and resolve data quality issues
              </CardDescription>
            </CardHeader>
            <CardContent>
              {integrityData && (
                <div className="space-y-4">
                  {integrityData.issues.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-green-700 dark:text-green-400">
                        No Issues Found
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        Your data integrity is excellent!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {integrityData.issues.map((issue: any, index: number) => (
                        <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{issue.description}</span>
                              <Badge variant="destructive">{issue.count} items</Badge>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                              Type: {issue.type.replace(/_/g, ' ')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
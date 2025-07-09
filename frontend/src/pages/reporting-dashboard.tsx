import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar, FileText, Mail, Download, Settings, BarChart3, LineChart, PieChart, LogOut } from "lucide-react";
import { format, subDays, subWeeks, subMonths } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import SimpleNav from "@/components/simple-nav";

interface ReportConfig {
  type: 'collections' | 'hosts' | 'impact' | 'comprehensive';
  dateRange: {
    start: string;
    end: string;
  };
  format: 'pdf' | 'csv' | 'json';
  includeCharts: boolean;
  groupBy?: 'week' | 'month' | 'host' | 'project';
  filters?: {
    hostIds?: number[];
    projectIds?: number[];
    status?: string[];
  };
}

interface ScheduledReport {
  id: number;
  config: ReportConfig;
  schedule: {
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string;
    recipients: string[];
  };
  nextRun: string;
  status: 'active' | 'paused';
}

export default function ReportingDashboard({ isEmbedded = false }: { isEmbedded?: boolean }) {
  const { toast } = useToast();
  const [reportConfig, setReportConfig] = useState<ReportConfig>({
    type: 'collections',
    dateRange: {
      start: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
      end: format(new Date(), 'yyyy-MM-dd')
    },
    format: 'csv',
    includeCharts: true,
    groupBy: 'month'
  });

  const [scheduleConfig, setScheduleConfig] = useState({
    frequency: 'weekly' as const,
    time: '09:00',
    recipients: ['']
  });

  // Query for scheduled reports
  const { data: scheduledReports = [], refetch: refetchScheduled } = useQuery({
    queryKey: ['/api/reports/scheduled'],
    retry: false
  });

  // Query for recent reports
  const { data: recentReports = [] } = useQuery({
    queryKey: ['/api/reports/recent'],
    retry: false
  });

  // Generate report mutation
  const generateReport = useMutation({
    mutationFn: async (config: ReportConfig) => {
      const response = await apiRequest('POST', '/api/reports/generate', config);
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Report Generated",
        description: "Your report has been generated successfully.",
      });
      
      // Trigger download
      const downloadUrl = `/api/reports/download/${data.id}`;
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${data.metadata.title}-${format(new Date(), 'yyyy-MM-dd')}.${reportConfig.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    onError: (error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Schedule report mutation
  const scheduleReport = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/reports/schedule', {
        config: reportConfig,
        schedule: scheduleConfig
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Report Scheduled",
        description: "Your automated report has been scheduled successfully.",
      });
      refetchScheduled();
    },
    onError: (error) => {
      toast({
        title: "Scheduling Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleQuickDateRange = (range: string) => {
    const now = new Date();
    let start: Date;

    switch (range) {
      case 'last7days':
        start = subDays(now, 7);
        break;
      case 'last30days':
        start = subDays(now, 30);
        break;
      case 'last3months':
        start = subMonths(now, 3);
        break;
      case 'last6months':
        start = subMonths(now, 6);
        break;
      case 'lastyear':
        start = subMonths(now, 12);
        break;
      default:
        return;
    }

    setReportConfig({
      ...reportConfig,
      dateRange: {
        start: format(start, 'yyyy-MM-dd'),
        end: format(now, 'yyyy-MM-dd')
      }
    });
  };

  const addRecipient = () => {
    setScheduleConfig({
      ...scheduleConfig,
      recipients: [...scheduleConfig.recipients, '']
    });
  };

  const updateRecipient = (index: number, value: string) => {
    const newRecipients = [...scheduleConfig.recipients];
    newRecipients[index] = value;
    setScheduleConfig({
      ...scheduleConfig,
      recipients: newRecipients
    });
  };

  const removeRecipient = (index: number) => {
    setScheduleConfig({
      ...scheduleConfig,
      recipients: scheduleConfig.recipients.filter((_, i) => i !== index)
    });
  };

  // Render content-only when embedded in dashboard
  const renderReportingContent = () => (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Reporting Dashboard</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-2">
            Generate comprehensive reports and schedule automated deliveries
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-10 text-sm">
            <FileText className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Templates</span>
            <span className="sm:hidden">Temp</span>
          </Button>
          <Button variant="outline" size="sm" className="h-10 text-sm">
            <Settings className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Settings</span>
            <span className="sm:hidden">Set</span>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="generate" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="generate">Generate Report</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled Reports</TabsTrigger>
          <TabsTrigger value="history">Report History</TabsTrigger>
        </TabsList>

        <TabsContent value="generate">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Report Configuration */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Report Configuration</CardTitle>
                  <CardDescription>
                    Configure your report parameters and data selection
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Report Type */}
                  <div>
                    <Label htmlFor="reportType">Report Type</Label>
                    <Select
                      value={reportConfig.type}
                      onValueChange={(value: any) => setReportConfig({ ...reportConfig, type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="collections">Collection Analysis</SelectItem>
                        <SelectItem value="hosts">Host Performance</SelectItem>
                        <SelectItem value="impact">Impact Assessment</SelectItem>
                        <SelectItem value="comprehensive">Comprehensive Report</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Date Range */}
                  <div className="space-y-4">
                    <Label>Date Range</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="startDate" className="text-sm">From</Label>
                        <Input
                          id="startDate"
                          type="date"
                          value={reportConfig.dateRange.start}
                          onChange={(e) => setReportConfig({
                            ...reportConfig,
                            dateRange: { ...reportConfig.dateRange, start: e.target.value }
                          })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="endDate" className="text-sm">To</Label>
                        <Input
                          id="endDate"
                          type="date"
                          value={reportConfig.dateRange.end}
                          onChange={(e) => setReportConfig({
                            ...reportConfig,
                            dateRange: { ...reportConfig.dateRange, end: e.target.value }
                          })}
                        />
                      </div>
                    </div>
                    
                    {/* Quick Date Ranges */}
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleQuickDateRange('last7days')}>
                        Last 7 Days
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleQuickDateRange('last30days')}>
                        Last 30 Days
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleQuickDateRange('last3months')}>
                        Last 3 Months
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleQuickDateRange('last6months')}>
                        Last 6 Months
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleQuickDateRange('lastyear')}>
                        Last Year
                      </Button>
                    </div>
                  </div>

                  {/* Format & Options */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="format">Output Format</Label>
                      <Select
                        value={reportConfig.format}
                        onValueChange={(value: any) => setReportConfig({ ...reportConfig, format: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pdf">PDF Document</SelectItem>
                          <SelectItem value="csv">CSV Spreadsheet</SelectItem>
                          <SelectItem value="json">JSON Data</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="groupBy">Group Data By</Label>
                      <Select
                        value={reportConfig.groupBy}
                        onValueChange={(value: any) => setReportConfig({ ...reportConfig, groupBy: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="week">Week</SelectItem>
                          <SelectItem value="month">Month</SelectItem>
                          <SelectItem value="host">Host</SelectItem>
                          <SelectItem value="project">Project</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Chart Options */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label htmlFor="includeCharts">Include Charts & Visualizations</Label>
                      <p className="text-sm text-gray-500">
                        Add visual charts and graphs to your report
                      </p>
                    </div>
                    <Switch
                      id="includeCharts"
                      checked={reportConfig.includeCharts}
                      onCheckedChange={(checked) => setReportConfig({ ...reportConfig, includeCharts: checked })}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Schedule Automation */}
              <Card>
                <CardHeader>
                  <CardTitle>Schedule Automation</CardTitle>
                  <CardDescription>
                    Set up automated report generation and email delivery
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Frequency */}
                  <div>
                    <Label htmlFor="frequency">Frequency</Label>
                    <Select
                      value={scheduleConfig.frequency}
                      onValueChange={(value: any) => setScheduleConfig({ ...scheduleConfig, frequency: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Time */}
                  <div>
                    <Label htmlFor="time">Delivery Time</Label>
                    <Input
                      id="time"
                      type="time"
                      value={scheduleConfig.time}
                      onChange={(e) => setScheduleConfig({ ...scheduleConfig, time: e.target.value })}
                    />
                  </div>

                  {/* Recipients */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Email Recipients</Label>
                      <Button variant="outline" size="sm" onClick={addRecipient}>
                        Add Recipient
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {scheduleConfig.recipients.map((recipient, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            type="email"
                            placeholder="email@example.com"
                            value={recipient}
                            onChange={(e) => updateRecipient(index, e.target.value)}
                          />
                          {scheduleConfig.recipients.length > 1 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removeRecipient(index)}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Preview & Actions */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Report Preview</CardTitle>
                  <CardDescription>
                    Summary of your report configuration
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Type:</span>
                      <Badge variant="secondary">
                        {reportConfig.type === 'collections' && 'Collection Analysis'}
                        {reportConfig.type === 'hosts' && 'Host Performance'}
                        {reportConfig.type === 'impact' && 'Impact Assessment'}
                        {reportConfig.type === 'comprehensive' && 'Comprehensive'}
                      </Badge>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Period:</span>
                      <span className="text-sm text-gray-600">
                        {format(new Date(reportConfig.dateRange.start), 'MMM dd')} - {format(new Date(reportConfig.dateRange.end), 'MMM dd, yyyy')}
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Format:</span>
                      <span className="text-sm text-gray-600 uppercase">
                        {reportConfig.format}
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Charts:</span>
                      <span className="text-sm text-gray-600">
                        {reportConfig.includeCharts ? 'Included' : 'Not included'}
                      </span>
                    </div>
                  </div>
                  
                  {reportConfig.includeCharts && (
                    <div className="pt-4 border-t">
                      <p className="text-sm font-medium mb-2">Chart Types:</p>
                      <div className="flex gap-2">
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <BarChart3 className="w-3 h-3" />
                          Bar Charts
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <LineChart className="w-3 h-3" />
                          Trend Lines
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <PieChart className="w-3 h-3" />
                          Distribution
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="space-y-3">
                <Button
                  className="w-full"
                  onClick={() => generateReport.mutate(reportConfig)}
                  disabled={generateReport.isPending}
                >
                  <Download className="w-4 h-4 mr-2" />
                  {generateReport.isPending ? 'Generating...' : 'Generate Report'}
                </Button>
                
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => scheduleReport.mutate()}
                  disabled={scheduleReport.isPending || scheduleConfig.recipients.some(r => !r.trim())}
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  {scheduleReport.isPending ? 'Scheduling...' : 'Schedule Report'}
                </Button>
              </div>

              {scheduleConfig.recipients.some(r => !r.trim()) && (
                <Alert>
                  <AlertDescription>
                    Please add at least one valid email recipient to schedule the report.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="scheduled">
          <Card>
            <CardHeader>
              <CardTitle>Scheduled Reports</CardTitle>
              <CardDescription>
                Manage your automated report schedules
              </CardDescription>
            </CardHeader>
            <CardContent>
              {scheduledReports.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No Scheduled Reports
                  </h3>
                  <p className="text-gray-500">
                    You haven't set up any automated reports yet. Create one from the Generate tab.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {scheduledReports.map((report: ScheduledReport) => (
                    <div key={report.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">
                            {report.config.type === 'collections' && 'Collection Analysis'}
                            {report.config.type === 'hosts' && 'Host Performance'}
                            {report.config.type === 'impact' && 'Impact Assessment'}
                            {report.config.type === 'comprehensive' && 'Comprehensive Report'}
                          </h4>
                          <p className="text-sm text-gray-500">
                            {report.schedule.frequency} at {report.schedule.time} • Next: {format(new Date(report.nextRun), 'MMM dd, yyyy HH:mm')}
                          </p>
                          <div className="flex items-center gap-4 mt-2">
                            <span className="text-xs text-gray-500">
                              {report.schedule.recipients.length} recipient(s)
                            </span>
                            <Badge variant={report.status === 'active' ? 'default' : 'secondary'}>
                              {report.status}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            Edit
                          </Button>
                          <Button variant="outline" size="sm">
                            {report.status === 'active' ? 'Pause' : 'Resume'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Report History</CardTitle>
              <CardDescription>
                View and download previously generated reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentReports.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No Report History
                  </h3>
                  <p className="text-gray-500">
                    Generated reports will appear here for easy access and download.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentReports.map((report: any) => (
                    <div key={report.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{report.title}</h4>
                          <p className="text-sm text-gray-500">
                            Generated {format(new Date(report.generatedAt), 'MMM dd, yyyy HH:mm')}
                          </p>
                          <div className="flex items-center gap-4 mt-2">
                            <span className="text-xs text-gray-500">
                              {report.format.toUpperCase()} • {report.size}
                            </span>
                            <Badge variant="outline">
                              {report.dateRange}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </Button>
                          <Button variant="outline" size="sm">
                            <Mail className="w-4 h-4 mr-2" />
                            Share
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );

  // Return embedded content only when called from dashboard
  if (isEmbedded) {
    return renderReportingContent();
  }

  // Return full layout when accessed directly
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
          {renderReportingContent()}
        </div>
      </div>
    </div>
  );
}
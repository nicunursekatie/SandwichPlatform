import { storage } from "../storage-wrapper";
import { format } from "date-fns";

export interface ReportConfig {
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

export interface ReportData {
  metadata: {
    title: string;
    generatedAt: string;
    dateRange: string;
    totalRecords: number;
    format: string;
  };
  summary: {
    totalSandwiches: number;
    totalHosts: number;
    activeProjects: number;
    topPerformers: Array<{
      name: string;
      value: number;
      type: 'host' | 'project';
    }>;
  };
  data: any[];
  charts?: Array<{
    type: 'bar' | 'line' | 'pie';
    title: string;
    data: any[];
  }>;
}

export class ReportGenerator {
  static async generateReport(config: ReportConfig): Promise<ReportData> {
    const startDate = new Date(config.dateRange.start);
    const endDate = new Date(config.dateRange.end);

    let data: any[] = [];
    let totalSandwiches = 0;
    let totalHosts = 0;
    let activeProjects = 0;

    switch (config.type) {
      case 'collections':
        data = await this.getCollectionsData(startDate, endDate, config.filters);
        totalSandwiches = data.reduce((sum, item) => sum + (item.individualSandwiches || 0), 0);
        break;

      case 'hosts':
        data = await this.getHostsData(config.filters);
        totalHosts = data.length;
        break;

      case 'impact':
        data = await this.getImpactData(startDate, endDate);
        totalSandwiches = data.reduce((sum, item) => sum + (item.totalSandwiches || 0), 0);
        break;

      case 'comprehensive':
        const [collections, hosts, projects] = await Promise.all([
          this.getCollectionsData(startDate, endDate, config.filters),
          this.getHostsData(config.filters),
          this.getProjectsData(config.filters)
        ]);
        data = { collections, hosts, projects };
        totalSandwiches = collections.reduce((sum, item) => sum + (item.individualSandwiches || 0), 0);
        totalHosts = hosts.length;
        activeProjects = projects.filter(p => p.status === 'active').length;
        break;
    }

    const topPerformers = await this.getTopPerformers(startDate, endDate);
    
    const charts = config.includeCharts ? await this.generateCharts(config, data) : undefined;

    return {
      metadata: {
        title: this.getReportTitle(config),
        generatedAt: new Date().toISOString(),
        dateRange: `${format(startDate, 'MMM dd, yyyy')} - ${format(endDate, 'MMM dd, yyyy')}`,
        totalRecords: Array.isArray(data) ? data.length : Object.values(data).flat().length,
        format: config.format
      },
      summary: {
        totalSandwiches,
        totalHosts,
        activeProjects,
        topPerformers
      },
      data,
      charts
    };
  }

  private static async getCollectionsData(startDate: Date, endDate: Date, filters?: any) {
    try {
      const collections = await storage.getSandwichCollections();
      return collections
        .filter(c => {
          const collectionDate = new Date(c.collectionDate);
          const inDateRange = collectionDate >= startDate && collectionDate <= endDate;
          
          if (!inDateRange) return false;
          
          if (filters?.hostIds?.length) {
            // This would need host ID mapping - simplified for now
            return true;
          }
          
          return true;
        })
        .map(c => ({
          id: c.id,
          date: c.collectionDate,
          hostName: c.hostName,
          individualSandwiches: c.individualSandwiches,
          groupCollections: c.groupCollections,
          submittedAt: c.submittedAt
        }));
    } catch (error) {
      console.error('Error getting collections data for report:', error);
      return [];
    }
  }

  private static async getHostsData(filters?: any) {
    try {
      const hosts = await storage.getHosts();
      return hosts
        .filter(h => {
          if (filters?.status?.length) {
            return filters.status.includes(h.status);
          }
          return true;
        })
        .map(h => ({
          id: h.id,
          name: h.name,
          address: h.address,
          status: h.status,
          notes: h.notes,
          createdAt: h.createdAt
        }));
    } catch (error) {
      console.error('Error getting hosts data for report:', error);
      return [];
    }
  }

  private static async getProjectsData(filters?: any) {
    try {
      const projects = await storage.getProjects();
      return projects
        .filter(p => {
          if (filters?.projectIds?.length) {
            return filters.projectIds.includes(p.id);
          }
          if (filters?.status?.length) {
            return filters.status.includes(p.status);
          }
          return true;
        })
        .map(p => ({
          id: p.id,
          title: p.title,
          status: p.status,
          priority: p.priority,
          assignedTo: p.assignedTo,
          createdAt: p.createdAt,
          dueDate: p.dueDate
        }));
    } catch (error) {
      console.error('Error getting projects data for report:', error);
      return [];
    }
  }

  private static async getImpactData(startDate: Date, endDate: Date) {
    try {
      const collections = await this.getCollectionsData(startDate, endDate);
      
      // Group by month for impact analysis
      const monthlyImpact = collections.reduce((acc, collection) => {
        const month = format(new Date(collection.date), 'yyyy-MM');
        if (!acc[month]) {
          acc[month] = {
            month,
            totalSandwiches: 0,
            totalCollections: 0,
            uniqueHosts: new Set()
          };
        }
        acc[month].totalSandwiches += collection.individualSandwiches;
        acc[month].totalCollections += 1;
        acc[month].uniqueHosts.add(collection.hostName);
        return acc;
      }, {} as any);

      return Object.values(monthlyImpact).map((item: any) => ({
        ...item,
        uniqueHosts: item.uniqueHosts.size
      }));
    } catch (error) {
      console.error('Error getting impact data for report:', error);
      return [];
    }
  }

  private static async getTopPerformers(startDate: Date, endDate: Date) {
    try {
      const collections = await this.getCollectionsData(startDate, endDate);
      
      // Group by host to find top performers
      const hostPerformance = collections.reduce((acc, collection) => {
        const hostName = collection.hostName;
        if (!acc[hostName]) {
          acc[hostName] = 0;
        }
        acc[hostName] += collection.individualSandwiches;
        return acc;
      }, {} as Record<string, number>);

      return Object.entries(hostPerformance)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, value]) => ({
          name,
          value,
          type: 'host' as const
        }));
    } catch (error) {
      console.error('Error getting top performers for report:', error);
      return [];
    }
  }

  private static async generateCharts(config: ReportConfig, data: any) {
    const charts = [];

    if (config.type === 'collections' && Array.isArray(data)) {
      // Monthly trend chart
      const monthlyData = data.reduce((acc, item) => {
        const month = format(new Date(item.date), 'MMM yyyy');
        acc[month] = (acc[month] || 0) + item.individualSandwiches;
        return acc;
      }, {} as Record<string, number>);

      charts.push({
        type: 'line' as const,
        title: 'Monthly Collection Trends',
        data: Object.entries(monthlyData).map(([month, total]) => ({
          label: month,
          value: total
        }))
      });

      // Top hosts chart
      const hostData = data.reduce((acc, item) => {
        acc[item.hostName] = (acc[item.hostName] || 0) + item.individualSandwiches;
        return acc;
      }, {} as Record<string, number>);

      charts.push({
        type: 'bar' as const,
        title: 'Top Performing Hosts',
        data: Object.entries(hostData)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([host, total]) => ({
            label: host,
            value: total
          }))
      });
    }

    return charts;
  }

  private static getReportTitle(config: ReportConfig): string {
    const typeNames = {
      collections: 'Sandwich Collections Report',
      hosts: 'Host Performance Report',
      impact: 'Impact Analysis Report',
      comprehensive: 'Comprehensive Operations Report'
    };

    return typeNames[config.type] || 'Custom Report';
  }

  static async scheduleReport(config: ReportConfig, schedule: {
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string; // HH:MM format
    recipients: string[];
  }) {
    // Store scheduled report configuration
    // This would integrate with a job scheduler in production
    const scheduledReport = {
      id: Date.now(),
      config,
      schedule,
      createdAt: new Date().toISOString(),
      nextRun: this.calculateNextRun(schedule)
    };

    console.log('Scheduled report configured:', scheduledReport);
    return scheduledReport;
  }

  private static calculateNextRun(schedule: any): string {
    const now = new Date();
    const [hours, minutes] = schedule.time.split(':').map(Number);
    
    const nextRun = new Date(now);
    nextRun.setHours(hours, minutes, 0, 0);
    
    if (nextRun <= now) {
      switch (schedule.frequency) {
        case 'daily':
          nextRun.setDate(nextRun.getDate() + 1);
          break;
        case 'weekly':
          nextRun.setDate(nextRun.getDate() + 7);
          break;
        case 'monthly':
          nextRun.setMonth(nextRun.getMonth() + 1);
          break;
      }
    }
    
    return nextRun.toISOString();
  }
}
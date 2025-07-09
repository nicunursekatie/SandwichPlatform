import { db } from "./db";
import { 
  sandwichCollections, 
  hosts, 
  recipients, 
  projects, 
  contacts,
  messages,
  hostContacts
} from "@shared/schema";
import { sql, ilike, or, and, gte, lte } from "drizzle-orm";

export interface SearchFilters {
  dateRange?: {
    start: string;
    end: string;
  };
  status?: string[];
  category?: string[];
  hostNames?: string[];
  minCount?: number;
  maxCount?: number;
}

export interface SearchResult {
  type: 'collection' | 'host' | 'recipient' | 'project' | 'contact' | 'message';
  id: number | string;
  title: string;
  description: string;
  relevance: number;
  metadata: Record<string, any>;
}

export class SearchEngine {
  static async searchCollections(
    query: string, 
    filters: SearchFilters = {},
    limit: number = 50
  ): Promise<SearchResult[]> {
    try {
      let dbQuery = db.select().from(sandwichCollections);
      const conditions = [];

      // Text search
      if (query.trim()) {
        conditions.push(
          or(
            ilike(sandwichCollections.hostName, `%${query}%`),
            ilike(sandwichCollections.notes, `%${query}%`)
          )
        );
      }

      // Date range filter
      if (filters.dateRange) {
        conditions.push(
          and(
            gte(sandwichCollections.collectionDate, filters.dateRange.start),
            lte(sandwichCollections.collectionDate, filters.dateRange.end)
          )
        );
      }

      // Host names filter
      if (filters.hostNames?.length) {
        conditions.push(
          sql`${sandwichCollections.hostName} = ANY(${filters.hostNames})`
        );
      }

      // Count range filters
      if (filters.minCount !== undefined) {
        conditions.push(gte(sandwichCollections.sandwichCount, filters.minCount));
      }
      if (filters.maxCount !== undefined) {
        conditions.push(lte(sandwichCollections.sandwichCount, filters.maxCount));
      }

      if (conditions.length > 0) {
        dbQuery = dbQuery.where(and(...conditions));
      }

      const results = await dbQuery.limit(limit);

      return results.map(item => ({
        type: 'collection' as const,
        id: item.id,
        title: `${item.hostName} - ${item.collectionDate}`,
        description: `${item.sandwichCount} sandwiches collected ${item.notes ? `- ${item.notes}` : ''}`,
        relevance: this.calculateRelevance(query, [item.hostName, item.notes || '']),
        metadata: {
          hostName: item.hostName,
          date: item.collectionDate,
          count: item.sandwichCount,
          notes: item.notes
        }
      }));
    } catch (error) {
      console.error('Collection search failed:', error);
      return [];
    }
  }

  static async searchHosts(
    query: string,
    filters: SearchFilters = {},
    limit: number = 50
  ): Promise<SearchResult[]> {
    try {
      let dbQuery = db.select().from(hosts);
      const conditions = [];

      if (query.trim()) {
        conditions.push(
          or(
            ilike(hosts.name, `%${query}%`),
            ilike(hosts.address, `%${query}%`),
            ilike(hosts.notes, `%${query}%`)
          )
        );
      }

      if (filters.status?.length) {
        conditions.push(sql`${hosts.status} = ANY(${filters.status})`);
      }

      if (conditions.length > 0) {
        dbQuery = dbQuery.where(and(...conditions));
      }

      const results = await dbQuery.limit(limit);

      return results.map(item => ({
        type: 'host' as const,
        id: item.id,
        title: item.name,
        description: `${item.status} - ${item.address || 'No address'} ${item.capacity ? `(Capacity: ${item.capacity})` : ''}`,
        relevance: this.calculateRelevance(query, [item.name, item.address || '', item.notes || '']),
        metadata: {
          address: item.address,
          status: item.status,
          capacity: item.capacity,
          notes: item.notes
        }
      }));
    } catch (error) {
      console.error('Host search failed:', error);
      return [];
    }
  }

  static async searchProjects(
    query: string,
    filters: SearchFilters = {},
    limit: number = 50
  ): Promise<SearchResult[]> {
    try {
      let dbQuery = db.select().from(projects);
      const conditions = [];

      if (query.trim()) {
        conditions.push(
          or(
            ilike(projects.title, `%${query}%`),
            ilike(projects.description, `%${query}%`),
            ilike(projects.assigneeName, `%${query}%`),
            ilike(projects.notes, `%${query}%`)
          )
        );
      }

      if (filters.status?.length) {
        conditions.push(sql`${projects.status} = ANY(${filters.status})`);
      }

      if (filters.category?.length) {
        conditions.push(sql`${projects.category} = ANY(${filters.category})`);
      }

      if (conditions.length > 0) {
        dbQuery = dbQuery.where(and(...conditions));
      }

      const results = await dbQuery.limit(limit);

      return results.map(item => ({
        type: 'project' as const,
        id: item.id,
        title: item.title,
        description: `${item.status} - ${item.description?.substring(0, 100)}${item.description && item.description.length > 100 ? '...' : ''}`,
        relevance: this.calculateRelevance(query, [item.title, item.description || '', item.assigneeName || '']),
        metadata: {
          status: item.status,
          priority: item.priority,
          category: item.category,
          assignee: item.assigneeName,
          dueDate: item.dueDate,
          progress: item.progressPercentage
        }
      }));
    } catch (error) {
      console.error('Project search failed:', error);
      return [];
    }
  }

  static async searchContacts(
    query: string,
    limit: number = 50
  ): Promise<SearchResult[]> {
    try {
      let dbQuery = db.select().from(contacts);
      const conditions = [];

      if (query.trim()) {
        conditions.push(
          or(
            ilike(contacts.name, `%${query}%`),
            ilike(contacts.organization, `%${query}%`),
            ilike(contacts.role, `%${query}%`),
            ilike(contacts.phone, `%${query}%`),
            ilike(contacts.email, `%${query}%`)
          )
        );
      }

      if (conditions.length > 0) {
        dbQuery = dbQuery.where(and(...conditions));
      }

      const results = await dbQuery.limit(limit);

      return results.map(item => ({
        type: 'contact' as const,
        id: item.id,
        title: item.name,
        description: `${item.role || 'Contact'} ${item.organization ? `at ${item.organization}` : ''} - ${item.phone}`,
        relevance: this.calculateRelevance(query, [item.name, item.organization || '', item.role || '', item.phone, item.email || '']),
        metadata: {
          organization: item.organization,
          role: item.role,
          phone: item.phone,
          email: item.email,
          category: item.category,
          status: item.status
        }
      }));
    } catch (error) {
      console.error('Contact search failed:', error);
      return [];
    }
  }

  static async globalSearch(
    query: string,
    filters: SearchFilters = {},
    limit: number = 100
  ): Promise<{ results: SearchResult[]; summary: Record<string, number> }> {
    try {
      const [
        collectionResults,
        hostResults,
        projectResults,
        contactResults
      ] = await Promise.all([
        this.searchCollections(query, filters, Math.floor(limit * 0.4)),
        this.searchHosts(query, filters, Math.floor(limit * 0.2)),
        this.searchProjects(query, filters, Math.floor(limit * 0.3)),
        this.searchContacts(query, Math.floor(limit * 0.1))
      ]);

      const allResults = [
        ...collectionResults,
        ...hostResults,
        ...projectResults,
        ...contactResults
      ];

      // Sort by relevance
      allResults.sort((a, b) => b.relevance - a.relevance);

      const summary = {
        collections: collectionResults.length,
        hosts: hostResults.length,
        projects: projectResults.length,
        contacts: contactResults.length,
        total: allResults.length
      };

      return {
        results: allResults.slice(0, limit),
        summary
      };
    } catch (error) {
      console.error('Global search failed:', error);
      return {
        results: [],
        summary: { collections: 0, hosts: 0, projects: 0, contacts: 0, total: 0 }
      };
    }
  }

  static async getSearchSuggestions(
    query: string,
    type?: 'collection' | 'host' | 'project' | 'contact'
  ): Promise<string[]> {
    try {
      const suggestions: Set<string> = new Set();
      
      if (!type || type === 'host') {
        const hostNames = await db.select({ name: hosts.name })
          .from(hosts)
          .where(ilike(hosts.name, `%${query}%`))
          .limit(10);
        hostNames.forEach(h => suggestions.add(h.name));
      }

      if (!type || type === 'project') {
        const projectTitles = await db.select({ title: projects.title })
          .from(projects)
          .where(ilike(projects.title, `%${query}%`))
          .limit(10);
        projectTitles.forEach(p => suggestions.add(p.title));
      }

      return Array.from(suggestions).slice(0, 10);
    } catch (error) {
      console.error('Search suggestions failed:', error);
      return [];
    }
  }

  private static calculateRelevance(query: string, fields: string[]): number {
    if (!query.trim()) return 0.5;

    const queryLower = query.toLowerCase();
    let relevance = 0;

    fields.forEach((field, index) => {
      if (!field) return;
      
      const fieldLower = field.toLowerCase();
      
      // Exact match gets highest score
      if (fieldLower === queryLower) {
        relevance += 1.0 / (index + 1);
      }
      // Starts with query gets high score
      else if (fieldLower.startsWith(queryLower)) {
        relevance += 0.8 / (index + 1);
      }
      // Contains query gets medium score
      else if (fieldLower.includes(queryLower)) {
        relevance += 0.5 / (index + 1);
      }
      // Fuzzy match gets low score
      else if (this.fuzzyMatch(queryLower, fieldLower)) {
        relevance += 0.2 / (index + 1);
      }
    });

    return Math.min(relevance, 1.0);
  }

  private static fuzzyMatch(query: string, text: string): boolean {
    // Simple fuzzy matching - checks if most characters of query appear in order in text
    let queryIndex = 0;
    let matches = 0;

    for (let i = 0; i < text.length && queryIndex < query.length; i++) {
      if (text[i] === query[queryIndex]) {
        matches++;
        queryIndex++;
      }
    }

    return matches / query.length >= 0.7; // 70% of characters must match
  }
}
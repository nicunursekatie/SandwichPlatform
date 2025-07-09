import { LRUCache } from 'lru-cache';

export interface CacheOptions {
  maxSize?: number;
  ttl?: number; // Time to live in milliseconds
  staleWhileRevalidate?: boolean;
}

export class CacheManager {
  private static instances = new Map<string, LRUCache<string, any>>();

  static getCache(name: string, options: CacheOptions = {}): LRUCache<string, any> {
    if (!this.instances.has(name)) {
      const cache = new LRUCache({
        max: options.maxSize || 500,
        ttl: options.ttl || 300000, // 5 minutes default
        allowStale: options.staleWhileRevalidate || false,
        updateAgeOnGet: true,
        updateAgeOnHas: true
      });
      this.instances.set(name, cache);
    }
    return this.instances.get(name)!;
  }

  // Optimized cache for frequently accessed data
  static collections = this.getCache('collections', { maxSize: 1000, ttl: 120000 }); // 2 minutes
  static hosts = this.getCache('hosts', { maxSize: 200, ttl: 300000 }); // 5 minutes
  static projects = this.getCache('projects', { maxSize: 100, ttl: 180000 }); // 3 minutes
  static stats = this.getCache('stats', { maxSize: 50, ttl: 60000 }); // 1 minute
  static search = this.getCache('search', { maxSize: 300, ttl: 600000 }); // 10 minutes
  static users = this.getCache('users', { maxSize: 100, ttl: 900000 }); // 15 minutes

  // Cache wrapper with automatic key generation
  static async withCache<T>(
    cacheName: string,
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cache = this.getCache(cacheName, options);
    
    // Check if data exists in cache
    if (cache.has(key)) {
      return cache.get(key);
    }

    // Fetch fresh data
    const data = await fetcher();
    
    // Store in cache
    cache.set(key, data);
    
    return data;
  }

  // Invalidate specific cache entries
  static invalidate(cacheName: string, pattern?: string) {
    const cache = this.instances.get(cacheName);
    if (!cache) return;

    if (pattern) {
      // Clear entries matching pattern
      const keys = Array.from(cache.keys());
      const regex = new RegExp(pattern);
      keys.forEach(key => {
        if (regex.test(key)) {
          cache.delete(key);
        }
      });
    } else {
      // Clear entire cache
      cache.clear();
    }
  }

  // Get cache statistics
  static getStats() {
    const stats = {};
    for (const [name, cache] of this.instances) {
      stats[name] = {
        size: cache.size,
        maxSize: cache.max,
        hitRate: cache.calculatedSize / (cache.calculatedSize + cache.missCount || 1),
        missCount: cache.missCount || 0
      };
    }
    return stats;
  }

  // Smart cache warming for critical data
  static async warmCaches() {
    console.log('Warming critical caches...');
    
    // Pre-load frequently accessed data
    const warmingTasks = [
      this.warmCollectionStats(),
      this.warmActiveHosts(),
      this.warmRecentProjects()
    ];

    await Promise.allSettled(warmingTasks);
    console.log('Cache warming completed');
  }

  private static async warmCollectionStats() {
    try {
      // This would typically call your stats API endpoint
      const response = await fetch('/api/sandwich-collections/stats');
      if (response.ok) {
        const stats = await response.json();
        this.stats.set('collection-stats', stats);
      }
    } catch (error) {
      console.warn('Failed to warm collection stats cache:', error);
    }
  }

  private static async warmActiveHosts() {
    try {
      const response = await fetch('/api/hosts?status=active');
      if (response.ok) {
        const hosts = await response.json();
        this.hosts.set('active-hosts', hosts);
      }
    } catch (error) {
      console.warn('Failed to warm hosts cache:', error);
    }
  }

  private static async warmRecentProjects() {
    try {
      const response = await fetch('/api/projects?recent=true');
      if (response.ok) {
        const projects = await response.json();
        this.projects.set('recent-projects', projects);
      }
    } catch (error) {
      console.warn('Failed to warm projects cache:', error);
    }
  }

  // Cache-aware pagination
  static generatePaginationKey(endpoint: string, page: number, limit: number, filters?: Record<string, any>): string {
    const filterStr = filters ? JSON.stringify(filters) : '';
    return `${endpoint}:page=${page}:limit=${limit}:filters=${filterStr}`;
  }

  // Intelligent cache preloading for pagination
  static async preloadNextPage(endpoint: string, currentPage: number, limit: number, fetcher: (page: number) => Promise<any>) {
    const nextPageKey = this.generatePaginationKey(endpoint, currentPage + 1, limit);
    const cache = this.getCache('pagination', { maxSize: 1000, ttl: 300000 });
    
    if (!cache.has(nextPageKey)) {
      // Preload next page in background
      setTimeout(async () => {
        try {
          const nextPageData = await fetcher(currentPage + 1);
          cache.set(nextPageKey, nextPageData);
        } catch (error) {
          console.warn('Failed to preload next page:', error);
        }
      }, 100);
    }
  }

  // Memory-efficient cache cleanup
  static performMaintenance() {
    for (const [name, cache] of this.instances) {
      const sizeBefore = cache.size;
      cache.purgeStale();
      const sizeAfter = cache.size;
      
      if (sizeBefore > sizeAfter) {
        console.log(`Cache ${name}: cleaned ${sizeBefore - sizeAfter} stale entries`);
      }
    }
  }
}
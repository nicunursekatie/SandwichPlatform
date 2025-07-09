/**
 * Database query optimization utilities
 */

export class QueryOptimizer {
  private static queryCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private static readonly DEFAULT_TTL = 30000; // 30 seconds

  /**
   * Cache frequently accessed queries
   */
  static async getCachedQuery<T>(
    key: string,
    queryFn: () => Promise<T>,
    ttl: number = this.DEFAULT_TTL
  ): Promise<T> {
    const cached = this.queryCache.get(key);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < cached.ttl) {
      return cached.data;
    }

    const data = await queryFn();
    this.queryCache.set(key, { data, timestamp: now, ttl });
    
    return data;
  }

  /**
   * Invalidate cache for specific keys
   */
  static invalidateCache(pattern: string) {
    for (const key of this.queryCache.keys()) {
      if (key.includes(pattern)) {
        this.queryCache.delete(key);
      }
    }
  }

  /**
   * Clear expired cache entries
   */
  static cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this.queryCache.entries()) {
      if ((now - value.timestamp) > value.ttl) {
        this.queryCache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  static getCacheStats() {
    return {
      size: this.queryCache.size,
      keys: Array.from(this.queryCache.keys())
    };
  }
}

// Auto-cleanup every 5 minutes
setInterval(() => {
  QueryOptimizer.cleanupCache();
}, 5 * 60 * 1000);
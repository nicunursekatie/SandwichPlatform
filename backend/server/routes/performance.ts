import type { Express } from "express";
import { QueryOptimizer } from "../performance/query-optimizer";
import { CacheManager } from "../performance/cache-manager";

export function registerPerformanceRoutes(app: Express) {
  // Performance health check endpoint
  app.get('/api/performance/health', async (req, res) => {
    try {
      const health = await QueryOptimizer.performHealthCheck();
      const cacheStats = CacheManager.getStats();
      
      res.json({
        database: health,
        cache: cacheStats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Performance health check failed:', error);
      res.status(500).json({ 
        error: 'Failed to get performance metrics',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Database optimization endpoint
  app.post('/api/performance/optimize', async (req, res) => {
    try {
      const { action } = req.body;
      
      if (action === 'create_indexes') {
        const results = await QueryOptimizer.createOptimalIndexes();
        res.json({
          message: 'Index creation completed',
          results,
          timestamp: new Date().toISOString()
        });
      } else if (action === 'analyze_queries') {
        const suggestions = await QueryOptimizer.analyzeAndSuggestOptimizations();
        res.json({
          message: 'Query analysis completed',
          suggestions,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(400).json({ error: 'Invalid action' });
      }
    } catch (error) {
      console.error('Performance optimization failed:', error);
      res.status(500).json({ 
        error: 'Failed to perform optimization',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Cache management endpoints
  app.delete('/api/performance/cache/:cacheName?', (req, res) => {
    try {
      const { cacheName } = req.params;
      const { pattern } = req.query;
      
      if (cacheName) {
        CacheManager.invalidate(cacheName, pattern as string);
        res.json({ 
          message: `Cache ${cacheName} invalidated`,
          pattern: pattern || 'all'
        });
      } else {
        // Clear all caches
        ['collections', 'hosts', 'projects', 'stats', 'search', 'users'].forEach(name => {
          CacheManager.invalidate(name);
        });
        res.json({ message: 'All caches cleared' });
      }
    } catch (error) {
      console.error('Cache invalidation failed:', error);
      res.status(500).json({ error: 'Failed to invalidate cache' });
    }
  });

  // Cache warming endpoint
  app.post('/api/performance/cache/warm', async (req, res) => {
    try {
      await CacheManager.warmCaches();
      res.json({ 
        message: 'Cache warming completed',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Cache warming failed:', error);
      res.status(500).json({ error: 'Failed to warm caches' });
    }
  });

  // Cache maintenance endpoint
  app.post('/api/performance/cache/maintenance', (req, res) => {
    try {
      CacheManager.performMaintenance();
      const stats = CacheManager.getStats();
      res.json({
        message: 'Cache maintenance completed',
        stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Cache maintenance failed:', error);
      res.status(500).json({ error: 'Failed to perform cache maintenance' });
    }
  });

  // Performance monitoring dashboard endpoint
  app.get('/api/performance/dashboard', async (req, res) => {
    try {
      const [
        connectionPool,
        slowQueries,
        indexUsage,
        tableStats,
        optimizationSuggestions
      ] = await Promise.all([
        QueryOptimizer.getConnectionPoolStatus(),
        QueryOptimizer.getSlowQueries(),
        QueryOptimizer.getIndexUsage(),
        QueryOptimizer.getTableStats(),
        QueryOptimizer.analyzeAndSuggestOptimizations()
      ]);

      const cacheStats = CacheManager.getStats();

      res.json({
        database: {
          connectionPool,
          slowQueries,
          indexUsage,
          tableStats,
          optimizationSuggestions
        },
        cache: cacheStats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Performance dashboard failed:', error);
      res.status(500).json({ 
        error: 'Failed to get performance dashboard data',
        timestamp: new Date().toISOString()
      });
    }
  });
}
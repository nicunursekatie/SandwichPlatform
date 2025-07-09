import { Router } from "express";
import { DataExporter } from "../data-export";
import { BulkOperationsManager } from "../bulk-operations";
import { AuditLogger } from "../audit-logger";
import { z } from "zod";

const router = Router();

// Export data endpoints
router.get('/export/collections', async (req, res) => {
  try {
    const { format = 'csv', startDate, endDate } = req.query;
    
    const options = {
      format: format as 'csv' | 'json',
      dateRange: startDate && endDate ? {
        start: startDate as string,
        end: endDate as string
      } : undefined
    };

    const result = await DataExporter.exportSandwichCollections(options);
    
    if (options.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="sandwich_collections.csv"');
      res.send(result.data);
    } else {
      res.json(result);
    }
  } catch (error) {
    console.error('Export failed:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});

router.get('/export/hosts', async (req, res) => {
  try {
    const { format = 'csv', includeInactive = 'false' } = req.query;
    
    const options = {
      format: format as 'csv' | 'json',
      includeInactive: includeInactive === 'true'
    };

    const result = await DataExporter.exportHosts(options);
    
    if (options.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="hosts.csv"');
      res.send(result.data);
    } else {
      res.json(result);
    }
  } catch (error) {
    console.error('Export failed:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});

router.get('/export/full-dataset', async (req, res) => {
  try {
    const result = await DataExporter.exportFullDataset({ format: 'json' });
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="full_dataset.json"');
    res.json(result.data);
  } catch (error) {
    console.error('Full export failed:', error);
    res.status(500).json({ error: 'Full export failed' });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const summary = await DataExporter.getDataSummary();
    res.json(summary);
  } catch (error) {
    console.error('Summary failed:', error);
    res.status(500).json({ error: 'Summary failed' });
  }
});

// Bulk operations endpoints
router.post('/bulk/deduplicate-hosts', async (req: any, res) => {
  try {
    const context = {
      userId: req.user?.claims?.sub,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.sessionID
    };

    const result = await BulkOperationsManager.deduplicateHosts(context);
    res.json(result);
  } catch (error) {
    console.error('Deduplication failed:', error);
    res.status(500).json({ error: 'Deduplication failed' });
  }
});

router.delete('/bulk/collections', async (req: any, res) => {
  try {
    const schema = z.object({
      ids: z.array(z.number())
    });

    const { ids } = schema.parse(req.body);

    const context = {
      userId: req.user?.claims?.sub,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.sessionID
    };

    const result = await BulkOperationsManager.bulkDeleteCollections(ids, context);
    res.json(result);
  } catch (error) {
    console.error('Bulk deletion failed:', error);
    res.status(500).json({ error: 'Bulk deletion failed' });
  }
});

// Data integrity endpoints
router.get('/integrity/check', async (req, res) => {
  try {
    const result = await BulkOperationsManager.validateDataIntegrity();
    res.json(result);
  } catch (error) {
    console.error('Integrity check failed:', error);
    res.status(500).json({ error: 'Integrity check failed' });
  }
});

// Audit log endpoints
router.get('/audit/history', async (req, res) => {
  try {
    const { tableName, recordId, userId, limit = '100', offset = '0' } = req.query;
    
    const history = await AuditLogger.getAuditHistory(
      tableName as string,
      recordId as string,
      userId as string,
      parseInt(limit as string),
      parseInt(offset as string)
    );

    res.json({ history });
  } catch (error) {
    console.error('Audit history failed:', error);
    res.status(500).json({ error: 'Audit history failed' });
  }
});

export default router;
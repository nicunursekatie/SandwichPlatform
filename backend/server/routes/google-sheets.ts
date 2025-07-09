import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { googleSheets, insertGoogleSheetSchema } from '@shared/schema';
import { isAuthenticated } from '../temp-auth';

const router = Router();

// Helper function to generate URLs from sheet ID
function generateSheetUrls(sheetId: string) {
  const embedUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit?usp=sharing&widget=true&headers=false`;
  const directUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit?usp=sharing`;
  return { embedUrl, directUrl };
}

// Get all Google Sheets
router.get('/', async (req, res) => {
  try {
    const sheets = await db
      .select()
      .from(googleSheets)
      .orderBy(googleSheets.createdAt);

    res.json(sheets);
  } catch (error) {
    console.error('Error fetching Google Sheets:', error);
    res.status(500).json({ message: 'Failed to fetch Google Sheets' });
  }
});

// Get a specific Google Sheet
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid sheet ID' });
    }

    const [sheet] = await db
      .select()
      .from(googleSheets)
      .where(eq(googleSheets.id, id));

    if (!sheet) {
      return res.status(404).json({ message: 'Google Sheet not found' });
    }

    res.json(sheet);
  } catch (error) {
    console.error('Error fetching Google Sheet:', error);
    res.status(500).json({ message: 'Failed to fetch Google Sheet' });
  }
});

// Create a new Google Sheet entry
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const validatedData = insertGoogleSheetSchema.parse(req.body);
    const { embedUrl, directUrl } = generateSheetUrls(validatedData.sheetId);
    
    const user = (req as any).user;
    const userId = user?.id || user?.claims?.sub;

    const [newSheet] = await db
      .insert(googleSheets)
      .values({
        ...validatedData,
        embedUrl,
        directUrl,
        createdBy: userId,
      })
      .returning();

    res.status(201).json(newSheet);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid input data',
        errors: error.errors 
      });
    }
    
    console.error('Error creating Google Sheet:', error);
    res.status(500).json({ message: 'Failed to create Google Sheet' });
  }
});

// Update a Google Sheet
router.patch('/:id', isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid sheet ID' });
    }

    const updateData = insertGoogleSheetSchema.partial().parse(req.body);
    
    // If sheetId is being updated, regenerate URLs
    let urlData = {};
    if (updateData.sheetId) {
      const { embedUrl, directUrl } = generateSheetUrls(updateData.sheetId);
      urlData = { embedUrl, directUrl };
    }

    const [updatedSheet] = await db
      .update(googleSheets)
      .set({
        ...updateData,
        ...urlData,
        updatedAt: new Date(),
      })
      .where(eq(googleSheets.id, id))
      .returning();

    if (!updatedSheet) {
      return res.status(404).json({ message: 'Google Sheet not found' });
    }

    res.json(updatedSheet);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid input data',
        errors: error.errors 
      });
    }
    
    console.error('Error updating Google Sheet:', error);
    res.status(500).json({ message: 'Failed to update Google Sheet' });
  }
});

// Delete a Google Sheet
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid sheet ID' });
    }

    const [deletedSheet] = await db
      .delete(googleSheets)
      .where(eq(googleSheets.id, id))
      .returning();

    if (!deletedSheet) {
      return res.status(404).json({ message: 'Google Sheet not found' });
    }

    res.json({ message: 'Google Sheet deleted successfully' });
  } catch (error) {
    console.error('Error deleting Google Sheet:', error);
    res.status(500).json({ message: 'Failed to delete Google Sheet' });
  }
});

// Test Google Sheet accessibility
router.post('/:id/test', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid sheet ID' });
    }

    const [sheet] = await db
      .select()
      .from(googleSheets)
      .where(eq(googleSheets.id, id));

    if (!sheet) {
      return res.status(404).json({ message: 'Google Sheet not found' });
    }

    // Test if the sheet is accessible by making a simple HTTP request
    const response = await fetch(sheet.directUrl, { method: 'HEAD' });
    
    res.json({ 
      accessible: response.ok,
      status: response.status,
      message: response.ok ? 'Sheet is accessible' : 'Sheet may not be publicly accessible'
    });
  } catch (error) {
    console.error('Error testing Google Sheet accessibility:', error);
    res.json({ 
      accessible: false,
      message: 'Unable to test sheet accessibility'
    });
  }
});

// Analyze the structure of the target Google Sheet
router.get('/sync/analyze', async (req, res) => {
  try {
    const { GoogleSheetsSyncService } = await import('../google-sheets-sync');
    const { StorageWrapper } = await import('../storage-wrapper');
    const storage = new StorageWrapper();
    const syncService = new GoogleSheetsSyncService(storage);
    
    const sheetName = req.query.sheet as string || 'Sheet1';
    const analysis = await syncService.analyzeSheetStructure(sheetName);
    
    res.json({
      success: true,
      analysis,
      sheetUrl: `https://docs.google.com/spreadsheets/d/1mjx5o6boluo8mNx8tzAV76NBGS6tF0um2Rq9bIdxPo8/edit`,
      targetSpreadsheetId: '1mjx5o6boluo8mNx8tzAV76NBGS6tF0um2Rq9bIdxPo8'
    });
  } catch (error) {
    console.error('Error analyzing Google Sheet:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Google Sheets analysis failed. Please check API credentials.',
      error: error.message 
    });
  }
});

// Import data from the target Google Sheet to database
router.post('/sync/import', isAuthenticated, async (req, res) => {
  try {
    const { GoogleSheetsSyncService } = await import('../google-sheets-sync');
    const { StorageWrapper } = await import('../storage-wrapper');
    const storage = new StorageWrapper();
    const syncService = new GoogleSheetsSyncService(storage);
    
    const { 
      sheetName = 'Sheet1',
      dateColumn,
      hostColumn, 
      sandwichColumn,
      groupColumn,
      skipRows = 1,
      dryRun = false
    } = req.body;

    const result = await syncService.importFromGoogleSheet(sheetName, {
      dateColumn,
      hostColumn,
      sandwichColumn,
      groupColumn,
      skipRows,
      dryRun
    });

    res.json({
      success: true,
      result,
      message: dryRun 
        ? `Preview complete: ${result.preview?.length || 0} rows analyzed`
        : `Import complete: ${result.imported} records imported, ${result.skipped} skipped`
    });
  } catch (error) {
    console.error('Error importing from Google Sheet:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Google Sheets import failed',
      error: error.message 
    });
  }
});

// Export database data to Google Sheet
router.post('/sync/export', isAuthenticated, async (req, res) => {
  try {
    const { GoogleSheetsSyncService } = await import('../google-sheets-sync');
    const { StorageWrapper } = await import('../storage-wrapper');
    const storage = new StorageWrapper();
    const syncService = new GoogleSheetsSyncService(storage);
    
    const { sheetName = 'Database_Export' } = req.body;
    const result = await syncService.exportToGoogleSheet(sheetName);

    res.json({
      success: true,
      result,
      message: `Export complete: ${result.exported} records exported to ${sheetName}`
    });
  } catch (error) {
    console.error('Error exporting to Google Sheet:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Google Sheets export failed',
      error: error.message 
    });
  }
});

// Bidirectional sync between database and Google Sheet
router.post('/sync/bidirectional', isAuthenticated, async (req, res) => {
  try {
    const { GoogleSheetsSyncService } = await import('../google-sheets-sync');
    const { StorageWrapper } = await import('../storage-wrapper');
    const storage = new StorageWrapper();
    const syncService = new GoogleSheetsSyncService(storage);
    
    const { 
      importFrom = 'Sheet1',
      exportTo = 'Database_Export',
      direction = 'both'
    } = req.body;

    const result = await syncService.syncWithGoogleSheet({
      importFrom,
      exportTo,
      direction
    });

    res.json({
      success: true,
      result,
      message: `Sync complete: ${result.syncSummary}`
    });
  } catch (error) {
    console.error('Error syncing with Google Sheet:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Google Sheets sync failed',
      error: error.message 
    });
  }
});

export default router;
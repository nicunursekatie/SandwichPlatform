import { google } from 'googleapis';
import type { SandwichCollection, InsertSandwichCollection } from '@shared/schema';

// Create a minimal storage interface for the sync service
interface SyncStorage {
  getAllSandwichCollections(): Promise<any[]>;
  createSandwichCollection(data: any): Promise<any>;
}

export class GoogleSheetsSyncService {
  private sheets: any;
  private targetSpreadsheetId: string;
  private storage: SyncStorage;

  constructor(storage: SyncStorage) {
    // Extract spreadsheet ID from the provided URL
    // https://docs.google.com/spreadsheets/d/1mjx5o6boluo8mNx8tzAV76NBGS6tF0um2Rq9bIdxPo8/edit?gid=2137648950#gid=2137648950
    this.targetSpreadsheetId = '1mjx5o6boluo8mNx8tzAV76NBGS6tF0um2Rq9bIdxPo8';
    this.storage = storage;

    try {
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets.readonly',
          'https://www.googleapis.com/auth/spreadsheets'
        ],
      });

      this.sheets = google.sheets({ version: 'v4', auth });
    } catch (error) {
      console.error('Google Sheets authentication failed:', error);
      throw new Error('Google Sheets service unavailable. Please configure API credentials.');
    }
  }

  /**
   * Read data from the target Google Sheet and return formatted collection data
   */
  async readFromGoogleSheet(sheetName: string = 'Sheet1'): Promise<any[]> {
    try {
      console.log(`Reading data from Google Sheet: ${this.targetSpreadsheetId}, sheet: ${sheetName}`);
      
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.targetSpreadsheetId,
        range: `${sheetName}!A:Z`, // Read all columns
      });

      const rows = response.data.values || [];
      
      if (rows.length === 0) {
        console.log('No data found in Google Sheet');
        return [];
      }

      // Log the structure for debugging
      console.log(`Found ${rows.length} rows in Google Sheet`);
      console.log('First row (headers):', rows[0]);
      if (rows.length > 1) {
        console.log('Sample data row:', rows[1]);
      }

      return rows;
    } catch (error) {
      console.error('Error reading from Google Sheet:', error);
      throw new Error(`Unable to read from Google Sheet: ${error}`);
    }
  }

  /**
   * Analyze the Google Sheet structure and identify relevant columns
   */
  async analyzeSheetStructure(sheetName: string = 'Sheet1'): Promise<{
    headers: string[];
    sampleRow: any[];
    totalRows: number;
    dateColumns: number[];
    hostColumns: number[];
    sandwichColumns: number[];
  }> {
    const rows = await this.readFromGoogleSheet(sheetName);
    
    if (rows.length === 0) {
      throw new Error('No data found in Google Sheet to analyze');
    }

    const headers = rows[0] || [];
    const sampleRow = rows.length > 1 ? rows[1] : [];

    // Identify potential columns based on header names
    const dateColumns: number[] = [];
    const hostColumns: number[] = [];
    const sandwichColumns: number[] = [];

    headers.forEach((header: string, index: number) => {
      const headerLower = header.toLowerCase();
      
      // Date-related columns
      if (headerLower.includes('date') || headerLower.includes('collected') || headerLower.includes('time')) {
        dateColumns.push(index);
      }
      
      // Host-related columns
      if (headerLower.includes('host') || headerLower.includes('organization') || headerLower.includes('group') || headerLower.includes('location')) {
        hostColumns.push(index);
      }
      
      // Sandwich count columns
      if (headerLower.includes('sandwich') || headerLower.includes('count') || headerLower.includes('total') || headerLower.includes('individual')) {
        sandwichColumns.push(index);
      }
    });

    return {
      headers,
      sampleRow,
      totalRows: rows.length,
      dateColumns,
      hostColumns,
      sandwichColumns
    };
  }

  /**
   * Import data from Google Sheet to database with smart column mapping
   */
  async importFromGoogleSheet(sheetName: string = 'Sheet1', options: {
    dateColumn?: number;
    hostColumn?: number;
    sandwichColumn?: number;
    groupColumn?: number;
    skipRows?: number;
    dryRun?: boolean;
  } = {}): Promise<{
    imported: number;
    skipped: number;
    errors: string[];
    preview?: any[];
  }> {
    try {
      const rows = await this.readFromGoogleSheet(sheetName);
      
      if (rows.length <= 1) {
        return { imported: 0, skipped: 0, errors: ['No data rows found'], preview: [] };
      }

      const headers = rows[0];
      const dataRows = rows.slice(options.skipRows || 1); // Skip header by default

      // Auto-detect columns if not specified
      const analysis = await this.analyzeSheetStructure(sheetName);
      
      const dateCol = options.dateColumn ?? analysis.dateColumns[0] ?? 0;
      const hostCol = options.hostColumn ?? analysis.hostColumns[0] ?? 1;
      const sandwichCol = options.sandwichColumn ?? analysis.sandwichColumns[0] ?? 2;
      const groupCol = options.groupColumn ?? 3;

      console.log(`Using columns - Date: ${dateCol}, Host: ${hostCol}, Sandwiches: ${sandwichCol}, Groups: ${groupCol}`);

      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];
      const preview: any[] = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        
        try {
          // Extract data from row
          const dateValue = row[dateCol]?.toString().trim();
          const hostValue = row[hostCol]?.toString().trim();
          const sandwichValue = row[sandwichCol]?.toString().trim();
          const groupValue = row[groupCol]?.toString().trim();

          // Validate required fields
          if (!dateValue || !hostValue) {
            skipped++;
            errors.push(`Row ${i + 2}: Missing date or host data`);
            continue;
          }

          // Parse date
          let collectionDate: string;
          try {
            const parsedDate = new Date(dateValue);
            if (isNaN(parsedDate.getTime())) {
              throw new Error('Invalid date format');
            }
            collectionDate = parsedDate.toISOString().split('T')[0];
          } catch (dateError) {
            skipped++;
            errors.push(`Row ${i + 2}: Invalid date format "${dateValue}"`);
            continue;
          }

          // Parse sandwich count
          const individualSandwiches = parseInt(sandwichValue) || 0;

          // Parse group collections
          let groupCollections: any[] = [];
          if (groupValue) {
            try {
              // Try to parse as JSON first
              groupCollections = JSON.parse(groupValue);
            } catch {
              // If not JSON, treat as simple text description
              groupCollections = [{
                groupName: 'Google Sheets Import',
                sandwichCount: 0,
                description: groupValue
              }];
            }
          }

          const collectionData = {
            collectionDate,
            hostName: hostValue,
            individualSandwiches,
            groupCollections: JSON.stringify(groupCollections),
            submittedBy: 'Google Sheets Sync',
            submittedAt: new Date()
          };

          if (options.dryRun) {
            preview.push({
              rowNumber: i + 2,
              data: collectionData,
              originalRow: row
            });
          } else {
            // Check for duplicates before importing
            const existingCollections = await this.storage.getAllSandwichCollections();
            const isDuplicate = existingCollections.some(existing => 
              existing.collectionDate === collectionData.collectionDate &&
              existing.hostName === collectionData.hostName &&
              existing.individualSandwiches === collectionData.individualSandwiches
            );

            if (isDuplicate) {
              skipped++;
              console.log(`Skipping duplicate: ${collectionData.collectionDate} - ${collectionData.hostName}`);
            } else {
              await this.storage.createSandwichCollection(collectionData);
              imported++;
              console.log(`Imported: ${collectionData.collectionDate} - ${collectionData.hostName} (${collectionData.individualSandwiches} sandwiches)`);
            }
          }

        } catch (rowError) {
          skipped++;
          errors.push(`Row ${i + 2}: ${rowError}`);
        }
      }

      return {
        imported,
        skipped,
        errors,
        ...(options.dryRun && { preview })
      };

    } catch (error) {
      console.error('Error importing from Google Sheet:', error);
      throw error;
    }
  }

  /**
   * Export database collections to the ReplitDatabase sheet
   */
  async exportToGoogleSheet(sheetName: string = 'ReplitDatabase'): Promise<{
    exported: number;
    sheetUrl: string;
  }> {
    try {
      // Get all collections from database
      const collections = await this.storage.getAllSandwichCollections();

      // Prepare data for the ReplitDatabase sheet format
      // Headers: Date, Location, Individual_Sandwiches, Group_Collections, Submitted_At
      const headers = [
        'Date',
        'Location', 
        'Individual_Sandwiches',
        'Group_Collections',
        'Submitted_At'
      ];

      const rows = collections.map((collection: any) => [
        collection.collectionDate,
        collection.hostName,
        collection.individualSandwiches,
        collection.groupCollections || '',
        collection.submittedAt?.toISOString?.() || new Date().toISOString()
      ]);

      // Create or update the sheet - clear existing data first, then add new data
      const allData = [headers, ...rows];

      await this.sheets.spreadsheets.values.clear({
        spreadsheetId: this.targetSpreadsheetId,
        range: `${sheetName}!A:Z`
      });

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.targetSpreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: allData
        }
      });

      const sheetUrl = `https://docs.google.com/spreadsheets/d/${this.targetSpreadsheetId}/edit#gid=0`;

      return {
        exported: collections.length,
        sheetUrl
      };

    } catch (error) {
      console.error('Error exporting to Google Sheet:', error);
      throw error;
    }
  }

  /**
   * Add a single collection entry to the ReplitDatabase sheet
   */
  async addEntryToSheet(collectionData: any): Promise<void> {
    try {
      // Format the data for the ReplitDatabase sheet
      const rowData = [
        collectionData.collectionDate,
        collectionData.hostName,
        collectionData.individualSandwiches,
        collectionData.groupCollections || '',
        new Date().toISOString()
      ];

      // Append the new row to the ReplitDatabase sheet
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.targetSpreadsheetId,
        range: 'ReplitDatabase!A:E',
        valueInputOption: 'RAW',
        requestBody: {
          values: [rowData]
        }
      });

    } catch (error) {
      console.error('Error adding entry to Google Sheet:', error);
      throw error;
    }
  }

  /**
   * Sync data bidirectionally between database and Google Sheet
   */
  async syncWithGoogleSheet(options: {
    importFrom?: string;
    exportTo?: string;
    direction?: 'import' | 'export' | 'both';
  } = {}): Promise<{
    importResult?: any;
    exportResult?: any;
    syncSummary: string;
  }> {
    const direction = options.direction || 'both';
    let importResult, exportResult;

    try {
      if (direction === 'import' || direction === 'both') {
        console.log('Starting import from Google Sheet...');
        importResult = await this.importFromGoogleSheet(options.importFrom);
      }

      if (direction === 'export' || direction === 'both') {
        console.log('Starting export to Google Sheet...');
        exportResult = await this.exportToGoogleSheet(options.exportTo);
      }

      const syncSummary = [
        importResult && `Imported: ${importResult.imported} records, Skipped: ${importResult.skipped}`,
        exportResult && `Exported: ${exportResult.exported} records`,
        importResult?.errors?.length && `Errors: ${importResult.errors.length}`
      ].filter(Boolean).join(' | ');

      return {
        importResult,
        exportResult,
        syncSummary
      };

    } catch (error) {
      console.error('Sync operation failed:', error);
      throw error;
    }
  }
}
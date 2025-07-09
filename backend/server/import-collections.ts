import { readFileSync, existsSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { db } from './db';
import { sandwichCollections } from '../shared/schema';

interface CSVRow {
  [key: string]: string;
}

export async function importCollectionsFromCSV(filePath: string) {
  console.log(`Starting CSV import from: ${filePath}`);
  
  // Check if file exists
  if (!existsSync(filePath)) {
    throw new Error(`CSV file not found: ${filePath}`);
  }

  // Read and parse CSV
  const csvContent = readFileSync(filePath, 'utf-8');
  const records: CSVRow[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  console.log(`Found ${records.length} records in CSV`);
  
  // Debug: Log the first record to see the actual column names
  if (records.length > 0) {
    console.log('Available columns in CSV:', Object.keys(records[0]));
    console.log('First record sample:', records[0]);
    console.log('Second record sample:', records[1]);
  }

  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  // Process each record
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    
    try {
      // Check for alternative column names
      const hostName = record['Host Name'] || record['Host'] || record['host_name'] || record['HostName'];
      const sandwichCountStr = record['Individual Sandwiches'] || record['Sandwich Count'] || record['Count'] || record['sandwich_count'] || record['SandwichCount'] || record['Sandwiches'];
      const date = record['Collection Date'] || record['Date'] || record['date'] || record['CollectionDate'];
      
      // Validate required fields with better error messages
      if (!hostName) {
        const availableKeys = Object.keys(record).join(', ');
        throw new Error(`Missing Host Name (available columns: ${availableKeys}) in row ${i + 1}`);
      }
      
      if (!sandwichCountStr) {
        const availableKeys = Object.keys(record).join(', ');
        throw new Error(`Missing Individual Sandwiches (available columns: ${availableKeys}) in row ${i + 1}`);
      }
      
      if (!date) {
        const availableKeys = Object.keys(record).join(', ');
        throw new Error(`Missing Date (available columns: ${availableKeys}) in row ${i + 1}`);
      }

      // Parse sandwich count as integer
      const sandwichCount = parseInt(sandwichCountStr.toString().trim());
      if (isNaN(sandwichCount)) {
        throw new Error(`Invalid sandwich count "${sandwichCountStr}" in row ${i + 1}`);
      }

      // Parse dates
      let collectionDate = date;
      let submittedAt = new Date();
      
      // Try to parse Created At if provided
      const createdAt = record['Created At'] || record['created_at'] || record['CreatedAt'];
      if (createdAt) {
        const parsedDate = new Date(createdAt);
        if (!isNaN(parsedDate.getTime())) {
          submittedAt = parsedDate;
        }
      }

      // Handle Group Collections data
      const groupCollectionsStr = record['Group Collections'] || '';
      let groupCollections = '[]';
      if (groupCollectionsStr && groupCollectionsStr.trim() !== '') {
        // If it's a number, convert to simple array format
        const groupCount = parseInt(groupCollectionsStr.trim());
        if (!isNaN(groupCount) && groupCount > 0) {
          groupCollections = JSON.stringify([{ count: groupCount, description: 'Group Collection' }]);
        }
      }

      // Insert into database
      await db.insert(sandwichCollections).values({
        hostName: hostName.trim(),
        individualSandwiches: sandwichCount,
        collectionDate: collectionDate.trim(),
        groupCollections: groupCollections,
        submittedAt: submittedAt
      });

      successCount++;
      
      // Log progress every 100 records
      if ((i + 1) % 100 === 0) {
        console.log(`Processed ${i + 1}/${records.length} records...`);
      }
      
    } catch (error) {
      errorCount++;
      const errorMsg = `Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMsg);
      console.error(errorMsg);
    }
  }

  // Summary
  console.log('\n=== Import Summary ===');
  console.log(`Total records processed: ${records.length}`);
  console.log(`Successfully imported: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  
  if (errors.length > 0) {
    console.log('\nError details:');
    errors.slice(0, 10).forEach(error => console.log(`  ${error}`));
    if (errors.length > 10) {
      console.log(`  ... and ${errors.length - 10} more errors`);
    }
  }

  return {
    totalRecords: records.length,
    successCount,
    errorCount,
    errors: errors.slice(0, 10) // Return first 10 errors
  };
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const csvPath = process.argv[2];
  
  if (!csvPath) {
    console.error('Usage: tsx server/import-collections.ts <path-to-csv-file>');
    process.exit(1);
  }

  importCollectionsFromCSV(csvPath)
    .then((result) => {
      console.log(`\nImport completed: ${result.successCount}/${result.totalRecords} records imported`);
      process.exit(result.errorCount > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('Import failed:', error);
      process.exit(1);
    });
}
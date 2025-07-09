import { db } from "./db";
import { sandwichCollections, hosts } from "@shared/schema";
import { eq } from "drizzle-orm";

// Mapping from CSV group names to your real location hosts
// Based on your actual CSV data patterns
const HOST_MAPPINGS = {
  "Unnamed Group": "Metro Atlanta", // Large volume entries from weekly spreadsheets
  "Group 8": "North Fulton",
  "Group 3": "East Metro",
  "Group 1": "West Metro", 
  "Group 2": "South Metro",
  "Group 4": "Northeast Metro",
  "Group 5": "Northwest Metro",
  "Group 6": "Central Atlanta",
  "Group 7": "Southeast Metro"
};

export async function bulkMapHosts() {
  console.log("Starting bulk host mapping...");
  
  let totalUpdated = 0;
  
  for (const [oldName, newName] of Object.entries(HOST_MAPPINGS)) {
    try {
      const result = await db
        .update(sandwichCollections)
        .set({ hostName: newName })
        .where(eq(sandwichCollections.hostName, oldName));
      
      const updatedCount = result.rowCount || 0;
      console.log(`Updated ${updatedCount} records from "${oldName}" to "${newName}"`);
      totalUpdated += updatedCount;
      
    } catch (error) {
      console.error(`Failed to update ${oldName} to ${newName}:`, error);
    }
  }
  
  console.log(`Bulk mapping complete: ${totalUpdated} total records updated`);
  return totalUpdated;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  bulkMapHosts()
    .then((count) => {
      console.log(`✅ Successfully updated ${count} collection records`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Bulk mapping failed:', error);
      process.exit(1);
    });
}
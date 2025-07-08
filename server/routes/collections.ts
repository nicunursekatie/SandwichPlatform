import { z } from "zod";
import { storage } from "../storage-wrapper";
import { logger } from "../middleware/logger";
import { QueryOptimizer } from "../performance/query-optimizer";
import { insertSandwichCollectionSchema } from "@shared/schema";
import fs from "fs/promises";
import { parse } from "csv-parse/sync";
import multer from "multer";

// Configure multer for file uploads
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  },
});

export function setupCollectionRoutes(app: any, isAuthenticated: any, requirePermission: any) {
  // Sandwich Collections Stats - Complete totals including individual + group collections (Optimized)
  app.get("/api/sandwich-collections/stats", async (req: any, res: any) => {
    try {
      const stats = await QueryOptimizer.getCachedQuery(
        "sandwich-collections-stats",
        async () => {
          const collections = await storage.getAllSandwichCollections();

          let individualTotal = 0;
          let groupTotal = 0;

          collections.forEach((collection) => {
            individualTotal += collection.individualSandwiches || 0;

            // Calculate group collections total
            try {
              const groupData = JSON.parse(collection.groupCollections || "[]");
              if (Array.isArray(groupData)) {
                groupTotal += groupData.reduce(
                  (sum: number, group: any) => sum + (group.sandwichCount || 0),
                  0,
                );
              }
            } catch (error) {
              // Handle text format like "Marketing Team: 8, Development: 6"
              if (
                collection.groupCollections &&
                collection.groupCollections !== "[]"
              ) {
                const matches = collection.groupCollections.match(/(\d+)/g);
                if (matches) {
                  groupTotal += matches.reduce(
                    (sum, num) => sum + parseInt(num),
                    0,
                  );
                }
              }
            }
          });

          return {
            totalEntries: collections.length,
            individualSandwiches: individualTotal,
            groupSandwiches: groupTotal,
            completeTotalSandwiches: individualTotal + groupTotal,
          };
        },
        60000 // Cache for 1 minute since this data doesn't change frequently
      );

      res.json(stats);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Failed to fetch sandwich collection stats" });
    }
  });

  // Sandwich Collections
  app.get("/api/sandwich-collections", async (req: any, res: any) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;

      const result = await storage.getSandwichCollections(limit, offset);
      const totalCount = await storage.getSandwichCollectionsCount();

      res.json({
        collections: result,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNext: page < Math.ceil(totalCount / limit),
          hasPrev: page > 1,
        },
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sandwich collections" });
    }
  });

  app.post(
    "/api/sandwich-collections",
    requirePermission("edit_data"),
    async (req: any, res: any) => {
      try {
        const collectionData = insertSandwichCollectionSchema.parse(req.body);
        const collection =
          await storage.createSandwichCollection(collectionData);
        
        // Invalidate cache when new collection is created
        QueryOptimizer.invalidateCache("sandwich-collections");
        
        res.status(201).json(collection);
      } catch (error) {
        if (error instanceof z.ZodError) {
          logger.warn("Invalid sandwich collection input", {
            error: error.errors,
            ip: req.ip,
          });
          res
            .status(400)
            .json({ message: "Invalid collection data", errors: error.errors });
        } else {
          logger.error("Failed to create sandwich collection", error);
          res.status(500).json({ message: "Failed to create collection" });
        }
      }
    },
  );

  app.put(
    "/api/sandwich-collections/:id",
    requirePermission("edit_data"),
    async (req: any, res: any) => {
      try {
        const id = parseInt(req.params.id);
        const updates = req.body;
        const collection = await storage.updateSandwichCollection(id, updates);
        if (!collection) {
          return res.status(404).json({ message: "Collection not found" });
        }
        
        // Invalidate cache when collection is updated
        QueryOptimizer.invalidateCache("sandwich-collections");
        
        res.json(collection);
      } catch (error) {
        logger.error("Failed to update sandwich collection", error);
        res.status(400).json({ message: "Invalid update data" });
      }
    },
  );

  app.patch(
    "/api/sandwich-collections/:id",
    requirePermission("edit_data"),
    async (req: any, res: any) => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ message: "Invalid collection ID" });
        }

        const updates = req.body;
        const collection = await storage.updateSandwichCollection(id, updates);
        if (!collection) {
          return res.status(404).json({ message: "Collection not found" });
        }
        
        // Invalidate cache when collection is updated
        QueryOptimizer.invalidateCache("sandwich-collections");
        
        res.json(collection);
      } catch (error) {
        logger.error("Failed to patch sandwich collection", error);
        res.status(500).json({ message: "Failed to update collection" });
      }
    },
  );

  app.delete(
    "/api/sandwich-collections/:id",
    requirePermission("edit_data"),
    async (req: any, res: any) => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ message: "Invalid collection ID" });
        }
        
        const deleted = await storage.deleteSandwichCollection(id);
        if (!deleted) {
          return res.status(404).json({ message: "Collection not found" });
        }
        
        // Invalidate cache when collection is deleted
        QueryOptimizer.invalidateCache("sandwich-collections");
        
        res.status(204).send();
      } catch (error) {
        logger.error("Failed to delete sandwich collection", error);
        res.status(500).json({ message: "Failed to delete collection" });
      }
    },
  );

  // Bulk operations
  app.delete("/api/sandwich-collections/bulk", async (req: any, res: any) => {
    try {
      const collections = await storage.getAllSandwichCollections();
      const collectionsToDelete = collections.filter((collection) => {
        const hostName = collection.hostName;
        return hostName.startsWith("Loc ") || /^Group [1-8]/.test(hostName);
      });

      let deletedCount = 0;
      // Delete in reverse order by ID to maintain consistency
      const sortedCollections = collectionsToDelete.sort((a, b) => b.id - a.id);

      for (const collection of sortedCollections) {
        try {
          const deleted = await storage.deleteSandwichCollection(collection.id);
          if (deleted) {
            deletedCount++;
          }
        } catch (error) {
          console.error(`Failed to delete collection ${collection.id}:`, error);
        }
      }

      res.json({
        message: `Successfully deleted ${deletedCount} duplicate entries`,
        deletedCount,
        patterns: ["Loc *", "Group 1-8"],
      });
    } catch (error) {
      logger.error("Failed to bulk delete sandwich collections", error);
      res.status(500).json({ message: "Failed to delete duplicate entries" });
    }
  });

  // Batch delete sandwich collections (must be before :id route)
  app.delete("/api/sandwich-collections/batch-delete", async (req: any, res: any) => {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "Invalid or empty IDs array" });
      }

      let deletedCount = 0;
      const errors = [];

      // Delete in reverse order to maintain consistency
      const sortedIds = ids.sort((a, b) => b - a);

      for (const id of sortedIds) {
        try {
          const deleted = await storage.deleteSandwichCollection(id);
          if (deleted) {
            deletedCount++;
          } else {
            errors.push(`Collection with ID ${id} not found`);
          }
        } catch (error) {
          errors.push(
            `Failed to delete collection ${id}: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
      }

      res.json({
        message: `Successfully deleted ${deletedCount} of ${ids.length} collections`,
        deletedCount,
        totalRequested: ids.length,
        errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
      });
    } catch (error) {
      logger.error("Failed to batch delete collections", error);
      res.status(500).json({ message: "Failed to batch delete collections" });
    }
  });

  // Batch edit sandwich collections
  app.patch(
    "/api/sandwich-collections/batch-edit",
    requirePermission("edit_data"),
    async (req: any, res: any) => {
      try {
        const { ids, updates } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
          return res
            .status(400)
            .json({ message: "Invalid or empty IDs array" });
        }

        if (!updates || Object.keys(updates).length === 0) {
          return res.status(400).json({ message: "No updates provided" });
        }

        let updatedCount = 0;
        const errors = [];

        for (const id of ids) {
          try {
            const updated = await storage.updateSandwichCollection(id, updates);
            if (updated) {
              updatedCount++;
            } else {
              errors.push(`Collection with ID ${id} not found`);
            }
          } catch (error) {
            errors.push(
              `Failed to update collection ${id}: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
          }
        }

        res.json({
          message: `Successfully updated ${updatedCount} of ${ids.length} collections`,
          updatedCount,
          totalRequested: ids.length,
          errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
        });
      } catch (error) {
        logger.error("Failed to batch edit collections", error);
        res.status(500).json({ message: "Failed to batch edit collections" });
      }
    },
  );

  // Analyze duplicates in sandwich collections
  app.get("/api/sandwich-collections/analyze-duplicates", async (req: any, res: any) => {
    try {
      const collections = await storage.getAllSandwichCollections();

      // Group by date, host, and sandwich counts to find exact duplicates
      const duplicateGroups = new Map();
      const suspiciousPatterns = [];
      const ogDuplicates = [];

      collections.forEach((collection) => {
        const key = `${collection.collectionDate}-${collection.hostName}-${collection.individualSandwiches}-${collection.groupCollections}`;

        if (!duplicateGroups.has(key)) {
          duplicateGroups.set(key, []);
        }
        duplicateGroups.get(key).push(collection);

        // Check for suspicious patterns
        const hostName = collection.hostName.toLowerCase();
        if (
          hostName.startsWith("loc ") ||
          hostName.match(/^group \d-\d$/) ||
          hostName.includes("test") ||
          hostName.includes("duplicate")
        ) {
          suspiciousPatterns.push(collection);
        }
      });

      // Find OG Sandwich Project duplicates with early collections
      const ogCollections = collections.filter(
        (c) => c.hostName === "OG Sandwich Project",
      );
      const earlyCollections = collections.filter(
        (c) =>
          c.hostName !== "OG Sandwich Project" &&
          (c.hostName === "" ||
            c.hostName === null ||
            c.hostName.trim() === "" ||
            c.hostName.toLowerCase().includes("unknown") ||
            c.hostName.toLowerCase().includes("no location")),
      );

      const ogMap = new Map();
      ogCollections.forEach((og) => {
        const key = `${og.collectionDate}-${og.individualSandwiches}`;
        if (!ogMap.has(key)) {
          ogMap.set(key, []);
        }
        ogMap.get(key).push(og);
      });

      earlyCollections.forEach((early) => {
        const key = `${early.collectionDate}-${early.individualSandwiches}`;
        if (ogMap.has(key)) {
          const ogEntries = ogMap.get(key);
          ogDuplicates.push({
            ogEntry: ogEntries[0],
            earlyEntry: early,
            reason: "Same date and sandwich count as OG Project entry",
          });
        }
      });

      // Also find duplicate OG entries
      ogMap.forEach((ogGroup) => {
        if (ogGroup.length > 1) {
          const sorted = ogGroup.sort(
            (a, b) =>
              new Date(b.submittedAt).getTime() -
              new Date(a.submittedAt).getTime(),
          );
          sorted.slice(1).forEach((duplicate) => {
            ogDuplicates.push({
              ogEntry: sorted[0],
              duplicateOgEntry: duplicate,
              reason: "Duplicate OG Project entry",
            });
          });
        }
      });

      // Find actual duplicates (groups with more than 1 entry)
      const duplicates = Array.from(duplicateGroups.values())
        .filter((group) => group.length > 1)
        .map((group) => ({
          entries: group,
          count: group.length,
          keepNewest: group.sort(
            (a, b) =>
              new Date(b.submittedAt).getTime() -
              new Date(a.submittedAt).getTime(),
          )[0],
          toDelete: group.slice(1),
        }));

      res.json({
        totalCollections: collections.length,
        duplicateGroups: duplicates.length,
        totalDuplicateEntries: duplicates.reduce(
          (sum, group) => sum + group.toDelete.length,
          0,
        ),
        suspiciousPatterns: suspiciousPatterns.length,
        ogDuplicates: ogDuplicates.length,
        duplicates,
        suspiciousEntries: suspiciousPatterns,
        ogDuplicateEntries: ogDuplicates,
      });
    } catch (error) {
      logger.error("Failed to analyze duplicates", error);
      res.status(500).json({ message: "Failed to analyze duplicates" });
    }
  });

  // Clean duplicates from sandwich collections
  app.delete("/api/sandwich-collections/clean-duplicates", async (req: any, res: any) => {
    try {
      const { mode = "exact" } = req.body; // 'exact', 'suspicious', or 'og-duplicates'
      const collections = await storage.getAllSandwichCollections();

      let collectionsToDelete = [];

      if (mode === "exact") {
        // Find exact duplicates based on date, host, and counts
        const duplicateGroups = new Map();

        collections.forEach((collection) => {
          const key = `${collection.collectionDate}-${collection.hostName}-${collection.individualSandwiches}-${collection.groupCollections}`;

          if (!duplicateGroups.has(key)) {
            duplicateGroups.set(key, []);
          }
          duplicateGroups.get(key).push(collection);
        });

        // Keep only the newest entry from each duplicate group
        duplicateGroups.forEach((group) => {
          if (group.length > 1) {
            const sorted = group.sort(
              (a, b) =>
                new Date(b.submittedAt).getTime() -
                new Date(a.submittedAt).getTime(),
            );
            collectionsToDelete.push(...sorted.slice(1)); // Keep first (newest), delete rest
          }
        });
      } else if (mode === "suspicious") {
        // Remove entries with suspicious patterns
        collectionsToDelete = collections.filter((collection) => {
          const hostName = collection.hostName.toLowerCase();
          return (
            hostName.startsWith("loc ") ||
            hostName.match(/^group \d-\d$/) ||
            hostName.match(/^group \d+$/) || // Matches "Group 8", "Group 1", etc.
            hostName.includes("test") ||
            hostName.includes("duplicate")
          );
        });
      }

      let deletedCount = 0;
      const errors = [];

      // Delete in reverse order by ID to maintain consistency
      const sortedCollections = collectionsToDelete.sort((a, b) => b.id - a.id);

      for (const collection of sortedCollections) {
        try {
          // Ensure ID is a valid number
          const id = Number(collection.id);
          if (isNaN(id)) {
            errors.push(`Invalid collection ID: ${collection.id}`);
            continue;
          }

          const deleted = await storage.deleteSandwichCollection(id);
          if (deleted) {
            deletedCount++;
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          errors.push(
            `Failed to delete collection ${collection.id}: ${errorMessage}`,
          );
          console.error(`Failed to delete collection ${collection.id}:`, error);
        }
      }

      res.json({
        message: `Successfully cleaned ${deletedCount} duplicate entries using ${mode} mode`,
        deletedCount,
        totalFound: collectionsToDelete.length,
        errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
        mode,
      });
    } catch (error) {
      logger.error("Failed to clean duplicates", error);
      res.status(500).json({ message: "Failed to clean duplicate entries" });
    }
  });

  // CSV Import for Sandwich Collections
  app.post(
    "/api/import-collections",
    upload.single("csvFile"),
    async (req: any, res: any) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No CSV file uploaded" });
        }

        const csvContent = await fs.readFile(req.file.path, "utf-8");
        logger.info(`CSV content preview: ${csvContent.substring(0, 200)}...`);

        // Detect CSV format type
        const lines = csvContent.split("\n");
        let formatType = "standard";

        // Check for complex weekly totals format
        if (lines[0].includes("WEEK #") || lines[0].includes("Hosts:")) {
          formatType = "complex";
        }
        // Check for structured weekly data format
        else if (
          lines[0].includes("Week_Number") &&
          lines[0].includes("Total_Sandwiches")
        ) {
          formatType = "structured";
        }

        let records = [];

        if (formatType === "complex") {
          logger.info("Complex weekly totals format detected");
          // Find the row with actual data (skip header rows)
          let startRow = 0;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].match(/^\d+,/) && lines[i].includes("TRUE")) {
              startRow = i;
              break;
            }
          }

          // Parse the complex format manually
          for (let i = startRow; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || !line.includes("TRUE")) continue;

            const parts = line.split(",");
            if (parts.length >= 5 && parts[4]) {
              const weekNum = parts[0];
              const date = parts[3];
              const totalSandwiches = parts[4].replace(/[",]/g, "");

              if (
                date &&
                totalSandwiches &&
                !isNaN(parseInt(totalSandwiches))
              ) {
                records.push({
                  "Host Name": `Week ${weekNum} Total`,
                  "Sandwich Count": totalSandwiches,
                  Date: date,
                  "Logged By": "CSV Import",
                  Notes: `Weekly total import from complex spreadsheet`,
                  "Created At": new Date().toISOString(),
                });
              }
            }
          }
        } else if (formatType === "structured") {
          logger.info("Structured weekly data format detected");
          // Parse the structured format
          const parsedData = parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            delimiter: ",",
            quote: '"',
          });

          // Convert structured data to standard format
          for (const row of parsedData) {
            if (
              row.Week_Number &&
              row.Date &&
              row.Total_Sandwiches &&
              parseInt(row.Total_Sandwiches) > 0
            ) {
              // Parse the date to a more readable format
              const date = new Date(row.Date);
              const formattedDate = date.toISOString().split("T")[0]; // YYYY-MM-DD format

              records.push({
                "Host Name": `Week ${row.Week_Number} Complete Data`,
                "Sandwich Count": row.Total_Sandwiches,
                Date: formattedDate,
                "Logged By": "CSV Import",
                Notes: `Structured weekly data import with location and group details`,
                "Created At": new Date().toISOString(),
              });
            }
          }
        } else {
          logger.info("Standard CSV format detected");
          // Parse normal CSV format
          records = parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            delimiter: ",",
            quote: '"',
          });
        }

        logger.info(`Parsed ${records.length} records`);
        if (records.length > 0) {
          logger.info(`First record: ${JSON.stringify(records[0])}`);
        }

        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];

        // Process each record
        for (let i = 0; i < records.length; i++) {
          const record = records[i];

          try {
            // Debug log the record structure
            logger.info(`Processing row ${i + 1}:`, {
              record: JSON.stringify(record),
            });

            // Check for alternative column names
            const hostName =
              record["Host Name"] ||
              record["Host"] ||
              record["host_name"] ||
              record["HostName"];
            const sandwichCountStr =
              record["Individual Sandwiches"] ||
              record["Sandwich Count"] ||
              record["Count"] ||
              record["sandwich_count"] ||
              record["SandwichCount"] ||
              record["Sandwiches"];
            const date =
              record["Collection Date"] ||
              record["Date"] ||
              record["date"] ||
              record["CollectionDate"];

            // Validate required fields with more detailed error reporting
            if (!hostName) {
              const availableKeys = Object.keys(record).join(", ");
              throw new Error(
                `Missing Host Name (available columns: ${availableKeys}) in row ${i + 1}`,
              );
            }
            if (!sandwichCountStr) {
              const availableKeys = Object.keys(record).join(", ");
              throw new Error(
                `Missing Individual Sandwiches (available columns: ${availableKeys}) in row ${i + 1}`,
              );
            }
            if (!date) {
              const availableKeys = Object.keys(record).join(", ");
              throw new Error(
                `Missing Collection Date (available columns: ${availableKeys}) in row ${i + 1}`,
              );
            }

            // Parse sandwich count as integer
            const sandwichCount = parseInt(sandwichCountStr.toString().trim());
            if (isNaN(sandwichCount)) {
              throw new Error(
                `Invalid sandwich count "${sandwichCountStr}" in row ${i + 1}`,
              );
            }

            // Parse dates
            let collectionDate = date;
            let submittedAt = new Date();

            // Try to parse Created At if provided
            const createdAt =
              record["Created At"] ||
              record["created_at"] ||
              record["CreatedAt"];
            if (createdAt) {
              const parsedDate = new Date(createdAt);
              if (!isNaN(parsedDate.getTime())) {
                submittedAt = parsedDate;
              }
            }

            // Handle Group Collections data
            const groupCollectionsStr = record["Group Collections"] || "";
            let groupCollections = "[]";
            if (groupCollectionsStr && groupCollectionsStr.trim() !== "") {
              // If it's a number, convert to simple array format
              const groupCount = parseInt(groupCollectionsStr.trim());
              if (!isNaN(groupCount) && groupCount > 0) {
                groupCollections = JSON.stringify([
                  { count: groupCount, description: "Group Collection" },
                ]);
              }
            }

            // Create sandwich collection
            await storage.createSandwichCollection({
              hostName: hostName.trim(),
              individualSandwiches: sandwichCount,
              collectionDate: collectionDate.trim(),
              groupCollections: groupCollections,
              submittedAt: submittedAt,
            });

            successCount++;
          } catch (error) {
            errorCount++;
            const errorMsg = `Row ${i + 1}: ${error instanceof Error ? error.message : "Unknown error"}`;
            errors.push(errorMsg);
            logger.error(errorMsg);
          }
        }

        // Clean up uploaded file
        await fs.unlink(req.file.path);

        const result = {
          totalRecords: records.length,
          successCount,
          errorCount,
          errors: errors.slice(0, 10), // Return first 10 errors
        };

        logger.info(
          `CSV import completed: ${successCount}/${records.length} records imported`,
        );
        res.json(result);
      } catch (error) {
        // Clean up uploaded file if it exists
        if (req.file?.path) {
          try {
            await fs.unlink(req.file.path);
          } catch (cleanupError) {
            logger.error("Failed to clean up uploaded file", cleanupError);
          }
        }

        logger.error("CSV import failed", error);
        res.status(500).json({
          message: "Failed to import CSV file",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  // Get collections by host name
  app.get("/api/collections-by-host/:hostName", async (req: any, res: any) => {
    try {
      const hostName = decodeURIComponent(req.params.hostName);
      const collections = await storage.getAllSandwichCollections();

      // Filter collections by host name (case insensitive)
      const hostCollections = collections.filter(
        (collection) =>
          collection.hostName.toLowerCase() === hostName.toLowerCase(),
      );

      res.json(hostCollections);
    } catch (error) {
      logger.error("Failed to fetch collections by host", error);
      res.status(500).json({ message: "Failed to fetch collections by host" });
    }
  });

  // Collection statistics for bulk data manager
  app.get("/api/collection-stats", async (req: any, res: any) => {
    try {
      const totalRecords = await storage.getSandwichCollectionsCount();
      const allCollections = await storage.getAllSandwichCollections();

      // Count mapped vs unmapped records based on host assignment
      const hosts = await storage.getAllHosts();
      const hostNames = new Set(hosts.map((h) => h.name));

      let mappedRecords = 0;
      let unmappedRecords = 0;

      for (const collection of allCollections) {
        // Consider "groups" as mapped hosts
        if (
          hostNames.has(collection.hostName) ||
          collection.hostName.toLowerCase().includes("group")
        ) {
          mappedRecords++;
        } else {
          unmappedRecords++;
        }
      }

      res.json({
        totalRecords: Number(totalRecords),
        processedRecords: Number(totalRecords),
        mappedRecords,
        unmappedRecords,
      });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Failed to fetch collection statistics" });
    }
  });

  // Host mapping statistics
  app.get("/api/host-mapping-stats", async (req: any, res: any) => {
    try {
      const allCollections = await storage.getAllSandwichCollections();
      const hosts = await storage.getAllHosts();
      const hostNames = new Set(hosts.map((h) => h.name));

      // Group collections by host name and count them
      const hostCounts = new Map<string, number>();

      for (const collection of allCollections) {
        const count = hostCounts.get(collection.hostName) || 0;
        hostCounts.set(collection.hostName, count + 1);
      }

      // Convert to array with mapping status
      // Consider "groups" as mapped hosts
      const mappingStats = Array.from(hostCounts.entries())
        .map(([hostName, count]) => ({
          hostName,
          count,
          mapped:
            hostNames.has(hostName) || hostName.toLowerCase().includes("group"),
        }))
        .sort((a, b) => b.count - a.count); // Sort by count descending

      res.json(mappingStats);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Failed to fetch host mapping statistics" });
    }
  });
}
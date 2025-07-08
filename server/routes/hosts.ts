import { storage } from "../storage-wrapper";
import { logger } from "../middleware/logger";
import { insertHostSchema } from "@shared/schema";
import fs from "fs/promises";

// Use dynamic imports for multer to avoid compilation issues
import multer from "multer";

// Configure multer for file uploads
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req: any, file: any, cb: any) => {
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  },
});

export function setupHostRoutes(app: any, isAuthenticated: any, requirePermission: any) {
  // Hosts
  app.get("/api/hosts", async (req: any, res: any) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      const hosts = await storage.getHosts(limit, offset);
      const totalCount = await storage.getHostsCount();

      res.json({
        hosts,
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
      res.status(500).json({ message: "Failed to fetch hosts" });
    }
  });

  app.post("/api/hosts", requirePermission("edit_data"), async (req: any, res: any) => {
    try {
      const hostData = insertHostSchema.parse(req.body);
      const host = await storage.createHost(hostData);
      res.status(201).json(host);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        logger.warn("Invalid host input", { error: (error as any).errors, ip: req.ip });
        res.status(400).json({ message: "Invalid host data", errors: (error as any).errors });
      } else {
        logger.error("Failed to create host", error);
        res.status(500).json({ message: "Failed to create host" });
      }
    }
  });

  app.put("/api/hosts/:id", requirePermission("edit_data"), async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const host = await storage.updateHost(id, updates);
      if (!host) {
        return res.status(404).json({ message: "Host not found" });
      }
      res.json(host);
    } catch (error) {
      logger.error("Failed to update host", error);
      res.status(400).json({ message: "Invalid update data" });
    }
  });

  app.delete("/api/hosts/:id", requirePermission("edit_data"), async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteHost(id);
      if (!deleted) {
        return res.status(404).json({ message: "Host not found" });
      }
      res.status(204).send();
    } catch (error) {
      logger.error("Failed to delete host", error);
      res.status(500).json({ message: "Failed to delete host" });
    }
  });

  // Contacts
  app.get("/api/contacts", async (req: any, res: any) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      const contacts = await storage.getContacts(limit, offset);
      const totalCount = await storage.getContactsCount();

      res.json({
        contacts,
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
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  app.post("/api/contacts", requirePermission("edit_data"), async (req: any, res: any) => {
    try {
      const contactData = req.body;
      const contact = await storage.createContact(contactData);
      res.status(201).json(contact);
    } catch (error) {
      logger.error("Failed to create contact", error);
      res.status(500).json({ message: "Failed to create contact" });
    }
  });

  app.put("/api/contacts/:id", requirePermission("edit_data"), async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const contact = await storage.updateContact(id, updates);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      res.json(contact);
    } catch (error) {
      logger.error("Failed to update contact", error);
      res.status(400).json({ message: "Invalid update data" });
    }
  });

  app.delete("/api/contacts/:id", requirePermission("edit_data"), async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteContact(id);
      if (!deleted) {
        return res.status(404).json({ message: "Contact not found" });
      }
      res.status(204).send();
    } catch (error) {
      logger.error("Failed to delete contact", error);
      res.status(500).json({ message: "Failed to delete contact" });
    }
  });

  // Recipients
  app.get("/api/recipients", async (req: any, res: any) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      const recipients = await storage.getRecipients(limit, offset);
      const totalCount = await storage.getRecipientsCount();

      res.json({
        recipients,
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
      res.status(500).json({ message: "Failed to fetch recipients" });
    }
  });

  app.post("/api/recipients", requirePermission("edit_data"), async (req: any, res: any) => {
    try {
      const recipientData = req.body;
      const recipient = await storage.createRecipient(recipientData);
      res.status(201).json(recipient);
    } catch (error) {
      logger.error("Failed to create recipient", error);
      res.status(500).json({ message: "Failed to create recipient" });
    }
  });

  app.put("/api/recipients/:id", requirePermission("edit_data"), async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const recipient = await storage.updateRecipient(id, updates);
      if (!recipient) {
        return res.status(404).json({ message: "Recipient not found" });
      }
      res.json(recipient);
    } catch (error) {
      logger.error("Failed to update recipient", error);
      res.status(400).json({ message: "Invalid update data" });
    }
  });

  app.delete("/api/recipients/:id", requirePermission("edit_data"), async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteRecipient(id);
      if (!deleted) {
        return res.status(404).json({ message: "Recipient not found" });
      }
      res.status(204).send();
    } catch (error) {
      logger.error("Failed to delete recipient", error);
      res.status(500).json({ message: "Failed to delete recipient" });
    }
  });

  // CSV Import for Contacts
  app.post("/api/import-contacts", upload.single("csvFile"), async (req: any, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No CSV file uploaded" });
      }

      const csvContent = await fs.readFile(req.file.path, "utf-8");
      logger.info(`CSV content preview: ${csvContent.substring(0, 200)}...`);

      // Use dynamic import for CSV parsing
      const { parse } = await import("csv-parse/sync");
      
      // Parse CSV
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        delimiter: ",",
      });

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        
        try {
          const name = record.name || record.Name || record.fullName || record.full_name;
          const email = record.email || record.Email || record.emailAddress || record.email_address;
          const phone = record.phone || record.Phone || record.phoneNumber || record.phone_number;
          const address = record.address || record.Address || record.fullAddress || record.full_address;
          const notes = record.notes || record.Notes || record.description || record.Description;

          if (!name || !email) {
            throw new Error(`Missing required fields (name, email) in row ${i + 1}`);
          }

          await storage.createContact({
            name: name.trim(),
            email: email.trim(),
            phone: phone ? phone.trim() : undefined,
            address: address ? address.trim() : undefined,
            notes: notes ? notes.trim() : undefined,
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

      logger.info(`Contact CSV import completed: ${successCount}/${records.length} records imported`);
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

      logger.error("Contact CSV import failed", error);
      res.status(500).json({
        message: "Failed to import contacts CSV file",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // CSV Import for Recipients
  app.post("/api/import-recipients", upload.single("csvFile"), async (req: any, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No CSV file uploaded" });
      }

      const csvContent = await fs.readFile(req.file.path, "utf-8");
      logger.info(`CSV content preview: ${csvContent.substring(0, 200)}...`);

      // Use dynamic import for CSV parsing
      const { parse } = await import("csv-parse/sync");
      
      // Parse CSV
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        delimiter: ",",
      });

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        
        try {
          const name = record.name || record.Name || record.fullName || record.full_name;
          const email = record.email || record.Email || record.emailAddress || record.email_address;
          const phone = record.phone || record.Phone || record.phoneNumber || record.phone_number;
          const address = record.address || record.Address || record.fullAddress || record.full_address;
          const notes = record.notes || record.Notes || record.description || record.Description;

          if (!name || !email) {
            throw new Error(`Missing required fields (name, email) in row ${i + 1}`);
          }

          await storage.createRecipient({
            name: name.trim(),
            email: email.trim(),
            phone: phone ? phone.trim() : undefined,
            address: address ? address.trim() : undefined,
            notes: notes ? notes.trim() : undefined,
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

      logger.info(`Recipient CSV import completed: ${successCount}/${records.length} records imported`);
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

      logger.error("Recipient CSV import failed", error);
      res.status(500).json({
        message: "Failed to import recipients CSV file",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
}
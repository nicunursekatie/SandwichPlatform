import { storage } from "../storage-wrapper";
import { logger } from "../middleware/logger";
import { insertHostSchema, insertHostContactSchema, insertRecipientSchema, insertContactSchema } from "@shared/schema";
import multer from "multer";

// Configure multer for import operations (memory storage)
const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req: any, file: any, cb: any) => {
    const allowedTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    const allowedExtensions = [".csv", ".xls", ".xlsx"];
    const hasValidType = allowedTypes.includes(file.mimetype);
    const hasValidExtension = allowedExtensions.some((ext: any) =>
      file.originalname.toLowerCase().endsWith(ext),
    );

    if (hasValidType || hasValidExtension) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV and Excel files are allowed"));
    }
  },
});

export function setupHostRoutes(app: any, isAuthenticated: any, requirePermission: any) {
  // Hosts
  app.get("/api/hosts", async (req: any, res: any) => {
    try {
      const hosts = await storage.getAllHosts();
      res.json(hosts);
    } catch (error) {
      logger.error("Failed to fetch hosts", error);
      res.status(500).json({ message: "Failed to fetch hosts" });
    }
  });

  app.post("/api/hosts", async (req: any, res: any) => {
    try {
      const hostData = insertHostSchema.parse(req.body);
      const host = await storage.createHost(hostData);
      res.status(201).json(host);
    } catch (error) {
      logger.error("Failed to create host", error);
      res.status(400).json({ message: "Invalid host data" });
    }
  });

  app.put("/api/hosts/:id", async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const updatedHost = await storage.updateHost(id, updates);
      if (!updatedHost) {
        return res.status(404).json({ message: "Host not found" });
      }
      res.json(updatedHost);
    } catch (error) {
      logger.error("Failed to update host", error);
      res.status(500).json({ message: "Failed to update host" });
    }
  });

  app.patch("/api/hosts/:id", async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const updatedHost = await storage.updateHost(id, updates);
      if (!updatedHost) {
        return res.status(404).json({ message: "Host not found" });
      }
      res.json(updatedHost);
    } catch (error) {
      logger.error("Failed to update host", error);
      res.status(500).json({ message: "Failed to update host" });
    }
  });

  app.delete("/api/hosts/:id", async (req: any, res: any) => {
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

  // Host Contacts
  app.post("/api/host-contacts", async (req: any, res: any) => {
    try {
      const contactData = insertHostContactSchema.parse(req.body);
      const contact = await storage.createHostContact(contactData);
      res.status(201).json(contact);
    } catch (error) {
      if (error.name === 'ZodError') {
        logger.warn("Invalid host contact input", { error: error.errors });
        res
          .status(400)
          .json({ message: "Invalid host contact data", errors: error.errors });
      } else {
        logger.error("Failed to create host contact", error);
        res.status(500).json({ message: "Failed to create host contact" });
      }
    }
  });

  app.get("/api/hosts/:hostId/contacts", async (req: any, res: any) => {
    try {
      const hostId = parseInt(req.params.hostId);
      const contacts = await storage.getHostContacts(hostId);
      res.json(contacts);
    } catch (error) {
      logger.error("Failed to get host contacts", error);
      res.status(500).json({ message: "Failed to get host contacts" });
    }
  });

  app.put("/api/host-contacts/:id", async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const updatedContact = await storage.updateHostContact(id, updates);
      if (!updatedContact) {
        return res.status(404).json({ message: "Host contact not found" });
      }
      res.json(updatedContact);
    } catch (error) {
      logger.error("Failed to update host contact", error);
      res.status(500).json({ message: "Failed to update host contact" });
    }
  });

  app.patch("/api/host-contacts/:id", async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const updatedContact = await storage.updateHostContact(id, updates);
      if (!updatedContact) {
        return res.status(404).json({ message: "Host contact not found" });
      }
      res.json(updatedContact);
    } catch (error) {
      logger.error("Failed to update host contact", error);
      res.status(500).json({ message: "Failed to update host contact" });
    }
  });

  app.delete("/api/host-contacts/:id", async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteHostContact(id);
      if (!deleted) {
        return res.status(404).json({ message: "Host contact not found" });
      }
      res.status(204).send();
    } catch (error) {
      logger.error("Failed to delete host contact", error);
      res.status(500).json({ message: "Failed to delete host contact" });
    }
  });

  // Optimized endpoint to get all hosts with their contacts in one call
  app.get("/api/hosts-with-contacts", async (req: any, res: any) => {
    try {
      const hostsWithContacts = await storage.getAllHostsWithContacts();
      res.json(hostsWithContacts);
    } catch (error) {
      logger.error("Failed to fetch hosts with contacts", error);
      res.status(500).json({ message: "Failed to fetch hosts with contacts" });
    }
  });

  // Recipients
  app.get("/api/recipients", async (req: any, res: any) => {
    try {
      const recipients = await storage.getAllRecipients();
      res.json(recipients);
    } catch (error) {
      logger.error("Failed to fetch recipients", error);
      res.status(500).json({ message: "Failed to fetch recipients" });
    }
  });

  app.post("/api/recipients", async (req: any, res: any) => {
    try {
      const recipientData = insertRecipientSchema.parse(req.body);
      const recipient = await storage.createRecipient(recipientData);
      res.status(201).json(recipient);
    } catch (error) {
      logger.error("Failed to create recipient", error);
      res.status(400).json({ message: "Invalid recipient data" });
    }
  });

  app.put("/api/recipients/:id", async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const updatedRecipient = await storage.updateRecipient(id, updates);
      if (!updatedRecipient) {
        return res.status(404).json({ message: "Recipient not found" });
      }
      res.json(updatedRecipient);
    } catch (error) {
      logger.error("Failed to update recipient", error);
      res.status(500).json({ message: "Failed to update recipient" });
    }
  });

  app.patch("/api/recipients/:id", async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const updatedRecipient = await storage.updateRecipient(id, updates);
      if (!updatedRecipient) {
        return res.status(404).json({ message: "Recipient not found" });
      }
      res.json(updatedRecipient);
    } catch (error) {
      logger.error("Failed to update recipient", error);
      res.status(500).json({ message: "Failed to update recipient" });
    }
  });

  app.delete("/api/recipients/:id", async (req: any, res: any) => {
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

  // General Contacts
  app.get("/api/contacts", async (req: any, res: any) => {
    try {
      const contacts = await storage.getAllContacts();
      res.json(contacts);
    } catch (error) {
      logger.error("Failed to fetch contacts", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  app.post("/api/contacts", async (req: any, res: any) => {
    try {
      const contactData = insertContactSchema.parse(req.body);
      const contact = await storage.createContact(contactData);
      res.status(201).json(contact);
    } catch (error) {
      logger.error("Failed to create contact", error);
      res.status(400).json({ message: "Invalid contact data" });
    }
  });

  app.put("/api/contacts/:id", async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const updatedContact = await storage.updateContact(id, updates);
      if (!updatedContact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      res.json(updatedContact);
    } catch (error) {
      logger.error("Failed to update contact", error);
      res.status(500).json({ message: "Failed to update contact" });
    }
  });

  app.patch("/api/contacts/:id", async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const updatedContact = await storage.updateContact(id, updates);
      if (!updatedContact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      res.json(updatedContact);
    } catch (error) {
      logger.error("Failed to update contact", error);
      res.status(500).json({ message: "Failed to update contact" });
    }
  });

  app.delete("/api/contacts/:id", async (req: any, res: any) => {
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

  // Import recipients from CSV/XLSX
  app.post(
    "/api/recipients/import",
    importUpload.single("file"),
    async (req: any, res: any) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        const fileExtension = req.file.originalname
          .toLowerCase()
          .split(".")
          .pop();
        let records: any[] = [];

        if (fileExtension === "csv") {
          // Parse CSV
          const csvContent = req.file.buffer.toString("utf-8");
          const { parse } = await import("csv-parse/sync");
          records = parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
          });
        } else if (fileExtension === "xlsx" || fileExtension === "xls") {
          // Parse Excel
          const XLSX = await import("xlsx");
          const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          records = XLSX.utils.sheet_to_json(sheet);
        } else {
          return res.status(400).json({ message: "Unsupported file format" });
        }

        let imported = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (const record of records) {
          try {
            // Normalize column names (case-insensitive)
            const normalizedRecord: any = {};
            Object.keys(record).forEach((key) => {
              const normalizedKey = key.toLowerCase().trim();
              normalizedRecord[normalizedKey] = record[key];
            });

            // Required fields validation - support more column variations
            const name =
              normalizedRecord.name ||
              normalizedRecord["recipient name"] ||
              normalizedRecord["full name"] ||
              normalizedRecord["organization"] ||
              normalizedRecord["org"] ||
              normalizedRecord["client name"];
            const phone =
              normalizedRecord.phone ||
              normalizedRecord["phone number"] ||
              normalizedRecord["mobile"] ||
              normalizedRecord["phone#"] ||
              normalizedRecord["contact phone"];

            if (!name || !phone) {
              errors.push(
                `Row skipped: Missing required fields (name: "${name}", phone: "${phone}")`,
              );
              skipped++;
              continue;
            }

            // Skip empty rows
            if (!String(name).trim() || !String(phone).trim()) {
              skipped++;
              continue;
            }

            // Optional fields with defaults
            const email =
              normalizedRecord.email ||
              normalizedRecord["email address"] ||
              null;
            const address =
              normalizedRecord.address || normalizedRecord.location || null;
            const preferences =
              normalizedRecord.preferences ||
              normalizedRecord.notes ||
              normalizedRecord.dietary ||
              normalizedRecord["sandwich type"] ||
              normalizedRecord["weekly estimate"] ||
              normalizedRecord["tsp contact"] ||
              null;
            const status = normalizedRecord.status || "active";

            // Check for duplicate (by phone number)
            const existingRecipients = await storage.getAllRecipients();
            const phoneToCheck = String(phone).trim().replace(/\D/g, ""); // Remove non-digits for comparison
            const isDuplicate = existingRecipients.some((r: any) => {
              const existingPhone = r.phone.replace(/\D/g, "");
              return existingPhone === phoneToCheck;
            });

            if (isDuplicate) {
              errors.push(
                `Row skipped: Duplicate phone number "${phoneToCheck}"`,
              );
              skipped++;
              continue;
            }

            // Create recipient
            await storage.createRecipient({
              name: String(name).trim(),
              phone: phoneToCheck,
              email: email ? String(email).trim() : null,
              address: address ? String(address).trim() : null,
              preferences: preferences ? String(preferences).trim() : null,
              status:
                String(status).toLowerCase() === "inactive"
                  ? "inactive"
                  : "active",
            });

            imported++;
          } catch (error) {
            console.error("Import error:", error);
            errors.push(
              `Row skipped: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
            skipped++;
          }
        }

        res.json({
          imported,
          skipped,
          total: records.length,
          errors: errors.slice(0, 10), // Limit error messages
        });
      } catch (error) {
        logger.error("Failed to import recipients", error);
        res.status(500).json({ message: "Failed to process import file" });
      }
    },
  );

  // Import host and driver contacts from Excel/CSV
  app.post(
    "/api/import-contacts",
    importUpload.single("file"),
    async (req: any, res: any) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        const fileExtension = req.file.originalname
          .toLowerCase()
          .split(".")
          .pop();
        let records: any[] = [];

        if (fileExtension === "csv") {
          // Parse CSV
          const csvContent = req.file.buffer.toString("utf-8");
          const { parse } = await import("csv-parse/sync");
          records = parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
          });
        } else if (fileExtension === "xlsx" || fileExtension === "xls") {
          // Parse Excel
          const XLSX = await import("xlsx");
          const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rawData = XLSX.utils.sheet_to_json(sheet, { defval: "" });

          // Handle Excel files where headers are in the first data row
          if (rawData.length > 0) {
            const firstRow = rawData[0];
            const hasGenericHeaders = Object.keys(firstRow).some((key) =>
              key.startsWith("__EMPTY"),
            );

            if (hasGenericHeaders && rawData.length > 1) {
              // Use the first row as headers and map the rest of the data
              const headers = Object.values(firstRow) as string[];
              records = rawData.slice(1).map((row) => {
                const mappedRow: any = {};
                const values = Object.values(row) as string[];
                headers.forEach((header, index) => {
                  if (header && header.trim()) {
                    mappedRow[header.trim()] = values[index] || "";
                  }
                });
                return mappedRow;
              });
            } else {
              records = rawData;
            }
          }
        } else {
          return res.status(400).json({ message: "Unsupported file format" });
        }

        let hostsCreated = 0;
        let contactsImported = 0;
        let skipped = 0;
        const errors: string[] = [];

        // Process each record from the Excel file
        for (const record of records) {
          try {
            // Normalize field names (case-insensitive)
            const normalizedRecord: any = {};
            Object.keys(record).forEach((key) => {
              normalizedRecord[key.toLowerCase().trim()] = record[key];
            });

            // Extract host/location information from your Excel structure
            const hostName =
              normalizedRecord.area ||
              normalizedRecord.location ||
              normalizedRecord.host ||
              normalizedRecord["host location"] ||
              normalizedRecord.site ||
              normalizedRecord.venue;

            // Extract contact information - combine first and last name
            const firstName =
              normalizedRecord["first name"] ||
              normalizedRecord.firstname ||
              "";
            const lastName =
              normalizedRecord["last name"] || normalizedRecord.lastname || "";
            const contactName =
              `${firstName} ${lastName}`.trim() ||
              normalizedRecord.name ||
              normalizedRecord["contact name"] ||
              normalizedRecord["driver name"] ||
              normalizedRecord["volunteer name"];

            const phone =
              normalizedRecord.phone ||
              normalizedRecord["phone number"] ||
              normalizedRecord.mobile ||
              normalizedRecord.cell;

            const email =
              normalizedRecord.email ||
              normalizedRecord["email address"] ||
              null;

            const role =
              normalizedRecord.role ||
              normalizedRecord.position ||
              normalizedRecord.type ||
              "Host/Driver";

            // Skip if missing essential data
            if (!hostName || !contactName || !phone) {
              skipped++;
              continue;
            }

            // Find or create host
            const existingHosts = await storage.getAllHosts();
            let host = existingHosts.find(
              (h: any) =>
                h.name.toLowerCase().trim() ===
                String(hostName).toLowerCase().trim(),
            );

            if (!host) {
              // Create new host
              host = await storage.createHost({
                name: String(hostName).trim(),
                address: normalizedRecord.address || null,
                status: "active",
                notes: null,
              });
              hostsCreated++;
            }

            // Clean phone number
            const cleanPhone = String(phone).trim().replace(/\D/g, "");
            if (cleanPhone.length < 10) {
              errors.push(`Skipped ${contactName}: Invalid phone number`);
              skipped++;
              continue;
            }

            // Check for duplicate contact
            const existingContacts = await storage.getHostContacts(host.id);
            const isDuplicate = existingContacts.some(
              (c: any) => c.phone.replace(/\D/g, "") === cleanPhone,
            );

            if (isDuplicate) {
              errors.push(`Skipped ${contactName}: Duplicate phone number`);
              skipped++;
              continue;
            }

            // Create host contact
            await storage.createHostContact({
              hostId: host.id,
              name: String(contactName).trim(),
              role: String(role).trim(),
              phone: cleanPhone,
              email: email ? String(email).trim() : null,
              isPrimary: false, // Can be updated manually later
              notes: normalizedRecord.notes || null,
            });

            contactsImported++;
          } catch (error) {
            errors.push(
              `Error processing record: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
            skipped++;
          }
        }

        res.json({
          message: "Import completed",
          imported: contactsImported,
          hosts: hostsCreated,
          skipped,
          total: records.length,
          errors: errors.slice(0, 10), // Limit error messages
        });
      } catch (error) {
        logger.error("Failed to import contacts", error);
        res.status(500).json({ message: "Failed to process import file" });
      }
    },
  );
}
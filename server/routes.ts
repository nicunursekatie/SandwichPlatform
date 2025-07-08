import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";
import { eq, and, or, sql, desc } from 'drizzle-orm';
import express from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import multer from "multer";
import { parse } from "csv-parse/sync";
import fs from "fs/promises";
import { createReadStream } from "fs";
import path from "path";
import mammoth from "mammoth";
import { storage } from "./storage-wrapper";
import { sendDriverAgreementNotification } from "./sendgrid";
import { messageNotificationRoutes } from "./routes/message-notifications";
import googleSheetsRoutes from "./routes/google-sheets";
// import { generalRateLimit, strictRateLimit, uploadRateLimit, clearRateLimit } from "./middleware/rateLimiter";
import { sanitizeMiddleware } from "./middleware/sanitizer";
import { requestLogger, errorLogger, logger } from "./middleware/logger";
import {
  insertProjectSchema,
  insertProjectTaskSchema,
  insertProjectCommentSchema,
  insertTaskCompletionSchema,
  insertMessageSchema,
  insertWeeklyReportSchema,
  insertSandwichCollectionSchema,
  insertMeetingMinutesSchema,
  insertAgendaItemSchema,
  insertMeetingSchema,
  insertDriverAgreementSchema,
  insertDriverSchema,
  insertHostSchema,
  insertHostContactSchema,
  insertRecipientSchema,
  insertContactSchema,
  insertAnnouncementSchema,
  drivers,
  projectTasks,
  taskCompletions,


  conversations,
  conversationParticipants,
  messages as messagesTable,
  users,
} from "@shared/schema";

// Extend Request interface to include file metadata
declare global {
  namespace Express {
    interface Request {
      fileMetadata?: {
        fileName: string;
        filePath: string;
        fileType: string;
        mimeType: string;
      };
    }
  }
}
import dataManagementRoutes from "./routes/data-management";
import { registerPerformanceRoutes } from "./routes/performance";
import { SearchEngine } from "./search-engine";
import { CacheManager } from "./performance/cache-manager";
import { ReportGenerator } from "./reporting/report-generator";
import { EmailService } from "./notifications/email-service";
import { VersionControl } from "./middleware/version-control";
import { BackupManager } from "./operations/backup-manager";
import { QueryOptimizer } from "./performance/query-optimizer";
import { db } from "./db";

// Permission middleware to check user roles and permissions
const requirePermission = (permission: string) => {
  return async (req: any, res: any, next: any) => {
    try {
      // Get user from session or req.user (temp auth sets req.user)
      const user = req.user || req.session?.user;

      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Check if user has the required permission
      const hasPermission = checkUserPermission(user, permission);

      if (!hasPermission) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      next();
    } catch (error) {
      res.status(500).json({ message: "Permission check failed" });
    }
  };
};

// Helper function to check permissions
const checkUserPermission = (user: any, permission: string): boolean => {
  // Admin has all permissions
  if (user.role === "admin") return true;

  // Coordinator has most permissions including data editing
  if (user.role === "coordinator") {
    return !["manage_users", "system_admin"].includes(permission);
  }

  // Volunteer has very limited permissions - only read access
  if (user.role === "volunteer") {
    return ["read_collections", "general_chat", "volunteer_chat"].includes(
      permission,
    );
  }

  // Viewer has read-only access
  if (user.role === "viewer") {
    return ["read_collections", "read_reports"].includes(permission);
  }

  return false;
};

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

// Configure multer for meeting minutes file uploads
const meetingMinutesUpload = multer({
  dest: "uploads/temp/", // Use temp directory first
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    const allowedExtensions = [".pdf", ".doc", ".docx"];
    const hasValidMimeType = allowedMimeTypes.includes(file.mimetype);
    const hasValidExtension = allowedExtensions.some((ext) =>
      file.originalname.toLowerCase().endsWith(ext),
    );

    if (hasValidMimeType || hasValidExtension) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Only PDF, DOC, and DOCX files are allowed for meeting minutes",
        ),
      );
    }
  },
});

// Configure multer for import operations (memory storage)
const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    const allowedExtensions = [".csv", ".xls", ".xlsx"];
    const hasValidType = allowedTypes.includes(file.mimetype);
    const hasValidExtension = allowedExtensions.some((ext) =>
      file.originalname.toLowerCase().endsWith(ext),
    );

    if (hasValidType || hasValidExtension) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV and Excel files are allowed"));
    }
  },
});

// Configure multer for project files (supports various file types)
const projectFilesUpload = multer({
  dest: "uploads/projects/",
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit per file
  fileFilter: (req, file, cb) => {
    // Allow most common file types for project documentation
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "text/plain",
      "text/csv",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/zip",
      "application/x-zip-compressed",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("File type not supported"));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup PostgreSQL session store for production-ready session persistence
  // This replaces the previous MemoryStore which was causing:
  // - Memory leaks and server crashes every ~5 minutes
  // - Session loss on server restarts
  // - "MemoryStore is not designed for a production environment" warnings
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true, // Auto-create sessions table if it doesn't exist
    ttl: 7 * 24 * 60 * 60, // 7 days TTL (in seconds for pg-simple)
    tableName: "sessions",
    pruneSessionInterval: 60 * 15, // Prune expired sessions every 15 minutes
    errorLog: (error) => {
      console.error('Session store error:', error);
    }
  });

  // Add session middleware with PostgreSQL storage
  app.use(
    session({
      store: sessionStore,
      secret: process.env.SESSION_SECRET || "temp-secret-key-for-development",
      resave: false,
      saveUninitialized: false,
      cookie: { 
        secure: false, // Should be true in production with HTTPS, false for development
        httpOnly: true, // Prevent XSS attacks
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days for better persistence
        sameSite: 'lax' // CSRF protection
      },
      name: 'tsp.session' // Custom session name
    }),
  );

  // Setup temporary authentication (stable and crash-free)
  const {
    setupTempAuth,
    isAuthenticated,
    requirePermission,
    initializeTempAuth,
  } = await import("./temp-auth");
  setupTempAuth(app);

  // Initialize with default admin user for persistent login
  await initializeTempAuth();

  // Import and register signup routes
  const { signupRoutes } = await import("./routes/signup");
  app.use("/api", signupRoutes);

  // Auth routes are now handled by the modular route system

  // Import and use the new modular routes
  const { setupAllRoutes } = await import("./routes/index");
  setupAllRoutes(app, isAuthenticated, requirePermission);

  // Register performance optimization routes
  registerPerformanceRoutes(app);
  // Apply global middleware
  app.use(requestLogger);
  // Temporarily disable rate limiting to fix sandwich collections
  // app.use(generalRateLimit);
  app.use(sanitizeMiddleware);

  // User management routes are now handled by the modular route system

  // Projects
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getAllProjects();
      res.json(projects);
    } catch (error) {
      logger.error("Failed to fetch projects", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.post("/api/projects", requirePermission("edit_data"), async (req, res) => {
    try {
      console.log("Received project data:", req.body);
      const projectData = insertProjectSchema.parse(req.body);
      console.log("Parsed project data:", projectData);
      const project = await storage.createProject(projectData);
      res.status(201).json(project);
    } catch (error) {
      console.error("Project creation error details:", error);
      logger.error("Failed to create project", error);
      res.status(400).json({
        message: "Invalid project data",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/projects/:id/claim", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { assigneeName } = req.body;

      const updatedProject = await storage.updateProject(id, {
        status: "in_progress",
        assigneeName: assigneeName || "You",
      });

      if (!updatedProject) {
        return res.status(404).json({ message: "Project not found" });
      }

      res.json(updatedProject);
    } catch (error) {
      res.status(500).json({ message: "Failed to claim project" });
    }
  });

  // Task completion routes for multi-user tasks
  app.post("/api/tasks/:taskId/complete", async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const user = req.session?.user;
      const { notes } = req.body;

      if (!user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Check if user is assigned to this task
      const task = await storage.getTaskById(taskId);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      const assigneeIds = task.assigneeIds || [];
      if (!assigneeIds.includes(user.id)) {
        return res.status(403).json({ error: "You are not assigned to this task" });
      }

      // Add completion record
      const completionData = insertTaskCompletionSchema.parse({
        taskId: taskId,
        userId: user.id,
        userName: user.displayName || user.email,
        notes: notes
      });

      const completion = await storage.createTaskCompletion(completionData);

      // Check completion status
      const allCompletions = await storage.getTaskCompletions(taskId);
      const isFullyCompleted = allCompletions.length >= assigneeIds.length;

      // If all users completed, update task status
      if (isFullyCompleted && task.status !== 'completed') {
        await storage.updateTaskStatus(taskId, 'completed');
      }

      res.json({ 
        completion: completion, 
        isFullyCompleted,
        totalCompletions: allCompletions.length,
        totalAssignees: assigneeIds.length
      });
    } catch (error) {
      console.error("Error completing task:", error);
      res.status(500).json({ error: "Failed to complete task" });
    }
  });

  // Remove completion by current user
  app.delete("/api/tasks/:taskId/complete", async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const user = req.session?.user;

      if (!user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Remove completion record
      const success = await storage.removeTaskCompletion(taskId, user.id);
      if (!success) {
        return res.status(404).json({ error: "Completion not found" });
      }

      // Update task status back to in_progress if it was completed
      const task = await storage.getTaskById(taskId);
      if (task?.status === 'completed') {
        await storage.updateTaskStatus(taskId, 'in_progress');
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error removing completion:", error);
      res.status(500).json({ error: "Failed to remove completion" });
    }
  });

  // Get task completions
  app.get("/api/tasks/:taskId/completions", async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const completions = await storage.getTaskCompletions(taskId);
      res.json(completions);
    } catch (error) {
      console.error("Error fetching completions:", error);
      res.status(500).json({ error: "Failed to fetch completions" });
    }
  });

  app.put("/api/projects/:id", requirePermission("edit_data"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;

      // Filter out timestamp fields that shouldn't be updated directly
      const { createdAt, updatedAt, ...validUpdates } = updates;

      const updatedProject = await storage.updateProject(id, validUpdates);

      if (!updatedProject) {
        return res.status(404).json({ message: "Project not found" });
      }

      res.json(updatedProject);
    } catch (error) {
      logger.error("Failed to update project", error);
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  app.patch("/api/projects/:id", requirePermission("edit_data"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;

      // Filter out timestamp fields that shouldn't be updated directly
      const { createdAt, updatedAt, ...validUpdates } = updates;

      const updatedProject = await storage.updateProject(id, validUpdates);

      if (!updatedProject) {
        return res.status(404).json({ message: "Project not found" });
      }

      res.json(updatedProject);
    } catch (error) {
      logger.error("Failed to update project", error);
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", requirePermission("edit_data"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const deleted = await storage.deleteProject(id);
      if (!deleted) {
        return res.status(404).json({ message: "Project not found" });
      }

      res.status(204).send();
    } catch (error) {
      logger.error("Failed to delete project", error);
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  // Project Files
  app.post(
    "/api/projects/:id/files",
    projectFilesUpload.array("files"),
    async (req, res) => {
      try {
        const projectId = parseInt(req.params.id);
        if (isNaN(projectId)) {
          return res.status(400).json({ message: "Invalid project ID" });
        }

        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
          return res.status(400).json({ message: "No files uploaded" });
        }

        // Process uploaded files and return metadata
        const fileMetadata = files.map((file) => ({
          name: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          path: file.path,
          uploadedAt: new Date().toISOString(),
        }));

        res.status(201).json({
          message: "Files uploaded successfully",
          files: fileMetadata,
        });
      } catch (error) {
        logger.error("Failed to upload project files", error);
        res.status(500).json({ message: "Failed to upload files" });
      }
    },
  );

  app.get("/api/projects/:id/files", async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      // For now, return empty array as file storage is basic
      // In a production app, you'd store file metadata in database
      res.json([]);
    } catch (error) {
      logger.error("Failed to fetch project files", error);
      res.status(500).json({ message: "Failed to fetch files" });
    }
  });

  // Messages - disable ALL caching middleware for this endpoint
  app.get("/api/messages", (req, res, next) => {
    // Completely disable caching at the Express level
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache'); 
    res.set('Expires', '0');
    res.set('Last-Modified', new Date().toUTCString()); // Force fresh response
    next();
  }, async (req, res) => {
    try {
      
      console.log(`[DEBUG] FULL URL: ${req.url}`);
      console.log(`[DEBUG] QUERY OBJECT:`, req.query);
      console.log(`[DEBUG] USER SESSION:`, (req as any).user);
      
      const limit = req.query.limit
        ? parseInt(req.query.limit as string)
        : undefined;
      const chatType = req.query.chatType as string;
      const committee = req.query.committee as string; // Keep for backwards compatibility
      const recipientId = req.query.recipientId as string;
      const groupId = req.query.groupId ? parseInt(req.query.groupId as string) : undefined;
      
      // Use chatType if provided, otherwise fall back to committee for backwards compatibility
      const messageContext = chatType || committee;
      console.log(`[DEBUG] API call received - chatType: "${chatType}", committee: "${committee}", recipientId: "${recipientId}", groupId: ${groupId}`);

      let messages;
      if (messageContext === "direct" && recipientId) {
        // For direct messages, get conversations between current user and recipient
        const currentUserId = (req as any).user?.id;
        console.log(`[DEBUG] Direct messages requested - currentUserId: ${currentUserId}, recipientId: ${recipientId}`);
        if (!currentUserId) {
          return res.status(401).json({ message: "Authentication required for direct messages" });
        }
        messages = await storage.getDirectMessages(currentUserId, recipientId);
        console.log(`[DEBUG] Direct messages found: ${messages.length} messages`);
      } else if (groupId) {
        // For group messages, use proper thread-based filtering
        const currentUserId = (req as any).user?.id;
        if (!currentUserId) {
          console.log(`[DEBUG] No user authentication found for group ${groupId} request`);
          return res.status(401).json({ message: "Authentication required for group messages" });
        }
        
        console.log(`[DEBUG] Group messages requested - currentUserId: ${currentUserId}, groupId: ${groupId}`);
        
        // Verify user is member of this group
        const membership = await db
          .select()
          .from(groupMemberships)
          .where(
            and(
              eq(groupMemberships.groupId, groupId),
              eq(groupMemberships.userId, currentUserId),
              eq(groupMemberships.isActive, true)
            )
          )
          .limit(1);
        
        if (membership.length === 0) {
          console.log(`[DEBUG] User ${currentUserId} is not a member of group ${groupId}`);
          return res.status(403).json({ message: "Not a member of this group" });
        }
        
        console.log(`[DEBUG] User ${currentUserId} verified as member of group ${groupId}`);
        
        // TEMPORARILY DISABLED: Get the conversation thread ID for this group
        // const thread = await db
        //   .select()
        //   .from(conversationThreads)
        //   .where(
        //     and(
        //       eq(conversationThreads.type, "group"),
        //       eq(conversationThreads.referenceId, groupId.toString()),
        //       eq(conversationThreads.isActive, true)
        //     )
        //   )
        //   .limit(1);
          
        // if (thread.length === 0) {
        //   console.log(`[DEBUG] No conversation thread found for group ${groupId}`);
        //   return res.json([]); // Return empty array if no thread exists
        // }
        
        // Get the conversation for this group using the new simple system
        const conversation = await db
          .select()
          .from(conversations)
          .where(
            and(
              eq(conversations.type, "group"),
              eq(conversations.referenceId, groupId.toString()),
              eq(conversations.isActive, true)
            )
          )
          .limit(1);
          
        if (conversation.length === 0) {
          console.log(`[DEBUG] No conversation found for group ${groupId}`);
          return res.json([]); // Return empty array if no conversation exists
        }
        
        const conversationId = conversation[0].id;
        console.log(`[DEBUG] Using conversation ID ${conversationId} for group ${groupId}`);
        
        // Get messages for this specific conversation
        const messageResults = await db
          .select()
          .from(messagesTable)
          .where(eq(messagesTable.conversationId, conversationId))
          .orderBy(messagesTable.timestamp);
        messages = messageResults;
          
        console.log(`[DEBUG] Group messages found: ${messages.length} messages for thread ${threadId}`);
        
        // TEMPORARILY DISABLED: Get messages for this specific thread
        // const threadId = thread[0].id;
        // console.log(`[DEBUG] Using thread ID ${threadId} for group ${groupId}`);
        
        // Get messages for this specific thread
        // const messageResults = await db
        //   .select()
        //   .from(messagesTable)
        //   .where(eq(messagesTable.threadId, threadId))
        //   .orderBy(messagesTable.timestamp);
        // messages = messageResults;
          
        // TEMPORARILY DISABLED: Group messages functionality
        // console.log(`[DEBUG] Group messages found: ${messages.length} messages for thread ${threadId}`);
      } else if (messageContext) {
        // TEMPORARILY DISABLED: For chat types, use thread-based filtering
        // const thread = await db
        //   .select()
        //   .from(conversationThreads)
        //   .where(
        //     and(
        //       eq(conversationThreads.type, "chat"),
        //       eq(conversationThreads.referenceId, messageContext),
        //       eq(conversationThreads.isActive, true)
        //     )
        //   )
        //   .limit(1);
          
        // if (thread.length > 0) {
        //   const threadId = thread[0].id;
        //   console.log(`[DEBUG] Using thread ID ${threadId} for chat type ${messageContext}`);
          
        //   const messageResults = await db
        //     .select()
        //     .from(messagesTable)
        //     .where(eq(messagesTable.threadId, threadId))
        //     .orderBy(messagesTable.timestamp);
        //   messages = messageResults;
        // } else {
        //   // FIXED: Use storage layer to create thread instead of legacy committee filtering
        //   console.log(`❌ CRITICAL: No thread found for chat type ${messageContext}, creating via storage layer`);
        //   const threadId = await storage.getOrCreateThreadId(messageContext);
        //   console.log(`✅ Created threadId ${threadId} for ${messageContext} via storage layer`);
        //   messages = await storage.getMessagesByThreadId(threadId);
        // }
        
        // Temporarily use storage layer for all chat messages
        messages = await storage.getMessages(messageContext, limit);
      } else {
        messages = limit
          ? await storage.getRecentMessages(limit)
          : await storage.getAllMessages();
      }

      // Filter out empty or blank messages
      const filteredMessages = messages.filter(msg => 
        msg && msg.content && msg.content.trim() !== ''
      );

      res.json(filteredMessages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/messages", requirePermission("send_messages"), async (req, res) => {
    try {
      const messageData = insertMessageSchema.parse(req.body);
      // Add user ID to message data if user is authenticated
      // ENHANCED: Add debug logging for message creation
      const messageWithUser = {
        ...messageData,
        userId: req.user?.id || null,
      };
      console.log(`📤 CREATING MESSAGE: committee=${messageData.committee}, conversationId=${messageData.conversationId}, userId=${req.user?.id}`);
      const message = await storage.createMessage(messageWithUser);
      console.log(`✅ MESSAGE CREATED: id=${message.id}, conversationId=${message.conversationId}`);
      
      // Broadcast new message notification to connected clients  
      if (typeof (global as any).broadcastNewMessage === 'function') {
        await (global as any).broadcastNewMessage(message);
      }
      
      res.status(201).json(message);
    } catch (error) {
      res.status(400).json({ message: "Invalid message data" });
    }
  });

  // REMOVED OLD ENDPOINT - using new conversation system instead

  app.delete("/api/messages/:id", requirePermission("send_messages"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      // Check if user is authenticated
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Get message to check ownership
      const message = await storage.getMessageById(id);
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }

      // Check if user owns the message or has admin privileges
      const user = req.user as any;
      const isOwner = message.userId === user.id;
      const isSuperAdmin = user.role === "super_admin";
      const isAdmin = user.role === "admin";
      const hasModeratePermission = user.permissions?.includes("moderate_messages");
      
      if (!isOwner && !isSuperAdmin && !isAdmin && !hasModeratePermission) {
        return res
          .status(403)
          .json({ message: "You can only delete your own messages" });
      }

      const deleted = await storage.deleteMessage(id);
      if (!deleted) {
        return res.status(404).json({ message: "Message not found" });
      }
      res.status(204).send();
    } catch (error) {
      logger.error("Failed to delete message", error);
      res.status(500).json({ message: "Failed to delete message" });
    }
  });

  // Notifications & Celebrations
  app.get("/api/notifications/:userId", async (req, res) => {
    try {
      const userId = req.params.userId;
      const notifications = await storage.getUserNotifications(userId);
      res.json(notifications);
    } catch (error) {
      logger.error("Failed to fetch notifications", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.post("/api/notifications", async (req, res) => {
    try {
      const notificationData = req.body;
      const notification = await storage.createNotification(notificationData);
      res.status(201).json(notification);
    } catch (error) {
      logger.error("Failed to create notification", error);
      res.status(500).json({ message: "Failed to create notification" });
    }
  });

  app.patch("/api/notifications/:id/read", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.markNotificationRead(id);
      if (!success) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json({ success: true });
    } catch (error) {
      logger.error("Failed to mark notification as read", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.delete("/api/notifications/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteNotification(id);
      if (!success) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.status(204).send();
    } catch (error) {
      logger.error("Failed to delete notification", error);
      res.status(500).json({ message: "Failed to delete notification" });
    }
  });

  app.post("/api/celebrations", async (req, res) => {
    try {
      const { userId, taskId, message } = req.body;
      const celebration = await storage.createCelebration(
        userId,
        taskId,
        message,
      );
      res.status(201).json(celebration);
    } catch (error) {
      logger.error("Failed to create celebration", error);
      res.status(500).json({ message: "Failed to create celebration" });
    }
  });

  // Weekly Reports
  app.get("/api/weekly-reports", async (req, res) => {
    try {
      const reports = await storage.getAllWeeklyReports();
      res.json(reports);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch weekly reports" });
    }
  });

  app.post("/api/weekly-reports", async (req, res) => {
    try {
      const reportData = insertWeeklyReportSchema.parse(req.body);
      const report = await storage.createWeeklyReport(reportData);
      res.status(201).json(report);
    } catch (error) {
      res.status(400).json({ message: "Invalid report data" });
    }
  });

  // Sandwich Collections Stats - Complete totals including individual + group collections (Optimized)
  app.get("/api/sandwich-collections/stats", async (req, res) => {
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
  app.get("/api/sandwich-collections", async (req, res) => {
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
    async (req, res) => {
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
    async (req, res) => {
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
    async (req, res) => {
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

  app.delete("/api/sandwich-collections/bulk", async (req, res) => {
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
  app.delete("/api/sandwich-collections/batch-delete", async (req, res) => {
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

  // Clean duplicates from sandwich collections (must be before :id route)
  app.delete("/api/sandwich-collections/clean-duplicates", async (req, res) => {
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
      } else if (mode === "og-duplicates") {
        // Find duplicates between OG Sandwich Project and early collections with no location data
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

        // Create a map of OG entries by date and count
        const ogMap = new Map();
        ogCollections.forEach((og) => {
          const key = `${og.collectionDate}-${og.individualSandwiches}`;
          if (!ogMap.has(key)) {
            ogMap.set(key, []);
          }
          ogMap.get(key).push(og);
        });

        // Find matching early collections and mark older/duplicate entries for deletion
        earlyCollections.forEach((early) => {
          const key = `${early.collectionDate}-${early.individualSandwiches}`;
          if (ogMap.has(key)) {
            const ogEntries = ogMap.get(key);
            // If we have matching OG entries, mark the early collection for deletion
            // as OG entries are the authoritative historical record
            collectionsToDelete.push(early);
          }
        });

        // Also check for duplicate OG entries with same date/count and keep only the newest
        ogMap.forEach((ogGroup) => {
          if (ogGroup.length > 1) {
            const sorted = ogGroup.sort(
              (a, b) =>
                new Date(b.submittedAt).getTime() -
                new Date(a.submittedAt).getTime(),
            );
            collectionsToDelete.push(...sorted.slice(1)); // Keep newest, delete duplicates
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
        totalRequested: collectionsToDelete.length,
        errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
      });
    } catch (error) {
      console.error("Failed to clean duplicates", error);
      res.status(500).json({ message: "Failed to clean duplicate entries" });
    }
  });

  app.delete(
    "/api/sandwich-collections/:id",
    requirePermission("edit_data"),
    async (req, res) => {
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

  // Analyze duplicates in sandwich collections
  app.get("/api/sandwich-collections/analyze-duplicates", async (req, res) => {
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
  app.delete("/api/sandwich-collections/clean-duplicates", async (req, res) => {
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

  // Batch edit sandwich collections
  app.patch(
    "/api/sandwich-collections/batch-edit",
    requirePermission("edit_data"),
    async (req, res) => {
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

  // CSV Import for Sandwich Collections
  app.post(
    "/api/import-collections",
    upload.single("csvFile"),
    async (req, res) => {
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

  // Meeting Minutes
  app.get("/api/meeting-minutes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const limit = req.query.limit
        ? parseInt(req.query.limit as string)
        : undefined;
      const minutes = limit
        ? await storage.getRecentMeetingMinutes(limit)
        : await storage.getAllMeetingMinutes();

      // Filter meeting minutes based on user role and committee membership
      if (
        user.role === "admin" ||
        user.role === "admin_coordinator" ||
        user.role === "admin_viewer"
      ) {
        // Admins see all meeting minutes
        res.json(minutes);
      } else if (user.role === "committee_member") {
        // Committee members only see minutes for their committees
        const userCommittees = await storage.getUserCommittees(userId);
        const committeeTypes = userCommittees.map(
          (membership) => membership.membership.committeeId,
        );

        const filteredMinutes = minutes.filter(
          (minute) =>
            !minute.committeeType || // General meeting minutes (no committee assignment)
            committeeTypes.includes(minute.committeeType),
        );
        res.json(filteredMinutes);
      } else {
        // Other roles see general meeting minutes and their role-specific minutes
        const filteredMinutes = minutes.filter(
          (minute) =>
            !minute.committeeType || // General meeting minutes
            minute.committeeType === user.role,
        );
        res.json(filteredMinutes);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch meeting minutes" });
    }
  });

  app.post("/api/meeting-minutes", async (req, res) => {
    try {
      const minutesData = insertMeetingMinutesSchema.parse(req.body);
      const minutes = await storage.createMeetingMinutes(minutesData);
      res.status(201).json(minutes);
    } catch (error) {
      res.status(400).json({ message: "Invalid meeting minutes data" });
    }
  });

  app.delete("/api/meeting-minutes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteMeetingMinutes(id);

      if (success) {
        logger.info("Meeting minutes deleted", {
          minutesId: id,
          method: req.method,
          url: req.url,
          ip: req.ip,
        });
        res.json({
          success: true,
          message: "Meeting minutes deleted successfully",
        });
      } else {
        res.status(404).json({ message: "Meeting minutes not found" });
      }
    } catch (error: any) {
      logger.error("Failed to delete meeting minutes", error);
      res.status(500).json({ message: "Failed to delete meeting minutes" });
    }
  });

  // Meeting minutes file upload endpoint
  app.post(
    "/api/meeting-minutes/upload",
    meetingMinutesUpload.single("file"),
    async (req, res) => {
      try {
        const { meetingId, title, date, summary, googleDocsUrl } = req.body;

        if (!meetingId || !title || !date) {
          return res.status(400).json({
            message: "Missing required fields: meetingId, title, date",
          });
        }

        let finalSummary = summary;
        let documentContent = "";

        // Handle file upload and store file
        if (req.file) {
          logger.info("Meeting minutes file uploaded", {
            filename: req.file.filename,
            originalname: req.file.originalname,
            size: req.file.size,
            meetingId: meetingId,
          });

          try {
            // Create permanent storage path with consistent filename
            const uploadsDir = path.join(
              process.cwd(),
              "uploads",
              "meeting-minutes",
            );
            await fs.mkdir(uploadsDir, { recursive: true });

            // Generate a consistent filename using the multer-generated filename
            const permanentFilename = req.file.filename;
            const permanentPath = path.join(uploadsDir, permanentFilename);
            await fs.copyFile(req.file.path, permanentPath);

            // Determine file type
            let fileType = "unknown";
            if (req.file.mimetype === "application/pdf") {
              fileType = "pdf";
              finalSummary = `PDF document: ${req.file.originalname}`;
            } else if (
              req.file.mimetype ===
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
              req.file.originalname.toLowerCase().endsWith(".docx")
            ) {
              fileType = "docx";
              finalSummary = `DOCX document: ${req.file.originalname}`;
            } else if (
              req.file.mimetype === "application/msword" ||
              req.file.originalname.toLowerCase().endsWith(".doc")
            ) {
              fileType = "doc";
              finalSummary = `DOC document: ${req.file.originalname}`;
            } else {
              finalSummary = `Document: ${req.file.originalname}`;
            }

            // Store file metadata for later retrieval
            req.fileMetadata = {
              fileName: req.file.originalname,
              filePath: permanentPath,
              fileType: fileType,
              mimeType: req.file.mimetype,
            };

            // Clean up temporary file
            await fs.unlink(req.file.path);
          } catch (fileError) {
            logger.error("Failed to store document file", fileError);
            finalSummary = `Document uploaded: ${req.file.originalname} (storage failed)`;
            // Clean up uploaded file even if storage failed
            try {
              await fs.unlink(req.file.path);
            } catch (unlinkError) {
              logger.error("Failed to clean up uploaded file", unlinkError);
            }
          }
        }

        // Handle Google Docs URL
        if (googleDocsUrl) {
          finalSummary = `Google Docs link: ${googleDocsUrl}`;
        }

        if (!finalSummary) {
          return res
            .status(400)
            .json({ message: "Must provide either a file or Google Docs URL" });
        }

        // Create meeting minutes record
        const minutesData = {
          title,
          date,
          summary: finalSummary,
          fileName: req.fileMetadata?.fileName || null,
          filePath: req.fileMetadata?.filePath || null,
          fileType:
            req.fileMetadata?.fileType ||
            (googleDocsUrl ? "google_docs" : "text"),
          mimeType: req.fileMetadata?.mimeType || null,
        };

        const minutes = await storage.createMeetingMinutes(minutesData);

        logger.info("Meeting minutes created successfully", {
          minutesId: minutes.id,
          meetingId: meetingId,
          method: req.method,
          url: req.url,
          ip: req.ip,
        });

        res.status(201).json({
          success: true,
          message: "Meeting minutes uploaded successfully",
          minutes: minutes,
          filename: req.file?.originalname,
          extractedContent: documentContent ? true : false,
        });
      } catch (error: any) {
        logger.error("Failed to upload meeting minutes", error);
        res.status(500).json({
          message: "Failed to upload meeting minutes",
          error: error.message,
        });
      }
    },
  );

  // File serving endpoint for meeting minutes documents by ID
  app.get(
    "/api/meeting-minutes/:id/file",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const minutesId = parseInt(req.params.id);
        if (isNaN(minutesId)) {
          return res
            .status(400)
            .json({ message: "Invalid meeting minutes ID" });
        }

        // Get all meeting minutes and find the specific one
        const allMinutes = await storage.getAllMeetingMinutes();
        const minutes = allMinutes.find((m: any) => m.id === minutesId);
        if (!minutes) {
          return res.status(404).json({ message: "Meeting minutes not found" });
        }

        if (!minutes.filePath) {
          return res
            .status(404)
            .json({ message: "No file associated with these meeting minutes" });
        }

        // Debug logging
        logger.info("Meeting minutes file debug", {
          minutesId,
          storedFilePath: minutes.filePath,
          fileName: minutes.fileName,
        });

        // Handle both absolute and relative paths
        const filePath = path.isAbsolute(minutes.filePath)
          ? minutes.filePath
          : path.join(process.cwd(), minutes.filePath);

        // Check if file exists
        try {
          await fs.access(filePath);
        } catch (error) {
          logger.error("File access failed", {
            filePath,
            storedPath: minutes.filePath,
            error: error.message,
          });
          return res.status(404).json({ message: "File not found on disk" });
        }

        // Get file info
        const stats = await fs.stat(filePath);

        // Detect actual file type by reading first few bytes
        const buffer = Buffer.alloc(50);
        const fd = await fs.open(filePath, "r");
        await fd.read(buffer, 0, 50, 0);
        await fd.close();

        let contentType = "application/octet-stream";
        const fileHeader = buffer.toString("utf8", 0, 20);

        if (fileHeader.startsWith("%PDF")) {
          contentType = "application/pdf";
        } else if (
          fileHeader.includes("[Content_Types].xml") ||
          fileHeader.startsWith("PK")
        ) {
          // This is a Microsoft Office document (DOCX, XLSX, etc.)
          if (minutes.fileName.toLowerCase().endsWith(".docx")) {
            contentType =
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          } else if (minutes.fileName.toLowerCase().endsWith(".xlsx")) {
            contentType =
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          } else {
            contentType =
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document"; // Default to DOCX
          }
        }

        logger.info("File type detected", {
          fileName: minutes.fileName,
          detectedType: contentType,
          fileHeader: fileHeader.substring(0, 20),
        });

        // Set appropriate headers
        res.setHeader("Content-Type", contentType);
        res.setHeader("Content-Length", stats.size);
        res.setHeader(
          "Content-Disposition",
          contentType === "application/pdf"
            ? `inline; filename="${minutes.fileName}"`
            : `attachment; filename="${minutes.fileName}"`,
        );

        // Stream the file
        const fileStream = createReadStream(filePath);
        fileStream.pipe(res);
      } catch (error) {
        logger.error("Failed to serve meeting minutes file", error);
        res.status(500).json({ message: "Failed to serve file" });
      }
    },
  );

  // File serving endpoint for meeting minutes documents by filename (legacy)
  app.get("/api/files/:filename", async (req, res) => {
    try {
      const filename = req.params.filename;
      const filePath = path.join(
        process.cwd(),
        "uploads",
        "meeting-minutes",
        filename,
      );

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).json({ message: "File not found" });
      }

      // Get file info
      const stats = await fs.stat(filePath);
      const fileBuffer = await fs.readFile(filePath);

      // Check file signature to determine actual type (since filename may not have extension)
      let contentType = "application/octet-stream";
      let displayName = filename;

      // Check for PDF signature (%PDF)
      if (
        fileBuffer.length > 4 &&
        fileBuffer.toString("ascii", 0, 4) === "%PDF"
      ) {
        contentType = "application/pdf";
        // Add .pdf extension to display name if not present
        if (!filename.toLowerCase().endsWith(".pdf")) {
          displayName = filename + ".pdf";
        }
      } else {
        // Fallback to extension-based detection
        const ext = path.extname(filename).toLowerCase();
        if (ext === ".pdf") {
          contentType = "application/pdf";
        } else if (ext === ".docx") {
          contentType =
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        } else if (ext === ".doc") {
          contentType = "application/msword";
        }
      }

      // Set headers for inline display
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Length", stats.size);
      res.setHeader("Content-Disposition", `inline; filename="${displayName}"`);
      res.setHeader("Cache-Control", "public, max-age=31536000"); // Cache for 1 year
      res.setHeader("X-Content-Type-Options", "nosniff");

      res.send(fileBuffer);
    } catch (error) {
      logger.error("Failed to serve file", error);
      res.status(500).json({ message: "Failed to serve file" });
    }
  });

  // Drive Links
  app.get("/api/drive-links", async (req, res) => {
    try {
      const links = await storage.getAllDriveLinks();
      res.json(links);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch drive links" });
    }
  });

  // Agenda Items
  app.get("/api/agenda-items", async (req, res) => {
    try {
      const items = await storage.getAllAgendaItems();
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch agenda items" });
    }
  });

  app.post("/api/agenda-items", async (req, res) => {
    try {
      const itemData = insertAgendaItemSchema.parse(req.body);
      const item = await storage.createAgendaItem(itemData);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json({ message: "Invalid agenda item data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create agenda item" });
      }
    }
  });

  app.patch("/api/agenda-items/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Committee members cannot modify agenda item statuses
      if (user.role === "committee_member") {
        return res.status(403).json({
          message: "Committee members cannot modify agenda item statuses",
        });
      }

      const id = parseInt(req.params.id);
      const { status } = req.body;

      if (!["pending", "approved", "rejected", "postponed"].includes(status)) {
        res.status(400).json({ message: "Invalid status" });
        return;
      }

      const updatedItem = await storage.updateAgendaItemStatus(id, status);
      if (!updatedItem) {
        res.status(404).json({ message: "Agenda item not found" });
        return;
      }

      res.json(updatedItem);
    } catch (error) {
      res.status(500).json({ message: "Failed to update agenda item" });
    }
  });

  app.put("/api/agenda-items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { title, description } = req.body;

      const updatedItem = await storage.updateAgendaItem(id, {
        title,
        description,
      });
      if (!updatedItem) {
        res.status(404).json({ message: "Agenda item not found" });
        return;
      }

      res.json(updatedItem);
    } catch (error) {
      res.status(500).json({ message: "Failed to update agenda item" });
    }
  });

  app.delete(
    "/api/agenda-items/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user?.claims?.sub || req.user?.id;
        if (!userId) {
          return res.status(401).json({ message: "User ID not found" });
        }
        const user = await storage.getUser(userId);

        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        // Committee members cannot delete agenda items
        if (user.role === "committee_member") {
          return res
            .status(403)
            .json({ message: "Committee members cannot delete agenda items" });
        }

        const id = parseInt(req.params.id);
        const success = await storage.deleteAgendaItem(id);

        if (!success) {
          res.status(404).json({ message: "Agenda item not found" });
          return;
        }

        res.json({ message: "Agenda item deleted successfully" });
      } catch (error) {
        res.status(500).json({ message: "Failed to delete agenda item" });
      }
    },
  );

  // Meetings
  app.get("/api/current-meeting", async (req, res) => {
    try {
      const meeting = await storage.getCurrentMeeting();
      res.json(meeting);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch current meeting" });
    }
  });

  app.post("/api/meetings", async (req, res) => {
    try {
      const meetingData = insertMeetingSchema.parse(req.body);
      const meeting = await storage.createMeeting(meetingData);
      res.status(201).json(meeting);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json({ message: "Invalid meeting data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create meeting" });
      }
    }
  });

  app.patch("/api/meetings/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid meeting ID" });
      }

      const updates = req.body;
      const updatedMeeting = await storage.updateMeeting(id, updates);

      if (!updatedMeeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }

      res.json(updatedMeeting);
    } catch (error) {
      logger.error("Failed to update meeting", error);
      res.status(500).json({ message: "Failed to update meeting" });
    }
  });

  app.delete("/api/meetings/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid meeting ID" });
      }

      const deleted = await storage.deleteMeeting(id);

      if (!deleted) {
        return res.status(404).json({ message: "Meeting not found" });
      }

      res.status(204).send();
    } catch (error) {
      logger.error("Failed to delete meeting", error);
      res.status(500).json({ message: "Failed to delete meeting" });
    }
  });

  app.post("/api/meetings/:id/upload-agenda", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid meeting ID" });
      }

      // Mark the agenda as uploaded in the meeting record
      const agendaInfo = "agenda_uploaded_" + new Date().toISOString();
      const meeting = await storage.updateMeetingAgenda(id, agendaInfo);

      if (!meeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }

      res.json({
        message: "Agenda uploaded successfully",
        meeting,
      });
    } catch (error) {
      logger.error("Failed to upload agenda", error);
      res.status(500).json({ message: "Failed to upload agenda" });
    }
  });

  // Drivers API endpoints
  app.get("/api/drivers", async (req, res) => {
    try {
      const drivers = await storage.getAllDrivers();
      res.json(drivers);
    } catch (error) {
      logger.error("Failed to get drivers", error);
      res.status(500).json({ message: "Failed to get drivers" });
    }
  });

  app.get("/api/drivers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const driver = await storage.getDriver(id);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      res.json(driver);
    } catch (error) {
      logger.error("Failed to get driver", error);
      res.status(500).json({ message: "Failed to get driver" });
    }
  });

  app.post("/api/drivers", sanitizeMiddleware, async (req, res) => {
    try {
      const result = insertDriverSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid driver data" });
      }
      const driver = await storage.createDriver(result.data);
      res.status(201).json(driver);
    } catch (error) {
      logger.error("Failed to create driver", error);
      res.status(500).json({ message: "Failed to create driver" });
    }
  });

  app.put("/api/drivers/:id", sanitizeMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const driver = await storage.updateDriver(id, updates);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      res.json(driver);
    } catch (error) {
      logger.error("Failed to update driver", error);
      res.status(500).json({ message: "Failed to update driver" });
    }
  });

  app.delete("/api/drivers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteDriver(id);
      if (!success) {
        return res.status(404).json({ message: "Driver not found" });
      }
      res.status(204).send();
    } catch (error) {
      logger.error("Failed to delete driver", error);
      res.status(500).json({ message: "Failed to delete driver" });
    }
  });

  // PATCH endpoint for partial driver updates (used by frontend)
  app.patch("/api/drivers/:id", sanitizeMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      
      // Log the update data for debugging
      console.log(`Updating driver ${id} with data:`, JSON.stringify(updates, null, 2));
      
      // Validate that we have some updates to apply
      if (!updates || Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No updates provided" });
      }
      
      const driver = await storage.updateDriver(id, updates);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      
      console.log(`Driver ${id} updated successfully:`, JSON.stringify(driver, null, 2));
      res.json(driver);
    } catch (error) {
      logger.error("Failed to update driver", error);
      res.status(500).json({ message: "Failed to update driver" });
    }
  });

  // DELETE endpoint for drivers
  app.delete("/api/drivers/:id", sanitizeMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log(`Deleting driver ${id}`);
      
      const success = await storage.deleteDriver(id);
      if (!success) {
        return res.status(404).json({ message: "Driver not found" });
      }
      
      console.log(`Driver ${id} deleted successfully`);
      res.json({ message: "Driver deleted successfully" });
    } catch (error) {
      logger.error("Failed to delete driver", error);
      res.status(500).json({ message: "Failed to delete driver" });
    }
  });

  // Driver Agreements (admin access only)
  app.post("/api/driver-agreements", async (req, res) => {
    try {
      const result = insertDriverAgreementSchema.safeParse(req.body);
      if (!result.success) {
        return res
          .status(400)
          .json({ message: "Invalid driver agreement data" });
      }

      const agreement = await storage.createDriverAgreement(result.data);

      // Send notification email if available
      try {
        await sendDriverAgreementNotification(agreement);
      } catch (emailError) {
        logger.error(
          "Failed to send driver agreement notification",
          emailError,
        );
      }

      res.status(201).json(agreement);
    } catch (error) {
      logger.error("Failed to create driver agreement", error);
      res.status(500).json({ message: "Failed to create driver agreement" });
    }
  });

  // Get agenda items
  app.get("/api/agenda-items", async (req, res) => {
    try {
      const items = await storage.getAllAgendaItems();
      res.json(items);
    } catch (error) {
      logger.error("Failed to get agenda items", error);
      res.status(500).json({ message: "Failed to get agenda items" });
    }
  });

  // Get all meetings
  app.get("/api/meetings", async (req, res) => {
    try {
      const meetings = await storage.getAllMeetings();
      res.json(meetings);
    } catch (error) {
      logger.error("Failed to get meetings", error);
      res.status(500).json({ message: "Failed to get meetings" });
    }
  });

  // Get meetings by type
  app.get("/api/meetings/type/:type", async (req, res) => {
    try {
      const { type } = req.params;
      const meetings = await storage.getMeetingsByType(type);
      res.json(meetings);
    } catch (error) {
      logger.error("Failed to get meetings by type", error);
      res.status(500).json({ message: "Failed to get meetings by type" });
    }
  });

  app.post("/api/meetings/:id/upload-agenda", async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      // Update the meeting with the uploaded agenda
      const updatedMeeting = await storage.updateMeetingAgenda(
        id,
        "Final agenda uploaded - agenda.docx",
      );

      if (!updatedMeeting) {
        res.status(404).json({ message: "Meeting not found" });
        return;
      }

      logger.info("Agenda file uploaded for meeting", {
        method: req.method,
        url: req.url,
        ip: req.ip,
      });

      res.json({
        success: true,
        message: "Agenda file uploaded successfully",
        filename: "agenda.docx",
        meeting: updatedMeeting,
      });
    } catch (error) {
      logger.error("Failed to upload agenda file", error);
      res.status(500).json({ message: "Failed to upload agenda file" });
    }
  });

  // Driver agreement submission route (secure, private)
  app.post("/api/driver-agreements", async (req, res) => {
    try {
      const validatedData = insertDriverAgreementSchema.parse(req.body);

      // Store in database
      const agreement = await storage.createDriverAgreement(validatedData);

      // Send email notification
      const { sendDriverAgreementNotification } = await import("./sendgrid");
      const emailSent = await sendDriverAgreementNotification(agreement);

      if (!emailSent) {
        console.warn(
          "Failed to send email notification for driver agreement:",
          agreement.id,
        );
      }

      // Return success without sensitive data
      res.json({
        success: true,
        message:
          "Driver agreement submitted successfully. You will be contacted soon.",
        id: agreement.id,
      });
    } catch (error: any) {
      console.error("Error submitting driver agreement:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Hosts API endpoints
  app.get("/api/hosts", async (req, res) => {
    try {
      const hosts = await storage.getAllHosts();
      res.json(hosts);
    } catch (error) {
      logger.error("Failed to get hosts", error);
      res.status(500).json({ message: "Failed to get hosts" });
    }
  });

  app.get("/api/hosts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const host = await storage.getHost(id);
      if (!host) {
        return res.status(404).json({ message: "Host not found" });
      }
      res.json(host);
    } catch (error) {
      logger.error("Failed to get host", error);
      res.status(500).json({ message: "Failed to get host" });
    }
  });

  app.post("/api/hosts", requirePermission("edit_data"), async (req, res) => {
    try {
      const hostData = insertHostSchema.parse(req.body);
      const host = await storage.createHost(hostData);
      res.status(201).json(host);
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn("Invalid host input", { errors: error.errors, ip: req.ip });
        res
          .status(400)
          .json({ message: "Invalid host data", errors: error.errors });
      } else {
        logger.error("Failed to create host", error);
        res.status(500).json({ message: "Failed to create host" });
      }
    }
  });

  app.put("/api/hosts/:id", requirePermission("edit_data"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;

      // Get current host info
      const currentHost = await storage.getHost(id);
      if (!currentHost) {
        return res.status(404).json({ message: "Host not found" });
      }

      console.log("Host update request:", {
        currentHostName: currentHost.name,
        newName: updates.name,
      });

      // Check if this is a location reassignment (when the host name matches an existing host)
      const allHosts = await storage.getAllHosts();
      const targetHost = allHosts.find(
        (h) =>
          h.id !== id &&
          h.name.toLowerCase().trim() === updates.name.toLowerCase().trim(),
      );

      if (targetHost) {
        console.log(
          "Reassignment detected: moving contacts from",
          currentHost.name,
          "to",
          targetHost.name,
        );

        // This is a location reassignment - merge contacts to the target host
        const contactsToMove = await storage.getHostContacts(id);
        console.log("Moving", contactsToMove.length, "contacts");

        // Update all contacts to point to the target host
        for (const contact of contactsToMove) {
          console.log(
            "Moving contact:",
            contact.name,
            "from host",
            id,
            "to host",
            targetHost.id,
          );
          await storage.updateHostContact(contact.id, {
            hostId: targetHost.id,
          });
        }

        // Update any sandwich collections that reference the old host name
        const collectionsUpdated = await storage.updateCollectionHostNames(
          currentHost.name,
          targetHost.name,
        );
        console.log(
          "Updated",
          collectionsUpdated,
          "sandwich collection records",
        );

        // Delete the original host since its contacts have been moved
        await storage.deleteHost(id);
        console.log("Deleted original host:", currentHost.name);

        // Return the target host with success message
        res.json({
          ...targetHost,
          message: `Host reassigned successfully. ${contactsToMove.length} contacts moved from "${currentHost.name}" to "${targetHost.name}".`,
        });
      } else {
        // Normal host update
        console.log("Normal host update for:", currentHost.name);
        const host = await storage.updateHost(id, updates);
        if (!host) {
          return res.status(404).json({ message: "Host not found" });
        }
        res.json(host);
      }
    } catch (error) {
      logger.error("Failed to update host", error);
      res.status(500).json({ message: "Failed to update host" });
    }
  });

  app.patch("/api/hosts/:id", async (req, res) => {
    console.log(`🔥 PATCH route hit for host ${req.params.id}`);
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;

      console.log(
        "PATCH host update - ID:",
        id,
        "Updates:",
        JSON.stringify(updates, null, 2),
      );

      // Clean up any problematic timestamp fields that might be strings
      const cleanUpdates = { ...updates };
      if (cleanUpdates.createdAt) delete cleanUpdates.createdAt;
      if (cleanUpdates.updatedAt) delete cleanUpdates.updatedAt;

      console.log("Cleaned updates:", JSON.stringify(cleanUpdates, null, 2));

      const host = await storage.updateHost(id, cleanUpdates);
      if (!host) {
        console.log("Host not found in storage for ID:", id);
        return res.status(404).json({ error: "Host not found" });
      }
      console.log("Host updated successfully:", host);
      res.json(host);
    } catch (error) {
      logger.error("Failed to update host", error);
      console.error("Host update error details:", error);
      res.status(500).json({ error: "Failed to update host" });
    }
  });

  app.delete("/api/hosts/:id", async (req, res) => {
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
  app.get("/api/host-contacts", async (req, res) => {
    try {
      // Get all host contacts across all hosts
      const hosts = await storage.getAllHosts();
      const allContacts = [];

      for (const host of hosts) {
        const contacts = await storage.getHostContacts(host.id);
        allContacts.push(...contacts);
      }

      res.json(allContacts);
    } catch (error) {
      logger.error("Failed to get all host contacts", error);
      res.status(500).json({ message: "Failed to get host contacts" });
    }
  });

  app.post("/api/host-contacts", async (req, res) => {
    try {
      const contactData = insertHostContactSchema.parse(req.body);
      const contact = await storage.createHostContact(contactData);
      res.status(201).json(contact);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json({ message: "Invalid host contact data", errors: error.errors });
      } else {
        logger.error("Failed to create host contact", error);
        res.status(500).json({ message: "Failed to create host contact" });
      }
    }
  });

  app.get("/api/hosts/:hostId/contacts", async (req, res) => {
    try {
      const hostId = parseInt(req.params.hostId);
      const contacts = await storage.getHostContacts(hostId);
      res.json(contacts);
    } catch (error) {
      logger.error("Failed to get host contacts", error);
      res.status(500).json({ message: "Failed to get host contacts" });
    }
  });

  app.put("/api/host-contacts/:id", async (req, res) => {
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

  app.patch("/api/host-contacts/:id", async (req, res) => {
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

  app.delete("/api/host-contacts/:id", async (req, res) => {
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
  app.get("/api/hosts-with-contacts", async (req, res) => {
    try {
      const hostsWithContacts = await storage.getAllHostsWithContacts();
      res.json(hostsWithContacts);
    } catch (error) {
      logger.error("Failed to fetch hosts with contacts", error);
      res.status(500).json({ message: "Failed to fetch hosts with contacts" });
    }
  });

  // Get collections by host name
  app.get("/api/collections-by-host/:hostName", async (req, res) => {
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

  // Recipients
  app.get("/api/recipients", async (req, res) => {
    try {
      const recipients = await storage.getAllRecipients();
      res.json(recipients);
    } catch (error) {
      logger.error("Failed to fetch recipients", error);
      res.status(500).json({ message: "Failed to fetch recipients" });
    }
  });

  app.post("/api/recipients", async (req, res) => {
    try {
      const recipientData = insertRecipientSchema.parse(req.body);
      const recipient = await storage.createRecipient(recipientData);
      res.status(201).json(recipient);
    } catch (error) {
      logger.error("Failed to create recipient", error);
      res.status(400).json({ message: "Invalid recipient data" });
    }
  });

  app.put("/api/recipients/:id", async (req, res) => {
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

  app.patch("/api/recipients/:id", async (req, res) => {
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

  app.delete("/api/recipients/:id", async (req, res) => {
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
  app.get("/api/contacts", async (req, res) => {
    try {
      const contacts = await storage.getAllContacts();
      res.json(contacts);
    } catch (error) {
      logger.error("Failed to fetch contacts", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  app.post("/api/contacts", async (req, res) => {
    try {
      const contactData = insertContactSchema.parse(req.body);
      const contact = await storage.createContact(contactData);
      res.status(201).json(contact);
    } catch (error) {
      logger.error("Failed to create contact", error);
      res.status(400).json({ message: "Invalid contact data" });
    }
  });

  app.put("/api/contacts/:id", async (req, res) => {
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

  app.patch("/api/contacts/:id", async (req, res) => {
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

  app.delete("/api/contacts/:id", async (req, res) => {
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
    async (req, res) => {
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
            const isDuplicate = existingRecipients.some((r) => {
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
    async (req, res) => {
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
              (h) =>
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
              (c) => c.phone.replace(/\D/g, "") === cleanPhone,
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

  // Collection statistics for bulk data manager
  app.get("/api/collection-stats", async (req, res) => {
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
  app.get("/api/host-mapping-stats", async (req, res) => {
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

  // Register project routes
  const { projectsRoutes } = await import("./routes/projects");
  app.use("/api", projectsRoutes);

  // Static file serving for documents
  app.use("/documents", express.static("public/documents"));

  // Add data management routes
  app.use("/api/data", dataManagementRoutes);

  // Global search endpoint
  app.get("/api/search", async (req, res) => {
    try {
      const { q: query, type, limit = "50" } = req.query;

      if (!query || typeof query !== "string") {
        return res.status(400).json({ error: "Query parameter is required" });
      }

      const searchLimit = Math.min(parseInt(limit as string) || 50, 200);

      if (type && typeof type === "string") {
        // Type-specific search
        let results: any[] = [];
        switch (type) {
          case "collections":
            results = await SearchEngine.searchCollections(
              query,
              {},
              searchLimit,
            );
            break;
          case "hosts":
            results = await SearchEngine.searchHosts(query, {}, searchLimit);
            break;
          case "projects":
            results = await SearchEngine.searchProjects(query, {}, searchLimit);
            break;
          case "contacts":
            results = await SearchEngine.searchContacts(query, searchLimit);
            break;
          default:
            return res.status(400).json({ error: "Invalid search type" });
        }
        res.json({ results, type });
      } else {
        // Global search
        const result = await SearchEngine.globalSearch(query, {}, searchLimit);
        res.json(result);
      }
    } catch (error) {
      logger.error("Search failed:", error);
      res.status(500).json({ error: "Search failed" });
    }
  });

  // Search suggestions endpoint
  app.get("/api/search/suggestions", async (req, res) => {
    try {
      const { q: query, type } = req.query;

      if (!query || typeof query !== "string") {
        return res.status(400).json({ suggestions: [] });
      }

      const suggestions = await SearchEngine.getSearchSuggestions(
        query,
        type as "collection" | "host" | "project" | "contact" | undefined,
      );

      res.json({ suggestions });
    } catch (error) {
      logger.error("Search suggestions failed:", error);
      res.status(500).json({ suggestions: [] });
    }
  });

  // Reporting and Analytics Routes

  // Generate report
  app.post("/api/reports/generate", async (req, res) => {
    try {
      const reportData = await ReportGenerator.generateReport(req.body);

      // Store report for download (in production, this would use cloud storage)
      const reportId = Date.now().toString();
      reportData.id = reportId;

      // Cache the report for 24 hours using the reports cache
      const reportsCache = CacheManager.getCache("reports", {
        maxSize: 100,
        ttl: 24 * 60 * 60 * 1000,
      });
      reportsCache.set(`report:${reportId}`, reportData);

      res.json(reportData);
    } catch (error) {
      console.error("Report generation failed:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  // Download report
  app.get("/api/reports/download/:id", async (req, res) => {
    try {
      const reportId = req.params.id;
      const reportsCache = CacheManager.getCache("reports", {
        maxSize: 100,
        ttl: 24 * 60 * 60 * 1000,
      });
      const reportData = reportsCache.get(`report:${reportId}`);

      if (!reportData) {
        return res.status(404).json({ error: "Report not found or expired" });
      }

      const format = reportData.metadata.format || "json";

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="report-${reportId}.${format}"`,
      );

      if (format === "csv") {
        res.setHeader("Content-Type", "text/csv");
        // Convert to CSV format
        if (Array.isArray(reportData.data)) {
          const csvHeader = Object.keys(reportData.data[0] || {}).join(",");
          const csvRows = reportData.data.map((row) =>
            Object.values(row)
              .map((val) => `"${val}"`)
              .join(","),
          );
          res.send([csvHeader, ...csvRows].join("\n"));
        } else {
          res.send("No data available");
        }
      } else if (format === "pdf") {
        try {
          // Import PDFDocument from pdfkit using dynamic import  
          const PDFKit = await import('pdfkit');
          const PDFDocument = PDFKit.default;
          
          // Verify PDFDocument is a constructor
          if (typeof PDFDocument !== 'function') {
            throw new Error('PDFDocument is not a constructor');
          }
          
          const doc = new PDFDocument();
          
          // Set response headers for PDF
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="report-${reportId}.pdf"`,
          );

          // Pipe the PDF to the response
          doc.pipe(res);

          // Add content to PDF
          let yPosition = 50;

          // Title
          doc.fontSize(20).font('Helvetica-Bold');
          doc.text(reportData.metadata.title, 50, yPosition);
          yPosition += 40;

          // Metadata
          doc.fontSize(10).font('Helvetica');
          doc.text(`Generated: ${new Date(reportData.metadata.generatedAt).toLocaleString()}`, 50, yPosition);
          yPosition += 15;
          doc.text(`Date Range: ${reportData.metadata.dateRange}`, 50, yPosition);
          yPosition += 15;
          doc.text(`Total Records: ${reportData.metadata.totalRecords}`, 50, yPosition);
          yPosition += 30;

          // Executive Summary
          doc.fontSize(16).font('Helvetica-Bold');
          doc.text('Executive Summary', 50, yPosition);
          yPosition += 25;

          doc.fontSize(12).font('Helvetica');
          doc.text(`Total Sandwiches: ${reportData.summary.totalSandwiches?.toLocaleString() || 0}`, 50, yPosition);
          yPosition += 18;
          doc.text(`Total Collection Entries: ${reportData.metadata.totalRecords}`, 50, yPosition);
          yPosition += 18;
          // Calculate unique hosts from the data
          const uniqueHosts = Array.isArray(reportData.data) 
            ? new Set(reportData.data.map(item => item.hostName).filter(Boolean)).size 
            : reportData.summary.totalHosts || 0;
          doc.text(`Unique Host Locations: ${uniqueHosts}`, 50, yPosition);
          yPosition += 18;
          doc.text(`Date Range Covered: ${reportData.metadata.dateRange}`, 50, yPosition);
          yPosition += 18;
          
          // Calculate averages if we have data
          if (Array.isArray(reportData.data) && reportData.data.length > 0) {
            const totalSandwiches = reportData.data.reduce((sum, record) => {
              const individual = record.individualSandwiches || 0;
              const group = record.groupSandwiches || record.groupCollections || 0;
              return sum + individual + group;
            }, 0);
            const avgPerCollection = Math.round(totalSandwiches / reportData.data.length);
            doc.text(`Average Sandwiches per Collection: ${avgPerCollection}`, 50, yPosition);
            yPosition += 18;
          }
          
          yPosition += 15;

          // Top Performers
          if (reportData.summary.topPerformers?.length > 0) {
            doc.fontSize(16).font('Helvetica-Bold');
            doc.text('Top Performers', 50, yPosition);
            yPosition += 25;

            doc.fontSize(10).font('Helvetica');
            reportData.summary.topPerformers.slice(0, 10).forEach((performer) => {
              doc.text(`${performer.name}: ${performer.value?.toLocaleString() || '0'} sandwiches`, 50, yPosition);
              yPosition += 15;
            });
            yPosition += 20;
          }

          // Data summary (first 20 records for space)
          if (Array.isArray(reportData.data) && reportData.data.length > 0) {
            // Check if we need a new page
            if (yPosition > 650) {
              doc.addPage();
              yPosition = 50;
            }

            doc.fontSize(16).font('Helvetica-Bold');
            doc.text('Sample Data Records', 50, yPosition);
            yPosition += 25;

            doc.fontSize(9).font('Helvetica');
            const sampleData = reportData.data.slice(0, 20);
            
            sampleData.forEach((record, index) => {
              if (yPosition > 720) {
                doc.addPage();
                yPosition = 50;
              }
              
              // Handle date conversion properly
              let date = 'Invalid Date';
              try {
                if (record.collectionDate || record.date) {
                  const dateStr = record.collectionDate || record.date;
                  const parsedDate = new Date(dateStr);
                  if (!isNaN(parsedDate.getTime())) {
                    date = parsedDate.toLocaleDateString();
                  }
                }
              } catch (e) {
                console.warn('Date parsing error for record:', record);
              }
              
              const individual = record.individualSandwiches || 0;
              const group = record.groupSandwiches || record.groupCollections || 0;
              const total = individual + group;
              
              let recordText = `${index + 1}. ${date} | ${record.hostName || 'Group Collection'} | `;
              recordText += `Individual: ${individual}, Group: ${group}, Total: ${total}`;
              if (record.notes) recordText += ` | Notes: ${record.notes.substring(0, 50)}${record.notes.length > 50 ? '...' : ''}`;
              
              doc.text(recordText, 50, yPosition);
              yPosition += 12;
            });

            if (reportData.data.length > 20) {
              yPosition += 10;
              doc.fontSize(10).font('Helvetica-Oblique');
              doc.text(`Note: Showing first 20 of ${reportData.data.length} total records. Download CSV format for complete data.`, 50, yPosition);
            }
            
            yPosition += 30;
          }
          
          // Add a comprehensive data table if we have space
          if (Array.isArray(reportData.data) && reportData.data.length > 0 && yPosition < 600) {
            if (yPosition > 650) {
              doc.addPage();
              yPosition = 50;
            }
            
            doc.fontSize(14).font('Helvetica-Bold');
            doc.text('Collection Summary Table', 50, yPosition);
            yPosition += 25;
            
            // Table headers
            doc.fontSize(9).font('Helvetica-Bold');
            doc.text('Date', 50, yPosition);
            doc.text('Host/Group', 120, yPosition);
            doc.text('Individual', 280, yPosition);
            doc.text('Group', 340, yPosition);
            doc.text('Total', 400, yPosition);
            doc.text('Notes', 450, yPosition);
            yPosition += 15;
            
            // Line under headers
            doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
            yPosition += 10;
            
            // Table data (first 15 records for space)
            doc.fontSize(8).font('Helvetica');
            const tableData = reportData.data.slice(0, 15);
            
            tableData.forEach((record, index) => {
              if (yPosition > 720) {
                doc.addPage();
                yPosition = 50;
                
                // Reprint headers on new page
                doc.fontSize(9).font('Helvetica-Bold');
                doc.text('Date', 50, yPosition);
                doc.text('Host/Group', 120, yPosition);
                doc.text('Individual', 280, yPosition);
                doc.text('Group', 340, yPosition);
                doc.text('Total', 400, yPosition);
                doc.text('Notes', 450, yPosition);
                yPosition += 15;
                doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
                yPosition += 10;
                doc.fontSize(8).font('Helvetica');
              }
              
              // Handle date conversion properly
              let date = 'Invalid Date';
              try {
                if (record.collectionDate || record.date) {
                  const dateStr = record.collectionDate || record.date;
                  const parsedDate = new Date(dateStr);
                  if (!isNaN(parsedDate.getTime())) {
                    date = parsedDate.toLocaleDateString();
                  }
                }
              } catch (e) {
                console.warn('Date parsing error for record:', record);
              }
              
              const individual = record.individualSandwiches || 0;
              const group = record.groupSandwiches || record.groupCollections || 0;
              const total = individual + group;
              const hostName = (record.hostName || 'Group Collection').substring(0, 20);
              const notes = (record.notes || '').substring(0, 15);
              
              doc.text(date, 50, yPosition);
              doc.text(hostName, 120, yPosition);
              doc.text(individual.toString(), 290, yPosition);
              doc.text(group.toString(), 350, yPosition);
              doc.text(total.toString(), 410, yPosition);
              doc.text(notes, 450, yPosition);
              yPosition += 12;
            });
          }

          // Footer
          const pages = doc.bufferedPageRange();
          for (let i = 0; i < pages.count; i++) {
            doc.switchToPage(i);
            doc.fontSize(8).font('Helvetica');
            doc.text(`Page ${i + 1} of ${pages.count}`, 50, doc.page.height - 30);
            doc.text('The Sandwich Project - Report', doc.page.width - 200, doc.page.height - 30);
          }

          // Finalize the PDF
          doc.end();

        } catch (error) {
          console.error('PDF generation error:', error);
          // Fallback to enhanced CSV if PDF fails
          res.setHeader("Content-Type", "text/csv");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="report-${reportId}.csv"`,
          );

          let csvContent = `# THE SANDWICH PROJECT - ${reportData.metadata.title}\n`;
          csvContent += `# Generated: ${new Date(reportData.metadata.generatedAt).toLocaleString()}\n`;
          csvContent += `# Date Range: ${reportData.metadata.dateRange}\n`;
          csvContent += `# Total Records: ${reportData.metadata.totalRecords}\n\n`;

          if (Array.isArray(reportData.data) && reportData.data.length > 0) {
            const headers = Object.keys(reportData.data[0]);
            csvContent += headers.join(',') + '\n';
            reportData.data.forEach(row => {
              const values = headers.map(h => `"${row[h] || ''}"`);
              csvContent += values.join(',') + '\n';
            });
          }

          res.send(csvContent);
        }
      } else {
        res.setHeader("Content-Type", "application/json");
        res.json(reportData);
      }
    } catch (error) {
      console.error("Report download failed:", error);
      res.status(500).json({ error: "Failed to download report" });
    }
  });

  // Schedule report
  app.post("/api/reports/schedule", async (req, res) => {
    try {
      const { config, schedule } = req.body;
      const scheduledReport = await ReportGenerator.scheduleReport(
        config,
        schedule,
      );

      res.json(scheduledReport);
    } catch (error) {
      console.error("Report scheduling failed:", error);
      res.status(500).json({ error: "Failed to schedule report" });
    }
  });

  // Get scheduled reports
  app.get("/api/reports/scheduled", async (req, res) => {
    try {
      // In production, this would fetch from database
      const reportsCache = CacheManager.getCache("reports", {
        maxSize: 100,
        ttl: 24 * 60 * 60 * 1000,
      });
      const scheduledReports = reportsCache.get("scheduled_reports") || [];
      res.json(scheduledReports);
    } catch (error) {
      console.error("Failed to fetch scheduled reports:", error);
      res.status(500).json({ error: "Failed to fetch scheduled reports" });
    }
  });

  // Get recent reports
  app.get("/api/reports/recent", async (req, res) => {
    try {
      // In production, this would fetch from database
      const recentReports = [];
      res.json(recentReports);
    } catch (error) {
      console.error("Failed to fetch recent reports:", error);
      res.status(500).json({ error: "Failed to fetch recent reports" });
    }
  });

  // Email notification routes

  // Send test email
  app.post("/api/notifications/test", async (req, res) => {
    try {
      const { to, template, variables } = req.body;

      const success = await EmailService.sendEmail({
        to,
        template,
        variables,
      });

      res.json({
        success,
        message: success ? "Email sent successfully" : "Email sending failed",
      });
    } catch (error) {
      console.error("Test email failed:", error);
      res.status(500).json({ error: "Failed to send test email" });
    }
  });

  // Get available email templates
  app.get("/api/notifications/templates", async (req, res) => {
    try {
      const templates = EmailService.getAvailableTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Failed to fetch email templates:", error);
      res.status(500).json({ error: "Failed to fetch email templates" });
    }
  });

  // Send milestone notification
  app.post("/api/notifications/milestone", async (req, res) => {
    try {
      const { milestone, recipients } = req.body;

      const success = await EmailService.sendMilestoneNotification(
        milestone,
        recipients,
      );

      res.json({
        success,
        message: success
          ? "Milestone notification sent"
          : "Failed to send notification",
      });
    } catch (error) {
      console.error("Milestone notification failed:", error);
      res.status(500).json({ error: "Failed to send milestone notification" });
    }
  });

  // Send project deadline reminder
  app.post("/api/notifications/deadline-reminder", async (req, res) => {
    try {
      const { project, recipients } = req.body;

      const success = await EmailService.sendProjectDeadlineReminder(
        project,
        recipients,
      );

      res.json({
        success,
        message: success ? "Deadline reminder sent" : "Failed to send reminder",
      });
    } catch (error) {
      console.error("Deadline reminder failed:", error);
      res.status(500).json({ error: "Failed to send deadline reminder" });
    }
  });

  // Send weekly summary
  app.post("/api/notifications/weekly-summary", async (req, res) => {
    try {
      const { summaryData, recipients } = req.body;

      const success = await EmailService.sendWeeklySummary(
        summaryData,
        recipients,
      );

      res.json({
        success,
        message: success ? "Weekly summary sent" : "Failed to send summary",
      });
    } catch (error) {
      console.error("Weekly summary failed:", error);
      res.status(500).json({ error: "Failed to send weekly summary" });
    }
  });

  // Version Control API Routes
  app.get(
    "/api/version-control/:entityType/:entityId/history",
    async (req, res) => {
      try {
        const { entityType, entityId } = req.params;
        const history = await VersionControl.getVersionHistory(
          entityType as any,
          parseInt(entityId),
        );
        res.json(history);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },
  );

  app.get(
    "/api/version-control/:entityType/:entityId/version/:version",
    async (req, res) => {
      try {
        const { entityType, entityId, version } = req.params;
        const versionData = await VersionControl.getVersion(
          entityType as any,
          parseInt(entityId),
          parseInt(version),
        );
        if (!versionData) {
          return res.status(404).json({ error: "Version not found" });
        }
        res.json(versionData);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },
  );

  app.post(
    "/api/version-control/:entityType/:entityId/restore/:version",
    async (req, res) => {
      try {
        const { entityType, entityId, version } = req.params;
        const userId = req.user?.claims?.sub;

        const success = await VersionControl.restoreVersion(
          entityType as any,
          parseInt(entityId),
          parseInt(version),
          userId,
        );

        if (success) {
          res.json({ success: true, message: "Version restored successfully" });
        } else {
          res.status(400).json({ error: "Failed to restore version" });
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },
  );

  app.get(
    "/api/version-control/:entityType/:entityId/compare/:version1/:version2",
    async (req, res) => {
      try {
        const { entityType, entityId, version1, version2 } = req.params;
        const comparison = await VersionControl.compareVersions(
          entityType as any,
          parseInt(entityId),
          parseInt(version1),
          parseInt(version2),
        );
        res.json(comparison);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },
  );

  app.post("/api/version-control/changeset", async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const result = await VersionControl.createChangeset({
        ...req.body,
        userId,
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/version-control/stats", async (req, res) => {
    try {
      const { entityType, userId, startDate, endDate } = req.query;
      const stats = await VersionControl.getChangeStats(
        entityType as any,
        userId as string,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined,
      );
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/version-control/export", async (req, res) => {
    try {
      const { entityType, entityId } = req.query;
      const history = await VersionControl.exportVersionHistory(
        entityType as any,
        entityId ? parseInt(entityId as string) : undefined,
      );
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Integration API Routes for external systems
  app.get("/api/integration/summary", async (req, res) => {
    try {
      const stats = await storage.getCollectionStats();
      const hosts = await storage.getAllHosts();
      const projects = await storage.getAllProjects();

      const summary = {
        totalSandwiches: stats.totalSandwiches,
        totalHosts: hosts.length,
        activeHosts: hosts.filter((h) => h.status === "active").length,
        totalProjects: projects.length,
        activeProjects: projects.filter((p) => p.status === "in_progress")
          .length,
        lastUpdated: new Date().toISOString(),
      };

      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/integration/collections/recent", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const collections = await storage.getAllSandwichCollections(limit);

      const recentCollections = collections
        .slice(0, limit)
        .map((collection) => ({
          id: collection.id,
          hostName: collection.hostName,
          individualSandwiches: collection.individualSandwiches,
          groupCollections: collection.groupCollections,
          collectionDate: collection.collectionDate,
          submittedAt: collection.submittedAt,
        }));

      res.json(recentCollections);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/integration/webhook", async (req, res) => {
    try {
      const { event, data } = req.body;

      // Log webhook event
      await AuditLogger.log("webhook_received", "system", null, {
        event,
        dataKeys: Object.keys(data || {}),
      });

      // Process different webhook events
      switch (event) {
        case "collection_submitted":
          // Handle external collection submission
          if (data.hostName && data.sandwiches) {
            await storage.createSandwichCollection({
              hostName: data.hostName,
              individualSandwiches: data.sandwiches,
              groupCollections: data.groupCollections || "{}",
              collectionDate:
                data.date || new Date().toISOString().split("T")[0],
            });
          }
          break;

        case "host_updated":
          // Handle external host updates
          if (data.hostId && data.updates) {
            await storage.updateHost(data.hostId, data.updates);
          }
          break;

        default:
          console.log(`Unknown webhook event: ${event}`);
      }

      res.json({ success: true, processed: event });
    } catch (error) {
      console.error("Webhook processing error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Backup Management API Routes for Phase 5: Operations & Reliability
  app.post("/api/backups/create", async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { reason } = req.body;

      const manifest = await BackupManager.createBackup(
        "manual",
        userId,
        reason,
      );
      res.json({ success: true, manifest });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/backups", async (req, res) => {
    try {
      const backups = await BackupManager.listBackups();
      res.json(backups);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/backups/:backupId", async (req, res) => {
    try {
      const { backupId } = req.params;
      const backup = await BackupManager.getBackupInfo(backupId);

      if (!backup) {
        return res.status(404).json({ error: "Backup not found" });
      }

      res.json(backup);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/backups/:backupId/validate", async (req, res) => {
    try {
      const { backupId } = req.params;
      const validation = await BackupManager.validateBackup(backupId);
      res.json(validation);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/backups/:backupId", async (req, res) => {
    try {
      const { backupId } = req.params;
      const userId = req.user?.claims?.sub;

      const success = await BackupManager.deleteBackup(backupId, userId);

      if (success) {
        res.json({ success: true, message: "Backup deleted successfully" });
      } else {
        res.status(400).json({ error: "Failed to delete backup" });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/backups/stats/storage", async (req, res) => {
    try {
      const stats = await BackupManager.getStorageStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Operations Dashboard API for comprehensive system monitoring
  app.get("/api/operations/system-health", async (req, res) => {
    try {
      const stats = await storage.getCollectionStats();
      const hosts = await storage.getAllHosts();
      const projects = await storage.getAllProjects();
      const backupStats = await BackupManager.getStorageStats();
      const cacheStats = CacheManager.getStats();

      const systemHealth = {
        database: {
          status: "healthy",
          totalRecords: stats.totalEntries,
          totalSandwiches: stats.totalSandwiches,
          lastActivity: new Date().toISOString(),
        },
        hosts: {
          total: hosts.length,
          active: hosts.filter((h) => h.status === "active").length,
          inactive: hosts.filter((h) => h.status === "inactive").length,
        },
        projects: {
          total: projects.length,
          active: projects.filter((p) => p.status === "in_progress").length,
          completed: projects.filter((p) => p.status === "completed").length,
        },
        backups: {
          total: backupStats.totalBackups,
          totalSize: backupStats.diskUsage,
          lastBackup: backupStats.newestBackup,
        },
        cache: {
          hitRate: cacheStats.hitRate,
          size: cacheStats.size,
          memory: `${Math.round(cacheStats.memoryUsage / 1024 / 1024)}MB`,
        },
        uptime: process.uptime(),
        memory: {
          used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
          total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
        },
      };

      res.json(systemHealth);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Initialize backup system
  BackupManager.initialize().then(() => {
    BackupManager.scheduleAutoBackup();
    console.log("Backup system initialized with automated daily backups");
  });

  const httpServer = createServer(app);
  // Committee management routes
  app.get("/api/committees", isAuthenticated, async (req: any, res) => {
    try {
      const committees = await storage.getAllCommittees();
      res.json({ committees });
    } catch (error) {
      console.error("Error fetching committees:", error);
      res.status(500).json({ message: "Failed to fetch committees" });
    }
  });

  app.get("/api/committees/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const committee = await storage.getCommittee(id);
      if (!committee) {
        return res.status(404).json({ message: "Committee not found" });
      }
      res.json(committee);
    } catch (error) {
      console.error("Error fetching committee:", error);
      res.status(500).json({ message: "Failed to fetch committee" });
    }
  });

  app.post(
    "/api/committees",
    isAuthenticated,
    requirePermission("manage_committees"),
    async (req: any, res) => {
      try {
        const committee = await storage.createCommittee(req.body);
        res.json(committee);
      } catch (error) {
        console.error("Error creating committee:", error);
        res.status(500).json({ message: "Failed to create committee" });
      }
    },
  );

  app.get(
    "/api/committees/:id/members",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const members = await storage.getCommitteeMembers(id);
        res.json({ members });
      } catch (error) {
        console.error("Error fetching committee members:", error);
        res.status(500).json({ message: "Failed to fetch committee members" });
      }
    },
  );

  app.post(
    "/api/committees/:id/members",
    isAuthenticated,
    requirePermission("manage_committees"),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const { userId, role } = req.body;
        const membership = await storage.addUserToCommittee({
          userId,
          committeeId: id,
          role: role || "member",
        });
        res.json(membership);
      } catch (error) {
        console.error("Error adding committee member:", error);
        res.status(500).json({ message: "Failed to add committee member" });
      }
    },
  );

  app.delete(
    "/api/committees/:id/members/:userId",
    isAuthenticated,
    requirePermission("manage_committees"),
    async (req: any, res) => {
      try {
        const { id, userId } = req.params;
        const success = await storage.removeUserFromCommittee(userId, id);
        if (success) {
          res.json({ message: "Member removed successfully" });
        } else {
          res.status(404).json({ message: "Membership not found" });
        }
      } catch (error) {
        console.error("Error removing committee member:", error);
        res.status(500).json({ message: "Failed to remove committee member" });
      }
    },
  );

  app.get(
    "/api/users/:id/committees",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const userCommittees = await storage.getUserCommittees(id);
        res.json({ committees: userCommittees });
      } catch (error) {
        console.error("Error fetching user committees:", error);
        res.status(500).json({ message: "Failed to fetch user committees" });
      }
    },
  );

  // Message notification routes
  app.get("/api/messages/unread-counts", isAuthenticated, messageNotificationRoutes.getUnreadCounts);
  app.post("/api/messages/mark-read", isAuthenticated, messageNotificationRoutes.markMessagesRead);
  app.post("/api/messages/mark-all-read", isAuthenticated, messageNotificationRoutes.markAllRead);

  // Announcement routes
  app.get("/api/announcements", async (req, res) => {
    try {
      const announcements = await storage.getAllAnnouncements();
      res.json(announcements);
    } catch (error) {
      console.error("Error fetching announcements:", error);
      res.status(500).json({ message: "Failed to fetch announcements" });
    }
  });

  app.post(
    "/api/announcements",
    isAuthenticated,
    requirePermission("manage_users"),
    async (req: any, res) => {
      try {
        console.log("Received announcement data:", req.body);
        
        // Convert ISO strings to Date objects for validation
        const processedData = {
          ...req.body,
          startDate: new Date(req.body.startDate),
          endDate: new Date(req.body.endDate)
        };
        
        const result = insertAnnouncementSchema.safeParse(processedData);
        if (!result.success) {
          console.log("Validation errors:", result.error.errors);
          return res.status(400).json({
            message: "Invalid announcement data",
            errors: result.error.errors,
          });
        }

        const announcement = await storage.createAnnouncement(result.data);
        res.status(201).json(announcement);
      } catch (error) {
        console.error("Error creating announcement:", error);
        res.status(500).json({ message: "Failed to create announcement" });
      }
    },
  );

  app.patch(
    "/api/announcements/:id",
    isAuthenticated,
    requirePermission("manage_users"),
    async (req: any, res) => {
      try {
        const id = parseInt(req.params.id);
        const updates = { ...req.body };
        
        // Convert ISO strings to Date objects if present
        if (updates.startDate) {
          updates.startDate = new Date(updates.startDate);
        }
        if (updates.endDate) {
          updates.endDate = new Date(updates.endDate);
        }

        const announcement = await storage.updateAnnouncement(id, updates);
        if (!announcement) {
          return res.status(404).json({ message: "Announcement not found" });
        }

        res.json(announcement);
      } catch (error) {
        console.error("Error updating announcement:", error);
        res.status(500).json({ message: "Failed to update announcement" });
      }
    },
  );

  app.delete(
    "/api/announcements/:id",
    isAuthenticated,
    requirePermission("manage_users"),
    async (req: any, res) => {
      try {
        const id = parseInt(req.params.id);

        const success = await storage.deleteAnnouncement(id);
        if (!success) {
          return res.status(404).json({ message: "Announcement not found" });
        }

        res.status(204).send();
      } catch (error) {
        console.error("Error deleting announcement:", error);
        res.status(500).json({ message: "Failed to delete announcement" });
      }
    },
  );

  // Message notification routes
  app.get("/api/messages/unread-counts", isAuthenticated, messageNotificationRoutes.getUnreadCounts);
  app.post("/api/messages/mark-read", isAuthenticated, messageNotificationRoutes.markMessagesRead);
  app.post("/api/messages/mark-all-read", isAuthenticated, messageNotificationRoutes.markAllRead);

  // Custom Message Groups API
  app.get("/api/message-groups", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const user = (req as any).user;
      
      // Check if user has moderation permissions (super_admin or admin with moderate_messages)
      const canModerateMessages = user.role === 'super_admin' || 
        (user.permissions && user.permissions.includes('moderate_messages'));
      
      let userGroups;
      
      if (canModerateMessages) {
        // TEMPORARILY DISABLED: Super admins and moderators see ALL group conversations
        // userGroups = await db
        //   .select({
        //     id: conversations.id,
        //     name: conversations.name,
        //     description: sql<string>`null`, // No description field in conversations table
        //     createdBy: sql<string>`null`, // No createdBy field in conversations table
        //     isActive: sql<boolean>`true`, // All conversations are active by default
        //     createdAt: conversations.createdAt,
        //     userRole: sql<string>`'moderator'` // Mark as moderator role for super admins
        //   })
        //   .from(conversations)
        //   .where(eq(conversations.type, 'group'));
        
        userGroups = [];
      } else {
        // TEMPORARILY DISABLED: Regular users only see group conversations where they are participants
        // userGroups = await db
        //   .select({
        //     id: conversations.id,
        //     name: conversations.name,
        //     description: sql<string>`null`, // No description field in conversations table
        //     createdBy: sql<string>`null`, // No createdBy field in conversations table
        //     isActive: sql<boolean>`true`, // All conversations are active by default
        //     createdAt: conversations.createdAt,
        //     userRole: sql<string>`'member'` // Regular participants are members
        //   })
        //   .from(conversations)
        //   .innerJoin(conversationParticipants, eq(conversations.id, conversationParticipants.conversationId))
        //   .where(
        //     and(
        //       eq(conversations.type, 'group'),
        //       eq(conversationParticipants.userId, userId)
        //     )
        //   );
        
        userGroups = [];
      }

      // Get member counts for each group separately
      const groupsWithCounts = await Promise.all(
        userGroups.map(async (group) => {
          const memberCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(conversationParticipants)
            .where(eq(conversationParticipants.conversationId, group.id));
          
          return {
            ...group,
            memberCount: memberCount[0]?.count || 0
          };
        })
      );
      
      res.json(groupsWithCounts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch message groups" });
    }
  });

  app.post("/api/message-groups", isAuthenticated, async (req, res) => {
    try {
      const { name, description, memberIds } = req.body;
      const userId = (req as any).user?.id;
      
      if (!name?.trim()) {
        return res.status(400).json({ message: "Group name is required" });
      }
      
      // Create the group
      const [group] = await db.insert(messageGroups).values({
        name: name.trim(),
        description: description?.trim() || null,
        createdBy: userId,
      }).returning();
      
      // Create a conversation thread for this group
      const [thread] = await db.insert(conversationThreads).values({
        type: 'group',
        referenceId: group.id.toString(),
        title: name.trim(),
        isActive: true,
        createdBy: userId
      }).returning();
      
      console.log(`[DEBUG] Created thread ${thread.id} for group ${group.id} (${name})`);
      
      // Add creator as admin to group membership
      await db.insert(groupMemberships).values({
        groupId: group.id,
        userId: userId,
        role: 'admin'
      });
      
      // Add creator as participant to thread
      await db.insert(groupMessageParticipants).values({
        threadId: thread.id,
        userId: userId,
        status: 'active',
        joinedAt: new Date()
      });
      
      // Add other members to both group and thread
      if (memberIds && Array.isArray(memberIds)) {
        const memberships = memberIds
          .filter(id => id !== userId) // Don't duplicate creator
          .map(memberId => ({
            groupId: group.id,
            userId: memberId,
            role: 'member' as const
          }));
        
        const participants = memberIds
          .filter(id => id !== userId) // Don't duplicate creator
          .map(memberId => ({
            threadId: thread.id,
            userId: memberId,
            status: 'active' as const,
            joinedAt: new Date()
          }));
        
        if (memberships.length > 0) {
          await db.insert(groupMemberships).values(memberships);
          await db.insert(groupMessageParticipants).values(participants);
        }
      }
      
      // Send welcome message notification
      if ((global as any).broadcastNewMessage) {
        (global as any).broadcastNewMessage({
          content: `Welcome to ${name}! This group has been created for team collaboration.`,
          sender: 'System',
          threadId: thread.id,
          timestamp: new Date()
        });
      }
      
      res.status(201).json({ ...group, threadId: thread.id });
    } catch (error) {
      console.error("Error creating message group:", error);
      res.status(500).json({ message: "Failed to create message group" });
    }
  });

  // Add members to existing group
  app.post("/api/message-groups/:groupId/members", isAuthenticated, async (req, res) => {
    try {
      const { groupId } = req.params;
      const { memberIds } = req.body;
      const currentUser = (req as any).user;
      const userId = currentUser?.id;
      
      // Platform super admins can add members to any group
      const isPlatformSuperAdmin = currentUser?.role === 'super_admin';
      
      if (!isPlatformSuperAdmin) {
        // Check if user is admin of the group
        const userMembership = await db
          .select()
          .from(groupMemberships)
          .where(
            and(
              eq(groupMemberships.groupId, parseInt(groupId)),
              eq(groupMemberships.userId, userId),
              eq(groupMemberships.role, 'admin'),
              eq(groupMemberships.isActive, true)
            )
          )
          .limit(1);
        
        if (userMembership.length === 0) {
          return res.status(403).json({ message: "Only group admins can add members" });
        }
      }
      
      if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
        return res.status(400).json({ message: "Member IDs are required" });
      }
      
      // Get existing members to avoid duplicates
      const existingMembers = await db
        .select({ userId: groupMemberships.userId })
        .from(groupMemberships)
        .where(
          and(
            eq(groupMemberships.groupId, parseInt(groupId)),
            eq(groupMemberships.isActive, true)
          )
        );
      
      const existingMemberIds = existingMembers.map(m => m.userId);
      const newMemberIds = memberIds.filter(id => !existingMemberIds.includes(id));
      
      if (newMemberIds.length === 0) {
        return res.status(400).json({ message: "All selected users are already members" });
      }
      
      // Add new members
      const memberships = newMemberIds.map(memberId => ({
        groupId: parseInt(groupId),
        userId: memberId,
        role: 'member' as const
      }));
      
      await db.insert(groupMemberships).values(memberships);
      
      res.json({ message: "Members added successfully", addedCount: newMemberIds.length });
    } catch (error) {
      res.status(500).json({ message: "Failed to add members to group" });
    }
  });

  app.get("/api/message-groups/:groupId/members", isAuthenticated, async (req, res) => {
    try {
      const groupId = parseInt(req.params.groupId);
      const userId = (req as any).user?.id;
      const user = (req as any).user;
      
      console.log(`[DEBUG] Fetching members for group ${groupId}, user ${userId}`);
      
      // Check if user has moderation permissions (super_admin or admin with moderate_messages)
      const canModerateMessages = user.role === 'super_admin' || 
        (user.permissions && user.permissions.includes('moderate_messages'));
      
      console.log(`[DEBUG] User moderation permissions: ${canModerateMessages}`);
      
      if (!canModerateMessages) {
        try {
          // Regular users need to be members of the group
          const membership = await db
            .select()
            .from(groupMemberships)
            .where(
              and(
                eq(groupMemberships.groupId, groupId),
                eq(groupMemberships.userId, userId),
                eq(groupMemberships.isActive, true)
              )
            )
            .limit(1);
          
          if (membership.length === 0) {
            return res.status(403).json({ message: "Not a member of this group" });
          }
        } catch (membershipError) {
          console.error(`[ERROR] Error checking membership:`, membershipError);
          // If groupMemberships table doesn't exist, allow super admins to proceed
          if (!canModerateMessages) {
            return res.status(500).json({ message: "Group membership system not available" });
          }
        }
      }
      
      try {
        // Get all group members with user details
        const members = await db
          .select({
            userId: groupMemberships.userId,
            role: groupMemberships.role,
            joinedAt: groupMemberships.joinedAt,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email
          })
          .from(groupMemberships)
          .leftJoin(users, eq(groupMemberships.userId, users.id))
          .where(
            and(
              eq(groupMemberships.groupId, groupId),
              eq(groupMemberships.isActive, true)
            )
          );
        
        console.log(`[DEBUG] Found ${members.length} members for group ${groupId}`);
        res.json(members);
      } catch (membersError) {
        console.error(`[ERROR] Error fetching group members:`, membersError);
        // If groupMemberships table doesn't exist, return empty array for now
        res.json([]);
      }
    } catch (error) {
      console.error(`[ERROR] General error in group members endpoint:`, error);
      res.status(500).json({ message: "Failed to fetch group members", details: error.message });
    }
  });

  // TEMPORARILY DISABLED: Thread Participant Management API - Using new conversation system instead
  // app.get("/api/threads/:threadId/participants", isAuthenticated, async (req, res) => {
  //   // This endpoint is disabled - use /api/conversations/:conversationId/participants instead
  //   res.status(404).json({ message: "Endpoint disabled - use conversation system" });
  // });

  app.patch("/api/threads/:threadId/my-status", isAuthenticated, async (req, res) => {
    try {
      const threadId = parseInt(req.params.threadId);
      const userId = (req as any).user?.id;
      const { status } = req.body;
      
      if (!['active', 'archived', 'left', 'muted'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      // Update participant status with timestamp
      const timestampField = status === 'left' ? 'left_at' : 
                            status === 'archived' ? 'archived_at' : 
                            status === 'muted' ? 'muted_at' : null;
      
      const updates: any = { status };
      if (timestampField) {
        updates[timestampField] = new Date();
      }
      
      const result = await db
        .update(groupMessageParticipants)
        .set(updates)
        .where(
          and(
            eq(groupMessageParticipants.threadId, threadId),
            eq(groupMessageParticipants.userId, userId)
          )
        );
      
      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Participant record not found" });
      }
      
      res.json({ message: `Thread status updated to ${status}`, status });
    } catch (error) {
      res.status(500).json({ message: "Failed to update thread status" });
    }
  });

  app.patch("/api/threads/:threadId/mark-read", isAuthenticated, async (req, res) => {
    try {
      const threadId = parseInt(req.params.threadId);
      const userId = (req as any).user?.id;
      
      const result = await db
        .update(groupMessageParticipants)
        .set({ lastReadAt: new Date() })
        .where(
          and(
            eq(groupMessageParticipants.threadId, threadId),
            eq(groupMessageParticipants.userId, userId)
          )
        );
      
      res.json({ message: "Thread marked as read" });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark thread as read" });
    }
  });

  app.get("/api/threads/:threadId/my-status", isAuthenticated, async (req, res) => {
    try {
      const threadId = parseInt(req.params.threadId);
      const userId = (req as any).user?.id;
      
      const [participant] = await db
        .select({
          status: groupMessageParticipants.status,
          lastReadAt: groupMessageParticipants.lastReadAt,
          joinedAt: groupMessageParticipants.joinedAt
        })
        .from(groupMessageParticipants)
        .where(
          and(
            eq(groupMessageParticipants.threadId, threadId),
            eq(groupMessageParticipants.userId, userId)
          )
        );
      
      if (!participant) {
        return res.status(404).json({ message: "Not a participant in this thread" });
      }
      
      res.json(participant);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch thread status" });
    }
  });

  // Updated group messages endpoint to respect individual participant status
  app.get("/api/message-groups/:groupId/messages", isAuthenticated, async (req, res) => {
    try {
      const groupId = parseInt(req.params.groupId);
      const userId = (req as any).user?.id;
      
      console.log(`[DEBUG] Fetching messages for group ${groupId}, user ${userId}`);
      
      try {
        // Get the thread ID for this group
        const [thread] = await db
          .select({ threadId: conversationThreads.id })
          .from(conversationThreads)
          .where(
            and(
              eq(conversationThreads.type, 'group'),
              eq(conversationThreads.referenceId, groupId.toString()),
              eq(conversationThreads.isActive, true)
            )
          );
        
        if (!thread) {
          console.log(`[DEBUG] No thread found for group ${groupId}`);
          return res.json([]);
        }
        
        // Check if user has access to this thread (not left)
        const participantStatus = await db
          .select({ status: groupMessageParticipants.status })
          .from(groupMessageParticipants)
          .where(
            and(
              eq(groupMessageParticipants.threadId, thread.threadId),
              eq(groupMessageParticipants.userId, userId)
            )
          );
        
        if (participantStatus.length === 0 || participantStatus[0].status === 'left') {
          console.log(`[DEBUG] User ${userId} has no access to thread ${thread.threadId} for group ${groupId}`);
          return res.json([]); // Return empty array for users who left
        }
        
        // Get messages from the thread
        const groupMessages = await db
          .select()
          .from(messagesTable)
          .where(eq(messagesTable.threadId, thread.threadId))
          .orderBy(messagesTable.timestamp);
        
        console.log(`[DEBUG] Found ${groupMessages.length} messages for group ${groupId} thread ${thread.threadId}`);
        res.json(groupMessages);
      } catch (threadError) {
        console.log(`[DEBUG] Thread system not available, falling back to conversation-based messages`);
        
        // Fallback: try to get messages from conversations table using the groupId
        const groupMessages = await db
          .select({
            id: messagesTable.id,
            content: messagesTable.content,
            userId: messagesTable.userId,
            sender: messagesTable.sender,
            timestamp: messagesTable.timestamp || messagesTable.createdAt,
            createdAt: messagesTable.createdAt
          })
          .from(messagesTable)
          .where(eq(messagesTable.conversationId, groupId))
          .orderBy(messagesTable.timestamp || messagesTable.createdAt);
        
        console.log(`[DEBUG] Fallback: Found ${groupMessages.length} messages for conversation ${groupId}`);
        res.json(groupMessages);
      }
    } catch (error) {
      console.error("Error fetching group messages:", error);
      res.status(500).json({ message: "Failed to fetch group messages", details: error.message });
    }
  });

  // POST endpoint for sending messages to group threads
  app.post("/api/message-groups/:groupId/messages", isAuthenticated, async (req, res) => {
    try {
      const groupId = parseInt(req.params.groupId);
      const userId = (req as any).user?.id;
      const { content, sender } = req.body;

      if (!content?.trim()) {
        return res.status(400).json({ message: "Message content is required" });
      }

      // Get the thread ID for this group
      const [thread] = await db
        .select({ threadId: conversationThreads.id })
        .from(conversationThreads)
        .where(
          and(
            eq(conversationThreads.type, 'group'),
            eq(conversationThreads.referenceId, groupId.toString()),
            eq(conversationThreads.isActive, true)
          )
        );

      if (!thread) {
        return res.status(404).json({ message: "Group thread not found" });
      }

      // Check if user has access to this thread
      const participantStatus = await db
        .select({ status: groupMessageParticipants.status })
        .from(groupMessageParticipants)
        .where(
          and(
            eq(groupMessageParticipants.threadId, thread.threadId),
            eq(groupMessageParticipants.userId, userId)
          )
        );

      if (participantStatus.length === 0 || participantStatus[0].status === 'left') {
        return res.status(403).json({ message: "Not authorized to send messages to this group" });
      }

      // Insert the message
      const [message] = await db.insert(messagesTable).values({
        content: content.trim(),
        sender: sender || "Anonymous",
        userId: userId,
        threadId: thread.threadId,
        timestamp: new Date()
      }).returning();

      // Update thread's last message timestamp
      await db.update(conversationThreads)
        .set({ lastMessageAt: new Date() })
        .where(eq(conversationThreads.id, thread.threadId));

      console.log(`[DEBUG] Message sent to group ${groupId} thread ${thread.threadId}`);
      
      // Broadcast notification via WebSocket if available
      if (typeof (global as any).broadcastNewMessage === 'function') {
        await (global as any).broadcastNewMessage(message);
      }

      res.json(message);
    } catch (error) {
      console.error("Error sending group message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });



  // Remove member from group endpoint
  app.delete("/api/message-groups/:groupId/members/:userId", isAuthenticated, async (req, res) => {
    try {
      const groupId = parseInt(req.params.groupId);
      const targetUserId = req.params.userId;
      const currentUserId = (req as any).user?.id;

      // Platform super admin can manage any group, otherwise check group admin permission
      const currentUser = (req as any).user;
      const isPlatformSuperAdmin = currentUser?.role === 'super_admin';
      
      console.log(`[DEBUG] Delete member - Current user:`, JSON.stringify(currentUser, null, 2));
      console.log(`[DEBUG] Delete member - isPlatformSuperAdmin:`, isPlatformSuperAdmin);
      console.log(`[DEBUG] Delete member - User role check:`, currentUser?.role);
      console.log(`[DEBUG] Delete member - User role === 'super_admin':`, currentUser?.role === 'super_admin');
      
      if (!isPlatformSuperAdmin) {
        const membership = await db
          .select({ role: groupMemberships.role })
          .from(groupMemberships)
          .where(
            and(
              eq(groupMemberships.groupId, groupId),
              eq(groupMemberships.userId, currentUserId),
              eq(groupMemberships.isActive, true)
            )
          );

        if (membership.length === 0 || membership[0].role !== 'admin') {
          return res.status(403).json({ message: "Only group admins can remove members" });
        }
      }

      // Only prevent removing other admins if current user is not a platform super admin
      if (!isPlatformSuperAdmin) {
        const targetMembership = await db
          .select({ role: groupMemberships.role })
          .from(groupMemberships)
          .where(
            and(
              eq(groupMemberships.groupId, groupId),
              eq(groupMemberships.userId, targetUserId),
              eq(groupMemberships.isActive, true)
            )
          );

        if (targetMembership.length > 0 && targetMembership[0].role === 'admin') {
          return res.status(403).json({ message: "Cannot remove group administrators" });
        }
      }

      // Get the thread for this group
      const [thread] = await db
        .select({ threadId: conversationThreads.id })
        .from(conversationThreads)
        .where(
          and(
            eq(conversationThreads.type, 'group'),
            eq(conversationThreads.referenceId, groupId.toString()),
            eq(conversationThreads.isActive, true)
          )
        );

      if (thread) {
        // Update thread participant status to 'left'
        await db.update(groupMessageParticipants)
          .set({ status: 'left' })
          .where(
            and(
              eq(groupMessageParticipants.threadId, thread.threadId),
              eq(groupMessageParticipants.userId, targetUserId)
            )
          );
      }

      // Remove from group membership
      await db.update(groupMemberships)
        .set({ isActive: false })
        .where(
          and(
            eq(groupMemberships.groupId, groupId),
            eq(groupMemberships.userId, targetUserId)
          )
        );

      console.log(`[DEBUG] Removed user ${targetUserId} from group ${groupId}`);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing member from group:", error);
      res.status(500).json({ message: "Failed to remove member" });
    }
  });

  // Update member role in group (promote/demote)
  app.patch("/api/message-groups/:groupId/members/:userId/role", isAuthenticated, async (req, res) => {
    try {
      const groupId = parseInt(req.params.groupId);
      const targetUserId = req.params.userId;
      const currentUserId = (req as any).user?.id;
      const { role } = req.body;
      const currentUser = (req as any).user;

      if (!role || !['admin', 'member'].includes(role)) {
        return res.status(400).json({ message: "Invalid role. Must be 'admin' or 'member'" });
      }

      // Platform super admin can manage any group, otherwise check group admin permission
      const isPlatformSuperAdmin = currentUser?.role === 'super_admin';
      
      if (!isPlatformSuperAdmin) {
        const membership = await db
          .select({ role: groupMemberships.role })
          .from(groupMemberships)
          .where(
            and(
              eq(groupMemberships.groupId, groupId),
              eq(groupMemberships.userId, currentUserId),
              eq(groupMemberships.isActive, true)
            )
          );

        if (membership.length === 0 || membership[0].role !== 'admin') {
          return res.status(403).json({ message: "Only group admins can manage member roles" });
        }
      }

      // Update the member's role
      await db.update(groupMemberships)
        .set({ role })
        .where(
          and(
            eq(groupMemberships.groupId, groupId),
            eq(groupMemberships.userId, targetUserId),
            eq(groupMemberships.isActive, true)
          )
        );

      console.log(`[DEBUG] Updated user ${targetUserId} role to ${role} in group ${groupId}`);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating member role:", error);
      res.status(500).json({ message: "Failed to update member role" });
    }
  });

  // Delete entire group message thread (super admin only)
  app.delete("/api/message-groups/:groupId", isAuthenticated, async (req, res) => {
    try {
      const groupId = parseInt(req.params.groupId);
      const currentUser = (req as any).user;

      console.log(`[DEBUG] Attempting to delete group ${groupId} by user ${currentUser?.id} with role ${currentUser?.role}`);

      // Only platform super admins can delete entire groups
      if (currentUser?.role !== 'super_admin') {
        return res.status(403).json({ message: "Only platform super admins can delete message groups" });
      }

      // Sequential deletion (Neon HTTP doesn't support transactions)
      
      // 1. Get the conversation thread for this group
      const [thread] = await db
        .select({ threadId: conversationThreads.id })
        .from(conversationThreads)
        .where(
          and(
            eq(conversationThreads.type, 'group'),
            eq(conversationThreads.referenceId, groupId.toString()),
            eq(conversationThreads.isActive, true)
          )
        );

      console.log(`[DEBUG] Found thread for group ${groupId}:`, thread);

      if (thread) {
        // 2. Delete all messages in the thread (use messagesTable alias)
        const deletedMessages = await db.delete(messagesTable)
          .where(eq(messagesTable.threadId, thread.threadId));
        console.log(`[DEBUG] Deleted messages in thread ${thread.threadId}`);

        // 3. Delete all thread participants
        const deletedParticipants = await db.delete(groupMessageParticipants)
          .where(eq(groupMessageParticipants.threadId, thread.threadId));
        console.log(`[DEBUG] Deleted participants for thread ${thread.threadId}`);

        // 4. Mark conversation thread as inactive
        await db.update(conversationThreads)
          .set({ isActive: false })
          .where(eq(conversationThreads.id, thread.threadId));
        console.log(`[DEBUG] Marked thread ${thread.threadId} as inactive`);
      }

      // 5. Delete all group memberships
      const deletedMemberships = await db.delete(groupMemberships)
        .where(eq(groupMemberships.groupId, groupId));
      console.log(`[DEBUG] Deleted memberships for group ${groupId}`);

      // 6. Mark the group as inactive
      await db.update(messageGroups)
        .set({ isActive: false })
        .where(eq(messageGroups.id, groupId));
      console.log(`[DEBUG] Marked group ${groupId} as inactive`);

      console.log(`[DEBUG] Super admin successfully deleted entire group ${groupId}`);
      res.json({ success: true, message: "Group deleted successfully" });
    } catch (error) {
      console.error("Error deleting group:", error);
      console.error("Full error details:", error.message, error.stack);
      res.status(500).json({ message: `Failed to delete group: ${error.message}` });
    }
  });

  // System performance monitoring endpoint
  app.get("/api/system/health", isAuthenticated, (req, res) => {
    try {
      const stats = QueryOptimizer.getCacheStats();
      const memoryUsage = process.memoryUsage();
      
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        cache: {
          size: stats.size,
          activeKeys: stats.keys.length
        },
        memory: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + "MB",
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + "MB"
        },
        uptime: Math.round(process.uptime()) + "s"
      });
    } catch (error) {
      res.status(500).json({ status: "error", message: "Health check failed" });
    }
  });

  // Register Google Sheets routes
  app.use('/api/google-sheets', googleSheetsRoutes);

  // Google Sheets sync endpoint for individual collection entries
  app.post('/api/google-sheets/sync-entry', async (req, res) => {
    try {
      const { collectionData } = req.body;
      
      if (!collectionData) {
        return res.status(400).json({ error: 'Collection data is required' });
      }

      // Import the sync service dynamically to avoid dependency issues
      const { GoogleSheetsSyncService } = await import('./google-sheets-sync');
      
      // Create minimal storage interface for the sync
      const mockStorage = {
        getAllSandwichCollections: async () => [],
        createSandwichCollection: async (data: any) => data
      };

      const syncService = new GoogleSheetsSyncService(mockStorage);
      
      // Add the entry to the ReplitDatabase sheet
      await syncService.addEntryToSheet(collectionData);

      res.json({ 
        success: true, 
        message: 'Entry synced to Google Sheets successfully' 
      });

    } catch (error: any) {
      console.error('Error syncing entry to Google Sheets:', error);
      res.status(500).json({ 
        error: 'Failed to sync to Google Sheets',
        details: error.message 
      });
    }
  });

  // Set up WebSocket server for real-time notifications
  const wss = new WebSocketServer({ server: httpServer, path: '/notifications' });
  const connectedClients = new Map<string, WebSocket[]>();

  wss.on('connection', (ws: WebSocket, request) => {
    console.log('WebSocket client connected');
    
    // Add connection state tracking
    let isAlive = true;
    let userId: string | null = null;
    
    // Setup heartbeat to detect disconnected clients
    const heartbeatInterval = setInterval(() => {
      if (!isAlive) {
        // Connection is dead, clean up
        clearInterval(heartbeatInterval);
        ws.terminate();
        return;
      }
      isAlive = false;
      ws.ping();
    }, 30000); // Ping every 30 seconds
    
    ws.on('pong', () => {
      isAlive = true;
    });
    
    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        
        if (data.type === 'identify' && data.userId) {
          userId = data.userId;
          // Associate WebSocket with user ID
          if (!connectedClients.has(data.userId)) {
            connectedClients.set(data.userId, []);
          }
          connectedClients.get(data.userId)!.push(ws);
          console.log(`User ${data.userId} connected via WebSocket`);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      // Clean up heartbeat
      clearInterval(heartbeatInterval);
      
      // Remove WebSocket from all user associations
      if (userId) {
        const clients = connectedClients.get(userId);
        if (clients) {
          const index = clients.indexOf(ws);
          if (index > -1) {
            clients.splice(index, 1);
            if (clients.length === 0) {
              connectedClients.delete(userId);
            }
            console.log(`User ${userId} disconnected from WebSocket`);
          }
        }
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      // Clean up on error
      clearInterval(heartbeatInterval);
      ws.terminate();
    });
  });

  // Helper function to get users with access to a specific chat
  const getUsersWithChatAccess = async (chatName: string): Promise<string[]> => {
    try {
      // Import chat permissions from shared utilities
      const { CHAT_PERMISSIONS } = await import('../shared/auth-utils.js');
      const requiredPermission = CHAT_PERMISSIONS[chatName as keyof typeof CHAT_PERMISSIONS];
      
      if (!requiredPermission) {
        console.log(`No permission mapping found for chat: ${chatName}`);
        return [];
      }

      // Get all users with the required permission
      const users = await storage.getAllUsers();
      const usersWithAccess = users
        .filter(user => user.permissions && user.permissions.includes(requiredPermission))
        .map(user => user.id);
      
      console.log(`Users with access to ${chatName} chat:`, usersWithAccess);
      return usersWithAccess;
    } catch (error) {
      console.error('Error getting users with chat access:', error);
      return [];
    }
  };

  // Function to broadcast new message notifications
  const broadcastNewMessage = async (message: any) => {
    try {
      console.log('broadcastNewMessage called with:', message);
      console.log('Connected clients count:', connectedClients.size);
      
      const notificationData = {
        type: 'new_message',
        messageId: message.id,
        sender: message.sender,
        content: message.content,
        committee: message.committee,
        timestamp: message.timestamp,
        recipientId: message.recipientId
      };

      // Determine who should receive this notification based on chat permissions
      let targetUsers = new Set<string>();

      if (message.committee === 'direct' && message.recipientId) {
        // Direct message - notify recipient only
        targetUsers.add(message.recipientId);
        console.log('Direct message, notifying recipient:', message.recipientId);
      } else {
        // Committee/chat room message - notify only users with access to that specific chat
        const usersWithAccess = await getUsersWithChatAccess(message.committee);
        
        for (const userId of usersWithAccess) {
          // Don't notify the sender
          if (userId !== message.userId) {
            targetUsers.add(userId);
          }
        }
        console.log(`${message.committee} chat message, target users:`, Array.from(targetUsers));
      }

      // Send notifications to target users
      let sentCount = 0;
      for (const userId of targetUsers) {
        const userClients = connectedClients.get(userId);
        console.log(`Checking user ${userId}, clients:`, userClients?.length || 0);
        if (userClients) {
          userClients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              console.log('Sending notification to client:', notificationData);
              client.send(JSON.stringify(notificationData));
              sentCount++;
            } else {
              console.log('Client not ready, readyState:', client.readyState);
            }
          });
        }
      }
      console.log(`Sent ${sentCount} notifications total`);
    } catch (error) {
      console.error('Error broadcasting message notification:', error);
    }
  };

  // Task assignment notification broadcasting function
  const broadcastTaskAssignment = (userId: string, notificationData: any) => {
    try {
      console.log(`Broadcasting task assignment notification to user: ${userId}`);
      const userClients = connectedClients.get(userId);
      
      if (userClients) {
        let sentCount = 0;
        userClients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            console.log('Sending task assignment notification to client:', notificationData);
            client.send(JSON.stringify({
              type: 'notification',
              data: notificationData
            }));
            sentCount++;
          }
        });
        console.log(`Sent task assignment notification to ${sentCount} clients for user ${userId}`);
      } else {
        console.log(`No connected clients found for user ${userId}`);
      }
    } catch (error) {
      console.error('Error broadcasting task assignment notification:', error);
    }
  };

  // Notification API endpoints
  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const user = (req as any).user; // Standardized authentication
      const notifications = await storage.getUserNotifications(user.id);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.patch("/api/notifications/:id/read", isAuthenticated, async (req: any, res) => {
    try {
      const notificationId = parseInt(req.params.id);
      const success = await storage.markNotificationAsRead(notificationId);
      if (!success) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  app.patch("/api/notifications/mark-all-read", isAuthenticated, async (req: any, res) => {
    try {
      const user = (req as any).user; // Standardized authentication
      const success = await storage.markAllNotificationsAsRead(user.id);
      res.json({ success });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ error: "Failed to mark all notifications as read" });
    }
  });

  // Legacy message endpoints - redirect to conversation system
  app.get("/api/messages", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get or create general team chat conversation
      let [generalConversation] = await db
        .select()
        .from(conversations)
        .where(and(
          eq(conversations.type, 'channel'),
          eq(conversations.name, 'team-chat')
        ));

      if (!generalConversation) {
        // Create general team chat conversation
        [generalConversation] = await db
          .insert(conversations)
          .values({
            type: 'channel',
            name: 'team-chat'
          })
          .returning();
      }

      // Get messages for general conversation
      const conversationMessages = await db
        .select({
          id: messagesTable.id,
          content: messagesTable.content,
          userId: messagesTable.userId,
          sender: messagesTable.sender,
          createdAt: messagesTable.createdAt,
          updatedAt: messagesTable.updatedAt
        })
        .from(messagesTable)
        .where(eq(messagesTable.conversationId, generalConversation.id))
        .orderBy(asc(messagesTable.createdAt));

      // Transform to match expected format
      const formattedMessages = conversationMessages.map(msg => ({
        id: msg.id,
        content: msg.content,
        userId: msg.userId,
        sender: msg.sender || 'Unknown User',
        timestamp: msg.createdAt,
        committee: 'general' // For compatibility
      }));

      res.json(formattedMessages);
    } catch (error) {
      console.error('[API] Error fetching messages:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/messages", isAuthenticated, async (req, res) => {
    console.log('=== POST /api/messages START ===');
    try {
      const user = (req as any).user;
      console.log('[STEP 1] User authentication check:');
      console.log('  - req.user exists:', !!user);
      console.log('  - user object:', user);
      console.log('  - user.id:', user?.id);
      console.log('  - user.firstName:', user?.firstName);
      console.log('  - user.lastName:', user?.lastName);
      console.log('  - user.email:', user?.email);
      
      console.log('[STEP 2] Request body:');
      console.log('  - req.body:', req.body);
      console.log('  - content:', req.body?.content);
      console.log('  - sender:', req.body?.sender);
      
      if (!user?.id) {
        console.log('[ERROR] No user.id found, returning 401');
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { content, sender } = req.body;

      if (!content || !content.trim()) {
        console.log('[ERROR] No content provided, returning 400');
        return res.status(400).json({ message: "Message content is required" });
      }

      console.log('[STEP 3] Looking for existing team-chat conversation...');
      
      // Get or create general team chat conversation
      let generalConversation;
      try {
        const existingConversations = await db
          .select()
          .from(conversations)
          .where(and(
            eq(conversations.type, 'channel'),
            eq(conversations.name, 'team-chat')
          ));
        
        console.log('  - Found existing conversations:', existingConversations.length);
        generalConversation = existingConversations[0];
        
        if (generalConversation) {
          console.log('  - Using existing conversation:', generalConversation);
        }
      } catch (dbError) {
        console.error('[ERROR] Database query for conversations failed:', dbError);
        throw dbError;
      }

      if (!generalConversation) {
        console.log('[STEP 4] Creating new team-chat conversation...');
        try {
          const newConversationData = {
            type: 'channel',
            name: 'team-chat'
          };
          console.log('  - Conversation data to insert:', newConversationData);
          
          const newConversations = await db
            .insert(conversations)
            .values(newConversationData)
            .returning();
            
          generalConversation = newConversations[0];
          console.log('  - Created new conversation:', generalConversation);
        } catch (dbError) {
          console.error('[ERROR] Database insert for conversations failed:', dbError);
          throw dbError;
        }
      }

      const userName = sender || `${user.firstName} ${user.lastName}` || user.email || 'Unknown User';
      console.log('[STEP 5] Preparing message data:');
      console.log('  - userName:', userName);
      console.log('  - conversationId:', generalConversation.id);
      console.log('  - userId:', user.id);
      console.log('  - content:', content.trim());

      const messageData = {
        conversationId: generalConversation.id,
        userId: user.id,
        content: content.trim(),
        sender: userName
      };
      console.log('  - Complete message data:', messageData);

      console.log('[STEP 6] Inserting message into database...');
      let message;
      try {
        const insertedMessages = await db
          .insert(messagesTable)
          .values(messageData)
          .returning();
          
        message = insertedMessages[0];
        console.log('  - Inserted message successfully:', message);
      } catch (dbError) {
        console.error('[ERROR] Database insert for messages failed:', dbError);
        console.error('  - Error details:', {
          message: dbError.message,
          code: dbError.code,
          detail: dbError.detail,
          hint: dbError.hint
        });
        throw dbError;
      }

      console.log('[STEP 7] Broadcasting message...');
      // Broadcast via WebSocket if available
      if (broadcastNewMessage) {
        const broadcastData = {
          type: 'new_message',
          conversationId: generalConversation.id,
          message: {
            id: message.id,
            content: message.content,
            userId: message.userId,
            sender: userName,
            timestamp: message.createdAt,
            committee: 'general'
          }
        };
        console.log('  - Broadcasting data:', broadcastData);
        broadcastNewMessage(broadcastData);
      } else {
        console.log('  - No broadcast function available');
      }

      const responseData = {
        id: message.id,
        content: message.content,
        userId: message.userId,
        sender: userName,
        timestamp: message.createdAt,
        committee: 'general'
      };
      console.log('[STEP 8] Sending response:', responseData);
      console.log('=== POST /api/messages SUCCESS ===');
      
      res.json(responseData);
    } catch (error) {
      console.error('=== POST /api/messages ERROR ===');
      console.error('[ERROR] Full error object:', error);
      console.error('[ERROR] Error name:', error.name);
      console.error('[ERROR] Error message:', error.message);
      console.error('[ERROR] Error stack:', error.stack);
      if (error.code) console.error('[ERROR] Error code:', error.code);
      if (error.detail) console.error('[ERROR] Error detail:', error.detail);
      if (error.hint) console.error('[ERROR] Error hint:', error.hint);
      console.error('=== POST /api/messages ERROR END ===');
      
      res.status(500).json({ 
        message: "Internal server error",
        error: error.message,
        details: error.detail || 'No additional details'
      });
    }
  });

  app.delete("/api/messages/:id", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const messageId = parseInt(req.params.id);
      
      // Use storage wrapper instead of direct database access
      const message = await storage.getMessageById(messageId);

      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }

      // Check if user can delete (owner, admin, or super admin)
      const isOwner = message.userId === user.id;
      const isAdmin = user.role === 'admin' || user.role === 'super_admin';
      const hasModeratePermission = user.permissions?.includes('moderate_messages');

      if (!isOwner && !isAdmin && !hasModeratePermission) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Delete the message using storage wrapper
      const deleted = await storage.deleteMessage(messageId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Message not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error('[API] Error deleting message:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Simple conversation API endpoints for the new 3-table messaging system
  app.get("/api/conversations", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get conversations the user is a participant in
      let userConversations;
      // Get all channel conversations (these are public) and user's private conversations
      userConversations = await db
        .select({
          id: conversations.id,
          type: conversations.type,
          name: conversations.name,
          createdAt: conversations.createdAt
        })
        .from(conversations)
        .leftJoin(conversationParticipants, eq(conversations.id, conversationParticipants.conversationId))
        .where(
          or(
            eq(conversations.type, 'channel'), // All channel conversations are accessible
            eq(conversationParticipants.userId, user.id) // User's private conversations
          )
        )
        .groupBy(conversations.id, conversations.type, conversations.name, conversations.createdAt)
        .orderBy(desc(conversations.createdAt));

      res.json(userConversations);
    } catch (error) {
      console.error('[API] Error fetching conversations:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/conversations", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { type, name, participants = [] } = req.body;

      // Create conversation
      const [conversation] = await db
        .insert(conversations)
        .values({
          type,
          name: name || null
        })
        .returning();

      // Add participants
      const participantData = participants.map((userId: string) => ({
        conversationId: conversation.id,
        userId
      }));

      if (participantData.length > 0) {
        await db.insert(conversationParticipants).values(participantData);
      }

      res.json(conversation);
    } catch (error) {
      console.error('[API] Error creating conversation:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/conversations/:id/messages", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const conversationId = parseInt(req.params.id);

      // Check access: participant in conversation OR channel conversations are public
      const [conversation] = await db
        .select({ type: conversations.type })
        .from(conversations)
        .where(eq(conversations.id, conversationId));

      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // Channel conversations are accessible to all users
      if (conversation.type !== 'channel') {
        const [participant] = await db
          .select()
          .from(conversationParticipants)
          .where(
            and(
              eq(conversationParticipants.conversationId, conversationId),
              eq(conversationParticipants.userId, user.id)
            )
          );

        if (!participant) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const conversationMessages = await db
        .select({
          id: messagesTable.id,
          content: messagesTable.content,
          userId: messagesTable.userId,
          sender: messagesTable.sender,
          createdAt: messagesTable.createdAt,
          updatedAt: messagesTable.updatedAt,
          timestamp: messagesTable.timestamp
        })
        .from(messagesTable)
        .where(eq(messagesTable.conversationId, conversationId))
        .orderBy(messagesTable.timestamp || messagesTable.createdAt);

      // Transform to match expected format
      const formattedMessages = conversationMessages.map(msg => ({
        id: msg.id,
        content: msg.content,
        userId: msg.userId,
        sender: msg.sender || 'Unknown User',
        timestamp: msg.timestamp || msg.createdAt,
        committee: 'conversation' // For compatibility
      }));

      res.json(formattedMessages);
    } catch (error) {
      console.error('[API] Error fetching messages:', error);
      res.status(500).json({ message: "Internal server error", details: error.message });
    }
  });

  app.post("/api/conversations/:id/messages", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const conversationId = parseInt(req.params.id);
      const { content } = req.body;

      if (!content || !content.trim()) {
        return res.status(400).json({ message: "Message content is required" });
      }

      // Check access: participant in conversation OR channel conversations are public
      const [conversation] = await db
        .select({ type: conversations.type })
        .from(conversations)
        .where(eq(conversations.id, conversationId));

      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // Channel conversations are accessible to all users
      if (conversation.type !== 'channel') {
        const [participant] = await db
          .select()
          .from(conversationParticipants)
          .where(
            and(
              eq(conversationParticipants.conversationId, conversationId),
              eq(conversationParticipants.userId, user.id)
            )
          );

        if (!participant) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const userName = `${user.firstName} ${user.lastName}` || user.email || 'Unknown User';

      const [message] = await db
        .insert(messagesTable)
        .values({
          conversationId,
          userId: user.id,
          content: content.trim(),
          sender: userName
        })
        .returning();

      // Broadcast via WebSocket if available
      if (broadcastNewMessage) {
        broadcastNewMessage({
          type: 'new_message',
          conversationId,
          message: {
            id: message.id,
            content: message.content,
            userId: message.userId,
            sender: userName,
            timestamp: message.createdAt
          }
        });
      }

      res.json(message);
    } catch (error) {
      console.error('[API] Error sending message:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create or get direct conversation between two users
  app.post("/api/conversations/direct", isAuthenticated, async (req, res) => {
    console.log('=== POST /api/conversations/direct START ===');
    try {
      const user = (req as any).user;
      console.log('User:', user);
      console.log('Request body:', req.body);
      
      const { otherUserId } = req.body;

      if (!otherUserId) {
        return res.status(400).json({ message: "Other user ID is required" });
      }

      // Check if direct conversation already exists between these users
      const existingConversation = await db
        .select({
          id: conversations.id,
          type: conversations.type,
          name: conversations.name,
          createdAt: conversations.createdAt
        })
        .from(conversations)
        .innerJoin(conversationParticipants, eq(conversations.id, conversationParticipants.conversationId))
        .where(
          and(
            eq(conversations.type, 'direct'),
            eq(conversationParticipants.userId, user.id)
          )
        );

      // Find conversation that includes both users
      for (const conv of existingConversation) {
        const participants = await db
          .select({ userId: conversationParticipants.userId })
          .from(conversationParticipants)
          .where(eq(conversationParticipants.conversationId, conv.id));
        
        const userIds = participants.map(p => p.userId);
        if (userIds.includes(otherUserId) && userIds.length === 2) {
          return res.json(conv);
        }
      }

      // Create new direct conversation
      const [newConversation] = await db
        .insert(conversations)
        .values({
          type: 'direct',
          name: null
        })
        .returning();

      // Add both users as participants
      await db.insert(conversationParticipants).values([
        {
          conversationId: newConversation.id,
          userId: user.id
        },
        {
          conversationId: newConversation.id,
          userId: otherUserId
        }
      ]);

      res.json(newConversation);
    } catch (error) {
      console.error('=== POST /api/conversations/direct ERROR ===');
      console.error('[ERROR] Full error object:', error);
      console.error('[ERROR] Error name:', error.name);
      console.error('[ERROR] Error message:', error.message);
      console.error('[ERROR] Error stack:', error.stack);
      if (error.code) console.error('[ERROR] Error code:', error.code);
      if (error.detail) console.error('[ERROR] Error detail:', error.detail);
      if (error.hint) console.error('[ERROR] Error hint:', error.hint);
      console.error('=== POST /api/conversations/direct ERROR END ===');
      
      res.status(500).json({ 
        message: "Failed to create conversation",
        error: error.message,
        details: error.detail || 'No additional details'
      });
    }
  });

  // Make broadcast functions available globally for use in other routes
  (global as any).broadcastNewMessage = broadcastNewMessage;
  (global as any).broadcastTaskAssignment = broadcastTaskAssignment;

  return httpServer;
}

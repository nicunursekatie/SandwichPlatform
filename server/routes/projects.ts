import { storage } from "../storage-wrapper";
import { logger } from "../middleware/logger";
import { insertProjectSchema, insertTaskCompletionSchema } from "@shared/schema";
import multer from "multer";

// Configure multer for project files (supports various file types)
const projectFilesUpload = multer({
  dest: "uploads/projects/",
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit per file
  fileFilter: (req: any, file: any, cb: any) => {
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

export function setupProjectRoutes(app: any, isAuthenticated: any, requirePermission: any) {
  // Projects
  app.get("/api/projects", async (req: any, res: any) => {
    try {
      const projects = await storage.getAllProjects();
      res.json(projects);
    } catch (error) {
      logger.error("Failed to fetch projects", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.post("/api/projects", requirePermission("edit_data"), async (req: any, res: any) => {
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

  app.post("/api/projects/:id/claim", async (req: any, res: any) => {
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

  app.put("/api/projects/:id", requirePermission("edit_data"), async (req: any, res: any) => {
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

  app.patch("/api/projects/:id", requirePermission("edit_data"), async (req: any, res: any) => {
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

  app.delete("/api/projects/:id", requirePermission("edit_data"), async (req: any, res: any) => {
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

  // Task completion routes for multi-user tasks
  app.post("/api/tasks/:taskId/complete", async (req: any, res: any) => {
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
  app.delete("/api/tasks/:taskId/complete", async (req: any, res: any) => {
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
  app.get("/api/tasks/:taskId/completions", async (req: any, res: any) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const completions = await storage.getTaskCompletions(taskId);
      res.json(completions);
    } catch (error) {
      console.error("Error fetching completions:", error);
      res.status(500).json({ error: "Failed to fetch completions" });
    }
  });

  // Project Files
  app.post(
    "/api/projects/:id/files",
    projectFilesUpload.array("files"),
    async (req: any, res: any) => {
      try {
        const projectId = parseInt(req.params.id);
        if (isNaN(projectId)) {
          return res.status(400).json({ message: "Invalid project ID" });
        }

        const files = req.files as any[];
        if (!files || files.length === 0) {
          return res.status(400).json({ message: "No files uploaded" });
        }

        // Process uploaded files and return metadata
        const fileMetadata = files.map((file: any) => ({
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

  app.get("/api/projects/:id/files", async (req: any, res: any) => {
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
}
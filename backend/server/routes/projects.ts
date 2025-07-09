import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import path from "path";
import { storage } from "../storage-wrapper";
import { sanitizeMiddleware } from "../middleware/sanitizer";
import { insertProjectSchema, insertProjectTaskSchema, insertProjectCommentSchema } from "@shared/schema";

// Configure multer for file uploads
const taskUpload = multer({
  dest: 'uploads/tasks/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|csv|xlsx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      cb(null, true);
    } else {
      cb(new Error('Only images, PDFs, and documents are allowed'));
    }
  }
});

const router = Router();

// Project management routes
router.get("/projects", async (req, res) => {
  try {
    const projects = await storage.getAllProjects();
    res.json(projects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

router.get("/projects/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const project = await storage.getProject(id);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    res.json(project);
  } catch (error) {
    console.error("Error fetching project:", error);
    res.status(500).json({ error: "Failed to fetch project" });
  }
});

router.post("/projects", sanitizeMiddleware, async (req, res) => {
  try {
    const result = insertProjectSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.message });
    }
    const project = await storage.createProject(result.data);
    res.status(201).json(project);
  } catch (error) {
    console.error("Error creating project:", error);
    res.status(500).json({ error: "Failed to create project" });
  }
});

router.patch("/projects/:id", sanitizeMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates = req.body;
    const project = await storage.updateProject(id, updates);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    res.json(project);
  } catch (error) {
    console.error("Error updating project:", error);
    res.status(500).json({ error: "Failed to update project" });
  }
});

router.delete("/projects/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const success = await storage.deleteProject(id);
    if (!success) {
      return res.status(404).json({ error: "Project not found" });
    }
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting project:", error);
    res.status(500).json({ error: "Failed to delete project" });
  }
});

// Project Task routes
router.get("/projects/:projectId/tasks", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const tasks = await storage.getProjectTasks(projectId);
    res.json(tasks);
  } catch (error) {
    console.error("Error fetching project tasks:", error);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

router.post("/projects/:projectId/tasks", sanitizeMiddleware, async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const taskData = { ...req.body, projectId };
    const result = insertProjectTaskSchema.safeParse(taskData);
    if (!result.success) {
      return res.status(400).json({ error: result.error.message });
    }
    const task = await storage.createProjectTask(result.data);
    
    // Create task assignment notifications and emit WebSocket events
    if (task.assigneeIds && task.assigneeIds.length > 0) {
      const user = (req as any).user; // Standardized authentication
      
      for (const assigneeId of task.assigneeIds) {
        if (assigneeId && assigneeId.trim()) {
          try {
            // Create notification in database
            const notification = await storage.createNotification({
              userId: assigneeId,
              type: 'task_assignment',
              title: 'New Task Assignment',
              message: `${task.title} has been assigned to you`,
              relatedType: 'task',
              relatedId: task.id,
              isRead: false
            });

            // Emit WebSocket notification if available
            if (typeof (global as any).broadcastTaskAssignment === 'function') {
              (global as any).broadcastTaskAssignment(assigneeId, {
                type: 'task_assignment',
                message: 'You have been assigned a new task',
                taskId: task.id,
                taskTitle: task.title,
                notificationId: notification.id
              });
            }
          } catch (notificationError) {
            console.error(`Error creating notification for user ${assigneeId}:`, notificationError);
            // Don't fail task creation if notification fails
          }
        }
      }
    }
    
    res.status(201).json(task);
  } catch (error) {
    console.error("Error creating project task:", error);
    res.status(500).json({ error: "Failed to create task" });
  }
});

router.patch("/projects/:projectId/tasks/:taskId", sanitizeMiddleware, async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    const projectId = parseInt(req.params.projectId);
    const updates = req.body;
    
    console.log(`PATCH request - Task ID: ${taskId}, Project ID: ${projectId}`);
    console.log("Updates payload:", updates);
    
    // Get original task to compare assignees
    const originalTask = await storage.getProjectTask(taskId);
    
    const task = await storage.updateProjectTask(taskId, updates);
    if (!task) {
      console.log(`Task ${taskId} not found in database`);
      return res.status(404).json({ error: "Task not found" });
    }
    
    // Check if assignees were added (new assigneeIds that weren't in original)
    if (updates.assigneeIds && Array.isArray(updates.assigneeIds)) {
      const originalAssigneeIds = originalTask?.assigneeIds || [];
      const newAssigneeIds = updates.assigneeIds.filter(id => 
        id && id.trim() && !originalAssigneeIds.includes(id)
      );
      
      // Create notifications for newly assigned users
      if (newAssigneeIds.length > 0) {
        const user = (req as any).user; // Standardized authentication
        
        for (const assigneeId of newAssigneeIds) {
          try {
            // Create notification in database
            const notification = await storage.createNotification({
              userId: assigneeId,
              type: 'task_assignment',
              title: 'New Task Assignment',
              message: `${task.title} has been assigned to you`,
              relatedType: 'task',
              relatedId: task.id,
              isRead: false
            });

            // Emit WebSocket notification if available
            if (typeof (global as any).broadcastTaskAssignment === 'function') {
              (global as any).broadcastTaskAssignment(assigneeId, {
                type: 'task_assignment',
                message: 'You have been assigned a new task',
                taskId: task.id,
                taskTitle: task.title,
                notificationId: notification.id
              });
            }
          } catch (notificationError) {
            console.error(`Error creating notification for user ${assigneeId}:`, notificationError);
            // Don't fail task update if notification fails
          }
        }
      }
    }
    
    console.log(`Task ${taskId} updated successfully`);
    res.json(task);
  } catch (error) {
    console.error("Error updating project task:", error);
    res.status(500).json({ error: "Failed to update task" });
  }
});

router.delete("/projects/:projectId/tasks/:taskId", async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    const success = await storage.deleteProjectTask(taskId);
    if (!success) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting project task:", error);
    res.status(500).json({ error: "Failed to delete task" });
  }
});

// Get project congratulations
router.get("/projects/:projectId/congratulations", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const congratulations = await storage.getProjectCongratulations(projectId);
    res.json(congratulations);
  } catch (error) {
    console.error("Error fetching project congratulations:", error);
    res.status(500).json({ error: "Failed to fetch congratulations" });
  }
});

// Task file upload route
router.post("/projects/:projectId/tasks/:taskId/upload", taskUpload.array('files', 5), async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    // Get current task to append to existing attachments
    const task = await storage.getProjectTasks(parseInt(req.params.projectId));
    const currentTask = task.find(t => t.id === taskId);
    
    if (!currentTask) {
      return res.status(404).json({ error: "Task not found" });
    }

    // Parse existing attachments
    let existingAttachments = [];
    if (currentTask.attachments) {
      try {
        existingAttachments = JSON.parse(currentTask.attachments);
      } catch (e) {
        existingAttachments = [];
      }
    }

    // Add new file info
    const newAttachments = files.map(file => ({
      filename: file.filename,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      uploadedAt: new Date().toISOString()
    }));

    const allAttachments = [...existingAttachments, ...newAttachments];

    // Update task with new attachments
    const updatedTask = await storage.updateProjectTask(taskId, {
      attachments: JSON.stringify(allAttachments)
    });

    res.json({ task: updatedTask, uploadedFiles: newAttachments });
  } catch (error) {
    console.error("Error uploading task files:", error);
    res.status(500).json({ error: "Failed to upload files" });
  }
});

// Project Comment routes
router.get("/projects/:projectId/comments", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const comments = await storage.getProjectComments(projectId);
    res.json(comments);
  } catch (error) {
    console.error("Error fetching project comments:", error);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

router.post("/projects/:projectId/comments", sanitizeMiddleware, async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const commentData = { ...req.body, projectId };
    const result = insertProjectCommentSchema.safeParse(commentData);
    if (!result.success) {
      return res.status(400).json({ error: result.error.message });
    }
    const comment = await storage.createProjectComment(result.data);
    res.status(201).json(comment);
  } catch (error) {
    console.error("Error creating project comment:", error);
    res.status(500).json({ error: "Failed to create comment" });
  }
});

router.delete("/projects/:projectId/comments/:commentId", async (req, res) => {
  try {
    const commentId = parseInt(req.params.commentId);
    const success = await storage.deleteProjectComment(commentId);
    if (!success) {
      return res.status(404).json({ error: "Comment not found" });
    }
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting project comment:", error);
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

// Project assignments endpoints
router.get("/projects/:id/assignments", async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const assignments = await storage.getProjectAssignments(projectId);
    res.json(assignments);
  } catch (error) {
    console.error('Error fetching project assignments:', error);
    res.status(500).json({ error: 'Failed to fetch project assignments' });
  }
});

router.post("/projects/:id/assignments", async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const { userId, role, sendNotification } = req.body;
    
    const assignment = await storage.addProjectAssignment({
      projectId,
      userId,
      role: role || 'member'
    });

    // Send notification if requested
    if (sendNotification && assignment) {
      const project = await storage.getProject(projectId);
      const assignedUser = await storage.getUser(userId);
      
      if (project && assignedUser && assignedUser.email) {
        const { NotificationService } = await import('../notification-service');
        const { NotificationTypes } = await import('../../shared/notification-types');
        
        await NotificationService.sendProjectNotification(
          NotificationTypes.PROJECT_ASSIGNED,
          {
            projectId: project.id,
            projectTitle: project.title,
            assignedBy: 'Admin User', // TODO: Get from auth context
            assignedTo: [assignedUser.email]
          },
          [assignedUser.email]
        );
      }
    }

    res.json(assignment);
  } catch (error) {
    console.error('Error adding project assignment:', error);
    res.status(500).json({ error: 'Failed to add project assignment' });
  }
});

router.delete("/projects/:id/assignments/:userId", async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const userId = req.params.userId;
    
    const success = await storage.removeProjectAssignment(projectId, userId);
    
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Assignment not found' });
    }
  } catch (error) {
    console.error('Error removing project assignment:', error);
    res.status(500).json({ error: 'Failed to remove project assignment' });
  }
});

router.patch("/projects/:id/assignments/:userId", async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const userId = req.params.userId;
    const { role } = req.body;
    
    const assignment = await storage.updateProjectAssignment(projectId, userId, { role });
    
    if (assignment) {
      res.json(assignment);
    } else {
      res.status(404).json({ error: 'Assignment not found' });
    }
  } catch (error) {
    console.error('Error updating project assignment:', error);
    res.status(500).json({ error: 'Failed to update project assignment' });
  }
});

export { router as projectsRoutes };
import { Router } from "express";
import { z } from "zod";
import { workLogs } from "@shared/schema";
import { db } from "../db";
// Import the actual authentication middleware being used in the app
const isAuthenticated = (req: any, res: any, next: any) => {
  const user = req.user || req.session?.user;
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  req.user = user; // Ensure req.user is set
  next();
};

const router = Router();

// Zod schema for validation
const insertWorkLogSchema = z.object({
  description: z.string().min(1),
  hours: z.number().int().min(0),
  minutes: z.number().int().min(0).max(59)
});

// Middleware to check if user is super admin or admin
function isSuperAdmin(req) {
  return req.user?.role === "super_admin" || req.user?.role === "admin";
}

// Middleware to check if user can log work
function canLogWork(req) {
  // Allow admin, super_admin, or users with general permissions
  return req.user?.role === "admin" || req.user?.role === "super_admin" || req.user?.role === "work_logger";
}

// Get all logs (super admin) or own logs (regular user)
router.get("/work-logs", isAuthenticated, async (req, res) => {
  try {
    if (isSuperAdmin(req)) {
      const logs = await db.select().from(workLogs);
      return res.json(logs);
    } else {
      const logs = await db.select().from(workLogs).where(workLogs.userId.eq(req.user.id));
      return res.json(logs);
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch work logs" });
  }
});

// Create a new work log
router.post("/work-logs", isAuthenticated, async (req, res) => {
  if (!canLogWork(req)) return res.status(403).json({ error: "Insufficient permissions" });
  const result = insertWorkLogSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: result.error.message });
  try {
    const log = await db.insert(workLogs).values({
      userId: req.user.id,
      description: result.data.description,
      hours: result.data.hours,
      minutes: result.data.minutes
    }).returning();
    res.status(201).json(log[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to create work log" });
  }
});

// Update a work log (own or any if super admin)
router.put("/work-logs/:id", isAuthenticated, async (req, res) => {
  const logId = parseInt(req.params.id);
  if (isNaN(logId)) return res.status(400).json({ error: "Invalid log ID" });
  const result = insertWorkLogSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: result.error.message });
  try {
    // Only allow editing own log unless super admin
    const log = await db.select().from(workLogs).where(workLogs.id.eq(logId));
    if (!log[0]) return res.status(404).json({ error: "Work log not found" });
    if (!isSuperAdmin(req) && log[0].userId !== req.user.id) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    const updated = await db.update(workLogs).set({
      description: result.data.description,
      hours: result.data.hours,
      minutes: result.data.minutes
    }).where(workLogs.id.eq(logId)).returning();
    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to update work log" });
  }
});

// Delete a work log (own or any if super admin)
router.delete("/work-logs/:id", isAuthenticated, async (req, res) => {
  const logId = parseInt(req.params.id);
  if (isNaN(logId)) return res.status(400).json({ error: "Invalid log ID" });
  try {
    const log = await db.select().from(workLogs).where(workLogs.id.eq(logId));
    if (!log[0]) return res.status(404).json({ error: "Work log not found" });
    if (!isSuperAdmin(req) && log[0].userId !== req.user.id) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    await db.delete(workLogs).where(workLogs.id.eq(logId));
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete work log" });
  }
});

export default router; 
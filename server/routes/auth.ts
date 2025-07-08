import { storage } from "../storage-wrapper";
import { logger } from "../middleware/logger";

export function setupAuthRoutes(app: any, isAuthenticated: any, requirePermission: any) {
  // Auth routes - Fixed to work with temp auth system
  app.get("/api/auth/user", isAuthenticated, async (req: any, res: any) => {
    try {
      // Get user from session (temp auth) or req.user (Replit auth)
      const user = req.session?.user || req.user;
      
      if (!user) {
        return res.status(401).json({ message: "No user in session" });
      }

      // For temp auth, user is directly in session
      if (req.session?.user) {
        res.json(user);
        return;
      }

      // For Replit auth, get user from database
      const userId = req.user.claims?.sub || req.user.id;
      const dbUser = await storage.getUser(userId);
      res.json(dbUser || user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Debug endpoints for authentication troubleshooting
  app.get("/api/debug/session", async (req: any, res: any) => {
    try {
      const sessionUser = req.session?.user;
      const reqUser = req.user;
      
      res.json({
        hasSession: !!req.session,
        sessionId: req.sessionID,
        sessionUser: sessionUser ? {
          id: sessionUser.id,
          email: sessionUser.email,
          role: sessionUser.role,
          isActive: sessionUser.isActive
        } : null,
        reqUser: reqUser ? {
          id: reqUser.id,
          email: reqUser.email,
          role: reqUser.role,
          isActive: reqUser.isActive
        } : null,
        cookies: req.headers.cookie,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      });
    } catch (error) {
      console.error("Debug session error:", error);
      res.status(500).json({ error: "Failed to get session info" });
    }
  });

  // Debug endpoint to check authentication status
  app.get("/api/debug/auth-status", async (req: any, res: any) => {
    try {
      const user = req.session?.user || req.user;
      
      res.json({
        isAuthenticated: !!user,
        sessionExists: !!req.session,
        userInSession: !!req.session?.user,
        userInRequest: !!req.user,
        userId: user?.id || null,
        userEmail: user?.email || null,
        userRole: user?.role || null,
        sessionId: req.sessionID,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Debug auth status error:", error);
      res.status(500).json({ error: "Failed to get auth status" });
    }
  });
}
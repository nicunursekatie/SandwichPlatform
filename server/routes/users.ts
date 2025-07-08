import { storage } from "../storage-wrapper";
import { logger } from "../middleware/logger";

export function setupUserRoutes(app: any, isAuthenticated: any, requirePermission: any) {
  // User management routes
  app.get(
    "/api/users",
    isAuthenticated,
    requirePermission("view_users"),
    async (req: any, res: any) => {
      try {
        const users = await storage.getAllUsers();
        res.json(users);
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ message: "Failed to fetch users" });
      }
    },
  );

  app.patch(
    "/api/users/:id",
    isAuthenticated,
    requirePermission("manage_users"),
    async (req: any, res: any) => {
      try {
        const { id } = req.params;
        const { role, permissions } = req.body;
        const updatedUser = await storage.updateUser(id, { role, permissions });
        res.json(updatedUser);
      } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ message: "Failed to update user" });
      }
    },
  );

  app.patch(
    "/api/users/:id/status",
    isAuthenticated,
    requirePermission("manage_users"),
    async (req: any, res: any) => {
      try {
        const { id } = req.params;
        const { isActive } = req.body;
        const updatedUser = await storage.updateUser(id, { isActive });
        res.json(updatedUser);
      } catch (error) {
        console.error("Error updating user status:", error);
        res.status(500).json({ message: "Failed to update user status" });
      }
    },
  );

  app.delete(
    "/api/users/:id",
    isAuthenticated,
    requirePermission("manage_users"),
    async (req: any, res: any) => {
      try {
        const { id } = req.params;
        await storage.deleteUser(id);
        res.json({ success: true, message: "User deleted successfully" });
      } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ message: "Failed to delete user" });
      }
    },
  );
}
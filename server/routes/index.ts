
// Route aggregator - imports and sets up all modular routes
import { setupAuthRoutes } from "./auth";
import { setupUserRoutes } from "./users";
import { setupProjectRoutes } from "./projects";
import { setupCollectionRoutes } from "./collections";
import { setupHostRoutes } from "./hosts";

export function setupAllRoutes(app: any, isAuthenticated: any, requirePermission: any) {
  // Setup all route modules
  setupAuthRoutes(app, isAuthenticated, requirePermission);
  setupUserRoutes(app, isAuthenticated, requirePermission);
  setupProjectRoutes(app, isAuthenticated, requirePermission);
  setupCollectionRoutes(app, isAuthenticated, requirePermission);
  setupHostRoutes(app, isAuthenticated, requirePermission);
}

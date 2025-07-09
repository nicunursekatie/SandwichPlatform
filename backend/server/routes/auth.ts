import { Router } from "express";

const router = Router();

// Authentication routes
router.get("/auth/user", (req, res) => {
  // Mock user for development
  res.json({
    id: "1",
    email: "team@sandwichproject.org",
    firstName: "Team",
    lastName: "Member"
  });
});

export { router as authRoutes };

import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage-wrapper";

const router = Router();

// Get all conversations for a user
router.get("/conversations", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      console.log('DEBUG: No user ID found in request, user object:', (req as any).user);
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    const conversations = await storage.getUserConversations(userId);
    res.json(conversations);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// Create a new conversation
router.post("/conversations", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    console.log('DEBUG: POST /conversations - User object:', (req as any).user);
    console.log('DEBUG: POST /conversations - User ID:', userId);
    if (!userId) {
      console.log('DEBUG: POST /conversations - No user ID found, rejecting request');
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    const { type, name, participants } = req.body;
    
    const conversation = await storage.createConversation({
      type,
      name,
      createdBy: userId
    }, participants);
    
    res.status(201).json(conversation);
  } catch (error) {
    console.error("Error creating conversation:", error);
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

// Get messages for a conversation
router.get("/conversations/:id/messages", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      console.log('DEBUG: No user ID found in get messages, user object:', (req as any).user);
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    const conversationId = parseInt(req.params.id);
    const messages = await storage.getConversationMessages(conversationId);
    res.json(messages);
  } catch (error) {
    console.error("Error fetching conversation messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// Send message to conversation
router.post("/conversations/:id/messages", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      console.log('DEBUG: No user ID found in send message, user object:', (req as any).user);
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    const conversationId = parseInt(req.params.id);
    const { content } = req.body;
    
    if (!content?.trim()) {
      return res.status(400).json({ error: "Message content is required" });
    }
    
    const message = await storage.createConversationMessage({
      conversationId,
      userId,
      content: content.trim()
    });
    
    res.status(201).json(message);
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

export { router as conversationsRoutes };

import { storage } from "../storage-wrapper";
import { logger } from "../middleware/logger";
import { insertMessageSchema } from "@shared/schema";
import { eq, and, or, sql, desc, asc } from 'drizzle-orm';
import { db } from "../db";
import {
  conversations,
  conversationParticipants,
  messages as messagesTable,
  users,
} from "@shared/schema";

export function setupMessageRoutes(app: any, isAuthenticated: any, requirePermission: any) {
  // Messages - disable ALL caching middleware for this endpoint
  app.get("/api/messages", (req: any, res: any, next: any) => {
    // Completely disable caching at the Express level
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache'); 
    res.set('Expires', '0');
    res.set('Last-Modified', new Date().toUTCString()); // Force fresh response
    next();
  }, async (req: any, res: any) => {
    try {
      
      console.log(`[DEBUG] FULL URL: ${req.url}`);
      console.log(`[DEBUG] QUERY OBJECT:`, req.query);
      console.log(`[DEBUG] USER SESSION:`, req.user);
      
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
        const currentUserId = req.user?.id;
        console.log(`[DEBUG] Direct messages requested - currentUserId: ${currentUserId}, recipientId: ${recipientId}`);
        if (!currentUserId) {
          return res.status(401).json({ message: "Authentication required for direct messages" });
        }
        messages = await storage.getDirectMessages(currentUserId, recipientId);
        console.log(`[DEBUG] Direct messages found: ${messages.length} messages`);
      } else if (groupId) {
        // For group messages, use proper thread-based filtering
        const currentUserId = req.user?.id;
        if (!currentUserId) {
          console.log(`[DEBUG] No user authentication found for group ${groupId} request`);
          return res.status(401).json({ message: "Authentication required for group messages" });
        }
        
        console.log(`[DEBUG] Group messages requested - currentUserId: ${currentUserId}, groupId: ${groupId}`);
        
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
          
        console.log(`[DEBUG] Group messages found: ${messages.length} messages for conversation ${conversationId}`);
      } else if (messageContext) {
        // Temporarily use storage layer for all chat messages
        messages = await storage.getMessages(messageContext, limit);
      } else {
        messages = limit
          ? await storage.getRecentMessages(limit)
          : await storage.getAllMessages();
      }

      // Filter out empty or blank messages
      const filteredMessages = messages.filter((msg: any) => 
        msg && msg.content && msg.content.trim() !== ''
      );

      res.json(filteredMessages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/messages", requirePermission("send_messages"), async (req: any, res: any) => {
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

  app.delete("/api/messages/:id", requirePermission("send_messages"), async (req: any, res: any) => {
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

  // Legacy message endpoints - redirect to conversation system
  app.get("/api/messages", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user;
      if (!user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

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
        
        generalConversation = existingConversations[0];
      } catch (dbError) {
        console.error('Database query for conversations failed:', dbError);
        throw dbError;
      }

      if (!generalConversation) {
        try {
          const newConversationData = {
            type: 'channel',
            name: 'team-chat'
          };
          
          const newConversations = await db
            .insert(conversations)
            .values(newConversationData)
            .returning();
            
          generalConversation = newConversations[0];
        } catch (dbError) {
          console.error('Database insert for conversations failed:', dbError);
          throw dbError;
        }
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
      const formattedMessages = conversationMessages.map((msg: any) => ({
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

  app.post("/api/messages", isAuthenticated, async (req: any, res: any) => {
    console.log('=== POST /api/messages START ===');
    try {
      const user = req.user;
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
      if ((global as any).broadcastNewMessage) {
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
        (global as any).broadcastNewMessage(broadcastData);
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
        message: "Failed to send message",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Weekly Reports
  app.get("/api/weekly-reports", async (req: any, res: any) => {
    try {
      const reports = await storage.getAllWeeklyReports();
      res.json(reports);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch weekly reports" });
    }
  });

  app.post("/api/weekly-reports", async (req: any, res: any) => {
    try {
      const reportData = req.body; // insertWeeklyReportSchema.parse(req.body);
      const report = await storage.createWeeklyReport(reportData);
      res.status(201).json(report);
    } catch (error) {
      res.status(400).json({ message: "Invalid report data" });
    }
  });
}
import { Request, Response } from "express";
import { eq, sql, and } from "drizzle-orm";
import { messages, conversations, conversationParticipants } from "../../shared/schema";
import { db } from "../db";

// Helper function to check if user has permission for specific chat type
function checkUserChatPermission(user: any, chatType: string): boolean {
  if (!user || !user.permissions) return false;
  
  const permissions = user.permissions;
  
  switch (chatType) {
    case 'core_team':
      return permissions.includes('core_team_chat');
    case 'committee':
      return permissions.includes('committee_chat');
    case 'hosts':
      return permissions.includes('host_chat');
    case 'drivers':
      return permissions.includes('driver_chat');
    case 'recipients':
      return permissions.includes('recipient_chat');
    case 'direct':
      return permissions.includes('direct_messages');
    case 'groups':
      return permissions.includes('group_messages');
    case 'general':
      return permissions.includes('general_chat');
    default:
      return permissions.includes('general_chat');
  }
}

export const messageNotificationRoutes = {
  // Get unread message counts for a user
  getUnreadCounts: async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const user = (req as any).user;
      
      // Initialize counts
      let unreadCounts = {
        general: 0,
        committee: 0,
        hosts: 0,
        drivers: 0,
        recipients: 0,
        core_team: 0,
        direct: 0,
        groups: 0,
        total: 0
      };

      try {
        // Get basic message counts for conversations the user is a participant in
        const unreadConversationCounts = await db
          .select({
            conversationId: messages.conversationId,
            conversationType: conversations.type,
            conversationName: conversations.name,
            count: sql<number>`count(*)`
          })
          .from(messages)
          .innerJoin(conversations, eq(messages.conversationId, conversations.id))
          .innerJoin(conversationParticipants, and(
            eq(conversationParticipants.conversationId, conversations.id),
            eq(conversationParticipants.userId, userId)
          ))
          .where(
            sql`${messages.userId} != ${userId}` // Don't count own messages
          )
          .groupBy(messages.conversationId, conversations.type, conversations.name);

        // Process conversation counts by type
        for (const conversation of unreadConversationCounts) {
          const count = Number(conversation.count);
          
          if (conversation.conversationType === 'direct') {
            unreadCounts.direct += count;
          } else if (conversation.conversationType === 'group') {
            unreadCounts.groups += count;
          } else if (conversation.conversationType === 'channel') {
            // Map channel names to specific categories
            const name = conversation.conversationName?.toLowerCase() || '';
            if (name.includes('core team')) {
              unreadCounts.core_team += count;
            } else if (name.includes('committee')) {
              unreadCounts.committee += count;
            } else if (name.includes('host')) {
              unreadCounts.hosts += count;
            } else if (name.includes('driver')) {
              unreadCounts.drivers += count;
            } else if (name.includes('recipient')) {
              unreadCounts.recipients += count;
            } else {
              unreadCounts.general += count;
            }
          }
        }
        
        // Calculate total
        unreadCounts.total = unreadCounts.general + unreadCounts.committee + 
                           unreadCounts.hosts + unreadCounts.drivers + 
                           unreadCounts.recipients + unreadCounts.core_team + 
                           unreadCounts.direct + unreadCounts.groups;

      } catch (dbError) {
        console.error('Database query error in unread counts:', dbError);
        // Return fallback counts on database error
      }

      res.json(unreadCounts);
    } catch (error) {
      console.error("Error getting unread counts:", error);
      res.status(500).json({ error: "Failed to get unread counts" });
    }
  },

  // Mark messages as read when user views a chat
  markMessagesRead: async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { conversationId } = req.body;
      
      if (!conversationId) {
        return res.status(400).json({ error: "Conversation ID is required" });
      }

      // TODO: Implement read tracking when messageReads table is added
      res.json({ success: true, markedCount: 0 });
    } catch (error) {
      console.error("Error marking messages as read:", error);
      res.status(500).json({ error: "Failed to mark messages as read" });
    }
  },

  // Mark all messages as read for user
  markAllRead: async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // TODO: Implement when messageReads table is added
      res.json({ success: true, markedCount: 0 });
    } catch (error) {
      console.error("Error marking all messages as read:", error);
      res.status(500).json({ error: "Failed to mark all messages as read" });
    }
  }
};
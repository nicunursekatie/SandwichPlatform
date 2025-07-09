import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "./useAuth";

interface Message {
  id: number;
  userId?: string;
  timestamp: string;
}

export function useMessageReads() {
  const { user } = useAuth();

  // Mutation to mark messages as read
  const markMessagesReadMutation = useMutation({
    mutationFn: async ({ committee, messageIds }: { committee: string; messageIds?: number[] }) => {
      return apiRequest("POST", "/api/notifications/mark-read", { committee, messageIds });
    },
    onSuccess: () => {
      // Invalidate notification counts to update the bell icon
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-counts"] });
    },
    onError: (error) => {
      console.error("Failed to mark messages as read:", error);
    }
  });

  // Function to mark all messages in a committee as read
  const markCommitteeAsRead = (committee: string) => {
    if (!user) return;
    markMessagesReadMutation.mutate({ committee });
  };

  // Function to mark specific messages as read
  const markSpecificMessagesAsRead = (committee: string, messageIds: number[]) => {
    if (!user || messageIds.length === 0) return;
    markMessagesReadMutation.mutate({ committee, messageIds });
  };

  // Hook to automatically mark messages as read when viewing a chat
  const useAutoMarkAsRead = (committee: string, messages: Message[], enabled = true) => {
    useEffect(() => {
      if (!enabled || !user || !messages || messages.length === 0) return;

      // Filter out user's own messages and get only unread ones
      const otherUserMessages = messages.filter(msg => msg.userId !== user.id);
      
      if (otherUserMessages.length === 0) return;

      // Check if page is visible (not in background tab)
      const isPageVisible = () => !document.hidden;
      
      // Mark all visible messages as read after a delay, but only if page is visible
      const timeoutId = setTimeout(() => {
        if (isPageVisible()) {
          markCommitteeAsRead(committee);
        }
      }, 1500); // 1.5 second delay to ensure user is actually viewing

      // Also mark as read when user comes back to the tab
      const handleVisibilityChange = () => {
        if (isPageVisible()) {
          markCommitteeAsRead(committee);
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }, [committee, messages, enabled, user]);
  };

  return {
    markCommitteeAsRead,
    markSpecificMessagesAsRead,
    useAutoMarkAsRead,
    isMarkingAsRead: markMessagesReadMutation.isPending,
  };
}
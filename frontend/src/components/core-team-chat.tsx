import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Send,
  Crown,
  Shield,
  AlertTriangle,
  Users,
  Trash2,
  MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useMessageReads } from "@/hooks/useMessageReads";
import { hasPermission, PERMISSIONS } from "@shared/auth-utils";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Message {
  id: number;
  userId?: string;
  user_id?: string;
  content: string;
  createdAt?: string;
  timestamp?: string;
  conversationId?: number;
  sender?: string;
}

export default function CoreTeamChat() {
  const [message, setMessage] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Only allow users with core team chat access
  const hasCoreTeamAccess = hasPermission(user, "core_team_chat");

  // Initialize read tracking hook
  const { useAutoMarkAsRead } = useMessageReads();

  // Fetch all users for name lookups
  const { data: allUsers = [] } = useQuery({
    queryKey: ["/api/users"],
  });

  // Helper functions for user display
  const getUserDisplayName = (userId: string) => {
    const userFound = allUsers.find((u: any) => u.id === userId);
    if (userFound) {
      if (userFound.displayName) return userFound.displayName;
      if (userFound.firstName) return userFound.firstName;
      if (userFound.email) return userFound.email.split("@")[0];
    }
    return "Team Member";
  };

  const getUserInitials = (userId: string) => {
    const userFound = allUsers.find((u: any) => u.id === userId);
    if (userFound) {
      if (userFound.firstName && userFound.lastName) {
        return (userFound.firstName[0] + userFound.lastName[0]).toUpperCase();
      }
      if (userFound.firstName) {
        return userFound.firstName[0].toUpperCase();
      }
      if (userFound.email) {
        return userFound.email[0].toUpperCase();
      }
    }
    return "TM";
  };

  if (!hasCoreTeamAccess) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center text-red-600">
            <Shield className="w-5 h-5 mr-2" />
            Core Team Chat - Access Restricted
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-4" />
            <p className="text-slate-600">
              This chat is restricted to core team administrators only.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get or create Core Team conversation
  const { data: coreTeamConversation } = useQuery({
    queryKey: ["/api/conversations/core-team"],
    queryFn: async () => {
      console.log("[DEBUG] Core Team Chat: Starting conversation lookup...");

      // First try to find existing Core Team conversation
      const response = await apiRequest("GET", "/api/conversations");
      const conversations = await response.json();
      console.log("[DEBUG] Core Team Chat: All conversations:", conversations);

      const existing = conversations.find(
        (c: any) => c.type === "channel" && c.name === "Core Team",
      );
      console.log(
        "[DEBUG] Core Team Chat: Found existing conversation:",
        existing,
      );

      if (existing) {
        return existing;
      }

      console.log(
        "[DEBUG] Core Team Chat: Creating new Core Team conversation...",
      );
      // Create Core Team conversation if it doesn't exist
      const createResponse = await apiRequest("POST", "/api/conversations", {
        type: "channel",
        name: "Core Team",
      });
      console.log(
        "[DEBUG] Core Team Chat: Created conversation:",
        createResponse,
      );
      return createResponse;
    },
    enabled: !!user && hasCoreTeamAccess,
  });

  // Fetch core team messages from the new conversation system
  const {
    data: messages = [],
    isLoading: messagesLoading,
    error: messagesError,
  } = useQuery<Message[]>({
    queryKey: ["/api/conversations", coreTeamConversation?.id, "messages"],
    queryFn: async () => {
      if (!coreTeamConversation) return [];
      const response = await fetch(
        `/api/conversations/${coreTeamConversation.id}/messages`,
        {
          credentials: "include",
        },
      );
      if (!response.ok) {
        console.error("Failed to fetch Core Team messages:", response.status);
        throw new Error(`Failed to fetch messages: ${response.status}`);
      }
      const data = await response.json();
      console.log("Core Team messages response:", data);
      return Array.isArray(data) ? data : [];
    },
    enabled: !!coreTeamConversation,
    refetchInterval: 3000,
    onSuccess: (data) => {
      console.log("[DEBUG] Core Team Chat: Messages loaded:", data);
    },
    onError: (error) => {
      console.error("[DEBUG] Core Team Chat: Error loading messages:", error);
    },
  });

  console.log(
    "[DEBUG] Core Team Chat: Conversation ID:",
    coreTeamConversation?.id,
  );
  console.log("[DEBUG] Core Team Chat: Messages loading:", messagesLoading);
  console.log("[DEBUG] Core Team Chat: Messages error:", messagesError);
  console.log("[DEBUG] Core Team Chat: Messages count:", messages.length);
  const [optimisticMessages, setOptimisticMessages] = useState<
    Message[] | null
  >(null);
  const rawMessages = optimisticMessages || messages;

  // Display all messages that have content
  const displayedMessages = rawMessages.filter(
    (msg) => msg && msg.content && msg.content.trim() !== "",
  );

  console.log("🔧 DEBUG Filtering:");
  console.log("Raw messages count:", rawMessages?.length);
  console.log("Displayed messages count:", displayedMessages?.length);
  console.log("Sample raw message:", rawMessages?.[0]);
  console.log("Sample displayed message:", displayedMessages?.[0]);

  // Auto-mark messages as read when viewing
  useAutoMarkAsRead("core_team", messages, hasCoreTeamAccess);

  // Mark messages as read when conversation is selected
  useEffect(() => {
    if (coreTeamConversation && messages.length > 0) {
      queryClient.invalidateQueries({
        queryKey: ["/api/messages/unread-counts"],
      });
    }
  }, [coreTeamConversation, messages.length, queryClient]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!coreTeamConversation)
        throw new Error("Core Team conversation not found");
      return await apiRequest(
        "POST",
        `/api/conversations/${coreTeamConversation.id}/messages`,
        {
          content,
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", coreTeamConversation?.id, "messages"],
      });
      setMessage("");
    },
    onError: () => {
      toast({ title: "Failed to send message", variant: "destructive" });
    },
  });

  // Delete message mutation
  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: number) => {
      return await apiRequest("DELETE", `/api/messages/${messageId}`);
    },
    onMutate: async (messageId: number) => {
      setOptimisticMessages((prev) => {
        const base = prev || messages;
        return base.filter((m) => m.id !== messageId);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", coreTeamConversation?.id, "messages"],
      });
      setOptimisticMessages(null);
      toast({
        title: "Message deleted",
        description: "The message has been removed",
      });
    },
    onError: () => {
      setOptimisticMessages(null);
      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", coreTeamConversation?.id, "messages"],
      });
      toast({
        title: "Error",
        description: "Failed to delete message",
        variant: "destructive",
      });
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setOptimisticMessages(null);
    if (coreTeamConversation?.id) {
      console.log(
        "🔥 INVALIDATING Core Team messages cache for conversation:",
        coreTeamConversation.id,
      );
      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", coreTeamConversation.id, "messages"],
      });
    }
  }, [coreTeamConversation?.id]);

  const handleSendMessage = () => {
    if (!message.trim() || !coreTeamConversation) return;

    sendMessageMutation.mutate(message.trim());
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString();
    }
  };

  // Group messages by date using filtered displayedMessages
  const groupedMessages = displayedMessages.reduce(
    (groups: { [key: string]: Message[] }, message) => {
      const timestamp =
        message.timestamp || message.createdAt || new Date().toISOString();
      const date = formatDate(timestamp);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
      return groups;
    },
    {},
  );

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-slate-200 bg-gradient-to-r from-red-50 to-orange-50 p-4">
        <div className="flex items-center mb-2">
          <Crown className="w-5 h-5 mr-2 text-orange-600" />
          Core Team Chat
          <Badge variant="destructive" className="ml-2 text-xs">
            <Shield className="w-3 h-3 mr-1" />
            Admin Only
          </Badge>
        </div>
        <p className="text-sm text-slate-600 flex items-center">
          <Users className="w-4 h-4 mr-1" />
          Secure communication channel for core team administrators
        </p>
      </div>

      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full p-4">
          {Object.keys(groupedMessages).length === 0 ? (
            <div className="text-center py-8">
              <Crown className="w-12 h-12 mx-auto text-orange-400 mb-4" />
              <p className="text-slate-500 mb-2">
                Welcome to the Core Team Chat
              </p>
              <p className="text-xs text-slate-400">
                Secure communications for admin team coordination
              </p>
            </div>
          ) : (
            Object.entries(groupedMessages).map(([date, dateMessages]) => (
              <div key={date} className="mb-6">
                <div className="flex items-center justify-center mb-4">
                  <Badge variant="outline" className="text-xs">
                    {date}
                  </Badge>
                </div>

                {dateMessages.map((msg) => (
                  <div key={msg.id} className="flex items-start space-x-3 mb-4">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-orange-100 text-orange-700 text-xs">
                        {getUserInitials(msg.userId || msg.user_id || "")}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-sm text-slate-900">
                            {msg.sender ||
                              getUserDisplayName(
                                msg.userId || msg.user_id || "",
                              )}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            <Crown className="w-3 h-3 mr-1" />
                            Admin
                          </Badge>
                          <span className="text-xs text-slate-500">
                            {new Date(
                              msg.timestamp || msg.createdAt || new Date(),
                            ).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                            })}
                          </span>
                        </div>

                        {/* Show dropdown only for message owner or moderators */}
                        {((msg.userId || msg.user_id) === user?.id ||
                          hasPermission(user, "moderate_messages")) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 hover:bg-orange-100"
                              >
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  deleteMessageMutation.mutate(msg.id)
                                }
                                className="text-red-600 hover:text-red-700"
                                disabled={deleteMessageMutation.isPending}
                              >
                                <Trash2 className="h-3 w-3 mr-2" />
                                Delete Message
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>

                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                        <p className="text-sm text-slate-800 whitespace-pre-wrap">
                          {msg.content}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </ScrollArea>
      </div>

      <div className="border-t border-slate-200 p-4">
        <div className="flex space-x-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Send a secure message to the core team..."
            className="flex-1"
            disabled={sendMessageMutation.isPending}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!message.trim() || sendMessageMutation.isPending}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-slate-500 mt-2 flex items-center">
          <Shield className="w-3 h-3 mr-1" />
          Messages in this channel are only visible to core team administrators
        </p>
      </div>
    </div>
  );
}

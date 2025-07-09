import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, Heart, User, Trash2, MoreVertical, Edit } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Message {
  id: number;
  content: string;
  sender?: string;
  userId?: string;
  user_id?: string;
  createdAt?: string;
  created_at?: string;
}

export default function RecipientChat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check if user has Recipient Chat access
  const hasRecipientChatAccess = user?.permissions?.includes('recipient_chat') ||
    user?.role === 'admin' || 
    user?.role === 'admin_coordinator' ||
    user?.role === 'super_admin';

  // Get all conversations to find Recipient Chat
  const { data: conversations = [] } = useQuery({
    queryKey: ["/api/conversations"],
    queryFn: async () => {
      const response = await fetch("/api/conversations");
      if (!response.ok) {
        throw new Error("Failed to fetch conversations");
      }
      const data = await response.json();
      return data;
    },
    enabled: !!user && hasRecipientChatAccess,
  });

  // Find Recipient Chat conversation from the list
  const recipientConversation = conversations.find((c: any) => 
    c.type === 'channel' && c.name === 'Recipient Chat'
  );

  // Fetch recipient messages from the conversation system
  const { data: messages = [], isLoading: messagesLoading, error: messagesError } = useQuery<Message[]>({
    queryKey: ["/api/conversations", recipientConversation?.id, "messages"],
    queryFn: async () => {
      if (!recipientConversation?.id) {
        return [];
      }
      
      const response = await fetch(`/api/conversations/${recipientConversation.id}/messages`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to fetch Recipient messages:', errorText);
        throw new Error(`Failed to fetch messages: ${response.statusText}`);
      }
      const data = await response.json();
      return data;
    },
    enabled: !!recipientConversation?.id && hasRecipientChatAccess,
    refetchInterval: 5000,
  });

  // Post a message to Recipient Chat
  const postMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!recipientConversation?.id) {
        throw new Error("Recipient conversation not found");
      }
      
      const response = await apiRequest("POST", `/api/conversations/${recipientConversation.id}/messages`, {
        content
      });
      
      return response;
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", recipientConversation?.id, "messages"] });
    },
    onError: (error) => {
      console.error("Failed to post message:", error);
      toast({
        title: "Failed to send message",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Edit message mutation
  const editMessageMutation = useMutation({
    mutationFn: async ({ messageId, content }: { messageId: number; content: string }) => {
      const response = await apiRequest("PATCH", `/api/messages/${messageId}`, { content });
      return response;
    },
    onSuccess: () => {
      setEditingMessageId(null);
      setEditContent("");
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", recipientConversation?.id, "messages"] });
      toast({
        title: "Message updated",
        description: "Your message has been edited successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to edit message",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Delete message mutation
  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: number) => {
      const response = await apiRequest("DELETE", `/api/messages/${messageId}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", recipientConversation?.id, "messages"] });
      toast({
        title: "Message deleted",
        description: "Your message has been removed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete message",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Filter out null/undefined messages and ensure we have valid data
  const displayedMessages = (messages || []).filter((msg): msg is Message => {
    return msg && typeof msg === 'object' && 'content' in msg;
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayedMessages]);

  const handleSendMessage = () => {
    if (message.trim() && !postMessageMutation.isPending) {
      postMessageMutation.mutate(message.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const startEdit = (msg: Message) => {
    setEditingMessageId(msg.id);
    setEditContent(msg.content);
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditContent("");
  };

  const saveEdit = (messageId: number) => {
    if (editContent.trim()) {
      editMessageMutation.mutate({ messageId, content: editContent.trim() });
    }
  };

  const handleDelete = (messageId: number) => {
    if (window.confirm("Are you sure you want to delete this message?")) {
      deleteMessageMutation.mutate(messageId);
    }
  };

  if (!user || !hasRecipientChatAccess) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            Recipient Chat
          </CardTitle>
          <CardDescription>
            Access restricted to recipients and coordinators
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <Heart className="h-5 w-5" />
          Recipient Chat
        </CardTitle>
        <CardDescription>
          Communication channel for receiving organizations
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
          {messagesLoading && <div className="text-center text-muted-foreground">Loading messages...</div>}
          {messagesError && (
            <div className="text-center text-destructive">
              Error loading messages: {messagesError instanceof Error ? messagesError.message : 'Unknown error'}
            </div>
          )}
          {!messagesLoading && !messagesError && displayedMessages.length === 0 && (
            <div className="text-center text-muted-foreground">
              No messages yet. Start the conversation!
            </div>
          )}
          {displayedMessages.map((msg) => {
            const msgUserId = msg.userId || msg.user_id;
            const msgCreatedAt = msg.createdAt || msg.created_at;
            const isOwnMessage = msgUserId === user?.id;
            
            return (
              <div key={msg.id} className={`flex gap-3 ${isOwnMessage ? 'justify-end' : ''}`}>
                <div className={`flex gap-3 max-w-[80%] ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center">
                      {isOwnMessage ? (
                        <CheckCircle2 className="h-4 w-4 text-pink-600" />
                      ) : (
                        <Heart className="h-4 w-4 text-pink-600" />
                      )}
                    </div>
                  </div>
                  <div className={`space-y-1 ${isOwnMessage ? 'items-end' : ''}`}>
                    <div className={`flex items-center gap-2 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
                      <span className="text-sm font-medium">
                        {msg.sender || "Recipient"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {msgCreatedAt ? formatDistanceToNow(new Date(msgCreatedAt), { addSuffix: true }) : 'just now'}
                      </span>
                      {isOwnMessage && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <MoreVertical className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => startEdit(msg)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(msg.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                    {editingMessageId === msg.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="min-h-[60px]"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => saveEdit(msg.id)}
                            disabled={editMessageMutation.isPending}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelEdit}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className={`rounded-lg px-3 py-2 ${
                        isOwnMessage 
                          ? 'bg-pink-500 text-white' 
                          : 'bg-muted'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
        <div className="flex gap-2">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            className="min-h-[60px]"
            disabled={postMessageMutation.isPending}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!message.trim() || postMessageMutation.isPending}
            className="self-end bg-pink-500 hover:bg-pink-600"
          >
            Send
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
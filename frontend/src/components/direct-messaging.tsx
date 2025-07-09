import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Send, MessageCircle, User, Search, Trash2, Edit, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Message {
  id: number;
  userId: string;
  content: string;
  createdAt: string;
  conversationId: number;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface Conversation {
  id: number;
  type: string;
  name: string;
  createdAt: string;
}

export default function DirectMessaging() {
  const [message, setMessage] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch all users for selection
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Fetch user's conversations
  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
    enabled: !!user,
  });

  // Get or create conversation when user is selected
  useEffect(() => {
    const findOrCreateConversation = async () => {
      if (!selectedUser || !user) return;

      const userIds = [(user as any).id, selectedUser.id].sort();
      const conversationName = `${userIds[0]}_${userIds[1]}`;

      // Find existing conversation
      let conversation = conversations.find(c => 
        c.type === 'direct' && c.name === conversationName
      );

      if (conversation) {
        setCurrentConversation(conversation);
      } else {
        // Create new conversation
        try {
          console.log('Creating conversation with user:', (user as any)?.id, 'for selected user:', selectedUser.id);
          const response = await apiRequest('POST', '/api/conversations', {
            type: "direct",
            name: conversationName,
            participants: [(user as any).id, selectedUser.id]
          });
          const newConversation = await response.json();
          setCurrentConversation(newConversation);
          queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
        } catch (error) {
          console.error('Failed to create conversation:', error);
          if (error.message.includes('401')) {
            toast({ title: "Authentication error - please refresh the page", variant: "destructive" });
          } else {
            toast({ title: "Failed to create conversation", variant: "destructive" });
          }
          // Don't retry automatically to prevent infinite loops
          return;
        }
      }
    };

    // Add a small delay to prevent rapid-fire requests
    const timeoutId = setTimeout(findOrCreateConversation, 100);
    return () => clearTimeout(timeoutId);
  }, [selectedUser, user, conversations]);

  // Fetch messages for current conversation
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/conversations", currentConversation?.id, "messages"],
    queryFn: async () => {
      if (!currentConversation) return [];
      const response = await apiRequest("GET", `/api/conversations/${currentConversation.id}/messages`);
      return await response.json();
    },
    enabled: !!currentConversation,
    refetchInterval: 3000,
  });
  const [optimisticMessages, setOptimisticMessages] = useState<Message[] | null>(null);
  const displayedMessages = optimisticMessages || messages;

  useEffect(() => {
    setOptimisticMessages(null);
    if (currentConversation?.id) {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", currentConversation.id, "messages"] });
    }
  }, [currentConversation?.id]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!currentConversation) throw new Error("No conversation selected");
      const response = await apiRequest("POST", `/api/conversations/${currentConversation.id}/messages`, {
        content
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", currentConversation?.id, "messages"] });
      setMessage("");
    },
    onError: () => {
      toast({ title: "Failed to send message", variant: "destructive" });
    },
  });

  // Edit message mutation
  const editMessageMutation = useMutation({
    mutationFn: async ({ messageId, content }: { messageId: number; content: string }) => {
      const response = await apiRequest('PATCH', `/api/messages/${messageId}`, { content });
      return await response.json();
    },
    onSuccess: () => {
      if (currentConversation) {
        queryClient.invalidateQueries({ queryKey: ["/api/conversations", currentConversation.id, "messages"] });
      }
      setEditingMessage(null);
      setEditedContent("");
      toast({ title: "Message updated successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to edit message", variant: "destructive" });
    },
  });

  // Delete message mutation
  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: number) => {
      return await apiRequest('DELETE', `/api/messages/${messageId}`);
    },
    onMutate: async (messageId: number) => {
      setOptimisticMessages((prev) => {
        const base = prev || messages;
        return base.filter((m) => m.id !== messageId);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", currentConversation?.id, "messages"] });
      setOptimisticMessages(null);
      toast({
        title: "Message deleted",
        description: "The message has been removed",
      });
    },
    onError: () => {
      setOptimisticMessages(null);
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", currentConversation?.id, "messages"] });
      toast({
        title: "Error",
        description: "Failed to delete message",
        variant: "destructive",
      });
    }
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = () => {
    if (!message.trim() || !currentConversation) return;
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
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const handleEditMessage = (message: Message) => {
    setEditingMessage(message);
    setEditedContent(message.content);
  };

  const handleSaveEdit = () => {
    if (!editingMessage || !editedContent.trim()) return;
    editMessageMutation.mutate({
      messageId: editingMessage.id,
      content: editedContent,
    });
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setEditedContent("");
  };

  const handleDeleteMessage = (messageId: number) => {
    if (confirm("Are you sure you want to delete this message?")) {
      deleteMessageMutation.mutate(messageId);
    }
  };

  const canEditMessage = (message: Message) => {
    const currentUser = user as any;
    const isOwner = message.userId === currentUser?.id;
    const isSuperAdmin = currentUser?.role === "super_admin";
    const isAdmin = currentUser?.role === "admin";
    const hasModeratePermission = currentUser?.permissions?.includes("moderate_messages");

    return isOwner || isSuperAdmin || isAdmin || hasModeratePermission;
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

  // Filter users based on search
  const filteredUsers = users.filter(u => 
    u.id !== (user as any)?.id && // Don't show current user
    (u.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     u.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     u.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Group messages by date
  const groupedMessages = messages.reduce((groups: { [key: string]: Message[] }, message) => {
    const date = formatDate(message.createdAt);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {});

  return (
    <div className="h-full max-h-screen flex flex-col lg:flex-row">
      {/* User Selection Sidebar */}
      <div className="w-full lg:w-1/3 lg:border-r bg-gray-50 dark:bg-gray-900 flex flex-col lg:min-h-0">
        <div className="p-4 border-b border-slate-200">
          <h2 className="font-sub-heading text-lg mb-3">Direct Messages</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <ScrollArea className="h-[500px]">
          <div className="p-2">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <User className="w-12 h-12 mx-auto mb-2" />
                <p>No users found</p>
              </div>
            ) : (
              filteredUsers.map((u) => (
                <div
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  className={`flex items-center p-3 rounded-lg cursor-pointer hover:bg-slate-100 ${
                    selectedUser?.id === u.id ? 'bg-teal-50 border border-teal-200' : ''
                  }`}
                >
                  <Avatar className="w-10 h-10 mr-3">
                    <AvatarFallback className="bg-teal-100 text-teal-700">
                      {u.firstName?.[0]}{u.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-slate-900 truncate">
                      {u.firstName} {u.lastName}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{u.email}</p>
                    <Badge variant="secondary" className="text-xs mt-1">
                      {u.role}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {!selectedUser ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 mx-auto text-slate-400 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">Select a user to start messaging</h3>
              <p className="text-slate-500">Choose someone from the list to begin a direct conversation</p>
            </div>
          </div>
        ) : (
          <Card className="h-full flex flex-col">
            <CardHeader className="border-b border-slate-200 py-4">
              <CardTitle className="flex items-center">
                <Avatar className="w-8 h-8 mr-3">
                  <AvatarFallback className="bg-teal-100 text-teal-700">
                    {selectedUser.firstName?.[0]}{selectedUser.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{selectedUser.firstName} {selectedUser.lastName}</div>
                  <div className="text-sm text-slate-500">{selectedUser.email}</div>
                </div>
              </CardTitle>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col p-0">
              <ScrollArea className="flex-1 p-4">
                {Object.keys(groupedMessages).length === 0 ? (
                  <div className="text-center py-8">
                    <MessageCircle className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                    <p className="text-slate-500 mb-2">No messages yet</p>
                    <p className="text-xs text-slate-400">Start the conversation by sending a message below</p>
                  </div>
                ) : (
                  Object.entries(groupedMessages).map(([date, dateMessages]) => (
                    <div key={date} className="mb-6">
                      <div className="flex items-center justify-center mb-4">
                        <Badge variant="outline" className="text-xs">
                          {date}
                        </Badge>
                      </div>

                      {dateMessages.map((msg) => {
                        const isCurrentUser = msg.userId === (user as any)?.id;

                        return (
                          <div key={msg.id} className={`group flex items-start space-x-3 mb-4 ${isCurrentUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
                            <Avatar className="w-8 h-8">
                              <AvatarFallback className={`text-xs ${isCurrentUser ? 'bg-orange-100 text-orange-700' : 'bg-teal-100 text-teal-700'}`}>
                                {isCurrentUser 
                                  ? `${(user as any)?.firstName?.[0] || ''}${(user as any)?.lastName?.[0] || ''}`.toUpperCase()
                                  : `${selectedUser?.firstName?.[0] || ''}${selectedUser?.lastName?.[0] || ''}`.toUpperCase()
                                }
                              </AvatarFallback>
                            </Avatar>

                            <div className={`flex-1 min-w-0 ${isCurrentUser ? 'text-right' : ''}`}>
                              <div className={`flex items-center space-x-2 mb-1 ${isCurrentUser ? 'justify-end' : ''}`}>
                                <span className="font-medium text-sm text-slate-900">
                                  {isCurrentUser ? 'You' : `${selectedUser?.firstName} ${selectedUser?.lastName}`}
                                </span>
                                <span className="text-xs text-slate-500">
                                  {formatTime(msg.createdAt)}
                                </span>

                                {canEditMessage(msg) && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 text-slate-500 hover:text-slate-700"
                                      >
                                        <MoreVertical className="w-3 h-3" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align={isCurrentUser ? "end" : "start"} sideOffset={5}>
                                      <DropdownMenuItem
                                        onClick={() => handleEditMessage(msg)}
                                        className="text-blue-600 hover:text-blue-700"
                                      >
                                        <Edit className="w-3 h-3 mr-2" />
                                        Edit message
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => handleDeleteMessage(msg.id)}
                                        className="text-red-600 hover:text-red-700"
                                      >
                                        <Trash2 className="w-3 h-3 mr-2" />
                                        Delete message
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>

                              {editingMessage?.id === msg.id ? (
                                <div className="w-full max-w-xs">
                                  <Textarea
                                    value={editedContent}
                                    onChange={(e) => setEditedContent(e.target.value)}
                                    className="mb-2 min-h-[80px] text-sm"
                                    placeholder="Edit your message..."
                                  />
                                  <div className="flex gap-2 justify-end">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={handleCancelEdit}
                                      disabled={editMessageMutation.isPending}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={handleSaveEdit}
                                      disabled={!editedContent.trim() || editMessageMutation.isPending}
                                      className="bg-blue-600 hover:bg-blue-700 text-white"
                                    >
                                      {editMessageMutation.isPending ? "Saving..." : "Save"}
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className={`${isCurrentUser ? 'bg-orange-50 border border-orange-200' : 'bg-slate-50 border border-slate-200'} rounded-lg p-3 inline-block max-w-xs`}>
                                  <p className="text-sm text-slate-800 whitespace-pre-wrap">
                                    {msg.content}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </ScrollArea>

              <div className="border-t border-slate-200 p-4">
                <div className="flex space-x-2">
                  <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={selectedUser ? `Message ${selectedUser.firstName}...` : "Type a message..."}
                    className="flex-1"
                    disabled={sendMessageMutation.isPending}
                  />
                  <Button 
                    onClick={handleSendMessage}
                    disabled={!message.trim() || sendMessageMutation.isPending || !currentConversation}
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
                {selectedUser && (
                  <p className="text-xs text-slate-500 mt-2">
                    Direct messages are private between you and {selectedUser.firstName}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
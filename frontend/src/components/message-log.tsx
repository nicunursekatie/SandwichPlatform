import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MessageCircle, Send, Hash, MessageSquare, ChevronRight, Settings, User, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { insertMessageSchema, type Message } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";

const messageFormSchema = z.object({
  content: z.string().min(1, "Message content is required"),
  sender: z.string().optional() // Optional since we'll use userName
});

type MessageFormData = z.infer<typeof messageFormSchema>;

interface MessageLogProps {
  chatType?: string;
}

export default function MessageLog({ chatType }: MessageLogProps = {}) {
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [userName, setUserName] = useState("");
  const [isNameDialogOpen, setIsNameDialogOpen] = useState(false);
  const [tempUserName, setTempUserName] = useState("");
  const { user } = useAuth();

  // Load user name from localStorage on component mount
  useEffect(() => {
    const savedName = localStorage.getItem('chatUserName');
    if (savedName) {
      setUserName(savedName);
    }
  }, []);

  const saveUserName = () => {
    if (tempUserName.trim()) {
      const trimmedName = tempUserName.trim();
      setUserName(trimmedName);
      localStorage.setItem('chatUserName', trimmedName);
      setIsNameDialogOpen(false);
      setTempUserName("");
      toast({
        title: "Name saved",
        description: `Your chat name has been set to "${trimmedName}".`,
      });
    }
  };
  
  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: chatType ? ["/api/messages", { chatType }] : ["/api/messages"],
    queryFn: async () => {
      const url = chatType ? `/api/messages?chatType=${chatType}` : '/api/messages';
      const response = await fetch(url, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch messages');
      return response.json();
    }
  });
  const [optimisticMessages, setOptimisticMessages] = useState<Message[] | null>(null);

  const displayedMessages = optimisticMessages || messages;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Group messages into threads - only show root messages, not replies
  const rootMessages = displayedMessages.filter(m => !m.parentId);
  const getThreadReplies = (threadId: number) => 
    displayedMessages.filter(m => m.threadId === threadId && m.parentId);
  
  const getLatestReply = (threadId: number) => {
    const replies = getThreadReplies(threadId);
    return replies.length > 0 ? replies[replies.length - 1] : null;
  };

  const form = useForm<MessageFormData>({
    resolver: zodResolver(messageFormSchema),
    defaultValues: {
      content: ""
    }
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: MessageFormData) => {
      console.log('=== FRONTEND: Sending message ===');
      console.log('Message data being sent:', data);
      console.log('API endpoint: POST /api/messages');
      
      try {
        const result = await apiRequest("POST", "/api/messages", data);
        console.log('API response received:', result);
        return result;
      } catch (error) {
        console.error('API request failed:', error);
        console.error('Error details:', {
          message: error.message,
          status: error.status,
          response: error.response
        });
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log('Message sent successfully:', data);
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      form.reset({
        content: ""
      });
      setReplyingTo(null);
      toast({
        title: "Message sent",
        description: "Your message has been added to the team chat."
      });
    },
    onError: (error) => {
      console.error('Message sending failed:', error);
      toast({
        title: "Error",
        description: `Failed to send message: ${error.message || 'Unknown error'}`,
        variant: "destructive"
      });
    }
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: number) => {
      return apiRequest('DELETE', `/api/messages/${messageId}`);
    },
    onMutate: async (messageId: number) => {
      // Optimistically remove the message from the UI
      setOptimisticMessages((prev) => {
        const base = prev || messages;
        return base.filter((m) => m.id !== messageId);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      setOptimisticMessages(null);
      toast({
        title: "Message deleted",
        description: "The message has been removed from the chat.",
      });
    },
    onError: (error, messageId, context) => {
      // Roll back optimistic update
      setOptimisticMessages(null);
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      toast({
        title: "Delete failed",
        description: "Could not delete the message. Please try again.",
        variant: "destructive"
      });
    }
  });

  const onSubmit = (data: MessageFormData) => {
    console.log('=== FORM SUBMIT ===');
    console.log('Form data received:', data);
    console.log('Current userName:', userName);
    console.log('Is replying to:', replyingTo);

    if (!user?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to send messages.",
        variant: "destructive"
      });
      return;
    }

    const messageData = {
      content: data.content,
      sender: userName || data.sender || "Anonymous",
      userId: user.id, // Add userId to payload
    };

    if (replyingTo) {
      // For replies, we need to handle this differently since we're using the new system
      console.log('Reply functionality needs to be updated for new messaging system');
      toast({
        title: "Reply not supported yet",
        description: "Reply functionality is being updated for the new messaging system.",
        variant: "destructive"
      });
      return;
    }

    console.log('Final message data to send:', JSON.stringify(messageData));
    console.log('About to call sendMessageMutation.mutate...');

    sendMessageMutation.mutate(messageData);
  };

  const handleReply = (message: Message) => {
    setReplyingTo(message);
    // Focus on input field would be nice but we'll keep it simple
  };

  const formatMessageTime = (timestamp: string | Date) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return "now";
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
    
    // Show time for today, date for older
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getInitials = (name: string) => {
    if (!name || typeof name !== 'string') return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getAvatarColor = (name: string) => {
    if (!name || typeof name !== 'string') return 'bg-gray-500';
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-red-500', 
      'bg-yellow-500', 'bg-indigo-500', 'bg-pink-500', 'bg-teal-500'
    ];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  const getDisplayName = (message: any) => {
    if (message.sender && message.sender.trim()) {
      return message.sender;
    }
    if (message.userId) {
      // Create a friendly fallback name from userId
      if (message.userId.includes('backup_restored')) {
        return 'Admin User';
      }
      if (message.userId.includes('user_')) {
        return 'Team Member';
      }
      return message.userId.substring(0, 12) + '...';
    }
    return 'Anonymous';
  };



  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="h-6 bg-slate-200 rounded animate-pulse"></div>
        </div>
        <div className="p-6 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-2">
              <div className="h-4 bg-slate-200 rounded animate-pulse"></div>
              <div className="h-3 bg-slate-100 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-0 flex-1 flex flex-col max-h-screen">
      {/* Chat Header - Slack style */}
      <div className="px-2 sm:px-4 py-3 border-b border-slate-200 flex items-center flex-shrink-0">
        <Hash className="w-4 h-4 text-slate-500 mr-2" />
        <h2 className="text-base sm:text-lg font-bold text-slate-900">team-chat</h2>
        <div className="ml-auto flex items-center gap-1 sm:gap-3">
          {userName && (
            <div className="hidden sm:flex items-center gap-2 px-2 sm:px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs sm:text-sm">
              <User className="w-3 sm:w-4 h-3 sm:h-4" />
              <span className="hidden md:inline">{userName}</span>
            </div>
          )}
          <Dialog open={isNameDialogOpen} onOpenChange={setIsNameDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className="text-xs sm:text-sm px-2 sm:px-3"
                onClick={() => {
                  setTempUserName(userName);
                  setIsNameDialogOpen(true);
                }}
              >
                <Settings className="w-3 sm:w-4 h-3 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">{userName ? "Change Name" : "Set Name"}</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Set Your Chat Name</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="username">Display Name</Label>
                  <Input
                    id="username"
                    value={tempUserName}
                    onChange={(e) => setTempUserName(e.target.value)}
                    placeholder="Enter your name for chat messages"
                    onKeyPress={(e) => e.key === 'Enter' && saveUserName()}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsNameDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={saveUserName} disabled={!tempUserName.trim()}>
                    Save Name
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <div className="text-xs text-slate-500">
            {displayedMessages.length} {displayedMessages.length === 1 ? 'message' : 'messages'}
          </div>
        </div>
      </div>

      {/* Chat Messages - Slack style */}
      <div className="flex-1 overflow-y-auto px-2 sm:px-4 py-2 min-h-0">
        {displayedMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageCircle className="w-12 h-12 text-slate-300 mb-4" />
            <div className="text-xl font-bold text-slate-900 mb-2">Welcome to #team-chat</div>
            <div className="text-slate-600 max-w-md">
              This is the beginning of your team conversation. Share updates, coordinate projects, and stay connected.
            </div>
          </div>
        )}
        
        {rootMessages.map((message, index) => {
          const prevMessage = index > 0 ? rootMessages[index - 1] : null;
          const isSameSender = prevMessage?.sender === message.sender && getDisplayName(prevMessage) === getDisplayName(message);
          const timeDiff = prevMessage ? 
            new Date(message.timestamp).getTime() - new Date(prevMessage.timestamp).getTime() : 
            Number.MAX_SAFE_INTEGER;
          const shouldShowAvatar = !isSameSender || timeDiff > 300000; // 5 minutes
          
          const threadReplies = getThreadReplies(message.threadId || message.id);
          const latestReply = getLatestReply(message.threadId || message.id);
          const hasReplies = threadReplies.length > 0;

          return (
            <div key={message.id} className={`group hover:bg-slate-50 px-2 py-1 rounded ${shouldShowAvatar ? 'mt-4' : 'mt-0.5'}`}>
              <div className="flex items-start">
                {shouldShowAvatar ? (
                  <Avatar className={`w-9 h-9 mr-3 ${getAvatarColor(getDisplayName(message))}`}>
                    <AvatarFallback className="text-white text-sm font-medium">
                      {getInitials(getDisplayName(message))}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="w-9 mr-3 flex items-center justify-center">
                    <span className="text-xs text-slate-400 opacity-0 group-hover:opacity-100">
                      {formatMessageTime(message.timestamp)}
                    </span>
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  {shouldShowAvatar && (
                    <div className="flex items-baseline mb-1">
                      <span className="font-bold text-slate-900 text-sm mr-2">
                        {getDisplayName(message)}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatMessageTime(message.timestamp)}
                      </span>
                    </div>
                  )}
                  <div className="text-slate-800 text-sm leading-relaxed break-words mb-1">
                    {message.content}
                  </div>
                  
                  {/* Message actions */}
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-slate-500 hover:text-slate-700"
                      onClick={() => handleReply(message)}
                    >
                      <MessageSquare className="w-3 h-3 mr-1" />
                      Reply
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-slate-500 hover:text-red-600"
                      onClick={() => deleteMessageMutation.mutate(message.id)}
                      disabled={deleteMessageMutation.isPending}
                      title="Delete message"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>

                  {/* Thread replies preview */}
                  {hasReplies && (
                    <div className="mt-2 border-l-2 border-slate-200 pl-3 ml-1">
                      <div className="flex items-center gap-2 text-xs text-slate-600 mb-1">
                        <MessageSquare className="w-3 h-3" />
                        <span className="font-medium">
                          {threadReplies.length} {threadReplies.length === 1 ? 'reply' : 'replies'}
                        </span>
                        {latestReply && (
                          <span>Last reply {formatMessageTime(latestReply.timestamp)}</span>
                        )}
                      </div>
                      
                      {/* Show latest reply preview */}
                      {latestReply && (
                        <div className="group/reply flex items-start gap-2 text-sm hover:bg-slate-100 -mx-2 px-2 py-1 rounded">
                          <Avatar className={`w-6 h-6 ${getAvatarColor(latestReply.sender)}`}>
                            <AvatarFallback className="text-white text-xs">
                              {getInitials(latestReply.sender)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-slate-900 text-xs mr-1">
                              {latestReply.sender}
                            </span>
                            <span className="text-slate-700 text-xs">
                              {latestReply.content.length > 100 
                                ? latestReply.content.substring(0, 100) + "..." 
                                : latestReply.content}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 text-slate-400 hover:text-red-600 opacity-0 group-hover/reply:opacity-100 transition-opacity"
                            onClick={() => deleteMessageMutation.mutate(latestReply.id)}
                            disabled={deleteMessageMutation.isPending}
                            title="Delete reply"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                      
                      {/* Show all replies if there are more than one */}
                      {threadReplies.length > 1 && (
                        <div className="mt-2 space-y-1">
                          {threadReplies.slice(0, -1).map((reply) => (
                            <div key={reply.id} className="group/reply flex items-start gap-2 text-sm hover:bg-slate-100 -mx-2 px-2 py-1 rounded">
                              <Avatar className={`w-6 h-6 ${getAvatarColor(reply.sender)}`}>
                                <AvatarFallback className="text-white text-xs">
                                  {getInitials(reply.sender)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-slate-900 text-xs mr-1">
                                  {reply.sender}
                                </span>
                                <span className="text-slate-700 text-xs">
                                  {reply.content.length > 100 
                                    ? reply.content.substring(0, 100) + "..." 
                                    : reply.content}
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 text-slate-400 hover:text-red-600 opacity-0 group-hover/reply:opacity-100 transition-opacity"
                                onClick={() => deleteMessageMutation.mutate(reply.id)}
                                disabled={deleteMessageMutation.isPending}
                                title="Delete reply"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input - Slack style */}
      <div className="border-t border-slate-200 p-2 sm:p-4 flex-shrink-0">
        {/* Reply indicator */}
        {replyingTo && (
          <div className="mb-3 p-2 bg-slate-50 border-l-4 border-blue-500 rounded-r">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-slate-600">
                  Replying to <span className="font-medium">{replyingTo.sender}</span>
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-slate-400 hover:text-slate-600"
                onClick={() => setReplyingTo(null)}
              >
                ×
              </Button>
            </div>
            <div className="text-sm text-slate-700 mt-1 truncate">
              {replyingTo.content.length > 100 
                ? replyingTo.content.substring(0, 100) + "..." 
                : replyingTo.content}
            </div>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <div className="flex items-end gap-2">
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <div className="relative">
                        <Input
                          placeholder={replyingTo ? `Reply to ${replyingTo.sender}...` : "Message #team-chat"}
                          {...field}
                          className="pr-10 resize-none border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              form.handleSubmit(onSubmit)();
                            }
                          }}
                        />
                        <Button 
                          type="submit" 
                          disabled={sendMessageMutation.isPending || !form.watch("content").trim()}
                          size="sm"
                          className="absolute right-1 top-1 h-8 w-8 p-0 bg-blue-600 hover:bg-blue-700"
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}

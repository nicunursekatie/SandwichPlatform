import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Send, Users, MessageCircle, ChevronLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useMessageReads } from "@/hooks/useMessageReads";

interface Message {
  id: number;
  sender: string;
  content: string;
  timestamp: Date;
  committee: string;
  parentId: number | null;
  threadId: number | null;
  replyCount: number;
}

const committees = [
  { 
    id: "marketing_committee", 
    name: "Marketing Committee", 
    description: "Marketing campaigns and promotions"
  },
  { 
    id: "grant_committee", 
    name: "Grant Committee", 
    description: "Grant applications and funding"
  },
  { 
    id: "group_events", 
    name: "Group Events", 
    description: "Team events and activities"
  },
  { 
    id: "finance_committee", 
    name: "Finance Committee", 
    description: "Budget and financial planning"
  },
  { 
    id: "operations", 
    name: "Operations", 
    description: "Daily operations and logistics"
  }
];

export default function CommitteeChat() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedCommittee, setSelectedCommittee] = useState<any>(null);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Initialize read tracking hook
  const { useAutoMarkAsRead } = useMessageReads();

  // Get user profile for display name
  const { data: userProfile } = useQuery({
    queryKey: ["/api/auth/profile"],
    enabled: !!user,
  });

  // Get user name from profile or fallback to email prefix
  const getUserName = () => {
    if (userProfile && typeof userProfile === 'object') {
      const profile = userProfile as any;
      if (profile.displayName) {
        return profile.displayName;
      }
      if (profile.firstName) {
        return profile.firstName;
      }
    }
    if (user && typeof user === 'object' && 'email' in user && user.email) {
      return String(user.email).split('@')[0];
    }
    return 'Team Member';
  };

  // Get or create committee conversation
  const { data: committeeConversation } = useQuery({
    queryKey: ["/api/conversations/committee", selectedCommittee?.id],
    queryFn: async () => {
      if (!selectedCommittee) return null;
      const response = await apiRequest('POST', '/api/conversations', {
        type: 'channel',
        name: `${selectedCommittee.name}`
      });
      return response;
    },
    enabled: !!selectedCommittee,
  });

  // Fetch messages for committee conversation
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/conversations", committeeConversation?.id, "messages"],
    enabled: !!committeeConversation,
    refetchInterval: 3000,
  });
  const [optimisticMessages, setOptimisticMessages] = useState<Message[] | null>(null);
  const displayedMessages = optimisticMessages || messages;

  // Auto-mark messages as read when viewing committee
  useAutoMarkAsRead(
    selectedCommittee?.id || "", 
    messages, 
    !!selectedCommittee
  );

  useEffect(() => {
    setOptimisticMessages(null);
    if (committeeConversation?.id) {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", committeeConversation.id, "messages"] });
    }
  }, [committeeConversation?.id]);

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { content: string }) => {
      if (!committeeConversation) throw new Error("No conversation available");
      return await apiRequest('POST', `/api/conversations/${committeeConversation.id}/messages`, {
        content: data.content
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", committeeConversation?.id, "messages"] });
      setNewMessage("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    }
  });

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
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", committeeConversation?.id, "messages"] });
      setOptimisticMessages(null);
      toast({
        title: "Message deleted",
        description: "The message has been removed",
      });
    },
    onError: () => {
      setOptimisticMessages(null);
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", committeeConversation?.id, "messages"] });
      toast({
        title: "Error",
        description: "Failed to delete message",
        variant: "destructive",
      });
    }
  });

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    sendMessageMutation.mutate({
      content: newMessage.trim()
    });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!selectedCommittee) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-6 flex items-center">
          <Users className="w-6 h-6 mr-2" />
          Committee Chat
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {committees.map((committee) => (
            <div
              key={committee.id}
              onClick={() => setSelectedCommittee(committee)}
              className="p-6 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
            >
              <div className="flex items-center mb-3">
                <Users className="w-8 h-8 text-blue-500 mr-3" />
                <div>
                  <h3 className="font-semibold">{committee.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{committee.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[600px] bg-white dark:bg-gray-900 border rounded-lg">
      {/* Header */}
      <div className="border-b p-4 flex items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedCommittee(null)}
          className="mr-3"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center">
          <Users className="w-8 h-8 text-blue-500 mr-3" />
          <div>
            <h3 className="font-semibold">{selectedCommittee.name}</h3>
            <p className="text-xs text-gray-600">Committee Chat</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-4">
          {displayedMessages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            displayedMessages.map((message: Message) => (
              <div key={message.id} className="flex space-x-3 group">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-gray-500 text-white text-xs">
                    {message.sender?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || 'TM'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-sm">{message.sender}</span>
                      <span className="text-xs text-gray-500">
                        {message.timestamp && !isNaN(new Date(message.timestamp).getTime()) 
                          ? new Date(message.timestamp).toLocaleTimeString()
                          : 'Just now'
                        }
                      </span>
                    </div>
                    {/* Only show delete button for user's own messages */}
                    {message.sender === getUserName() && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMessageMutation.mutate(message.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        disabled={deleteMessageMutation.isPending}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                    <p className="text-sm">{message.content}</p>
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input */}
      <div className="border-t p-4 space-y-3">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-600">Posting as:</span>
          <span className="text-sm font-semibold text-gray-800">{getUserName()}</span>
        </div>
        <div className="flex space-x-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={`Message ${selectedCommittee.name}...`}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            disabled={sendMessageMutation.isPending}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || sendMessageMutation.isPending}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
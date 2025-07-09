import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useMessageReads } from "@/hooks/useMessageReads";
import { MessageCircle, Plus, Users, Send, Crown, Trash2, UserPlus, Edit, MoreVertical, Archive, LogOut, VolumeX, Eye, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { MessageGroup, InsertMessageGroup, GroupMembership, Message, User } from "@shared/schema";
import { PERMISSIONS } from "@shared/auth-utils";

interface GroupWithMembers extends MessageGroup {
  memberCount: number;
  userRole: string;
  members?: Array<{
    userId: string;
    role: string;
    firstName: string;
    lastName: string;
    email: string;
  }>;
}

interface GroupMessagesProps {
  currentUser: any;
}

export function GroupMessaging({ currentUser }: GroupMessagesProps) {
  const [selectedGroup, setSelectedGroup] = useState<GroupWithMembers | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [showMemberDialog, setShowMemberDialog] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [groupForm, setGroupForm] = useState({
    name: "",
    description: "",
    memberIds: [] as string[]
  });
  const [addMemberForm, setAddMemberForm] = useState({
    memberIds: [] as string[]
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Initialize read tracking hook
  const { useAutoMarkAsRead } = useMessageReads();

  // Helper functions for user display
  const getUserDisplayName = (userId: string) => {
    const userFound = allUsers.find((u: any) => u.id === userId);
    if (userFound) {
      if (userFound.displayName) return userFound.displayName;
      if (userFound.firstName) return userFound.firstName;
      if (userFound.email) return userFound.email.split('@')[0];
    }
    return 'Member';
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
    return 'M';
  };

  // Fetch user's message groups from conversations table
  const { data: groups = [], isLoading: groupsLoading, error: groupsError } = useQuery<GroupWithMembers[]>({
    queryKey: ["/api/conversations/groups"],
    queryFn: async () => {
      console.log("🔍 Fetching groups from API...");
      const response = await fetch('/api/conversations?type=group', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch groups: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("🔍 Raw API response:", data);
      
      const mappedGroups = data.map((conv: any) => ({
        id: conv.id,
        name: conv.name,
        description: conv.description || "",
        memberCount: conv.memberCount || 0,
        userRole: "member",
        isActive: true,
        createdAt: conv.createdAt,
        createdBy: conv.createdBy || "system"
      }));
      console.log("🔍 Mapped groups:", mappedGroups);
      return mappedGroups;
    },
    refetchOnMount: true,
    refetchOnWindowFocus: false
  });

  // Fetch all users for member selection
  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Fetch group members when a group is selected
  const { data: groupMembers = [] } = useQuery<Array<{
    userId: string;
    role: string;
    firstName: string;
    lastName: string;
    email: string;
  }>>({
    queryKey: ["/api/conversations", selectedGroup?.id, "participants"],
    queryFn: async () => {
      if (!selectedGroup) return [];
      const response = await fetch(`/api/conversations/${selectedGroup.id}/participants`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch participants: ${response.status}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!selectedGroup,
  });

  // Use the selected group as the conversation directly
  const groupConversation = selectedGroup ? {
    id: selectedGroup.id,
    name: selectedGroup.name,
    type: 'group'
  } : null;

  // Fetch messages for group conversation
  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["/api/conversations", groupConversation?.id, "messages"],
    queryFn: async () => {
      if (!groupConversation) return [];
      const response = await fetch(`/api/conversations/${groupConversation.id}/messages`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.status}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!groupConversation,
    refetchInterval: 3000,
  });
  const [optimisticMessages, setOptimisticMessages] = useState<Message[] | null>(null);
  const displayedMessages = optimisticMessages || messages;

  useEffect(() => {
    setOptimisticMessages(null);
    if (groupConversation?.id) {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", groupConversation.id, "messages"] });
    }
  }, [groupConversation?.id]);

  // Auto-mark group messages as read when viewing group
  useAutoMarkAsRead(
    "groups", 
    displayedMessages, 
    !!selectedGroup
  );

  // Create new group mutation
  const createGroupMutation = useMutation({
    mutationFn: async (data: InsertMessageGroup & { memberIds: string[] }) => {
      const response = await fetch("/api/message-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create group");
      return response.json();
    },
    onSuccess: (newGroup) => {
      queryClient.invalidateQueries({ queryKey: ["/api/message-groups"] });
      setGroupForm({ name: "", description: "", memberIds: [] });
      setShowCreateDialog(false);
      setSelectedGroup(newGroup);
      toast({ title: "Group created successfully!" });
      
      // Send congratulations notification through the notification system
      fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser?.id,
          type: "success",
          title: "Group Created Successfully!",
          message: `🎉 You've successfully created the "${newGroup.name}" group. Start collaborating with your team members!`,
          data: { groupId: newGroup.id, action: "group_created" }
        }),
      }).catch(err => console.log("Notification failed:", err));
      
      // Also send a welcome message to the group
      fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `Welcome to ${newGroup.name}! This group was created by ${currentUser?.firstName || currentUser?.email}. Let's start collaborating! 🚀`,
          committee: `group_${newGroup.id}`,
          sender: "System"
        }),
      }).catch(err => console.log("Welcome message failed:", err));
    },
  });

  // Add members to group mutation
  const addMembersMutation = useMutation({
    mutationFn: async (data: { groupId: number; memberIds: string[] }) => {
      const response = await fetch(`/api/message-groups/${data.groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ memberIds: data.memberIds }),
      });
      if (!response.ok) throw new Error("Failed to add members");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/message-groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/message-groups", selectedGroup?.id, "members"] });
      setAddMemberForm({ memberIds: [] });
      setShowAddMemberDialog(false);
      toast({ title: "Members added successfully!" });
    },
  });

  // Send message mutation  
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { content: string }) => {
      if (!groupConversation) throw new Error("No conversation available");
      return await apiRequest('POST', `/api/conversations/${groupConversation.id}/messages`, {
        content: data.content
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", groupConversation?.id, "messages"] });
      setNewMessage("");
    },
  });

  // Edit message mutation
  const editMessageMutation = useMutation({
    mutationFn: async ({ messageId, content }: { messageId: number; content: string }) => {
      return await apiRequest('PATCH', `/api/messages/${messageId}`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", groupConversation?.id, "messages"] });
      setEditingMessage(null);
      setEditedContent("");
      toast({ title: "Message updated successfully!" });
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
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", groupConversation?.id, "messages"] });
      setOptimisticMessages(null);
      toast({
        title: "Message deleted",
        description: "The message has been removed",
      });
    },
    onError: () => {
      setOptimisticMessages(null);
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", groupConversation?.id, "messages"] });
      toast({
        title: "Error",
        description: "Failed to delete message",
        variant: "destructive",
      });
    }
  });

  // Thread status management mutations
  const updateThreadStatusMutation = useMutation({
    mutationFn: async ({ threadId, status }: { threadId: number; status: string }) => {
      const response = await fetch(`/api/threads/${threadId}/my-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Failed to update thread status");
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/message-groups"] });
      const statusLabels = {
        archived: "archived",
        left: "left",
        muted: "muted",
        active: "restored"
      };
      toast({ 
        title: `Thread ${statusLabels[variables.status as keyof typeof statusLabels]}!`,
        description: variables.status === 'left' 
          ? "You have left this conversation and will no longer receive messages."
          : variables.status === 'archived' 
          ? "This conversation has been archived and moved to your archived folder."
          : variables.status === 'muted'
          ? "You will no longer receive notifications from this conversation."
          : "This conversation has been restored to your active conversations."
      });
      
      // If user left or archived the thread, deselect it
      if (variables.status === 'left' || variables.status === 'archived') {
        setSelectedGroup(null);
      }
    },
  });



  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async ({ groupId, userId }: { groupId: number; userId: string }) => {
      const response = await fetch(`/api/message-groups/${groupId}/members/${userId}`, {
        method: "DELETE",
        credentials: 'include'
      });
      if (!response.ok) throw new Error("Failed to remove member");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/message-groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/message-groups", selectedGroup?.id, "members"] });
      toast({ title: "Member removed successfully!" });
    },
  });

  // Promote member to admin mutation
  const promoteMemberMutation = useMutation({
    mutationFn: async ({ groupId, userId, role }: { groupId: number; userId: string; role: 'admin' | 'member' }) => {
      const response = await fetch(`/api/message-groups/${groupId}/members/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ role }),
      });
      if (!response.ok) throw new Error("Failed to update member role");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/message-groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/message-groups", selectedGroup?.id, "members"] });
      toast({ title: "Member role updated successfully!" });
    },
  });

  // Delete entire group mutation (super admin only)
  const deleteGroupMutation = useMutation({
    mutationFn: async (groupId: number) => {
      const response = await fetch(`/api/message-groups/${groupId}`, {
        method: "DELETE",
        credentials: 'include',
      });
      if (!response.ok) throw new Error("Failed to delete group");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/message-groups"] });
      setSelectedGroup(null);
      toast({ title: "Group deleted successfully!", description: "The entire group and all messages have been permanently removed." });
    },
    onError: () => {
      toast({ title: "Failed to delete group", variant: "destructive" });
    },
  });

  const handleCreateGroup = () => {
    if (!groupForm.name.trim()) {
      toast({ title: "Group name is required", variant: "destructive" });
      return;
    }
    createGroupMutation.mutate({
      ...groupForm,
      createdBy: currentUser?.id || "",
    });
  };

  const handleAddMembers = () => {
    if (!selectedGroup || addMemberForm.memberIds.length === 0) {
      toast({ title: "Please select members to add", variant: "destructive" });
      return;
    }
    addMembersMutation.mutate({
      groupId: selectedGroup.id,
      memberIds: addMemberForm.memberIds,
    });
  };

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    
    sendMessageMutation.mutate({
      content: newMessage,
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

  // Thread management handlers
  const handleArchiveThread = (threadId: number) => {
    updateThreadStatusMutation.mutate({ threadId, status: 'archived' });
  };

  const handleLeaveThread = (threadId: number) => {
    if (confirm("Are you sure you want to leave this conversation? You won't be able to see new messages.")) {
      updateThreadStatusMutation.mutate({ threadId, status: 'left' });
    }
  };

  const handleMuteThread = (threadId: number) => {
    updateThreadStatusMutation.mutate({ threadId, status: 'muted' });
  };

  const handleUnmuteThread = (threadId: number) => {
    updateThreadStatusMutation.mutate({ threadId, status: 'active' });
  };

  const canEditMessage = (message: Message) => {
    // Message owner can always edit their own messages
    if (message.userId === currentUser?.id) {
      return true;
    }
    
    // Super admins can moderate any message
    if (currentUser?.permissions?.includes(PERMISSIONS.MODERATE_MESSAGES)) {
      return true;
    }
    
    return false;
  };

  const formatDisplayName = (user: any) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.email;
  };

  const getInitials = (user: any) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user.email[0].toUpperCase();
  };



  if (groupsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <MessageCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          <p className="text-gray-500">Loading groups...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full max-h-screen flex flex-col lg:flex-row">
      {/* Groups sidebar */}
      <div className="w-full lg:w-1/3 lg:border-r bg-gray-50 dark:bg-gray-900 flex flex-col lg:min-h-0">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Message Groups</h3>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  New Group
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Message Group</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Group Name</label>
                    <Input
                      value={groupForm.name}
                      onChange={(e) => setGroupForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter group name"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Description (Optional)</label>
                    <Textarea
                      value={groupForm.description}
                      onChange={(e) => setGroupForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Enter group description"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Add Members</label>
                    <Select onValueChange={(userId) => {
                      if (!groupForm.memberIds.includes(userId)) {
                        setGroupForm(prev => ({ 
                          ...prev, 
                          memberIds: [...prev.memberIds, userId] 
                        }));
                      }
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select users to add" />
                      </SelectTrigger>
                      <SelectContent>
                        {allUsers
                          .filter(user => user.id !== currentUser?.id && !groupForm.memberIds.includes(user.id))
                          .map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {formatDisplayName(user)}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {groupForm.memberIds.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {groupForm.memberIds.map((userId) => {
                          const user = allUsers.find(u => u.id === userId);
                          return (
                            <Badge key={userId} variant="secondary" className="text-xs">
                              {user ? formatDisplayName(user) : userId}
                              <button
                                onClick={() => setGroupForm(prev => ({
                                  ...prev,
                                  memberIds: prev.memberIds.filter(id => id !== userId)
                                }))}
                                className="ml-1 text-red-500 hover:text-red-700"
                              >
                                ×
                              </button>
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleCreateGroup}
                      disabled={createGroupMutation.isPending}
                    >
                      Create Group
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-2">
            {groups.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">No groups yet</p>
                <p className="text-xs">Create your first group to get started</p>

              </div>
            ) : (
              groups.map((group) => (
                <Card
                  key={group.id}
                  className={`cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 ${
                    selectedGroup?.id === group.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => setSelectedGroup(group)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium truncate">{group.name}</h4>
                          {group.userRole === 'admin' && (
                            <Crown className="h-3 w-3 text-yellow-500" />
                          )}
                        </div>
                        {group.description && (
                          <p className="text-xs text-gray-500 truncate">{group.description}</p>
                        )}
                        <div className="flex items-center gap-1 mt-1">
                          <Users className="h-3 w-3 text-gray-400" />
                          <button 
                            className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedGroup(group);
                              setShowMemberDialog(true);
                            }}
                          >
                            {group.memberCount} members
                          </button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-h-0">
        {selectedGroup ? (
          <>
            {/* Group header */}
            <div className="p-4 border-b bg-white dark:bg-gray-800">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    {selectedGroup.name}
                    {(selectedGroup.userRole === 'admin' || selectedGroup.userRole === 'moderator' || currentUser?.role === 'super_admin') && (
                      <Crown className="h-4 w-4 text-yellow-500" />
                    )}
                  </h3>
                  {selectedGroup.description && (
                    <p className="text-sm text-gray-500">{selectedGroup.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <button 
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded"
                      onClick={() => setShowMemberDialog(true)}
                    >
                      <Users className="h-3 w-3" />
                      {selectedGroup.memberCount} members
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    <Users className="h-3 w-3 mr-1" />
                    {selectedGroup.memberCount} members
                  </Badge>
                  
                  {/* Thread Management Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        onClick={() => handleArchiveThread(selectedGroup.id)}
                        disabled={updateThreadStatusMutation.isPending}
                      >
                        <Archive className="h-4 w-4 mr-2" />
                        Archive Thread
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleMuteThread(selectedGroup.id)}
                        disabled={updateThreadStatusMutation.isPending}
                      >
                        <VolumeX className="h-4 w-4 mr-2" />
                        Mute Notifications
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleLeaveThread(selectedGroup.id)}
                        disabled={updateThreadStatusMutation.isPending}
                        className="text-red-600 hover:text-red-700"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Leave Conversation
                      </DropdownMenuItem>
                      {currentUser?.role === 'super_admin' && (
                        <DropdownMenuItem 
                          onClick={() => {
                            if (confirm(`⚠️ DANGER: Delete entire group "${selectedGroup.name}"?\n\nThis will permanently delete:\n• All messages in this group\n• All member information\n• The entire conversation thread\n\nThis action CANNOT be undone. Are you absolutely sure?`)) {
                              deleteGroupMutation.mutate(selectedGroup.id);
                            }
                          }}
                          disabled={deleteGroupMutation.isPending}
                          className="text-red-700 hover:text-red-800 font-semibold border-t"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Entire Group
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {(currentUser?.role === 'super_admin' || selectedGroup.userRole === 'admin' || selectedGroup.userRole === 'moderator' || selectedGroup.userRole === 'member') && (
                    <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <UserPlus className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Members to {selectedGroup.name}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium">Select Members to Add</label>
                            <Select onValueChange={(userId) => {
                              const existingMemberIds = groupMembers.map(m => m.userId);
                              if (!addMemberForm.memberIds.includes(userId) && !existingMemberIds.includes(userId)) {
                                setAddMemberForm(prev => ({ 
                                  memberIds: [...prev.memberIds, userId] 
                                }));
                              }
                            }}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select users to add" />
                              </SelectTrigger>
                              <SelectContent>
                                {allUsers
                                  .filter(user => {
                                    const existingMemberIds = groupMembers.map(m => m.userId);
                                    return user.id !== currentUser?.id && 
                                           !addMemberForm.memberIds.includes(user.id) &&
                                           !existingMemberIds.includes(user.id);
                                  })
                                  .map((user) => (
                                    <SelectItem key={user.id} value={user.id}>
                                      {formatDisplayName(user)}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                            {addMemberForm.memberIds.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {addMemberForm.memberIds.map((userId) => {
                                  const user = allUsers.find(u => u.id === userId);
                                  return (
                                    <Badge key={userId} variant="secondary" className="text-xs">
                                      {user ? formatDisplayName(user) : userId}
                                      <button
                                        onClick={() => setAddMemberForm(prev => ({
                                          memberIds: prev.memberIds.filter(id => id !== userId)
                                        }))}
                                        className="ml-1 text-red-500 hover:text-red-700"
                                      >
                                        ×
                                      </button>
                                    </Badge>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              onClick={handleAddMembers}
                              disabled={addMembersMutation.isPending || addMemberForm.memberIds.length === 0}
                            >
                              Add Members
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {displayedMessages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MessageCircle className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm">No messages yet</p>
                    <p className="text-xs">Start the conversation!</p>
                  </div>
                ) : (
                  displayedMessages.map((message) => (
                    <div key={message.id} className="group relative">
                      <div className="flex gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {getUserInitials(message.userId)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{getUserDisplayName(message.userId)}</span>
                            <span className="text-xs text-gray-500">
                              {new Date(message.createdAt).toLocaleTimeString()}
                            </span>
                            {canEditMessage(message) && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <MoreVertical className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleEditMessage(message)}>
                                    <Edit className="h-3 w-3 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => handleDeleteMessage(message.id)}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="h-3 w-3 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                          {editingMessage?.id === message.id ? (
                            <div className="space-y-2">
                              <Textarea
                                value={editedContent}
                                onChange={(e) => setEditedContent(e.target.value)}
                                className="text-sm"
                                rows={2}
                              />
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  onClick={handleSaveEdit}
                                  disabled={editMessageMutation.isPending}
                                >
                                  Save
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={handleCancelEdit}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm bg-gray-100 dark:bg-gray-700 rounded-lg p-2">
                              {message.content}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            {/* Message input */}
            <div className="p-4 border-t bg-white dark:bg-gray-800">
              <div className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sendMessageMutation.isPending}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 mx-auto mb-3" />
              <h3 className="text-lg font-medium mb-1">Select a group to start messaging</h3>
              <p className="text-sm">Choose a group from the sidebar or create a new one</p>
            </div>
          </div>
        )}
      </div>

      {/* Member Management Dialog */}
      <Dialog open={showMemberDialog} onOpenChange={setShowMemberDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Group Members - {selectedGroup?.name}</DialogTitle>
            <DialogDescription>
              View and manage group members. Admins can add or remove members.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Current Members */}
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Current Members ({groupMembers.length})
              </h4>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {groupMembers.map((member) => (
                  <div key={member.userId} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {member.firstName?.[0]?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">
                          {member.firstName} {member.lastName}
                        </div>
                        <div className="text-sm text-gray-500">{member.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {member.role === 'admin' && (
                        <Badge variant="secondary" className="text-xs">
                          <Crown className="h-3 w-3 mr-1" />
                          Admin
                        </Badge>
                      )}
                      {/* Platform super admin or group admin can manage members */}
                      {(currentUser?.role === 'super_admin' || selectedGroup?.userRole === 'admin' || selectedGroup?.userRole === 'moderator') && (
                        <div className="flex items-center gap-1">
                          {/* Role Management Dropdown */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm">
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {member.role === 'member' ? (
                                <DropdownMenuItem 
                                  onClick={() => {
                                    if (confirm(`Promote ${member.firstName} ${member.lastName} to group admin?`)) {
                                      promoteMemberMutation.mutate({
                                        groupId: selectedGroup.id,
                                        userId: member.userId,
                                        role: 'admin'
                                      });
                                    }
                                  }}
                                  disabled={promoteMemberMutation.isPending}
                                >
                                  <Crown className="h-3 w-3 mr-2" />
                                  Promote to Admin
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem 
                                  onClick={() => {
                                    if (confirm(`Demote ${member.firstName} ${member.lastName} to regular member?`)) {
                                      promoteMemberMutation.mutate({
                                        groupId: selectedGroup.id,
                                        userId: member.userId,
                                        role: 'member'
                                      });
                                    }
                                  }}
                                  disabled={promoteMemberMutation.isPending}
                                >
                                  <Crown className="h-3 w-3 mr-2" />
                                  Demote to Member
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem 
                                onClick={() => {
                                  if (confirm(`Remove ${member.firstName} ${member.lastName} from this group?`)) {
                                    removeMemberMutation.mutate({
                                      groupId: selectedGroup.id,
                                      userId: member.userId,
                                    });
                                  }
                                }}
                                disabled={removeMemberMutation.isPending}
                                className="text-red-600"
                              >
                                <X className="h-3 w-3 mr-2" />
                                Remove Member
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Add Members Section (Platform super admin or any group member can add) */}
            {(currentUser?.role === 'super_admin' || selectedGroup?.userRole === 'admin' || selectedGroup?.userRole === 'moderator' || selectedGroup?.userRole === 'member') && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Add New Members
                </h4>
                <div className="space-y-3">
                  <Select
                    value=""
                    onValueChange={(userId) => {
                      if (userId && !addMemberForm.memberIds.includes(userId)) {
                        setAddMemberForm(prev => ({
                          memberIds: [...prev.memberIds, userId]
                        }));
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select users to add..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allUsers
                        .filter(user => 
                          !groupMembers.some(member => member.userId === user.id) &&
                          !addMemberForm.memberIds.includes(user.id)
                        )
                        .map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.firstName} {user.lastName} ({user.email})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>

                  {/* Selected Users to Add */}
                  {addMemberForm.memberIds.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Selected to add:</p>
                      <div className="flex flex-wrap gap-2">
                        {addMemberForm.memberIds.map((userId) => {
                          const user = allUsers.find(u => u.id === userId);
                          return (
                            <Badge key={userId} variant="secondary" className="flex items-center gap-1">
                              {user?.firstName} {user?.lastName}
                              <X
                                className="h-3 w-3 cursor-pointer"
                                onClick={() => {
                                  setAddMemberForm(prev => ({
                                    memberIds: prev.memberIds.filter(id => id !== userId)
                                  }));
                                }}
                              />
                            </Badge>
                          );
                        })}
                      </div>
                      <Button
                        onClick={handleAddMembers}
                        disabled={addMembersMutation.isPending}
                        className="w-full"
                      >
                        {addMembersMutation.isPending ? "Adding..." : `Add ${addMemberForm.memberIds.length} Member(s)`}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
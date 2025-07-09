import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useCelebration, CelebrationToast } from "@/components/celebration-toast";
import { hasPermission, USER_ROLES, PERMISSIONS, getDefaultPermissionsForRole, getRoleDisplayName } from "@shared/auth-utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Users, Shield, Settings, Key, Award, Megaphone, Trash2, Bug } from "lucide-react";
import AnnouncementManager from "@/components/announcement-manager";
import AuthDebug from "@/components/auth-debug";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  permissions: string[];
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const { celebration, triggerCelebration, hideCelebration } = useCelebration();
  const [activeTab, setActiveTab] = useState<"users" | "announcements" | "auth-debug">("users");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editingRole, setEditingRole] = useState<string>("");
  const [editingPermissions, setEditingPermissions] = useState<string[]>([]);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState<string>("");

  // Check if current user can manage users
  if (!hasPermission(currentUser, PERMISSIONS.MANAGE_USERS)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Access Denied
          </CardTitle>
          <CardDescription>
            You don't have permission to manage users.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: hasPermission(currentUser, PERMISSIONS.VIEW_USERS),
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: { userId: string; role: string; permissions: string[] }) => {
      return apiRequest("PATCH", `/api/users/${data.userId}`, {
        role: data.role,
        permissions: data.permissions,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User Updated",
        description: "User permissions have been successfully updated.",
      });
      setSelectedUser(null);
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleUserStatus = useMutation({
    mutationFn: async (data: { userId: string; isActive: boolean }) => {
      return apiRequest("PATCH", `/api/users/${data.userId}/status`, {
        isActive: data.isActive,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User Status Updated",
        description: "User status has been successfully changed.",
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: { userEmail: string; newPassword: string }) => {
      return apiRequest("PUT", "/api/auth/admin/reset-password", {
        userEmail: data.userEmail,
        newPassword: data.newPassword,
      });
    },
    onSuccess: () => {
      toast({
        title: "Password Reset",
        description: `Password has been successfully reset.`,
      });
      setResetPasswordUser(null);
      setNewPassword("");
    },
    onError: (error) => {
      toast({
        title: "Reset Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("DELETE", `/api/users/${userId}`);
    },
    onSuccess: () => {
      // Force a complete refetch of the users list
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.refetchQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User Deleted",
        description: "User has been successfully deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setEditingRole(user.role);
    setEditingPermissions(user.permissions || []);
  };

  const handleRoleChange = (role: string) => {
    setEditingRole(role);
    setEditingPermissions(getDefaultPermissionsForRole(role));
  };

  const handlePermissionToggle = (permission: string) => {
    setEditingPermissions(prev => 
      prev.includes(permission)
        ? prev.filter(p => p !== permission)
        : [...prev, permission]
    );
  };

  const handleSaveChanges = () => {
    if (!selectedUser) return;
    
    updateUserMutation.mutate({
      userId: selectedUser.id,
      role: editingRole,
      permissions: editingPermissions,
    });
  };

  const handleResetPassword = () => {
    if (!resetPasswordUser || !newPassword) return;
    
    resetPasswordMutation.mutate({
      userEmail: resetPasswordUser.email,
      newPassword: newPassword,
    });
  };

  const handleCongratulateUser = (user: User) => {
    const achievements = [
      "making a real difference in our mission",
      "way to go"
    ];
    
    const randomAchievement = achievements[Math.floor(Math.random() * achievements.length)];
    const congratsMessage = `${user.firstName} ${user.lastName} - ${randomAchievement}! From ${currentUser?.firstName || 'Admin'}`;
    
    triggerCelebration(congratsMessage);
    
    toast({
      title: "Congratulations Sent!",
      description: `Celebrated ${user.firstName} ${user.lastName}'s achievements.`,
    });
  };

  const handleDeleteUser = (user: User) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${user.firstName} ${user.lastName}? This action cannot be undone.`
    );
    
    if (confirmDelete) {
      deleteUserMutation.mutate(user.id);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case USER_ROLES.ADMIN:
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case USER_ROLES.COMMITTEE_MEMBER:
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case USER_ROLES.VOLUNTEER:
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case USER_ROLES.VIEWER:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab("users")}
            className={`py-2 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
              activeTab === "users"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            <Users className="h-4 w-4 inline mr-1 sm:mr-2" />
            <span className="hidden sm:inline">User Management</span>
            <span className="sm:hidden">Users</span>
          </button>
          <button
            onClick={() => setActiveTab("announcements")}
            className={`py-2 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
              activeTab === "announcements"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            <Megaphone className="h-4 w-4 inline mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Announcements</span>
            <span className="sm:hidden">Announce</span>
          </button>
          <button
            onClick={() => setActiveTab("auth-debug")}
            className={`py-2 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
              activeTab === "auth-debug"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            <Bug className="h-4 w-4 inline mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Auth Debug</span>
            <span className="sm:hidden">Debug</span>
          </button>
        </nav>
      </div>

      {activeTab === "announcements" ? (
        <AnnouncementManager />
      ) : activeTab === "auth-debug" ? (
        <AuthDebug />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Management
            </CardTitle>
            <CardDescription>
              Manage user roles and permissions for team members
            </CardDescription>
          </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getRoleBadgeColor(user.role)}>
                      {getRoleDisplayName(user.role)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? "default" : "secondary"}>
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.lastLoginAt 
                      ? new Date(user.lastLoginAt).toLocaleDateString() + ' ' + 
                        new Date(user.lastLoginAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : <span className="text-gray-500 italic">Never</span>
                    }
                  </TableCell>
                  <TableCell>
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Dialog 
                        open={selectedUser?.id === user.id} 
                        onOpenChange={(open) => {
                          if (!open) {
                            setSelectedUser(null);
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditUser(user)}
                          >
                            <Settings className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                          <DialogHeader>
                            <DialogTitle>Edit User Permissions</DialogTitle>
                            <DialogDescription>
                              Modify role and permissions for {user.firstName} {user.lastName}
                            </DialogDescription>
                          </DialogHeader>
                          
                          <div className="space-y-6 overflow-y-auto flex-1 pr-2">
                            <div>
                              <Label htmlFor="role">Role</Label>
                              <Select
                                value={editingRole}
                                onValueChange={handleRoleChange}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={USER_ROLES.ADMIN}>Administrator</SelectItem>
                                  <SelectItem value={USER_ROLES.COMMITTEE_MEMBER}>Committee Member</SelectItem>
                                  <SelectItem value={USER_ROLES.HOST}>Host</SelectItem>
                                  <SelectItem value={USER_ROLES.DRIVER}>Driver</SelectItem>
                                  <SelectItem value={USER_ROLES.RECIPIENT}>Recipient</SelectItem>
                                  <SelectItem value={USER_ROLES.VOLUNTEER}>Volunteer</SelectItem>
                                  <SelectItem value={USER_ROLES.VIEWER}>Viewer</SelectItem>
                                  <SelectItem value={USER_ROLES.WORK_LOGGER}>Work Logger</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-6">
                              {/* Chat Access Permissions */}
                              <div>
                                <Label className="text-base font-semibold">Chat Access</Label>
                                <div className="grid grid-cols-2 gap-4 mt-3 p-4 bg-gray-50 rounded-lg">
                                  {[
                                    { key: 'GENERAL_CHAT', label: 'General Chat', permission: PERMISSIONS.GENERAL_CHAT },
                                    { key: 'COMMITTEE_CHAT', label: 'Committee Chat', permission: PERMISSIONS.COMMITTEE_CHAT },
                                    { key: 'HOST_CHAT', label: 'Host Chat', permission: PERMISSIONS.HOST_CHAT },
                                    { key: 'DRIVER_CHAT', label: 'Driver Chat', permission: PERMISSIONS.DRIVER_CHAT },
                                    { key: 'RECIPIENT_CHAT', label: 'Recipient Chat', permission: PERMISSIONS.RECIPIENT_CHAT },
                                    { key: 'CORE_TEAM_CHAT', label: 'Core Team Chat', permission: 'core_team_chat' },
                                    { key: 'DIRECT_MESSAGES', label: 'Direct Messages', permission: 'direct_messages' },
                                    { key: 'GROUP_MESSAGES', label: 'Group Messages', permission: 'group_messages' }
                                  ].map(({ key, label, permission }) => (
                                    <div key={permission} className="flex items-center space-x-2">
                                      <Checkbox
                                        id={permission}
                                        checked={editingPermissions.includes(permission)}
                                        onCheckedChange={() => handlePermissionToggle(permission)}
                                      />
                                      <Label
                                        htmlFor={permission}
                                        className="text-sm font-normal"
                                      >
                                        {label}
                                      </Label>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Other Permissions */}
                              <div>
                                <Label className="text-base font-semibold">Other Permissions</Label>
                                <div className="grid grid-cols-2 gap-4 mt-3">
                                  {Object.entries(PERMISSIONS)
                                    .filter(([key, permission]) => 
                                      !['GENERAL_CHAT', 'COMMITTEE_CHAT', 'HOST_CHAT', 'DRIVER_CHAT', 'RECIPIENT_CHAT', 'DIRECT_MESSAGES', 'GROUP_MESSAGES'].includes(key)
                                    )
                                    .map(([key, permission]) => (
                                      <div key={permission} className="flex items-center space-x-2">
                                        <Checkbox
                                          id={permission}
                                          checked={editingPermissions.includes(permission)}
                                          onCheckedChange={() => handlePermissionToggle(permission)}
                                        />
                                        <Label
                                          htmlFor={permission}
                                          className="text-sm font-normal"
                                        >
                                          {key.replace(/_/g, ' ').toLowerCase()}
                                        </Label>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            </div>

                          </div>
                          
                          <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                            <Button variant="outline" onClick={() => setSelectedUser(null)}>
                              Cancel
                            </Button>
                            <Button onClick={handleSaveChanges}>
                              Save Changes
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      
                      {/* Password Reset Dialog */}
                      <Dialog open={resetPasswordUser?.id === user.id} onOpenChange={(open) => {
                        if (!open) {
                          setResetPasswordUser(null);
                          setNewPassword("");
                        }
                      }}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setResetPasswordUser(user)}
                          >
                            <Key className="h-4 w-4 mr-2" />
                            Reset Password
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Reset Password</DialogTitle>
                            <DialogDescription>
                              Reset password for {user.firstName} {user.lastName} ({user.email})
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="newPassword">New Password</Label>
                              <Input
                                id="newPassword"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Enter new password"
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="outline" 
                                onClick={() => {
                                  setResetPasswordUser(null);
                                  setNewPassword("");
                                }}
                              >
                                Cancel
                              </Button>
                              <Button 
                                onClick={handleResetPassword}
                                disabled={!newPassword || resetPasswordMutation.isPending}
                              >
                                {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      
                      {/* Congratulate Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCongratulateUser(user)}
                        className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                      >
                        <Award className="h-4 w-4 mr-2" />
                        Congratulate
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleUserStatus.mutate({
                          userId: user.id,
                          isActive: !user.isActive
                        })}
                      >
                        {user.isActive ? "Deactivate" : "Activate"}
                      </Button>

                      {/* Delete Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteUser(user)}
                        disabled={deleteUserMutation.isPending}
                        className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {deleteUserMutation.isPending ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        </Card>
      )}

      {/* Celebration Toast */}
      <CelebrationToast
        isVisible={celebration.isVisible}
        onClose={hideCelebration}
        taskTitle={celebration.taskTitle}
        emoji={celebration.emoji}
        onSendThanks={(message: string) => {
          toast({
            title: "Thank you sent!",
            description: "Your appreciation message has been recorded.",
          });
        }}
      />
    </div>
  );
}
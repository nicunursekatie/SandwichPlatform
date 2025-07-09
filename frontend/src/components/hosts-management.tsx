import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Users, Plus, Edit, Trash2, Phone, Mail, User, AlertCircle, MapPin, Star, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, PERMISSIONS } from "@shared/auth-utils";
import type { Host, InsertHost } from "@shared/schema";

interface HostContact {
  id: number;
  hostId: number;
  name: string;
  role: string;
  phone: string;
  email: string | null;
  isPrimary: boolean;
  notes: string | null;
}

interface HostWithContacts extends Host {
  contacts: HostContact[];
}

export default function HostsManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const canEdit = hasPermission(user, PERMISSIONS.EDIT_DATA);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingHost, setEditingHost] = useState<Host | null>(null);
  const [selectedHost, setSelectedHost] = useState<HostWithContacts | null>(null);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [editingContact, setEditingContact] = useState<HostContact | null>(null);
  const [newHost, setNewHost] = useState<InsertHost>({
    name: "",
    address: "",
    status: "active",
    notes: ""
  });
  const [newContact, setNewContact] = useState({
    name: "",
    role: "",
    phone: "",
    email: "",
    isPrimary: false,
    notes: ""
  });

  const { data: hosts = [], isLoading } = useQuery<HostWithContacts[]>({
    queryKey: ['/api/hosts-with-contacts'],
  });

  const createHostMutation = useMutation({
    mutationFn: async (data: InsertHost) => {
      return await apiRequest('/api/hosts', {
        method: 'POST',
        body: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hosts-with-contacts'] });
      setNewHost({ name: "", address: "", status: "active", notes: "" });
      setIsAddModalOpen(false);
      toast({
        title: "Host added",
        description: "New host has been added successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to add host: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const updateHostMutation = useMutation({
    mutationFn: async (data: { id: number; updates: Partial<Host> }) => {
      const response = await fetch(`/api/hosts/${data.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data.updates),
      });
      if (!response.ok) throw new Error('Failed to update host');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hosts'] });
      setEditingHost(null);
      toast({
        title: "Host updated",
        description: "Host has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update host. Please try again.",
        variant: "destructive",
      });
    }
  });

  const deleteHostMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/hosts/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete host');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hosts'] });
      toast({
        title: "Host deleted",
        description: "Host has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete host. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleAddHost = () => {
    createHostMutation.mutate(newHost);
  };

  const handleUpdateHost = () => {
    if (!editingHost) return;
    updateHostMutation.mutate({
      id: editingHost.id,
      updates: editingHost
    });
  };

  const handleDeleteHost = (id: number) => {
    if (confirm("Are you sure you want to delete this host? This action cannot be undone.")) {
      deleteHostMutation.mutate(id);
    }
  };

  const activeHosts = hosts.filter(host => host.status === "active");
  const inactiveHosts = hosts.filter(host => host.status === "inactive");

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="h-6 bg-slate-200 rounded animate-pulse"></div>
        </div>
        <div className="p-6 space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="h-4 bg-slate-200 rounded animate-pulse"></div>
              <div className="h-3 bg-slate-100 rounded animate-pulse"></div>
              <div className="h-3 bg-slate-100 rounded animate-pulse w-2/3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center">
            <Users className="text-blue-500 mr-2 w-5 h-5" />
            Hosts Management
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {activeHosts.length} active hosts, {inactiveHosts.length} inactive
          </p>
        </div>
        
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button 
              className="bg-blue-600 hover:bg-blue-700" 
              disabled={!canEdit}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Host
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Host</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={newHost.name}
                  onChange={(e) => setNewHost({ ...newHost, name: e.target.value })}
                  placeholder="Host full name"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newHost.email || ""}
                  onChange={(e) => setNewHost({ ...newHost, email: e.target.value })}
                  placeholder="host@email.com"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={newHost.phone || ""}
                  onChange={(e) => setNewHost({ ...newHost, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select 
                  value={newHost.status} 
                  onValueChange={(value: "active" | "inactive") => setNewHost({ ...newHost, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={newHost.notes || ""}
                  onChange={(e) => setNewHost({ ...newHost, notes: e.target.value })}
                  placeholder="Additional notes about this host..."
                  rows={3}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddHost}
                  disabled={!newHost.name.trim() || createHostMutation.isPending}
                >
                  {createHostMutation.isPending ? "Adding..." : "Add Host"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {hosts.map((host) => (
            <Card 
              key={host.id} 
              className={`hover:shadow-md transition-shadow ${
                host.status === 'inactive' 
                  ? 'bg-gray-100 border-gray-400 opacity-70' 
                  : ''
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <User className={`w-5 h-5 ${host.status === 'inactive' ? 'text-gray-400' : 'text-slate-600'}`} />
                    <CardTitle className={`text-base ${host.status === 'inactive' ? 'text-gray-600' : ''}`}>{host.name}</CardTitle>
                  </div>
                  <Badge 
                    variant={host.status === "active" ? "default" : "secondary"}
                    className={host.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}
                  >
                    {host.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {host.address && (
                  <div className="flex items-center text-sm text-slate-600">
                    <MapPin className="w-4 h-4 mr-2" />
                    <span className="truncate">{host.address}</span>
                  </div>
                )}
                
                {/* Display contacts */}
                {host.contacts && host.contacts.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-slate-700">Contacts:</div>
                    {host.contacts.slice(0, 2).map((contact) => (
                      <div key={contact.id} className="space-y-1 border-l-2 border-blue-200 pl-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-700">{contact.name}</span>
                          {contact.isPrimary && <Star className="w-3 h-3 text-yellow-500 fill-current" />}
                        </div>
                        <div className="text-xs text-slate-600">{contact.role}</div>
                        <div className="flex items-center text-xs text-slate-600">
                          <Phone className="w-3 h-3 mr-1" />
                          {contact.phone}
                        </div>
                        {contact.email && (
                          <div className="flex items-center text-xs text-slate-600">
                            <Mail className="w-3 h-3 mr-1" />
                            {contact.email}
                          </div>
                        )}
                      </div>
                    ))}
                    {host.contacts.length > 2 && (
                      <div className="text-xs text-slate-500">
                        +{host.contacts.length - 2} more contacts
                      </div>
                    )}
                  </div>
                )}
                
                {host.notes && (
                  <div className="flex items-start text-sm text-slate-600">
                    <AlertCircle className="w-4 h-4 mr-2 mt-0.5" />
                    <span className="text-xs">{host.notes}</span>
                  </div>
                )}
                
                <div className="flex justify-between items-center space-x-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedHost(host)}
                  >
                    <Users className="w-3 h-3 mr-1" />
                    View Details
                  </Button>
                  <div className="flex space-x-1">
                  <Dialog open={editingHost?.id === host.id} onOpenChange={(open) => !open && setEditingHost(null)}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        disabled={!canEdit}
                        onClick={() => setEditingHost(host)}
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Host</DialogTitle>
                      </DialogHeader>
                      {editingHost && (
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="edit-name">Name *</Label>
                            <Input
                              id="edit-name"
                              value={editingHost.name}
                              onChange={(e) => setEditingHost({ ...editingHost, name: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label htmlFor="edit-email">Email</Label>
                            <Input
                              id="edit-email"
                              type="email"
                              value={editingHost.email || ""}
                              onChange={(e) => setEditingHost({ ...editingHost, email: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label htmlFor="edit-phone">Phone</Label>
                            <Input
                              id="edit-phone"
                              value={editingHost.phone || ""}
                              onChange={(e) => setEditingHost({ ...editingHost, phone: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label htmlFor="edit-status">Status</Label>
                            <Select 
                              value={editingHost.status} 
                              onValueChange={(value: "active" | "inactive") => setEditingHost({ ...editingHost, status: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="edit-notes">Notes</Label>
                            <Textarea
                              id="edit-notes"
                              value={editingHost.notes || ""}
                              onChange={(e) => setEditingHost({ ...editingHost, notes: e.target.value })}
                              rows={3}
                            />
                          </div>
                          <div className="flex justify-end space-x-2">
                            <Button variant="outline" onClick={() => setEditingHost(null)}>
                              Cancel
                            </Button>
                            <Button 
                              onClick={handleUpdateHost}
                              disabled={!editingHost.name.trim() || updateHostMutation.isPending}
                            >
                              {updateHostMutation.isPending ? "Updating..." : "Update Host"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleDeleteHost(host.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    disabled={deleteHostMutation.isPending}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Delete
                  </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {hosts.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No hosts found</h3>
            <p className="text-slate-500 mb-4">Get started by adding your first host.</p>
            <Button onClick={() => setIsAddModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Host
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
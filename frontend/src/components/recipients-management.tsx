import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Users, Plus, Edit, Trash2, Phone, Mail, MapPin, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, PERMISSIONS } from "@shared/auth-utils";

interface Recipient {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  preferences: string;
  status: "active" | "inactive";
}

export default function RecipientsManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const canEdit = hasPermission(user, PERMISSIONS.EDIT_DATA);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<Recipient | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResults, setImportResults] = useState<{ imported: number; skipped: number } | null>(null);
  const [newRecipient, setNewRecipient] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    preferences: "",
    status: "active" as const
  });

  const { data: recipients = [], isLoading } = useQuery({
    queryKey: ["/api/recipients"],
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });

  const createRecipientMutation = useMutation({
    mutationFn: (recipient: any) => apiRequest("/api/recipients", {
      method: "POST",
      body: JSON.stringify(recipient),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipients"] });
      setIsAddModalOpen(false);
      setNewRecipient({
        name: "",
        phone: "",
        email: "",
        address: "",
        preferences: "",
        status: "active"
      });
      toast({
        title: "Success",
        description: "Recipient added successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add recipient",
        variant: "destructive",
      });
    },
  });

  const updateRecipientMutation = useMutation({
    mutationFn: ({ id, ...updates }: any) => apiRequest(`/api/recipients/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipients"] });
      setEditingRecipient(null);
      toast({
        title: "Success",
        description: "Recipient updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update recipient",
        variant: "destructive",
      });
    },
  });

  const deleteRecipientMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/recipients/${id}`, {
      method: "DELETE",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipients"] });
      toast({
        title: "Success",
        description: "Recipient deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete recipient",
        variant: "destructive",
      });
    },
  });

  const importRecipientsMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return fetch('/api/recipients/import', {
        method: 'POST',
        body: formData,
      }).then(res => res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipients"] });
      setImportResults(data);
      setImportFile(null);
      toast({
        title: "Import Complete",
        description: `Successfully imported ${data.imported} recipients`,
      });
    },
    onError: () => {
      toast({
        title: "Import Error",
        description: "Failed to import recipients",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecipient.name || !newRecipient.phone) {
      toast({
        title: "Validation Error",
        description: "Name and phone are required",
        variant: "destructive",
      });
      return;
    }
    createRecipientMutation.mutate(newRecipient);
  };

  const handleEdit = (recipient: Recipient) => {
    setEditingRecipient(recipient);
  };

  const handleUpdate = () => {
    if (!editingRecipient) return;
    updateRecipientMutation.mutate(editingRecipient);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this recipient?")) {
      deleteRecipientMutation.mutate(id);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportResults(null);
    }
  };

  const handleImport = () => {
    if (importFile) {
      importRecipientsMutation.mutate(importFile);
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading recipients...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <Users className="text-blue-500 mr-3 w-6 h-6" />
            Recipients Management
          </h1>
          <div className="flex gap-2">
            <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Import CSV/XLSX
                </Button>
              </DialogTrigger>
              <DialogContent aria-describedby="import-recipients-description">
                <DialogHeader>
                  <DialogTitle>Import Recipients from CSV/XLSX</DialogTitle>
                </DialogHeader>
                <p id="import-recipients-description" className="text-sm text-slate-600 mb-4">
                  Upload a CSV or Excel file with recipient data. Required columns: name, phone. Optional: email, address, preferences, status.
                </p>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="file-upload">Select File</Label>
                    <Input
                      id="file-upload"
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileSelect}
                      className="mt-1"
                    />
                    {importFile && (
                      <p className="text-sm text-green-600 mt-2">
                        Selected: {importFile.name}
                      </p>
                    )}
                  </div>

                  {importResults && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-medium text-green-800">Import Results</h4>
                      <p className="text-sm text-green-700 mt-1">
                        Successfully imported {importResults.imported} recipients
                        {importResults.skipped > 0 && `, skipped ${importResults.skipped} duplicates`}
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsImportModalOpen(false);
                        setImportFile(null);
                        setImportResults(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleImport}
                      disabled={!importFile || importRecipientsMutation.isPending}
                    >
                      {importRecipientsMutation.isPending ? "Importing..." : "Import"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
              <DialogTrigger asChild>
                <Button disabled={!canEdit} className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add Recipient
                </Button>
              </DialogTrigger>
              <DialogContent aria-describedby="add-recipient-description">
                <DialogHeader>
                  <DialogTitle>Add New Recipient</DialogTitle>
                </DialogHeader>
                <p id="add-recipient-description" className="text-sm text-slate-600 mb-4">
                  Add a new recipient to the system for sandwich deliveries.
                </p>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={newRecipient.name}
                      onChange={(e) => setNewRecipient({ ...newRecipient, name: e.target.value })}
                      placeholder="Enter recipient name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      value={newRecipient.phone}
                      onChange={(e) => setNewRecipient({ ...newRecipient, phone: e.target.value })}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newRecipient.email}
                      onChange={(e) => setNewRecipient({ ...newRecipient, email: e.target.value })}
                      placeholder="email@example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={newRecipient.address}
                      onChange={(e) => setNewRecipient({ ...newRecipient, address: e.target.value })}
                      placeholder="123 Main St, City, State 12345"
                    />
                  </div>
                  <div>
                    <Label htmlFor="preferences">Preferences</Label>
                    <Input
                      id="preferences"
                      value={newRecipient.preferences}
                      onChange={(e) => setNewRecipient({ ...newRecipient, preferences: e.target.value })}
                      placeholder="Dietary restrictions or preferences"
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createRecipientMutation.isPending}>
                      {createRecipientMutation.isPending ? "Adding..." : "Add Recipient"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Recipients List */}
      <div className="grid gap-4">
        {recipients.map((recipient: any) => (
          <Card key={recipient.id} className="border border-slate-200">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{recipient.name}</CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={recipient.status === "active" ? "default" : "secondary"}>
                      {recipient.status}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canEdit}
                    onClick={() => handleEdit(recipient)}
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canEdit}
                    onClick={() => handleDelete(recipient.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Phone className="w-4 h-4" />
                <span>{recipient.phone}</span>
              </div>
              {recipient.email && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Mail className="w-4 h-4" />
                  <span>{recipient.email}</span>
                </div>
              )}
              {recipient.address && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <MapPin className="w-4 h-4" />
                  <span>{recipient.address}</span>
                </div>
              )}
              {recipient.preferences && (
                <div className="text-sm text-slate-600">
                  <strong>Preferences:</strong> {recipient.preferences}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {recipients.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            No recipients found. Add a new recipient to get started.
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingRecipient && (
        <Dialog open={!!editingRecipient} onOpenChange={() => setEditingRecipient(null)}>
          <DialogContent aria-describedby="edit-recipient-description">
            <DialogHeader>
              <DialogTitle>Edit Recipient</DialogTitle>
            </DialogHeader>
            <p id="edit-recipient-description" className="text-sm text-slate-600 mb-4">
              Update recipient information.
            </p>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editingRecipient.name}
                  onChange={(e) => setEditingRecipient({ ...editingRecipient, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  value={editingRecipient.phone}
                  onChange={(e) => setEditingRecipient({ ...editingRecipient, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editingRecipient.email}
                  onChange={(e) => setEditingRecipient({ ...editingRecipient, email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-address">Address</Label>
                <Input
                  id="edit-address"
                  value={editingRecipient.address}
                  onChange={(e) => setEditingRecipient({ ...editingRecipient, address: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-preferences">Preferences</Label>
                <Input
                  id="edit-preferences"
                  value={editingRecipient.preferences}
                  onChange={(e) => setEditingRecipient({ ...editingRecipient, preferences: e.target.value })}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setEditingRecipient(null)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdate} disabled={updateRecipientMutation.isPending}>
                  {updateRecipientMutation.isPending ? "Updating..." : "Update Recipient"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
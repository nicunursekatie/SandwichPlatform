import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertHostSchema, insertHostContactSchema, insertRecipientSchema, insertContactSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, PERMISSIONS } from "@shared/auth-utils";
import { Phone, Mail, MapPin, Search, Download, User, Users, Star, Building2, Plus, Edit, Trash2, Upload, FileSpreadsheet, Crown, Settings, ChevronDown } from "lucide-react";

interface Host {
  id: number;
  name: string;
  address: string | null;
  status: 'active' | 'inactive';
  notes: string | null;
}

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

interface Recipient {
  id: number;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string;
  address: string | null;
  preferences: string | null;
  status: 'active' | 'inactive';
}

interface GeneralContact {
  id: number;
  name: string;
  organization?: string;
  role?: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
  category: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Driver {
  id: number;
  name: string;
  phone: string;
  email: string;
  zone: string;
  hostId?: number;
  isActive: boolean;
  notes: string;
  vanApproved: boolean;
  homeAddress?: string;
  availabilityNotes?: string;
}

function PhoneDirectory() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("hosts");
  const [isAddingHost, setIsAddingHost] = useState(false);
  const [isAddingRecipient, setIsAddingRecipient] = useState(false);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [isAddingHostContact, setIsAddingHostContact] = useState(false);
  const [selectedHostForContact, setSelectedHostForContact] = useState<Host | null>(null);
  const [editingHost, setEditingHost] = useState<Host | null>(null);
  const [editingRecipient, setEditingRecipient] = useState<Recipient | null>(null);
  const [editingContact, setEditingContact] = useState<GeneralContact | null>(null);
  const [editingHostContact, setEditingHostContact] = useState<HostContact | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const { toast } = useToast();
  
  // Auth and permissions
  const { user } = useAuth();
  const canEdit = hasPermission(user, PERMISSIONS.EDIT_DATA);

  // Optimized: Fetch hosts with contacts in single query
  const { data: hosts = [], isLoading, refetch: refetchHostsWithContacts } = useQuery<HostWithContacts[]>({
    queryKey: ["/api/hosts-with-contacts"],
  });

  // Keep separate hosts query for forms that need the basic host list
  const { data: hostsData = [], refetch: refetchHosts } = useQuery<Host[]>({
    queryKey: ["/api/hosts"],
  });







  // Fetch recipients
  const { data: recipients = [], isLoading: recipientsLoading } = useQuery<Recipient[]>({
    queryKey: ["/api/recipients"],
  });

  // Fetch general contacts
  const { data: contacts = [], isLoading: contactsLoading } = useQuery<GeneralContact[]>({
    queryKey: ["/api/contacts"],
  });

  // Fetch drivers
  const { data: drivers = [], isLoading: driversLoading } = useQuery<Driver[]>({
    queryKey: ["/api/drivers"],
  });

  // Mutations for CRUD operations
  const createHostMutation = useMutation({
    mutationFn: (data: z.infer<typeof insertHostSchema>) => apiRequest("POST", `/api/hosts`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hosts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hosts-with-contacts"] });
      setIsAddingHost(false);
      toast({ title: "Host added successfully" });
    },
    onError: () => {
      toast({ title: "Failed to add host", variant: "destructive" });
    },
  });

  const updateHostMutation = useMutation({
    mutationFn: ({ id, data, isReassignment }: { id: number; data: Partial<z.infer<typeof insertHostSchema>>; isReassignment?: boolean }) => {
      console.log('Updating host with:', { id, data, isReassignment });
      return apiRequest("PATCH", `/api/hosts/${id}`, data);
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["/api/hosts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/host-contacts"] });
      setEditingHost(null);
      
      if (response && typeof response === 'object' && 'message' in response) {
        // This was a location reassignment
        toast({ 
          title: "Location reassigned successfully", 
          description: (response as any).message 
        });
      } else {
        toast({ title: "Host updated successfully" });
      }
    },
    onError: (error) => {
      console.error('Host update error:', error);
      toast({ title: "Failed to update host", variant: "destructive" });
    },
  });

  const deleteHostMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/hosts/${id}`),
    onSuccess: async () => {
      // Force immediate refresh of both queries
      await Promise.all([
        refetchHostsWithContacts(),
        refetchHosts(),
        queryClient.invalidateQueries({ queryKey: ["/api/host-contacts"] })
      ]);
      toast({ title: "Host location deleted successfully" });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Failed to delete host location";
      toast({ 
        title: "Cannot delete host location", 
        description: errorMessage,
        variant: "destructive" 
      });
    },
  });

  const createRecipientMutation = useMutation({
    mutationFn: (data: z.infer<typeof insertRecipientSchema>) => apiRequest("POST", `/api/recipients`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipients"] });
      setIsAddingRecipient(false);
      toast({ title: "Recipient added successfully" });
    },
    onError: () => {
      toast({ title: "Failed to add recipient", variant: "destructive" });
    },
  });

  const updateRecipientMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<z.infer<typeof insertRecipientSchema>> }) => 
      apiRequest("PATCH", `/api/recipients/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipients"] });
      setEditingRecipient(null);
      toast({ title: "Recipient updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update recipient", variant: "destructive" });
    },
  });

  const deleteRecipientMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/recipients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipients"] });
      toast({ title: "Recipient deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete recipient", variant: "destructive" });
    },
  });

  const createHostContactMutation = useMutation({
    mutationFn: (data: z.infer<typeof insertHostContactSchema>) => apiRequest("POST", "/api/host-contacts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hosts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hosts-with-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/host-contacts"] });
      setIsAddingHostContact(false);
      setSelectedHostForContact(null);
      toast({ title: "Contact added successfully" });
    },
    onError: () => {
      toast({ title: "Failed to add contact", variant: "destructive" });
    },
  });

  const importContactsMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return fetch('/api/import-contacts', {
        method: 'POST',
        body: formData,
      }).then(res => res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/hosts-with-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hosts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/host-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setImportDialogOpen(false);
      toast({ 
        title: "Import completed successfully", 
        description: `Imported ${data.imported} contacts and ${data.hosts} host locations`
      });
    },
    onError: () => {
      toast({ title: "Failed to import contacts", variant: "destructive" });
    },
  });






  // Contact mutations
  const createContactMutation = useMutation({
    mutationFn: (data: z.infer<typeof insertContactSchema>) => apiRequest("POST", `/api/contacts`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setIsAddingContact(false);
      toast({
        title: "Success",
        description: "Contact created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create contact",
        variant: "destructive",
      });
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<GeneralContact> }) => 
      apiRequest("PATCH", `/api/contacts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setEditingContact(null);
      toast({
        title: "Success",
        description: "Contact updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update contact",
        variant: "destructive",
      });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/contacts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({
        title: "Success",
        description: "Contact deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete contact",
        variant: "destructive",
      });
    },
  });

  // Host contact mutations
  const updateHostContactMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<HostContact> }) => 
      apiRequest("PATCH", `/api/host-contacts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hosts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hosts-with-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/host-contacts"] });
      setEditingHostContact(null);
      toast({
        title: "Success",
        description: "Host contact updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update host contact",
        variant: "destructive",
      });
    },
  });

  const deleteHostContactMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/host-contacts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hosts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hosts-with-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/host-contacts"] });
      toast({
        title: "Success",
        description: "Host contact deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete host contact",
        variant: "destructive",
      });
    },
  });

  // Filtering logic
  const filteredHosts = hosts.filter((host) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    
    // Search in host name, address, and notes
    const hostMatch = host.name.toLowerCase().includes(searchLower) ||
                     (host.address && host.address.toLowerCase().includes(searchLower)) ||
                     (host.notes && host.notes.toLowerCase().includes(searchLower));
    
    // Search in contact information
    const contactMatch = host.contacts.some(contact => 
      contact.name.toLowerCase().includes(searchLower) ||
      contact.phone.includes(searchTerm) ||
      (contact.email && contact.email.toLowerCase().includes(searchLower)) ||
      contact.role.toLowerCase().includes(searchLower) ||
      (contact.notes && contact.notes.toLowerCase().includes(searchLower))
    );
    
    return hostMatch || contactMatch;
  });

  const filteredRecipients = recipients.filter((recipient) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    
    return recipient.name.toLowerCase().includes(searchLower) ||
           (recipient.contactName && recipient.contactName.toLowerCase().includes(searchLower)) ||
           recipient.phone.includes(searchTerm) ||
           (recipient.email && recipient.email.toLowerCase().includes(searchLower)) ||
           (recipient.address && recipient.address.toLowerCase().includes(searchLower)) ||
           (recipient.preferences && recipient.preferences.toLowerCase().includes(searchLower));
  });

  const filteredContacts = contacts.filter((contact) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    
    return contact.name.toLowerCase().includes(searchLower) ||
           (contact.organization && contact.organization.toLowerCase().includes(searchLower)) ||
           (contact.role && contact.role.toLowerCase().includes(searchLower)) ||
           contact.phone.includes(searchTerm) ||
           (contact.email && contact.email.toLowerCase().includes(searchLower)) ||
           (contact.address && contact.address.toLowerCase().includes(searchLower)) ||
           (contact.notes && contact.notes.toLowerCase().includes(searchLower)) ||
           contact.category.toLowerCase().includes(searchLower);
  });

  // Export functions
  const exportToCSV = (data: any[], filename: string) => {
    const headers = Object.keys(data[0] || {});
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return null;
    // Format phone number for display (e.g., (555) 123-4567)
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const cleanAddress = (address: string | null) => {
    if (!address) return null;
    // Remove parenthetical information like "(Karen)" or "(west side)"
    return address.replace(/\s*\([^)]*\)/g, '').trim();
  };

  // Helper function to render role badges with special styling for leads
  const RoleBadge = ({ role }: { role: string }) => {
    if (role.toLowerCase() === 'lead') {
      return (
        <div className="flex items-center gap-1">
          <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 text-white font-semibold shadow-md border-0 flex items-center gap-1 px-2 py-1">
            <Crown className="w-3 h-3" />
            LEAD
          </Badge>
        </div>
      );
    }
    return (
      <Badge variant="outline" className="text-xs">
        {role}
      </Badge>
    );
  };

  const HostCard = ({ host }: { host: HostWithContacts }) => (
    <Card className="mb-4">
      <CardContent className="pt-4">
        {/* Mobile-First Host Card Layout */}
        <div className="space-y-4">
          {/* Host Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <h3 className="font-bold text-lg text-gray-900 break-words">{host.name}</h3>
              {host.status === 'inactive' && (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </div>
            
            {/* Action Buttons - Mobile Responsive */}
            <div className="flex gap-2 flex-wrap sm:flex-nowrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedHostForContact(host);
                  setIsAddingHostContact(true);
                }}
                className="flex items-center gap-1 text-xs sm:text-sm h-8 px-2"
                disabled={!canEdit}
              >
                <Plus className="w-3 h-3" />
                <span className="hidden sm:inline">Add Contact</span>
                <span className="sm:hidden">Add</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingHost(host)}
                className="flex items-center gap-1 text-xs sm:text-sm h-8 px-2"
                disabled={!canEdit}
              >
                <Edit className="w-3 h-3" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (confirm(`Are you sure you want to delete the host location "${host.name}"? This will also delete all associated contacts.`)) {
                    deleteHostMutation.mutate(host.id);
                  }
                }}
                className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 text-xs sm:text-sm h-8 px-2"
                disabled={deleteHostMutation.isPending || !canEdit}
              >
                <Trash2 className="w-3 h-3" />
                <span className="hidden sm:inline">Delete</span>
                <span className="sm:hidden">Del</span>
              </Button>
            </div>
          </div>
          
          {/* Host Address */}
          {host.address && (
            <div className="flex items-start gap-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
              <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span className="break-words">{host.address}</span>
            </div>
          )}
          
          {/* Contact List */}
          {host.contacts.length === 0 ? (
            <div className="text-gray-500 text-sm italic bg-gray-50 p-4 rounded-lg text-center">
              No contact information available
            </div>
          ) : (
            <div className="space-y-3">
              {host.contacts.map((contact) => (
                <div key={contact.id} className="border border-blue-200 rounded-lg p-4 bg-blue-50/20">
                  {/* Contact Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-gray-900 text-base">{contact.name}</span>
                      <RoleBadge role={contact.role} />
                      {contact.isPrimary && (
                        <Star className="w-3 h-3 text-yellow-500 fill-current" />
                      )}
                    </div>
                    
                    {/* Contact Actions */}
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingHostContact(contact)}
                        className="flex items-center gap-1 h-7 px-2 text-xs"
                        disabled={!canEdit}
                      >
                        <Edit className="w-3 h-3" />
                        <span className="hidden sm:inline">Edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteHostContactMutation.mutate(contact.id)}
                        className="flex items-center gap-1 h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 text-xs"
                        disabled={!canEdit}
                      >
                        <Trash2 className="w-3 h-3" />
                        <span className="hidden sm:inline">Delete</span>
                      </Button>
                    </div>
                  </div>
                  
                  {/* Contact Info - Mobile Stacked */}
                  <div className="space-y-2">
                    <a 
                      href={`tel:${contact.phone}`} 
                      className="flex items-center gap-2 bg-blue-100 hover:bg-blue-200 px-3 py-3 rounded-lg transition-colors group w-full touch-manipulation"
                    >
                      <Phone className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <span className="font-medium text-blue-700 text-base sm:text-lg">
                        {formatPhone(contact.phone)}
                      </span>
                    </a>
                    
                    {contact.email && (
                      <a 
                        href={`mailto:${contact.email}`} 
                        className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors py-2 touch-manipulation"
                      >
                        <Mail className="w-4 h-4 flex-shrink-0" />
                        <span className="text-sm break-all">{contact.email}</span>
                      </a>
                    )}
                  </div>
                  
                  {contact.notes && (
                    <div className="text-xs text-gray-600 mt-3 bg-white/80 p-2 rounded border">
                      <strong>Notes:</strong> {contact.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {/* Host Notes */}
          {host.notes && (
            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border">
              <strong>Location Notes:</strong> {host.notes}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const RecipientCard = ({ recipient }: { recipient: Recipient }) => (
    <Card className="mb-4">
      <CardContent className="pt-4">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-5 h-5 text-green-600" />
              <h3 className="font-bold text-lg text-gray-900">{recipient.name}</h3>
              {recipient.status === 'inactive' && (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </div>
            
            {recipient.contactName && (
              <div className="text-sm text-gray-600 mb-2">
                <strong>Contact:</strong> {recipient.contactName}
              </div>
            )}
            
            <div className="flex items-center gap-3 mb-3">
              <a 
                href={`tel:${recipient.phone}`} 
                className="flex items-center gap-2 bg-green-50 hover:bg-green-100 px-3 py-2 rounded-lg transition-colors group"
              >
                <Phone className="w-4 h-4 text-green-600" />
                <span className="font-medium text-green-700 text-lg">
                  {formatPhone(recipient.phone)}
                </span>
              </a>
              
              {recipient.email && (
                <a 
                  href={`mailto:${recipient.email}`} 
                  className="flex items-center gap-2 text-gray-600 hover:text-green-600 transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  <span className="text-sm">{recipient.email}</span>
                </a>
              )}
            </div>
            
            {recipient.address && (
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <MapPin className="w-4 h-4" />
                <span>{cleanAddress(recipient.address)}</span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingRecipient(recipient)}
              className="flex items-center gap-1"
            >
              <Edit className="w-3 h-3" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => deleteRecipientMutation.mutate(recipient.id)}
              className="flex items-center gap-1 text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const ContactCard = ({ contact }: { contact: GeneralContact }) => (
    <Card className="mb-4">
      <CardContent className="pt-4">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <Phone className="w-5 h-5 text-purple-600" />
              <h3 className="font-bold text-lg text-gray-900">{contact.name}</h3>
              {contact.status === 'inactive' && (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </div>
            
            {contact.organization && (
              <div className="text-sm text-gray-600 mb-2">
                <strong>Organization:</strong> {contact.organization}
              </div>
            )}
            
            {contact.role && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm text-gray-600 font-medium">Role:</span>
                <RoleBadge role={contact.role} />
              </div>
            )}
            
            <div className="flex items-center gap-3 mb-3">
              <a 
                href={`tel:${contact.phone}`} 
                className="flex items-center gap-2 bg-purple-50 hover:bg-purple-100 px-3 py-2 rounded-lg transition-colors group"
              >
                <Phone className="w-4 h-4 text-purple-600" />
                <span className="font-medium text-purple-700 text-lg">
                  {formatPhone(contact.phone)}
                </span>
              </a>
              
              {contact.email && (
                <a 
                  href={`mailto:${contact.email}`} 
                  className="flex items-center gap-2 text-gray-600 hover:text-purple-600 transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  <span className="text-sm">{contact.email}</span>
                </a>
              )}
            </div>
            
            {contact.address && (
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <MapPin className="w-4 h-4" />
                <span>{contact.address}</span>
              </div>
            )}
            
            {contact.notes && (
              <div className="text-sm text-gray-600">
                <strong>Notes:</strong> {contact.notes}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingContact(contact)}
              className="flex items-center gap-1"
            >
              <Edit className="w-3 h-3" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => deleteContactMutation.mutate(contact.id)}
              className="flex items-center gap-1 text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading || recipientsLoading || contactsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Loading directory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Phone Directory</h2>
          <p className="text-slate-600 text-sm sm:text-base">Contact information for hosts, recipients, and general contacts</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === "hosts" && (
            <Button 
              onClick={() => setIsAddingHost(true)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Location
            </Button>
          )}
          {activeTab === "recipients" && (
            <Button 
              onClick={() => setIsAddingRecipient(true)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Recipient
            </Button>
          )}
          {activeTab === "contacts" && (
            <Button 
              onClick={() => setIsAddingContact(true)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Contact
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="default"
                className="flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Manage Contacts
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => setImportDialogOpen(true)}
                className="flex items-center gap-2 text-green-700"
              >
                <Upload className="w-4 h-4" />
                Import Excel
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  const hostExportData = hosts.flatMap(host => 
                    host.contacts.map(contact => ({
                      location: host.name,
                      contactName: contact.name,
                      role: contact.role,
                      phone: contact.phone,
                      email: contact.email || '',
                      isPrimary: contact.isPrimary ? 'Yes' : 'No',
                      address: host.address || '',
                      notes: contact.notes || ''
                    }))
                  );
                  exportToCSV(hostExportData, 'hosts-directory.csv');
                }}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export Hosts
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => exportToCSV(recipients, 'recipients-directory.csv')}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export Recipients
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => exportToCSV(contacts, 'contacts-directory.csv')}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export Contacts
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Search Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-11 text-base"
            />
          </div>
        </CardContent>
      </Card>

      {/* Directory Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="contacts" className="flex items-center gap-2 font-semibold">
            <Phone className="w-4 h-4" />
            Contacts ({filteredContacts.length})
          </TabsTrigger>
          <TabsTrigger value="hosts" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Hosts ({filteredHosts.length})
          </TabsTrigger>
          <TabsTrigger value="recipients" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Recipients ({filteredRecipients.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contacts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                General Contacts
              </CardTitle>
              <CardDescription>
                Contact information for general contacts and volunteers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredContacts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {searchTerm ? 'No contacts found matching your search.' : 'No contacts found.'}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredContacts.map((contact) => (
                    <ContactCard key={contact.id} contact={contact} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hosts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Host Directory
              </CardTitle>
              <CardDescription>
                Contact information for sandwich collection hosts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-gray-500">
                  Loading host directory...
                </div>
              ) : filteredHosts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {searchTerm ? 'No hosts found matching your search.' : 'No hosts found.'}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredHosts.map((host) => (
                    <HostCard key={host.id} host={host} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recipients" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Recipient Directory
              </CardTitle>
              <CardDescription>
                Contact information for sandwich delivery recipients
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredRecipients.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {searchTerm ? 'No recipients found matching your search.' : 'No recipients found.'}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredRecipients.map((recipient) => (
                    <RecipientCard key={recipient.id} recipient={recipient} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Hosts</p>
                <p className="text-2xl font-bold">{filteredHosts.length}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {filteredHosts.filter(h => h.contacts.length > 0).length} with contacts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Recipients</p>
                <p className="text-2xl font-bold">{filteredRecipients.length}</p>
              </div>
              <User className="w-8 h-8 text-green-500" />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {filteredRecipients.filter(r => r.status === 'active').length} active, {filteredRecipients.filter(r => r.phone).length} with phone numbers
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Add Host Dialog */}
      <Dialog open={isAddingHost} onOpenChange={setIsAddingHost}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Location</DialogTitle>
            <DialogDescription>
              Add a new host location for sandwich collection
            </DialogDescription>
          </DialogHeader>
          <HostForm
            onSubmit={(data) => createHostMutation.mutate(data)}
            onCancel={() => setIsAddingHost(false)}
            isLoading={createHostMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Host Dialog */}
      <Dialog open={!!editingHost} onOpenChange={(open) => !open && setEditingHost(null)}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Host Location</DialogTitle>
            <DialogDescription>
              Update host location information
            </DialogDescription>
          </DialogHeader>
          {editingHost && (
            <HostForm
              initialData={editingHost}
              onSubmit={(data) => updateHostMutation.mutate({ id: editingHost.id, data })}
              onCancel={() => setEditingHost(null)}
              isLoading={updateHostMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Add Recipient Dialog */}
      <Dialog open={isAddingRecipient} onOpenChange={setIsAddingRecipient}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Recipient</DialogTitle>
            <DialogDescription>
              Add a new recipient for sandwich delivery
            </DialogDescription>
          </DialogHeader>
          <RecipientForm
            onSubmit={(data) => createRecipientMutation.mutate(data)}
            onCancel={() => setIsAddingRecipient(false)}
            isLoading={createRecipientMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Recipient Dialog */}
      <Dialog open={!!editingRecipient} onOpenChange={(open) => !open && setEditingRecipient(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Recipient</DialogTitle>
            <DialogDescription>
              Update recipient information
            </DialogDescription>
          </DialogHeader>
          {editingRecipient && (
            <RecipientForm
              initialData={editingRecipient}
              onSubmit={(data) => updateRecipientMutation.mutate({ id: editingRecipient.id, data })}
              onCancel={() => setEditingRecipient(null)}
              isLoading={updateRecipientMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Add Contact Dialog */}
      <Dialog open={isAddingContact} onOpenChange={setIsAddingContact}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Contact</DialogTitle>
            <DialogDescription>
              Add a new general contact
            </DialogDescription>
          </DialogHeader>
          <ContactForm
            onSubmit={(data) => createContactMutation.mutate(data)}
            onCancel={() => setIsAddingContact(false)}
            isLoading={createContactMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Contact Dialog */}
      <Dialog open={!!editingContact} onOpenChange={(open) => !open && setEditingContact(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
            <DialogDescription>
              Update contact information
            </DialogDescription>
          </DialogHeader>
          {editingContact && (
            <ContactForm
              initialData={editingContact}
              onSubmit={(data) => updateContactMutation.mutate({ id: editingContact.id, data: {
                ...data,
                organization: data.organization || undefined,
                role: data.role || undefined,
                address: data.address || undefined,
                notes: data.notes || undefined,
                email: data.email || undefined
              } })}
              onCancel={() => setEditingContact(null)}
              isLoading={updateContactMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Add Host Contact Dialog */}
      <Dialog open={isAddingHostContact} onOpenChange={(open) => !open && setIsAddingHostContact(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contact to {selectedHostForContact?.name}</DialogTitle>
            <DialogDescription>
              Add a new contact person for this host location
            </DialogDescription>
          </DialogHeader>
          {selectedHostForContact && (
            <HostContactForm
              hostId={selectedHostForContact.id}
              onSubmit={(data) => createHostContactMutation.mutate(data)}
              onCancel={() => {
                setIsAddingHostContact(false);
                setSelectedHostForContact(null);
              }}
              isLoading={createHostContactMutation.isPending}
              hosts={hostsData}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Host Contact Dialog */}
      <Dialog open={!!editingHostContact} onOpenChange={(open) => !open && setEditingHostContact(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Host Contact</DialogTitle>
            <DialogDescription>
              Update contact information
            </DialogDescription>
          </DialogHeader>
          {editingHostContact && (
            <HostContactForm
              hostId={editingHostContact.hostId}
              initialData={editingHostContact}
              onSubmit={(data) => updateHostContactMutation.mutate({ id: editingHostContact.id, data })}
              onCancel={() => setEditingHostContact(null)}
              isLoading={updateHostContactMutation.isPending}
              hosts={hostsData}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Recipient Dialog */}
      <Dialog open={!!editingRecipient} onOpenChange={(open) => !open && setEditingRecipient(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Recipient</DialogTitle>
            <DialogDescription>
              Update recipient information
            </DialogDescription>
          </DialogHeader>
          {editingRecipient && (
            <RecipientForm
              initialData={editingRecipient}
              onSubmit={(data) => updateRecipientMutation.mutate({ id: editingRecipient.id, data })}
              onCancel={() => setEditingRecipient(null)}
              isLoading={updateRecipientMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Host Contact Dialog */}
      <Dialog open={isAddingHostContact} onOpenChange={setIsAddingHostContact}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Contact for {selectedHostForContact?.name}</DialogTitle>
          </DialogHeader>
          {selectedHostForContact && (
            <HostContactForm
              hostId={selectedHostForContact.id}
              onSubmit={createHostContactMutation.mutate}
              onCancel={() => {
                setIsAddingHostContact(false);
                setSelectedHostForContact(null);
              }}
              isLoading={createHostContactMutation.isPending}
              hosts={hostsData}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <FileImportDialog 
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImport={(file) => importContactsMutation.mutate(file)}
        isLoading={importContactsMutation.isPending}
      />
    </div>
  );
}

// Host Form Component
const HostForm = ({ 
  initialData, 
  onSubmit, 
  onCancel, 
  isLoading 
}: {
  initialData?: Host;
  onSubmit: (data: z.infer<typeof insertHostSchema>) => void;
  onCancel: () => void;
  isLoading: boolean;
}) => {
  const [useExistingLocation, setUseExistingLocation] = useState(false);
  const [selectedExistingHost, setSelectedExistingHost] = useState<string>("");
  
  // Fetch all hosts for location selection
  const { data: allHosts = [] } = useQuery<Host[]>({
    queryKey: ["/api/hosts"],
  });

  const form = useForm<z.infer<typeof insertHostSchema>>({
    resolver: zodResolver(insertHostSchema),
    defaultValues: {
      name: initialData?.name || "",
      address: initialData?.address || "",
      status: initialData?.status || "active",
      notes: initialData?.notes || "",
    },
  });

  const handleExistingLocationChange = (hostId: string) => {
    setSelectedExistingHost(hostId);
    const selectedHost = allHosts.find(h => h.id.toString() === hostId);
    if (selectedHost) {
      form.setValue("name", selectedHost.name);
      form.setValue("address", selectedHost.address || "");
      form.setValue("notes", selectedHost.notes || "");
    }
  };

  const handleSubmit = (data: z.infer<typeof insertHostSchema>) => {
    if (useExistingLocation && selectedExistingHost && initialData) {
      // We're reassigning to an existing location - send the target host's information
      const selectedHost = allHosts.find(h => h.id.toString() === selectedExistingHost);
      if (selectedHost) {
        console.log('Reassigning host:', initialData.name, 'to:', selectedHost.name);
        // Send the target host's information to trigger reassignment logic
        onSubmit({
          name: selectedHost.name,
          address: selectedHost.address || "",
          notes: selectedHost.notes || "",
          status: data.status || "active"
        });
      }
    } else {
      // Normal create/update operation
      onSubmit(data);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3 sm:space-y-4">
        {initialData && (
          <div className="space-y-3 p-4 bg-blue-50 rounded-lg border">
            <div className="flex items-center space-x-2">
              <Switch
                id="use-existing"
                checked={useExistingLocation}
                onCheckedChange={setUseExistingLocation}
              />
              <label htmlFor="use-existing" className="text-sm font-medium">
                Reassign to existing location
              </label>
            </div>
            <p className="text-xs text-gray-600">
              Enable this to move contacts from this location to an existing host location
            </p>
            
            {useExistingLocation && (
              <FormField
                control={form.control}
                name="name"
                render={() => (
                  <FormItem>
                    <FormLabel>Select Existing Location</FormLabel>
                    <Select onValueChange={handleExistingLocationChange} value={selectedExistingHost}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a location to reassign to" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {allHosts
                          .filter(h => h.id !== initialData.id) // Don't show current host
                          .map((host) => (
                            <SelectItem key={host.id} value={host.id.toString()}>
                              {host.name}
                              {host.address && (
                                <span className="text-xs text-gray-500 ml-2">
                                  - {host.address.substring(0, 50)}...
                                </span>
                              )}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Contacts from "{initialData.name}" will be moved to the selected location
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>
        )}

        {(!useExistingLocation || !initialData) && (
          <>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter host location name" {...field} className="h-11 text-base" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter full address" 
                      {...field} 
                      value={field.value || ""} 
                      className="min-h-[80px] text-base resize-none" 
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Additional notes about this location" 
                      {...field} 
                      value={field.value || ""} 
                      className="min-h-[80px] text-base resize-none"
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} className="h-11 text-base">
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} className="h-11 text-base">
            {isLoading ? "Saving..." : 
             useExistingLocation && initialData ? "Reassign Location" :
             initialData ? "Update Host" : "Add Host"}
          </Button>
        </div>
      </form>
    </Form>
  );
};

// Recipient Form Component
const RecipientForm = ({ 
  initialData, 
  onSubmit, 
  onCancel, 
  isLoading 
}: {
  initialData?: Recipient;
  onSubmit: (data: z.infer<typeof insertRecipientSchema>) => void;
  onCancel: () => void;
  isLoading: boolean;
}) => {
  const form = useForm<z.infer<typeof insertRecipientSchema>>({
    resolver: zodResolver(insertRecipientSchema),
    defaultValues: {
      name: initialData?.name || "",
      contactName: initialData?.contactName || "",
      phone: initialData?.phone || "",
      email: initialData?.email || "",
      address: initialData?.address || "",
      status: initialData?.status || "active",
      preferences: initialData?.preferences || "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Organization Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter organization name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="contactName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contact Person</FormLabel>
              <FormControl>
                <Input placeholder="Enter contact person name" {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number</FormLabel>
              <FormControl>
                <Input placeholder="(555) 123-4567" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="contact@organization.org" {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address</FormLabel>
              <FormControl>
                <Textarea placeholder="Enter full address" {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="preferences"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Delivery Preferences</FormLabel>
              <FormControl>
                <Textarea placeholder="Special delivery instructions or preferences" {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving..." : initialData ? "Update Recipient" : "Add Recipient"}
          </Button>
        </div>
      </form>
    </Form>
  );
};

// Host Contact Form Component
const HostContactForm = ({ 
  hostId,
  initialData, 
  onSubmit, 
  onCancel, 
  isLoading,
  hosts
}: {
  hostId: number;
  initialData?: HostContact;
  onSubmit: (data: z.infer<typeof insertHostContactSchema>) => void;
  onCancel: () => void;
  isLoading?: boolean;
  hosts: Host[];
}) => {
  const form = useForm<z.infer<typeof insertHostContactSchema>>({
    resolver: zodResolver(insertHostContactSchema),
    defaultValues: {
      hostId,
      name: initialData?.name || "",
      role: initialData?.role || "coordinator",
      phone: initialData?.phone || "",
      email: initialData?.email || "",
      isPrimary: initialData?.isPrimary || false,
      notes: initialData?.notes || ""
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="hostId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Host Location</FormLabel>
              <Select onValueChange={(value) => field.onChange(Number(value))} defaultValue={field.value?.toString()}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select host location" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {hosts.map((host) => (
                    <SelectItem key={host.id} value={host.id.toString()}>
                      {host.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contact Name</FormLabel>
              <FormControl>
                <Input placeholder="Full name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="primary">Primary Contact</SelectItem>
                  <SelectItem value="backup">Backup Contact</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="coordinator">Coordinator</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="volunteer">Volunteer</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number</FormLabel>
              <FormControl>
                <Input placeholder="(555) 123-4567" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email (Optional)</FormLabel>
              <FormControl>
                <Input type="email" placeholder="email@example.com" {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Additional notes about this contact" {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Adding..." : "Add Contact"}
          </Button>
        </div>
      </form>
    </Form>
  );
};

// Contact Form Component
const ContactForm = ({ 
  initialData, 
  onSubmit, 
  onCancel, 
  isLoading 
}: {
  initialData?: GeneralContact;
  onSubmit: (data: z.infer<typeof insertContactSchema>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}) => {
  const form = useForm<z.infer<typeof insertContactSchema>>({
    resolver: zodResolver(insertContactSchema),
    defaultValues: {
      name: initialData?.name || "",
      phone: initialData?.phone || "",
      email: initialData?.email || "",
      address: initialData?.address || "",
      organization: initialData?.organization || "",
      role: initialData?.role || "",
      status: initialData?.status || "active",
      notes: initialData?.notes || "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter contact name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number</FormLabel>
              <FormControl>
                <Input placeholder="Enter phone number" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="Enter email address" {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="organization"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Organization</FormLabel>
              <FormControl>
                <Input placeholder="Enter organization name" {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <FormControl>
                <Input placeholder="Enter role or title" {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address</FormLabel>
              <FormControl>
                <Textarea placeholder="Enter address" {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea placeholder="Additional notes or information" {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving..." : initialData ? "Update Contact" : "Add Contact"}
          </Button>
        </div>
      </form>
    </Form>
  );
};

// File Import Dialog Component
const FileImportDialog = ({ open, onOpenChange, onImport, isLoading }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (file: File) => void;
  isLoading: boolean;
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleImport = () => {
    if (selectedFile) {
      onImport(selectedFile);
      setSelectedFile(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import Host & Driver Contacts</DialogTitle>
          <DialogDescription>
            Upload an Excel file (.xlsx) containing host locations and contact information
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <FileSpreadsheet className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <div className="text-sm text-gray-600 mb-4">
              Select your Excel file with host and driver contact data
            </div>
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="cursor-pointer"
            />
          </div>

          {selectedFile && (
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">
                  {selectedFile.name}
                </span>
              </div>
              <div className="text-xs text-blue-600 mt-1">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </div>
            </div>
          )}

          <div className="text-xs text-gray-500">
            <strong>Expected format:</strong> Excel file with columns for host names, contact names, roles, phone numbers, and email addresses.
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={!selectedFile || isLoading}
            className="bg-green-600 hover:bg-green-700"
          >
            {isLoading ? "Importing..." : "Import Contacts"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PhoneDirectory;
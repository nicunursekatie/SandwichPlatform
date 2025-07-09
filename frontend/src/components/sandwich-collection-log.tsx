import React, { useState, useRef, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sandwich, Calendar, User, Users, Edit, Trash2, Upload, AlertTriangle, Scan, Square, CheckSquare, Filter, X, ArrowUp, ArrowDown, Download, Plus, Database } from "lucide-react";
import sandwichLogo from "@assets/LOGOS/sandwich logo.png";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import BulkDataManager from "@/components/bulk-data-manager";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, PERMISSIONS } from "@shared/auth-utils";
import type { SandwichCollection, Host } from "@shared/schema";



interface ImportResult {
  totalRecords: number;
  successCount: number;
  errorCount: number;
  errors: string[];
}

interface DuplicateAnalysis {
  totalCollections: number;
  duplicateGroups: number;
  totalDuplicateEntries: number;
  suspiciousPatterns: number;
  ogDuplicates: number;
  duplicates: Array<{
    entries: SandwichCollection[];
    count: number;
    keepNewest: SandwichCollection;
    toDelete: SandwichCollection[];
  }>;
  suspiciousEntries: SandwichCollection[];
  ogDuplicateEntries: Array<{
    ogEntry?: SandwichCollection;
    earlyEntry?: SandwichCollection;
    duplicateOgEntry?: SandwichCollection;
    reason: string;
  }>;
}

export default function SandwichCollectionLog() {
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Check user permissions for editing data
  const canEditData = hasPermission(user, PERMISSIONS.EDIT_DATA);
  const canDeleteData = hasPermission(user, PERMISSIONS.DELETE_DATA);
  const [editingCollection, setEditingCollection] = useState<SandwichCollection | null>(null);
  const [showDuplicateAnalysis, setShowDuplicateAnalysis] = useState(false);
  const [duplicateAnalysis, setDuplicateAnalysis] = useState<DuplicateAnalysis | null>(null);
  const [selectedCollections, setSelectedCollections] = useState<Set<number>>(new Set());
  const [showBatchEdit, setShowBatchEdit] = useState(false);
  const [batchEditData, setBatchEditData] = useState({
    hostName: "",
    collectionDate: ""
  });
  const [searchFilters, setSearchFilters] = useState({
    hostName: "",
    collectionDateFrom: "",
    collectionDateTo: "",
    createdAtFrom: "",
    createdAtTo: ""
  });

  const [sortConfig, setSortConfig] = useState({
    field: "collectionDate" as keyof SandwichCollection,
    direction: "desc" as "asc" | "desc"
  });
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [editFormData, setEditFormData] = useState({
    collectionDate: "",
    hostName: "",
    individualSandwiches: "",
    groupCollections: ""
  });
  const [editGroupCollections, setEditGroupCollections] = useState<Array<{id: string, groupName: string, sandwichCount: number}>>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDataManagement, setShowDataManagement] = useState(false);
  const [newCollectionData, setNewCollectionData] = useState({
    collectionDate: "",
    hostName: "",
    individualSandwiches: "",
    groupCollections: ""
  });
  const [newGroupCollections, setNewGroupCollections] = useState<Array<{id: string, groupName: string, sandwichCount: number}>>([
    { id: Math.random().toString(36), groupName: "", sandwichCount: 0 }
  ]);
  const [newCollectionGroupOnlyMode, setNewCollectionGroupOnlyMode] = useState(false);

  // Memoize expensive computations
  const needsAllData = useMemo(() => 
    showFilters || Object.values(searchFilters).some(v => v) || 
    sortConfig.field !== "collectionDate" || sortConfig.direction !== "desc",
    [showFilters, searchFilters, sortConfig]
  );

  const queryKey = useMemo(() => [
    "/api/sandwich-collections", 
    needsAllData ? "all" : currentPage, 
    needsAllData ? "all" : itemsPerPage, 
    searchFilters, 
    sortConfig
  ], [needsAllData, currentPage, itemsPerPage, searchFilters, sortConfig]);

  const { data: collectionsResponse, isLoading } = useQuery({
    queryKey,
    queryFn: useCallback(async () => {
      if (needsAllData) {
        const response = await fetch('/api/sandwich-collections?limit=10000');
        if (!response.ok) throw new Error('Failed to fetch collections');
        const data = await response.json();
        
        let filteredCollections = data.collections || [];
        
        // Apply filters
        if (searchFilters.hostName) {
          const searchTerm = searchFilters.hostName.toLowerCase();
          filteredCollections = filteredCollections.filter((c: SandwichCollection) => 
            c.hostName?.toLowerCase().includes(searchTerm)
          );
        }
        
        if (searchFilters.collectionDateFrom) {
          filteredCollections = filteredCollections.filter((c: SandwichCollection) => 
            c.collectionDate >= searchFilters.collectionDateFrom
          );
        }
        
        if (searchFilters.collectionDateTo) {
          filteredCollections = filteredCollections.filter((c: SandwichCollection) => 
            c.collectionDate <= searchFilters.collectionDateTo
          );
        }
        
        if (searchFilters.createdAtFrom) {
          filteredCollections = filteredCollections.filter((c: SandwichCollection) => 
            c.submittedAt >= searchFilters.createdAtFrom
          );
        }
        
        if (searchFilters.createdAtTo) {
          filteredCollections = filteredCollections.filter((c: SandwichCollection) => 
            c.submittedAt <= searchFilters.createdAtTo
          );
        }
        
        // Apply sorting
        filteredCollections.sort((a: any, b: any) => {
          const aVal = a[sortConfig.field];
          const bVal = b[sortConfig.field];
          
          if (aVal === bVal) return 0;
          if (aVal === null || aVal === undefined) return 1;
          if (bVal === null || bVal === undefined) return -1;
          
          const comparison = aVal < bVal ? -1 : 1;
          return sortConfig.direction === "asc" ? comparison : -comparison;
        });
        
        // Apply pagination
        const startIndex = (currentPage - 1) * itemsPerPage;
        const paginatedResults = filteredCollections.slice(startIndex, startIndex + itemsPerPage);
        
        return {
          collections: paginatedResults,
          pagination: {
            currentPage,
            totalPages: Math.ceil(filteredCollections.length / itemsPerPage),
            totalItems: filteredCollections.length,
            itemsPerPage
          }
        };
      } else {
        const response = await fetch(`/api/sandwich-collections?page=${currentPage}&limit=${itemsPerPage}`);
        if (!response.ok) throw new Error('Failed to fetch collections');
        return response.json();
      }
    }, [needsAllData, currentPage, itemsPerPage, searchFilters, sortConfig])
  });

  const collections = collectionsResponse?.collections || [];
  const pagination = collectionsResponse?.pagination;

  const { data: hostsList = [] } = useQuery<Host[]>({
    queryKey: ["/api/hosts"]
  });

  // Query for complete database totals including both individual and group collections
  const { data: totalStats } = useQuery({
    queryKey: ["/api/sandwich-collections/stats"],
    queryFn: async () => {
      const response = await fetch('/api/sandwich-collections/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    }
  });

  // Filter and sort collections
  const filteredCollections = collections
    .filter(collection => {
      // Host name filter
      if (searchFilters.hostName && !collection.hostName.toLowerCase().includes(searchFilters.hostName.toLowerCase())) {
        return false;
      }

      // Collection date range filter
      if (searchFilters.collectionDateFrom) {
        const collectionDate = new Date(collection.collectionDate);
        const fromDate = new Date(searchFilters.collectionDateFrom);
        if (collectionDate < fromDate) return false;
      }

      if (searchFilters.collectionDateTo) {
        const collectionDate = new Date(collection.collectionDate);
        const toDate = new Date(searchFilters.collectionDateTo);
        if (collectionDate > toDate) return false;
      }

      // Created at date range filter
      if (searchFilters.createdAtFrom) {
        const createdDate = new Date(collection.submittedAt);
        const fromDate = new Date(searchFilters.createdAtFrom);
        if (createdDate < fromDate) return false;
      }

      if (searchFilters.createdAtTo) {
        const createdDate = new Date(collection.submittedAt);
        const toDate = new Date(searchFilters.createdAtTo);
        // Add 23:59:59 to include the entire day
        toDate.setHours(23, 59, 59, 999);
        if (createdDate > toDate) return false;
      }

      return true;
    })
    .sort((a, b) => {
      const aValue = a[sortConfig.field];
      const bValue = b[sortConfig.field];

      // Handle different data types
      let comparison = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else if (aValue instanceof Date && bValue instanceof Date) {
        comparison = aValue.getTime() - bValue.getTime();
      } else {
        // Handle date strings
        const aDate = new Date(aValue as string);
        const bDate = new Date(bValue as string);
        comparison = aDate.getTime() - bDate.getTime();
      }

      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });

  // Use server-side pagination data
  const totalItems = pagination?.total || 0;
  const totalPages = pagination?.totalPages || 1;
  const paginatedCollections = filteredCollections;



  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchFilters, sortConfig]);

  // Get unique host names from collections for filtering
  const uniqueHostNames = Array.from(new Set(collections.map(c => c.hostName))).sort();

  // Include all hosts (active and inactive) for collection assignment
  const hostOptions = [...hostsList.map(host => host.name), "Other"];

  const formatDate = (dateString: string) => {
    // Parse date as local date to avoid timezone issues
    const [year, month, day] = dateString.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    return localDate.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatSubmittedAt = (timestamp: string | Date) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    }) + ' at ' + new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateTotal = (collection: SandwichCollection) => {
    const individual = Number(collection.individualSandwiches || 0);
    let groupTotal = 0;
    
    try {
      // Handle different formats in groupCollections
      if (!collection.groupCollections || collection.groupCollections === "[]" || collection.groupCollections === "") {
        return individual;
      }
      
      // Try to parse as JSON first
      const groupData = JSON.parse(collection.groupCollections);
      if (Array.isArray(groupData)) {
        groupTotal = groupData.reduce((sum: number, group: any) => sum + (Number(group.sandwichCount) || 0), 0);
      } else if (typeof groupData === 'number') {
        groupTotal = Number(groupData);
      } else if (typeof groupData === 'object' && groupData.sandwichCount) {
        groupTotal = Number(groupData.sandwichCount);
      }
    } catch (error) {
      // Handle text format like "Marketing Team: 8, Development: 6"
      if (collection.groupCollections && collection.groupCollections !== "[]") {
        const matches = collection.groupCollections.match(/(\d+)/g);
        if (matches) {
          groupTotal = matches.reduce((sum, num) => sum + parseInt(num), 0);
        }
      }
    }
    
    return individual + groupTotal;
  };

  const parseGroupCollections = (groupCollectionsJson: string) => {
    try {
      return JSON.parse(groupCollectionsJson || "[]");
    } catch {
      // Handle text format by converting to array
      if (groupCollectionsJson && groupCollectionsJson !== "[]") {
        const parts = groupCollectionsJson.split(',');
        return parts.map(part => {
          const match = part.match(/([^:]+):\s*(\d+)/);
          if (match) {
            return {
              groupName: match[1].trim(),
              sandwichCount: parseInt(match[2])
            };
          }
          return null;
        }).filter(item => item !== null);
      }
      return [];
    }
  };

  // Mutations for update and delete
  const updateMutation = useMutation({
    mutationFn: async (data: { id: number; updates: any }) => {
      return await apiRequest('PATCH', `/api/sandwich-collections/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sandwich-collections"] });
      setEditingCollection(null);
      toast({
        title: "Collection updated",
        description: "Sandwich collection has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update collection. Please try again.",
        variant: "destructive",
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/sandwich-collections/${id}`);
      // Don't try to parse JSON for 204 responses
      return response.status === 204 ? null : response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sandwich-collections"] });
      toast({
        title: "Collection deleted",
        description: "Sandwich collection has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete collection. Please try again.",
        variant: "destructive",
      });
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/sandwich-collections', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sandwich-collections"] });
      setShowAddForm(false);
      setNewCollectionData({
        collectionDate: "",
        hostName: "",
        individualSandwiches: "",
        groupCollections: ""
      });
      setNewGroupCollections([{ id: Math.random().toString(36), groupName: "", sandwichCount: 0 }]);
      setNewCollectionGroupOnlyMode(false);
      toast({
        title: "Collection added",
        description: "The sandbox collection has been added successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Add failed",
        description: "Failed to add the collection. Please try again.",
        variant: "destructive",
      });
    }
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('csvFile', file);

      const response = await fetch('/api/import-collections', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      return response.json() as Promise<ImportResult>;
    },
    onSuccess: (result: ImportResult) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sandwich-collections"] });
      toast({
        title: "Import completed",
        description: `Successfully imported ${result.successCount} of ${result.totalRecords} records.`,
      });
      if (result.errorCount > 0) {
        console.log("Import errors:", result.errors);
      }
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    onError: (error) => {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Failed to import CSV file",
        variant: "destructive",
      });
    }
  });

  const analyzeDuplicatesMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/sandwich-collections/analyze-duplicates");
      if (!response.ok) throw new Error('Failed to analyze duplicates');
      return response.json() as Promise<DuplicateAnalysis>;
    },
    onSuccess: (result: DuplicateAnalysis) => {
      setDuplicateAnalysis(result);
      setShowDuplicateAnalysis(true);
      toast({
        title: "Analysis complete",
        description: `Found ${result.totalDuplicateEntries} duplicate entries and ${result.suspiciousPatterns} suspicious patterns.`,
      });
    },
    onError: () => {
      toast({
        title: "Analysis failed",
        description: "Failed to analyze duplicates. Please try again.",
        variant: "destructive",
      });
    }
  });

  const cleanDuplicatesMutation = useMutation({
    mutationFn: async (mode: 'exact' | 'suspicious' | 'og-duplicates') => {
      const response = await fetch("/api/sandwich-collections/clean-duplicates", {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });
      if (!response.ok) throw new Error('Failed to clean duplicates');
      return response.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sandwich-collections"] });
      setShowDuplicateAnalysis(false);
      setDuplicateAnalysis(null);
      toast({
        title: "Cleanup completed",
        description: `Successfully cleaned ${result.deletedCount} duplicate entries.`,
      });
    },
    onError: () => {
      toast({
        title: "Cleanup failed",
        description: "Failed to clean duplicates. Please try again.",
        variant: "destructive",
      });
    }
  });

  const batchEditMutation = useMutation({
    mutationFn: async (data: { ids: number[], updates: Partial<SandwichCollection> }) => {
      console.log("Batch edit request:", data);
      const response = await fetch("/api/sandwich-collections/batch-edit", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Batch edit error response:", errorData);
        throw new Error(errorData.message || "Failed to update collections");
      }

      const result = await response.json();
      console.log("Batch edit success response:", result);
      return result;
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sandwich-collections"] });
      setSelectedCollections(new Set());
      setShowBatchEdit(false);
      setBatchEditData({ hostName: "", collectionDate: "" });
      toast({
        title: "Batch edit completed",
        description: `Successfully updated ${result.updatedCount} of ${result.totalRequested} collections.`,
      });
    },
    onError: (error: any) => {
      console.error("Batch edit mutation error:", error);
      toast({
        title: "Batch edit failed",
        description: error.message || "Failed to update collections. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Export function
  const exportToCSV = async () => {
    try {
      // Fetch all collections data for export
      const response = await fetch('/api/sandwich-collections?limit=10000');
      if (!response.ok) throw new Error('Failed to fetch all collections');
      const allCollectionsData = await response.json();
      const allCollections = allCollectionsData.collections || [];

      if (allCollections.length === 0) {
        toast({
          title: "No data to export",
          description: "There are no collections to export.",
          variant: "destructive",
        });
        return;
      }

      const headers = ["ID", "Host Name", "Individual Sandwiches", "Collection Date", "Group Collections", "Submitted At"];
      const csvData = [
        headers.join(","),
        ...allCollections.map((collection: SandwichCollection) => [
          collection.id,
          `"${collection.hostName}"`,
          collection.individualSandwiches,
          `"${collection.collectionDate}"`,
          `"${collection.groupCollections}"`,
          `"${new Date(collection.submittedAt).toLocaleString()}"`
        ].join(","))
      ].join("\n");

      const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `sandwich-collections-all-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export successful",
        description: `All ${allCollections.length} collections exported to CSV.`,
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export collections data.",
        variant: "destructive",
      });
    }
  };

  const batchDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const response = await fetch("/api/sandwich-collections/batch-delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids })
      });
      return response.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sandwich-collections"] });
      setSelectedCollections(new Set());
      toast({
        title: "Batch delete completed",
        description: `Successfully deleted ${result.deletedCount} collections.`,
      });
    },
    onError: () => {
      toast({
        title: "Batch delete failed",
        description: "Failed to delete collections. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      importMutation.mutate(file);
    } else {
      toast({
        title: "Invalid file",
        description: "Please select a valid CSV file.",
        variant: "destructive",
      });
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCollections(new Set(filteredCollections.map(c => c.id)));
    } else {
      setSelectedCollections(new Set());
    }
  };

  const handleSelectCollection = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedCollections);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedCollections(newSelected);
  };

  const handleBatchEdit = () => {
    if (selectedCollections.size === 0) {
      toast({
        title: "No collections selected",
        description: "Please select collections to edit.",
        variant: "destructive",
      });
      return;
    }
    setShowBatchEdit(true);
  };

  const submitBatchEdit = () => {
    console.log("submitBatchEdit called with batchEditData:", batchEditData);
    console.log("selectedCollections:", Array.from(selectedCollections));

    const updates: Partial<SandwichCollection> = {};
    if (batchEditData.hostName) updates.hostName = batchEditData.hostName;
    if (batchEditData.collectionDate) updates.collectionDate = batchEditData.collectionDate;

    console.log("Prepared updates:", updates);

    if (Object.keys(updates).length === 0) {
      console.log("No updates to apply");
      toast({
        title: "No changes specified",
        description: "Please specify at least one field to update.",
        variant: "destructive",
      });
      return;
    }

    console.log("Submitting batch edit with:", {
      ids: Array.from(selectedCollections),
      updates
    });

    batchEditMutation.mutate({
      ids: Array.from(selectedCollections),
      updates
    });
  };

  const handleBatchDelete = () => {
    if (selectedCollections.size === 0) {
      toast({
        title: "No collections selected",
        description: "Please select collections to delete.",
        variant: "destructive",
      });
      return;
    }

    if (confirm(`Are you sure you want to delete ${selectedCollections.size} selected collections? This action cannot be undone.`)) {
      batchDeleteMutation.mutate(Array.from(selectedCollections));
    }
  };

  const handleEdit = (collection: SandwichCollection) => {
    setEditingCollection(collection);
    setEditFormData({
      collectionDate: collection.collectionDate,
      hostName: collection.hostName,
      individualSandwiches: collection.individualSandwiches.toString(),
      groupCollections: collection.groupCollections
    });
    
    // Parse existing group collections for editing
    const parsedGroups = parseGroupCollections(collection.groupCollections || "");
    if (parsedGroups.length > 0) {
      setEditGroupCollections(parsedGroups.map((group: any, index: number) => ({
        id: `edit-${index}`,
        groupName: group.groupName,
        sandwichCount: group.sandwichCount
      })));
    } else {
      setEditGroupCollections([{ id: "edit-1", groupName: "", sandwichCount: 0 }]);
    }
  };

  const handleUpdate = () => {
    if (!editingCollection) return;

    // Convert editGroupCollections back to JSON format with consistent property names
    const validGroups = editGroupCollections.filter(g => g.groupName.trim() && g.sandwichCount > 0);
    const groupCollectionsString = validGroups.length > 0 
      ? JSON.stringify(validGroups.map(g => ({ name: g.groupName.trim(), count: g.sandwichCount })))
      : '[]';

    updateMutation.mutate({
      id: editingCollection.id,
      updates: {
        collectionDate: editFormData.collectionDate,
        hostName: editFormData.hostName,
        individualSandwiches: parseInt(editFormData.individualSandwiches) || 0,
        groupCollections: groupCollectionsString
      }
    });
  };

  // Helper functions for edit group collections
  const addEditGroupRow = () => {
    const newId = `edit-${Date.now()}`;
    setEditGroupCollections([...editGroupCollections, { id: newId, groupName: "", sandwichCount: 0 }]);
  };

  const removeEditGroupRow = (id: string) => {
    if (editGroupCollections.length > 1) {
      setEditGroupCollections(editGroupCollections.filter(group => group.id !== id));
    }
  };

  const updateEditGroupCollection = (id: string, field: 'groupName' | 'sandwichCount', value: string | number) => {
    setEditGroupCollections(editGroupCollections.map(group => 
      group.id === id ? { ...group, [field]: value } : group
    ));
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this collection? This action cannot be undone.")) {
      deleteMutation.mutate(id);
    }
  };

  const handleNewCollectionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // In group-only mode, we only require collection date and group collections
    if (newCollectionGroupOnlyMode) {
      if (!newCollectionData.collectionDate) {
        toast({
          title: "Missing information",
          description: "Please fill in the collection date.",
          variant: "destructive",
        });
        return;
      }
      
      const validGroupCollections = newGroupCollections.filter(
        (g) => g.sandwichCount > 0,
      );
      
      if (validGroupCollections.length === 0) {
        toast({
          title: "Missing group collections",
          description: "Please add at least one group collection with a sandwich count.",
          variant: "destructive",
        });
        return;
      }
    } else {
      // Regular mode requires host name and collection date
      if (!newCollectionData.collectionDate || !newCollectionData.hostName) {
        toast({
          title: "Missing required fields",
          description: "Please fill in the collection date and host name.",
          variant: "destructive",
        });
        return;
      }
    }

    // Format group collections as JSON to match the schema
    const validGroupCollections = newGroupCollections.filter(group => group.sandwichCount > 0);
    const formattedGroupCollections = validGroupCollections.length > 0 
      ? JSON.stringify(validGroupCollections.map(g => ({ 
          name: g.groupName.trim() || "Unnamed Group", 
          count: g.sandwichCount 
        })))
      : '[]';

    const submissionData = {
      collectionDate: newCollectionData.collectionDate,
      hostName: newCollectionGroupOnlyMode ? "Groups - Unassigned" : newCollectionData.hostName,
      individualSandwiches: newCollectionGroupOnlyMode ? 0 : parseInt(newCollectionData.individualSandwiches) || 0,
      groupCollections: formattedGroupCollections
    };

    createMutation.mutate(submissionData);
  };

  const addNewGroupRow = () => {
    setNewGroupCollections([...newGroupCollections, { 
      id: Math.random().toString(36), 
      groupName: "", 
      sandwichCount: 0 
    }]);
  };

  const removeNewGroupRow = (id: string) => {
    if (newGroupCollections.length > 1) {
      setNewGroupCollections(newGroupCollections.filter(group => group.id !== id));
    }
  };

  const updateNewGroupCollection = (id: string, field: 'groupName' | 'sandwichCount', value: string | number) => {
    setNewGroupCollections(newGroupCollections.map(group => 
      group.id === id ? { ...group, [field]: value } : group
    ));
  };

  // Handler functions that reset page when sorting/filtering
  const handleSortChange = (field: keyof SandwichCollection) => {
    setSortConfig(prev => ({ ...prev, field }));
    setCurrentPage(1);
  };

  const handleSortDirectionChange = () => {
    setSortConfig(prev => ({ ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' }));
    setCurrentPage(1);
  };

  const handleFilterChange = (filterUpdates: Partial<typeof searchFilters>) => {
    setSearchFilters(prev => ({ ...prev, ...filterUpdates }));
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearchFilters({
      hostName: "",
      collectionDateFrom: "",
      collectionDateTo: "",
      createdAtFrom: "",
      createdAtTo: ""
    });
    setCurrentPage(1);
  };

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
      <div className="px-6 py-4 border-b border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 flex items-center">
              <img src={sandwichLogo} alt="Sandwich Logo" className="mr-2 w-5 h-5" />
              Collections
            </h2>
            <p className="text-sm text-slate-500 mt-1">Manage collection data and bulk operations</p>
          </div>
          {canEditData && (
            <Button
              onClick={() => setShowDataManagement(true)}
              variant="outline"
              size="sm"
              className="flex items-center space-x-2 w-full sm:w-auto btn-outline-tsp h-10 text-sm"
              style={{borderColor: 'var(--tsp-teal)', color: 'var(--tsp-teal)'}}
            >
              <Database className="w-4 h-4" />
              <span className="hidden sm:inline">Data Management</span>
              <span className="sm:hidden">Data</span>
            </Button>
          )}
        </div>
      </div>
      
      <div className="px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
            <p className="text-sm text-slate-500">{totalItems} total entries</p>
            {totalStats && (
              <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-4 text-sm">
                <span className="text-slate-600">
                  <span className="font-medium text-amber-600">{totalStats.completeTotalSandwiches.toLocaleString()}</span> total sandwiches
                </span>
                <span className="text-slate-400 hidden sm:inline">|</span>
                <span className="text-slate-500">
                  {totalStats.individualSandwiches.toLocaleString()} individual + {totalStats.groupSandwiches.toLocaleString()} group
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canEditData && (
              <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center space-x-1 w-full sm:w-auto"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Collection</span>
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add New Collection</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleNewCollectionSubmit} className="space-y-4">
                  {/* Group-only mode toggle */}
                  <div className="flex items-center space-x-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <Checkbox
                      id="newCollectionGroupOnlyMode"
                      checked={newCollectionGroupOnlyMode}
                      onCheckedChange={(checked) => {
                        setNewCollectionGroupOnlyMode(checked as boolean);
                        // Reset form when switching modes
                        if (checked) {
                          setNewCollectionData(prev => ({
                            ...prev,
                            hostName: "",
                            individualSandwiches: ""
                          }));
                        }
                      }}
                    />
                    <Label htmlFor="newCollectionGroupOnlyMode" className="text-sm font-medium text-blue-900">
                      Group Collections Only Mode
                    </Label>
                    <span className="text-xs text-blue-700 ml-2">
                      (For logging group collections without specifying a host)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="collectionDate">Collection Date *</Label>
                      <Input
                        id="collectionDate"
                        type="date"
                        value={newCollectionData.collectionDate}
                        onChange={(e) => setNewCollectionData(prev => ({
                          ...prev,
                          collectionDate: e.target.value
                        }))}
                        required
                      />
                    </div>
                    {!newCollectionGroupOnlyMode && (
                      <div>
                        <Label htmlFor="hostName">Host Name *</Label>
                        <Select
                          value={newCollectionData.hostName}
                          onValueChange={(value) => setNewCollectionData(prev => ({
                            ...prev,
                            hostName: value
                          }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a host" />
                          </SelectTrigger>
                          <SelectContent>
                            {hostOptions.map((hostName, index) => (
                              <SelectItem key={index} value={hostName}>
                                {hostName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {!newCollectionGroupOnlyMode && (
                    <div>
                      <Label htmlFor="individualSandwiches">Individual Sandwiches</Label>
                      <Input
                        id="individualSandwiches"
                        type="number"
                        min="0"
                        value={newCollectionData.individualSandwiches}
                        onChange={(e) => setNewCollectionData(prev => ({
                          ...prev,
                          individualSandwiches: e.target.value
                        }))}
                        placeholder="0"
                      />
                    </div>
                  )}

                  <div>
                    <Label>Group Collections</Label>
                    {newGroupCollections.map((group, index) => (
                      <div key={group.id} className="flex items-center space-x-2 mt-2">
                        <Input
                          placeholder="Group name"
                          value={group.groupName}
                          onChange={(e) => updateNewGroupCollection(group.id, 'groupName', e.target.value)}
                          className="flex-1"
                          required
                        />
                        <Input
                          type="number"
                          min="0"
                          placeholder="Count"
                          value={group.sandwichCount}
                          onChange={(e) => updateNewGroupCollection(group.id, 'sandwichCount', parseInt(e.target.value) || 0)}
                          className="w-24"
                        />
                        {newGroupCollections.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeNewGroupRow(group.id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addNewGroupRow}
                      className="mt-2"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Group
                    </Button>
                    <p className="text-sm text-gray-600 mt-3">
                      Record group collections with sandwich counts. Group names are optional - 
                      entries without names will be listed as "Unnamed Group".
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddForm(false)}
                      className="w-full sm:w-auto"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending}
                      className="w-full sm:w-auto"
                    >
                      {createMutation.isPending ? "Adding..." : "Add Collection"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
              </Dialog>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-1 w-full sm:w-auto"
            >
              <Filter className="w-4 h-4" />
              <span>Filter</span>
            </Button>
            {selectedCollections.size > 0 && canEditData && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBatchEdit}
                  className="flex items-center"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit ({selectedCollections.size})
                </Button>
                {canDeleteData && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBatchDelete}
                    className="flex items-center text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete ({selectedCollections.size})
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <Label htmlFor="hostFilter" className="text-sm font-medium text-slate-700">Host/Location Name</Label>
              <Input
                id="hostFilter"
                placeholder="Search by host name..."
                value={searchFilters.hostName}
                onChange={(e) => handleFilterChange({ hostName: e.target.value })}
                className="mt-1"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => handleFilterChange({ hostName: "OG Sandwich Project" })}
                  className="px-3 py-1 text-xs bg-amber-100 text-amber-800 border border-amber-300 rounded-full hover:bg-amber-200 transition-colors"
                >
                  👑 Historical OG Project
                </button>
                <button
                  onClick={() => handleFilterChange({ hostName: "" })}
                  className="px-3 py-1 text-xs bg-slate-100 text-slate-700 border border-slate-300 rounded-full hover:bg-slate-200 transition-colors"
                >
                  All Locations
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="collectionFromDate" className="text-sm font-medium text-slate-700">Collection Date From</Label>
              <Input
                id="collectionFromDate"
                type="date"
                value={searchFilters.collectionDateFrom}
                onChange={(e) => handleFilterChange({ collectionDateFrom: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="collectionToDate" className="text-sm font-medium text-slate-700">Collection Date To</Label>
              <Input
                id="collectionToDate"
                type="date"
                value={searchFilters.collectionDateTo}
                onChange={(e) => handleFilterChange({ collectionDateTo: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="createdFromDate" className="text-sm font-medium text-slate-700">Created Date From</Label>
              <Input
                id="createdFromDate"
                type="date"
                value={searchFilters.createdAtFrom}
                onChange={(e) => handleFilterChange({ createdAtFrom: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="createdToDate" className="text-sm font-medium text-slate-700">Created Date To</Label>
              <Input
                id="createdToDate"
                type="date"
                value={searchFilters.createdAtTo}
                onChange={(e) => handleFilterChange({ createdAtTo: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-4 gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <div className="text-sm text-slate-600">
                Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} entries
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                <Label className="text-sm font-medium text-slate-700">Sort by:</Label>
                <div className="flex items-center space-x-2">
                  <Select
                    value={sortConfig.field}
                    onValueChange={(value) => handleSortChange(value as keyof SandwichCollection)}
                  >
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="collectionDate">Collection Date</SelectItem>
                      <SelectItem value="hostName">Host Name</SelectItem>
                      <SelectItem value="individualSandwiches">Sandwich Count</SelectItem>
                      <SelectItem value="submittedAt">Created Date</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSortDirectionChange}
                    className="flex items-center space-x-1"
                  >
                    {sortConfig.direction === 'asc' ? '↑' : '↓'}
                    <span className="hidden sm:inline">{sortConfig.direction === 'asc' ? 'Asc' : 'Desc'}</span>
                  </Button>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearFilters}
              className="flex items-center space-x-1 w-full sm:w-auto"
            >
              <X className="w-4 h-4" />
              <span>Clear Filters</span>
            </Button>
          </div>
        </div>
      )}
      <div className="p-6">
        {paginatedCollections.length > 0 && (
          <div className="flex items-center space-x-3 mb-4 pb-3 border-b border-slate-200">
            <button
              onClick={() => handleSelectAll(!selectedCollections.size || selectedCollections.size < filteredCollections.length)}
              className="flex items-center space-x-2 text-sm text-slate-600 hover:text-slate-900"
            >
              {selectedCollections.size === filteredCollections.length ? (
                <CheckSquare className="w-4 h-4" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              <span>Select All</span>
            </button>
            {selectedCollections.size > 0 && (
              <span className="text-sm text-slate-500">
                {selectedCollections.size} of {filteredCollections.length} selected
              </span>
            )}
          </div>
        )}
        <div className="space-y-4">
          {paginatedCollections.map((collection) => {
            const groupData = parseGroupCollections(collection.groupCollections);
            const totalSandwiches = calculateTotal(collection);
            const isSelected = selectedCollections.has(collection.id);

            // Check if the host is inactive
            const hostData = hostsList.find(h => h.name === collection.hostName);
            const isInactiveHost = hostData?.status === 'inactive';

            return (
              <div 
                key={collection.id} 
                className={`border rounded-lg p-4 ${
                  isSelected 
                    ? 'bg-blue-50 border-blue-200' 
                    : isInactiveHost 
                      ? 'bg-gray-100 border-gray-400 opacity-70' 
                      : 'border-slate-200'
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    {canEditData && (
                      <button
                        onClick={() => handleSelectCollection(collection.id, !isSelected)}
                        className="flex items-center"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                        )}
                      </button>
                    )}
                    <div className={`flex items-center ${isInactiveHost ? 'text-gray-600' : 'text-slate-700'}`}>
                      <Calendar className={`w-4 h-4 mr-1 ${isInactiveHost ? 'text-gray-500' : ''}`} />
                      <span className="font-medium">{formatDate(collection.collectionDate)}</span>
                    </div>
                    <div className={`flex items-center ${isInactiveHost ? 'text-gray-500' : 'text-slate-600'}`}>
                      <User className={`w-4 h-4 mr-1 ${isInactiveHost ? 'text-gray-400' : ''}`} />
                      <span>{collection.hostName}</span>
                      {collection.hostName === 'OG Sandwich Project' && (
                        <span className="ml-2 text-xs bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 px-2 py-0.5 rounded-full font-medium border border-amber-300">
                          👑 HISTORICAL
                        </span>
                      )}
                      {isInactiveHost && (
                        <span className="ml-2 text-xs bg-gray-300 text-gray-800 px-2 py-0.5 rounded-full font-medium">
                          INACTIVE HOST
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="text-right mr-3">
                      <div className={`text-lg font-semibold ${isInactiveHost ? 'text-gray-700' : 'text-slate-900'}`}>{totalSandwiches}</div>
                      <div className={`text-xs ${isInactiveHost ? 'text-gray-500' : 'text-slate-500'}`}>total sandwiches</div>
                    </div>
                    {canEditData && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(collection)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    )}
                    {canDeleteData && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(collection.id)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Individual Collections */}
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">Individual Collections</span>
                      <span className="text-sm font-semibold text-slate-900">{collection.individualSandwiches}</span>
                    </div>
                  </div>

                  {/* Group Collections */}
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">Group Collections</span>
                      <span className="text-sm font-semibold text-slate-900">
                        {Array.isArray(groupData) 
                          ? groupData.reduce((sum: number, group: any) => sum + (group.sandwichCount || 0), 0)
                          : 0}
                      </span>
                    </div>
                    {Array.isArray(groupData) && groupData.length > 0 && (
                      <div className="space-y-1">
                        {groupData.map((group: any, index: number) => (
                          <div key={index} className="flex items-center justify-between text-xs">
                            <span className="text-slate-600 flex items-center">
                              <Users className="w-3 h-3 mr-1" />
                              {group.groupName}
                            </span>
                            <span className="text-slate-700 font-medium">{group.sandwichCount}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {(!Array.isArray(groupData) || groupData.length === 0) && (
                      <div className="text-xs text-slate-500">No group collections</div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <div className="text-xs text-slate-500">
                    Submitted {formatSubmittedAt(collection.submittedAt)}
                  </div>
                </div>
              </div>
            );
          })}

          {collections.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              No collection entries found. Use the form above to record sandwich collections.
            </div>
          )}

          {collections.length > 0 && filteredCollections.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              No entries match the current filters. Try adjusting your search criteria.
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        {totalItems > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
            <div className="flex items-center space-x-4">
              <Select value={itemsPerPage.toString()} onValueChange={(value) => {
                setItemsPerPage(Number(value));
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25 per page</SelectItem>
                  <SelectItem value="50">50 per page</SelectItem>
                  <SelectItem value="100">100 per page</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>

                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNumber = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                    if (pageNumber > totalPages) return null;

                    return (
                      <Button
                        key={pageNumber}
                        variant={pageNumber === currentPage ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNumber)}
                        className="w-10"
                      >
                        {pageNumber}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  Last
                </Button>
              </div>
            )}

            <div className="text-sm text-slate-600 text-center sm:text-left">
              Page {currentPage} of {totalPages}
            </div>
          </div>
        )}
      </div>

      {/* Duplicate Analysis Modal */}
      <Dialog open={showDuplicateAnalysis} onOpenChange={setShowDuplicateAnalysis}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-amber-500" />
              Duplicate Analysis Results
            </DialogTitle>
          </DialogHeader>
          {duplicateAnalysis && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-slate-900">{duplicateAnalysis.totalCollections}</div>
                  <div className="text-sm text-slate-600">Total Collections</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{duplicateAnalysis.totalDuplicateEntries}</div>
                  <div className="text-sm text-slate-600">Duplicate Entries</div>
                </div>
              </div>

              {duplicateAnalysis.totalDuplicateEntries > 0 && (
                <div className="space-y-3">
                  <h3 className="font-medium text-slate-900">Exact Duplicates</h3>
                  {duplicateAnalysis.duplicates.map((group, index) => (
                    <div key={index} className="border border-slate-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{group.entries[0].hostName} - {group.entries[0].collectionDate}</span>
                        <span className="text-sm text-slate-600">{group.count} entries</span>
                      </div>
                      <div className="text-sm text-slate-600">
                        Will keep newest entry (ID: {group.keepNewest.id}) and remove {group.toDelete.length} duplicates
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {duplicateAnalysis.suspiciousPatterns > 0 && (
                <div className="space-y-3">
                  <h3 className="font-medium text-slate-900">Suspicious Patterns ({duplicateAnalysis.suspiciousPatterns})</h3>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {duplicateAnalysis.suspiciousEntries.slice(0, 10).map((entry) => (
                      <div key={entry.id} className="text-sm text-slate-600 border-l-2 border-amber-300 pl-2">
                        {entry.hostName} - {entry.collectionDate} (ID: {entry.id})
                      </div>
                    ))}
                    {duplicateAnalysis.suspiciousEntries.length > 10 && (
                      <div className="text-sm text-slate-500">... and {duplicateAnalysis.suspiciousEntries.length - 10} more</div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowDuplicateAnalysis(false)} className="w-full sm:w-auto">
                  Cancel
                </Button>
                {duplicateAnalysis.suspiciousPatterns > 0 && (
                  <Button 
                    variant="outline"
                    onClick={() => cleanDuplicatesMutation.mutate('suspicious')}
                    disabled={cleanDuplicatesMutation.isPending}
                    className="text-amber-600 hover:text-amber-700 w-full sm:w-auto"
                  >
                    Clean Suspicious ({duplicateAnalysis.suspiciousPatterns})
                  </Button>
                )}
                {duplicateAnalysis.totalDuplicateEntries > 0 && (
                  <Button 
                    onClick={() => cleanDuplicatesMutation.mutate('exact')}
                    disabled={cleanDuplicatesMutation.isPending}
                    className="bg-red-600 hover:bg-red-700 w-full sm:w-auto"
                  >
                    {cleanDuplicatesMutation.isPending ? "Cleaning..." : `Clean Duplicates (${duplicateAnalysis.totalDuplicateEntries})`}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={!!editingCollection} onOpenChange={(open) => !open && setEditingCollection(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Collection</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-date">Collection Date</Label>
              <Input
                id="edit-date"
                type="date"
                value={editFormData.collectionDate}
                onChange={(e) => setEditFormData({ ...editFormData, collectionDate: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="edit-host">Host Name</Label>
              <Select value={editFormData.hostName} onValueChange={(value) => setEditFormData({ ...editFormData, hostName: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select host" />
                </SelectTrigger>
                <SelectContent>
                  {hostOptions.map((host) => (
                    <SelectItem key={host} value={host}>{host}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="edit-individual">Individual Sandwiches</Label>
              <Input
                id="edit-individual"
                type="number"
                min="0"
                value={editFormData.individualSandwiches}
                onChange={(e) => setEditFormData({ ...editFormData, individualSandwiches: e.target.value })}
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>Group Collections</Label>
                <Button type="button" variant="outline" size="sm" onClick={addEditGroupRow}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Group
                </Button>
              </div>
              
              <div className="space-y-3 mt-2">
                {editGroupCollections.map((group) => (
                  <div key={group.id} className="flex gap-3 items-center">
                    <Input
                      placeholder="Group name"
                      value={group.groupName}
                      onChange={(e) => updateEditGroupCollection(group.id, "groupName", e.target.value)}
                      className="flex-1"
                      required
                    />
                    <Input
                      type="number"
                      min="0"
                      placeholder="Count"
                      value={group.sandwichCount || ""}
                      onChange={(e) => updateEditGroupCollection(group.id, "sandwichCount", parseInt(e.target.value) || 0)}
                      className="w-24"
                    />
                    {editGroupCollections.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeEditGroupRow(group.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setEditingCollection(null)}>
                Cancel
              </Button>
              <Button 
                onClick={handleUpdate}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Updating..." : "Update Collection"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Batch Edit Modal */}
      <Dialog open={showBatchEdit} onOpenChange={setShowBatchEdit}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Batch Edit Collections</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Editing {selectedCollections.size} selected collections. Leave fields empty to keep existing values.
            </p>

            <div>
              <Label htmlFor="batch-date">Collection Date</Label>
              <Input
                id="batch-date"
                type="date"
                value={batchEditData.collectionDate}
                onChange={(e) => setBatchEditData({ ...batchEditData, collectionDate: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="batch-host">Host Name</Label>
              <Select value={batchEditData.hostName} onValueChange={(value) => setBatchEditData({ ...batchEditData, hostName: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select host (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {hostOptions.map((host) => (
                    <SelectItem key={host} value={host}>{host}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setShowBatchEdit(false)}>
                Cancel
              </Button>
              <Button 
                onClick={submitBatchEdit}
                disabled={batchEditMutation.isPending}
              >
                {batchEditMutation.isPending ? "Updating..." : "Update Collections"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Data Management Dialog */}
      <Dialog open={showDataManagement} onOpenChange={setShowDataManagement}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Data Management Center</DialogTitle>
          </DialogHeader>
          <BulkDataManager 
            onExportCSV={exportToCSV}
            onImportCSV={() => fileInputRef.current?.click()}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
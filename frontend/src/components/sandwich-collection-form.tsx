import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Trash2, Sandwich } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import sandwichLogo from "@assets/LOGOS/sandwich logo.png";
import type { Host } from "@shared/schema";

interface GroupCollection {
  id: string;
  groupName: string;
  sandwichCount: number;
}

export default function SandwichCollectionForm() {
  const { toast } = useToast();

  // Default to today's date
  const today = new Date().toISOString().split("T")[0];
  const [collectionDate, setCollectionDate] = useState(today);
  const [hostName, setHostName] = useState("");
  const [isCustomHost, setIsCustomHost] = useState(false);
  const [individualSandwiches, setIndividualSandwiches] = useState("");
  const [groupCollections, setGroupCollections] = useState<GroupCollection[]>([
    { id: "1", groupName: "", sandwichCount: 0 },
  ]);
  const [groupOnlyMode, setGroupOnlyMode] = useState(false);

  // Fetch active hosts from the database
  const { data: hosts = [] } = useQuery<Host[]>({
    queryKey: ["/api/hosts"],
    queryFn: async () => {
      const response = await fetch("/api/hosts");
      if (!response.ok) throw new Error("Failed to fetch hosts");
      return response.json();
    },
  });

  // Include all hosts (active and inactive) for collection assignment
  const hostOptions = [...hosts.map((host) => host.name).filter(name => name && name.trim() !== ""), "Other"];

  // Mutation for creating new hosts
  const createHostMutation = useMutation({
    mutationFn: async (hostData: {
      name: string;
      address: string;
      phone: string;
      email: string;
      status: string;
    }) => {
      const response = await apiRequest("POST", "/api/hosts", hostData);
      return response.json();
    },
    onSuccess: () => {
      // Refresh all host-related queries to update dropdown and management sections
      queryClient.invalidateQueries({ queryKey: ["/api/hosts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hosts-with-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recipients"] });
    },
  });

  const submitCollectionMutation = useMutation({
    mutationFn: async (data: {
      collectionDate: string;
      hostName: string;
      individualSandwiches: number;
      groupCollections: string;
    }) => {
      return await apiRequest(
        "POST",
        "/api/sandwich-collections",
        data,
      );
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/sandwich-collections"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/hosts"] });

      // Sync to Google Sheets
      try {
        await apiRequest("POST", "/api/google-sheets/sync-entry", {
          collectionData: data
        });
        console.log("Collection synced to Google Sheets");
      } catch (error) {
        console.warn("Google Sheets sync failed:", error);
        // Don't show error to user as the main collection was successful
      }

      // Reset form
      setHostName("");
      setIsCustomHost(false);
      setIndividualSandwiches("");
      setGroupCollections([{ id: "1", groupName: "", sandwichCount: 0 }]);
      setGroupOnlyMode(false);
      toast({
        title: "Collection submitted",
        description: "Sandwich collection has been logged and synced to Google Sheets.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit collection. Please try again.",
        variant: "destructive",
      });
    },
  });

  const addGroupRow = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    setGroupCollections([
      ...groupCollections,
      { id: newId, groupName: "", sandwichCount: 0 },
    ]);
  };

  const removeGroupRow = (id: string) => {
    if (groupCollections.length > 1) {
      setGroupCollections(groupCollections.filter((group) => group.id !== id));
    }
  };

  const updateGroupCollection = (
    id: string,
    field: keyof GroupCollection,
    value: string | number,
  ) => {
    setGroupCollections(
      groupCollections.map((group) =>
        group.id === id ? { ...group, [field]: value } : group,
      ),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // In group-only mode, we only require collection date and group collections
    if (groupOnlyMode) {
      if (!collectionDate) {
        toast({
          title: "Missing information",
          description: "Please fill in the collection date.",
          variant: "destructive",
        });
        return;
      }
      
      const validGroupCollections = groupCollections.filter(
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
      // Regular mode requires host name and individual sandwiches
      if (!collectionDate || !hostName || !individualSandwiches) {
        toast({
          title: "Missing information",
          description:
            "Please fill in the collection date, host name, and individual sandwiches.",
          variant: "destructive",
        });
        return;
      }
    }

    // Check if host exists and create if needed (skip for "Groups")
    if (
      hostName !== "Groups" &&
      (isCustomHost || !hosts.some((h) => h.name === hostName))
    ) {
      try {
        await createHostMutation.mutateAsync({
          name: hostName.trim(),
          address: "",
          phone: "",
          email: "",
          status: "active",
        });

        toast({
          title: "New host location created",
          description: `"${hostName.trim()}" has been added to host locations.`,
        });
      } catch (error) {
        // Host might already exist, continue with collection creation
        console.log("Host creation skipped (may already exist):", error);
      }
    }

    // Filter for valid group collections (only those with sandwich counts > 0)
    const validGroupCollections = groupCollections.filter(
      (g) => g.sandwichCount > 0 && g.groupName.trim() !== "",
    );
    const groupCollectionsString =
      validGroupCollections.length > 0
        ? JSON.stringify(
            validGroupCollections.map((g) => ({
              name: g.groupName.trim(),
              count: g.sandwichCount,
            })),
          )
        : "[]";

    // In group-only mode, use "Groups" as host name and move group totals to individual sandwiches
    let finalHostName = hostName.trim();
    let finalIndividualSandwiches = parseInt(individualSandwiches) || 0;
    let finalGroupCollections = groupCollectionsString;
    
    if (groupOnlyMode) {
      finalHostName = "Groups";
      // In group-only mode, sum all group collections and put in individual sandwiches field
      const totalGroupSandwiches = validGroupCollections.reduce((sum, group) => sum + group.sandwichCount, 0);
      finalIndividualSandwiches = totalGroupSandwiches;
      finalGroupCollections = groupCollectionsString; // Keep the group breakdown for reference
    }

    submitCollectionMutation.mutate({
      collectionDate,
      hostName: finalHostName,
      individualSandwiches: finalIndividualSandwiches,
      groupCollections: finalGroupCollections,
    });
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
      <div className="px-6 py-4 border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center">
          <img src={sandwichLogo} alt="Sandwich Logo" className="mr-2 w-5 h-5" />
          Submit Collection
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Log a new sandwich collection for tracking
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Group-only mode toggle */}
        <div className="flex items-center space-x-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <Checkbox
            id="groupOnlyMode"
            checked={groupOnlyMode}
            onCheckedChange={(checked) => {
              setGroupOnlyMode(checked as boolean);
              // Reset form when switching modes
              if (checked) {
                setHostName("");
                setIndividualSandwiches("");
                setIsCustomHost(false);
              }
            }}
          />
          <Label htmlFor="groupOnlyMode" className="text-sm font-medium text-blue-900">
            Group Collections Only Mode
          </Label>
          <span className="text-xs text-blue-700 ml-2">
            (For logging group collections without specifying a host)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="collectionDate">Collection Date</Label>
            <Input
              id="collectionDate"
              type="date"
              value={collectionDate}
              onChange={(e) => setCollectionDate(e.target.value)}
              required
            />
          </div>

          {!groupOnlyMode && (
            <div className="space-y-2">
              <Label htmlFor="hostName">Host Name</Label>
            {isCustomHost ? (
              <div className="flex gap-2">
                <Input
                  id="hostName"
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  placeholder="Enter custom host name"
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCustomHost(false);
                    setHostName("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Select
                  value={hostName}
                  onValueChange={(value) => {
                    if (value === "Other") {
                      setIsCustomHost(true);
                      setHostName("");
                    } else {
                      setHostName(value);
                      setIsCustomHost(false);
                    }
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select host" />
                  </SelectTrigger>
                  <SelectContent>
                    {hostOptions.map((host) => (
                      <SelectItem key={host} value={host}>
                        {host === "Groups"
                          ? "Groups (no location)"
                          : host === "Other"
                            ? "Other (create new location)"
                            : host}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {hostName && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsCustomHost(true);
                    }}
                  >
                    Edit
                  </Button>
                )}
              </div>
            )}
            </div>
          )}
        </div>

        {!groupOnlyMode && (
          <div className="space-y-2">
            <Label htmlFor="individualSandwiches">Individual Sandwiches</Label>
            <Input
              id="individualSandwiches"
              type="number"
              min="0"
              value={individualSandwiches}
              onChange={(e) => setIndividualSandwiches(e.target.value)}
              placeholder="Number of individual sandwiches"
              required
            />
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Group Collections</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addGroupRow}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Group
            </Button>
          </div>

          <div className="space-y-3">
            {groupCollections.map((group) => (
              <div key={group.id} className="flex gap-3 items-center">
                <Input
                  placeholder="Group name"
                  value={group.groupName}
                  onChange={(e) =>
                    updateGroupCollection(group.id, "groupName", e.target.value)
                  }
                  className="flex-1"
                />
                <Input
                  type="number"
                  min="0"
                  placeholder="Count"
                  value={group.sandwichCount || ""}
                  onChange={(e) =>
                    updateGroupCollection(
                      group.id,
                      "sandwichCount",
                      parseInt(e.target.value) || 0,
                    )
                  }
                  className="w-24"
                />
                {groupCollections.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeGroupRow(group.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <p className="text-sm text-gray-600 mt-3">
            Add group collections if you have specific group donations to record.
          </p>
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={submitCollectionMutation.isPending}
            className="btn-tsp-primary"
          >
            {submitCollectionMutation.isPending
              ? "Submitting..."
              : "Submit Collection"}
          </Button>
        </div>
      </form>
    </div>
  );
}

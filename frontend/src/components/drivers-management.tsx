import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Car,
  Plus,
  Send,
  Upload,
  Phone,
  Mail,
  Edit2,
  MapPin,
  CheckCircle,
  XCircle,
  FileCheck,
  AlertTriangle,
  Download,
  Truck,
  Clock,
  Filter,
  X,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, PERMISSIONS } from "@shared/auth-utils";

interface Driver {
  id: number;
  name: string;
  phone: string;
  email: string;
  address?: string;
  zone: string; // Keep for backward compatibility
  routeDescription?: string; // New field for route descriptions like "SS to Dunwoody"

  hostId?: number;
  availability?: string;
  isActive: boolean;
  notes: string;
  vanApproved: boolean;
  homeAddress?: string;
  availabilityNotes?: string;
  emailAgreementSent: boolean;
  voicemailLeft: boolean;
  inactiveReason?: string;
}

interface Host {
  id: number;
  name: string;
  status: string;
}

export default function DriversManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const canEdit = hasPermission(user, PERMISSIONS.EDIT_DATA);
  const canExport = hasPermission(user, PERMISSIONS.EXPORT_DATA);
  const queryClient = useQueryClient();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAgreementModalOpen, setIsAgreementModalOpen] = useState(false);
  const [isSubmissionModalOpen, setIsSubmissionModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [deletingDriver, setDeletingDriver] = useState<Driver | null>(null);

  // Filter states
  const [filters, setFilters] = useState({
    vanDriversOnly: false,
    missingAgreementsOnly: false,
    selectedZone: "all",
  });

  const [newDriver, setNewDriver] = useState({
    name: "",
    phone: "",
    email: "",
    vehicleType: "",
    licenseNumber: "",
    availability: "available" as const,
    zone: "",
    routeDescription: "" as string | undefined,

    hostId: undefined as number | undefined,
  });

  const [volunteerForm, setVolunteerForm] = useState({
    submittedBy: "",
    phone: "",
    email: "",
    licenseNumber: "",
    vehicleInfo: "",
    emergencyContact: "",
    emergencyPhone: "",
    agreementAccepted: false,
  });

  const [agreementFile, setAgreementFile] = useState<File | null>(null);

  // Fetch drivers
  const { data: drivers = [], isLoading } = useQuery<Driver[]>({
    queryKey: ["/api/drivers"],
  });

  // Fetch hosts for selection dropdown
  const { data: hosts = [] } = useQuery<Host[]>({
    queryKey: ["/api/hosts"],
  });

  // Add driver mutation
  const addDriverMutation = useMutation({
    mutationFn: (driver: typeof newDriver) =>
      apiRequest("POST", "/api/drivers", driver),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      setNewDriver({
        name: "",
        phone: "",
        email: "",
        vehicleType: "",
        licenseNumber: "",
        availability: "available",
        zone: "",
        routeDescription: "",

        hostId: undefined,
      });
      setIsAddModalOpen(false);
      toast({ title: "Driver added successfully" });
    },
    onError: () => {
      toast({ title: "Failed to add driver", variant: "destructive" });
    },
  });

  // Update driver mutation
  const updateDriverMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Partial<Driver> }) =>
      apiRequest("PATCH", `/api/drivers/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      setEditingDriver(null);
      toast({ title: "Driver updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update driver", variant: "destructive" });
    },
  });
  const updateAgreement = (driver: Driver, newStatus: "signed" | "missing") => {
    const updatedNotes =
      newStatus === "signed"
        ? `${driver.notes || ""} AGREEMENT RECEIVED`
        : `${driver.notes || ""} AGREEMENT MISSING`;

    updateDriverMutation.mutate({
      id: driver.id,
      updates: { notes: updatedNotes },
    });
  };
  // Delete driver mutation
  const deleteDriverMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/drivers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      setDeletingDriver(null);
      toast({ title: "Driver deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete driver", variant: "destructive" });
    },
  });

  // Upload agreement mutation
  const uploadAgreementMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("agreement", file);
      return apiRequest("POST", "/api/driver-agreement/upload", formData);
    },
    onSuccess: () => {
      setAgreementFile(null);
      setIsAgreementModalOpen(false);
      toast({ title: "Agreement template uploaded successfully" });
    },
    onError: () => {
      toast({ title: "Failed to upload agreement", variant: "destructive" });
    },
  });

  // Submit volunteer agreement mutation
  const submitVolunteerMutation = useMutation({
    mutationFn: (data: typeof volunteerForm) =>
      apiRequest("POST", "/api/driver-agreement/submit", data),
    onSuccess: () => {
      setVolunteerForm({
        submittedBy: "",
        phone: "",
        email: "",
        licenseNumber: "",
        vehicleInfo: "",
        emergencyContact: "",
        emergencyPhone: "",
        agreementAccepted: false,
      });
      setIsSubmissionModalOpen(false);
      toast({ title: "Volunteer agreement submitted successfully" });
    },
    onError: () => {
      toast({
        title: "Failed to submit volunteer agreement",
        variant: "destructive",
      });
    },
  });

  // Update agreement status mutation
  const updateAgreementMutation = useMutation({
    mutationFn: ({
      driverId,
      status,
    }: {
      driverId: number;
      status: "signed" | "missing";
    }) => {
      const driver = drivers?.find((d) => d.id === driverId);
      if (!driver) throw new Error("Driver not found");

      const updatedNotes = updateAgreementInNotes(driver.notes, status);

      return apiRequest("PATCH", `/api/drivers/${driverId}`, {
        notes: updatedNotes,
      });
    },
    onMutate: async ({ driverId, status }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/drivers"] });

      // Snapshot the previous value
      const previousDrivers = queryClient.getQueryData(["/api/drivers"]);

      // Optimistically update to the new value
      queryClient.setQueryData(["/api/drivers"], (old: Driver[] | undefined) => {
        if (!old) return old;
        return old.map(driver => {
          if (driver.id === driverId) {
            const updatedNotes = updateAgreementInNotes(driver.notes, status);
            return { ...driver, notes: updatedNotes };
          }
          return driver;
        });
      });

      // Return a context object with the snapshotted value
      return { previousDrivers };
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      toast({
        title: `Agreement marked as ${status}`,
        description: "Driver agreement status updated successfully",
      });
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousDrivers) {
        queryClient.setQueryData(["/api/drivers"], context.previousDrivers);
      }
      toast({
        title: "Failed to update agreement status",
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
    },
  });

  const handleAdd = () => {
    if (!newDriver.name || !newDriver.phone || !newDriver.vehicleType) {
      toast({
        title: "Please fill in required fields",
        variant: "destructive",
      });
      return;
    }
    addDriverMutation.mutate(newDriver);
  };

  const handleUpdate = () => {
    if (!editingDriver) return;
    updateDriverMutation.mutate({
      id: editingDriver.id,
      updates: editingDriver,
    });
  };

  const handleEdit = (driver: Driver) => {
    setEditingDriver({ ...driver });
  };

  const handleDelete = (driver: Driver) => {
    setDeletingDriver(driver);
  };

  const confirmDelete = () => {
    if (!deletingDriver) return;
    deleteDriverMutation.mutate(deletingDriver.id);
  };

  const handleUploadAgreement = () => {
    if (!agreementFile) {
      toast({ title: "Please select a file", variant: "destructive" });
      return;
    }
    uploadAgreementMutation.mutate(agreementFile);
  };

  const handleSubmitVolunteer = () => {
    if (
      !volunteerForm.submittedBy ||
      !volunteerForm.phone ||
      !volunteerForm.email ||
      !volunteerForm.agreementAccepted
    ) {
      toast({
        title: "Please fill in all required fields and accept the agreement",
        variant: "destructive",
      });
      return;
    }
    submitVolunteerMutation.mutate(volunteerForm);
  };

  const hasSignedAgreement = (notes: string) => {
    if (!notes) return false;
    const agreementText = notes.toLowerCase();
    return (
      agreementText.includes("agreement: yes") ||
      agreementText.includes("agreement: signed") ||
      agreementText.includes("agreement: true") ||
      agreementText.includes("agreement received")
    );
  };

  // Helper function to clean notes for display (removes redundant info)
  const getCleanNotesForDisplay = (notes: string, driverZone: string) => {
    if (!notes) return null;
    
    // Split notes by semicolons and filter out redundant information
    const parts = notes.split(';').map(part => part.trim()).filter(part => {
      if (!part) return false;
      
      // Remove area information (redundant since we have zone field)
      if (part.toLowerCase().startsWith('area:')) {
        return false;
      }
      
      // Remove only signed/missing agreement status (redundant since we have badge)
      // But keep other agreement info like "Agreement SENT"
      const lowerPart = part.toLowerCase();
      if (lowerPart.includes('agreement: yes') || 
          lowerPart.includes('agreement: no') ||
          lowerPart.includes('agreement: signed') ||
          lowerPart.includes('agreement received')) {
        return false;
      }
      
      // Remove van approved info (redundant since we have purple badge)
      if (lowerPart.includes('van approved')) {
        return false;
      }
      
      // Keep other meaningful notes like "Agreement SENT"
      return true;
    }).map(part => {
      // Remove "Notes:" prefix from individual parts if it exists
      return part.replace(/^notes:\s*/i, '');
    });
    
    return parts.length > 0 ? parts.join('; ') : null;
  };

  // Helper function to update agreement status in notes while preserving other content
  const updateAgreementInNotes = (
    currentNotes: string = "",
    newStatus: "signed" | "missing",
  ): string => {
    // Remove any existing agreement status
    let updatedNotes = currentNotes
      .replace(/Agreement:\s*(yes|signed|true|no|missing|false)/gi, "")
      .trim();

    // Remove trailing semicolons or commas
    updatedNotes = updatedNotes.replace(/[;,]\s*$/, "").trim();

    // Add the new agreement status
    const agreementText = `Agreement: ${newStatus}`;

    // If there are other notes, add agreement status at the end
    if (updatedNotes) {
      return `${updatedNotes}; ${agreementText}`;
    }

    return agreementText;
  };

  // Export function
  const handleExport = () => {
    if (!drivers || drivers.length === 0) return;

    const headers = [
      "Name",
      "Phone",
      "Email",
      "Zone",
      "Active",
      "Agreement",
      "Van Approved",
      "Home Address",
      "Availability",
      "Email Sent",
      "Voicemail Left",
      "Inactive Reason",
      "Notes",
    ];
    const csvContent = [
      headers.join(","),
      ...drivers.map((driver) => {
        const hasAgreement = hasSignedAgreement(driver.notes);
        return [
          `"${driver.name}"`,
          `"${driver.phone || ""}"`,
          `"${driver.email || ""}"`,
          `"${driver.zone || ""}"`,
          driver.isActive ? "Yes" : "No",
          hasAgreement ? "Yes" : "No",
          driver.vanApproved ? "Yes" : "No",
          `"${driver.homeAddress || ""}"`,
          `"${driver.availabilityNotes || ""}"`,
          driver.emailAgreementSent ? "Yes" : "No",
          driver.voicemailLeft ? "Yes" : "No",
          `"${driver.inactiveReason || ""}"`,
          `"${driver.notes || ""}"`,
        ].join(",");
      }),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `drivers_export_${new Date().toISOString().split("T")[0]}.csv`,
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    toast({
      title: "Export Complete",
      description: `Exported ${drivers.length} drivers to CSV file`,
    });
  };

  // Apply filters
  const applyFilters = (driverList: Driver[]) => {
    return driverList.filter((driver) => {
      // Van drivers filter
      if (filters.vanDriversOnly && !driver.vanApproved) {
        return false;
      }

      // Missing agreements filter
      if (filters.missingAgreementsOnly && hasSignedAgreement(driver.notes)) {
        return false;
      }

      // Zone filter
      if (
        filters.selectedZone !== "all" &&
        driver.zone !== filters.selectedZone
      ) {
        return false;
      }

      return true;
    });
  };

  // Get unique zones for filter dropdown
  const zoneSet: string[] = [];
  drivers.forEach((driver) => {
    if (driver.zone && !zoneSet.includes(driver.zone)) {
      zoneSet.push(driver.zone);
    }
  });
  const availableZones = zoneSet.sort();

  // Separate and sort drivers, then apply filters
  const allActiveDrivers = drivers
    .filter((driver) => driver.isActive)
    .sort((a, b) => a.name.localeCompare(b.name));
  const allInactiveDrivers = drivers
    .filter((driver) => !driver.isActive)
    .sort((a, b) => a.name.localeCompare(b.name));

  const activeDrivers = applyFilters(allActiveDrivers);
  const inactiveDrivers = applyFilters(allInactiveDrivers);

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      vanDriversOnly: false,
      missingAgreementsOnly: false,
      selectedZone: "all",
    });
  };

  // Check if any filters are active
  const hasActiveFilters =
    filters.vanDriversOnly ||
    filters.missingAgreementsOnly ||
    filters.selectedZone !== "all";

  if (isLoading) {
    return <div className="p-6">Loading drivers...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center">
              <Car className="text-blue-500 mr-2 sm:mr-3 w-5 h-5 sm:w-6 sm:h-6" />
              <span className="hidden sm:inline">Drivers Management</span>
              <span className="sm:hidden">Drivers</span>
            </h1>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={handleExport}
                disabled={!canExport || !drivers || drivers.length === 0}
                className="text-xs sm:text-sm"
              >
                <Download className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Export CSV</span>
                <span className="sm:hidden">Export</span>
              </Button>
              <Dialog
                open={isAgreementModalOpen}
                onOpenChange={setIsAgreementModalOpen}
              >
                <DialogTrigger asChild>
                  <Button
                    disabled={!canEdit}
                    variant="outline"
                    className="flex items-center gap-2 text-xs sm:text-sm"
                  >
                    <Upload className="w-4 h-4" />
                    <span className="hidden sm:inline">Upload Agreement</span>
                    <span className="sm:hidden">Upload</span>
                  </Button>
                </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload Driver Agreement Template</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="agreement-file">Agreement PDF</Label>
                    <Input
                      id="agreement-file"
                      type="file"
                      accept=".pdf"
                      onChange={(e) =>
                        setAgreementFile(e.target.files?.[0] || null)
                      }
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsAgreementModalOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleUploadAgreement}
                      disabled={uploadAgreementMutation.isPending}
                    >
                      {uploadAgreementMutation.isPending
                        ? "Uploading..."
                        : "Upload"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog
              open={isSubmissionModalOpen}
              onOpenChange={setIsSubmissionModalOpen}
            >
              <DialogTrigger asChild>
                <Button
                  disabled={!canEdit}
                  variant="outline"
                  className="flex items-center gap-2 text-xs sm:text-sm"
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden lg:inline">Submit Volunteer Agreement</span>
                  <span className="lg:hidden hidden sm:inline">Submit Agreement</span>
                  <span className="sm:hidden">Submit</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Submit Volunteer Driver Agreement</DialogTitle>
                </DialogHeader>
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSubmitVolunteer();
                  }}
                >
                  <div>
                    <Label htmlFor="volunteer-name">Full Name *</Label>
                    <Input
                      id="volunteer-name"
                      value={volunteerForm.submittedBy}
                      onChange={(e) =>
                        setVolunteerForm({
                          ...volunteerForm,
                          submittedBy: e.target.value,
                        })
                      }
                      placeholder="Enter your full name"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="volunteer-phone">Phone Number *</Label>
                    <Input
                      id="volunteer-phone"
                      value={volunteerForm.phone}
                      onChange={(e) =>
                        setVolunteerForm({
                          ...volunteerForm,
                          phone: e.target.value,
                        })
                      }
                      placeholder="(555) 123-4567"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="volunteer-email">Email Address *</Label>
                    <Input
                      id="volunteer-email"
                      type="email"
                      value={volunteerForm.email}
                      onChange={(e) =>
                        setVolunteerForm({
                          ...volunteerForm,
                          email: e.target.value,
                        })
                      }
                      placeholder="email@example.com"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="volunteer-license">
                      Driver's License Number
                    </Label>
                    <Input
                      id="volunteer-license"
                      value={volunteerForm.licenseNumber}
                      onChange={(e) =>
                        setVolunteerForm({
                          ...volunteerForm,
                          licenseNumber: e.target.value,
                        })
                      }
                      placeholder="License number"
                    />
                  </div>
                  <div>
                    <Label htmlFor="volunteer-vehicle">
                      Vehicle Information
                    </Label>
                    <Input
                      id="volunteer-vehicle"
                      value={volunteerForm.vehicleInfo}
                      onChange={(e) =>
                        setVolunteerForm({
                          ...volunteerForm,
                          vehicleInfo: e.target.value,
                        })
                      }
                      placeholder="Year, Make, Model, Color"
                    />
                  </div>
                  <div>
                    <Label htmlFor="emergency-contact">
                      Emergency Contact Name
                    </Label>
                    <Input
                      id="emergency-contact"
                      value={volunteerForm.emergencyContact}
                      onChange={(e) =>
                        setVolunteerForm({
                          ...volunteerForm,
                          emergencyContact: e.target.value,
                        })
                      }
                      placeholder="Emergency contact name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="emergency-phone">
                      Emergency Contact Phone
                    </Label>
                    <Input
                      id="emergency-phone"
                      value={volunteerForm.emergencyPhone}
                      onChange={(e) =>
                        setVolunteerForm({
                          ...volunteerForm,
                          emergencyPhone: e.target.value,
                        })
                      }
                      placeholder="Emergency contact phone"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="agreement-accepted"
                      checked={volunteerForm.agreementAccepted}
                      onChange={(e) =>
                        setVolunteerForm({
                          ...volunteerForm,
                          agreementAccepted: e.target.checked,
                        })
                      }
                      required
                    />
                    <Label htmlFor="agreement-accepted" className="text-sm">
                      I have read and agree to the volunteer driver agreement
                      terms *
                    </Label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsSubmissionModalOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={submitVolunteerMutation.isPending}
                    >
                      {submitVolunteerMutation.isPending
                        ? "Submitting..."
                        : "Submit Agreement"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
              <DialogTrigger asChild>
                <Button disabled={!canEdit} className="flex items-center gap-2 text-xs sm:text-sm">
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Add Driver</span>
                  <span className="sm:hidden">Add</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Driver</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Driver Name *</Label>
                    <Input
                      id="name"
                      value={newDriver.name}
                      onChange={(e) =>
                        setNewDriver({ ...newDriver, name: e.target.value })
                      }
                      placeholder="Enter driver name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      value={newDriver.phone}
                      onChange={(e) =>
                        setNewDriver({ ...newDriver, phone: e.target.value })
                      }
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newDriver.email}
                      onChange={(e) =>
                        setNewDriver({ ...newDriver, email: e.target.value })
                      }
                      placeholder="email@example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="vehicle-type">Vehicle Type *</Label>
                    <Select
                      value={newDriver.vehicleType}
                      onValueChange={(value) =>
                        setNewDriver({ ...newDriver, vehicleType: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select vehicle type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Car">Car</SelectItem>
                        <SelectItem value="Van">Van</SelectItem>
                        <SelectItem value="Truck">Truck</SelectItem>
                        <SelectItem value="Motorcycle">Motorcycle</SelectItem>
                        <SelectItem value="Bicycle">Bicycle</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="license">License Number</Label>
                    <Input
                      id="license"
                      value={newDriver.licenseNumber}
                      onChange={(e) =>
                        setNewDriver({
                          ...newDriver,
                          licenseNumber: e.target.value,
                        })
                      }
                      placeholder="License number"
                    />
                  </div>
                  <div>
                    <Label htmlFor="host">Host Location</Label>
                    <Select
                      value={
                        newDriver.hostId ? newDriver.hostId.toString() : "none"
                      }
                      onValueChange={(value) =>
                        setNewDriver({
                          ...newDriver,
                          hostId:
                            value === "none" ? undefined : parseInt(value),
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a host location" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No host assigned</SelectItem>
                        {hosts
                          .filter((host) => host.status === "active")
                          .map((host) => (
                            <SelectItem
                              key={host.id}
                              value={host.id.toString()}
                            >
                              {host.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="route-description">Route Description</Label>
                    <Input
                      id="route-description"
                      value={newDriver.routeDescription || ""}
                      onChange={(e) =>
                        setNewDriver({
                          ...newDriver,
                          routeDescription: e.target.value,
                        })
                      }
                      placeholder="e.g., SS to Dunwoody, East Cobb to anywhere"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsAddModalOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAdd}
                      disabled={addDriverMutation.isPending}
                    >
                      {addDriverMutation.isPending ? "Adding..." : "Add Driver"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-600" />
            <span className="text-sm font-medium text-slate-700">Filters:</span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="van-drivers"
              checked={filters.vanDriversOnly}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  vanDriversOnly: e.target.checked,
                }))
              }
              className="rounded border-slate-300"
            />
            <label
              htmlFor="van-drivers"
              className="text-sm text-slate-600 cursor-pointer"
            >
              Van Drivers Only
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="missing-agreements"
              checked={filters.missingAgreementsOnly}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  missingAgreementsOnly: e.target.checked,
                }))
              }
              className="rounded border-slate-300"
            />
            <label
              htmlFor="missing-agreements"
              className="text-sm text-slate-600 cursor-pointer"
            >
              Missing Agreements Only
            </label>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="zone-filter" className="text-sm text-slate-600">
              Zone:
            </label>
            <Select
              value={filters.selectedZone}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, selectedZone: value }))
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                {availableZones.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {zone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="flex items-center gap-1 text-slate-600"
            >
              <X className="w-3 h-3" />
              Clear Filters
            </Button>
          )}
        </div>

        {hasActiveFilters && (
          <div className="mt-3 text-sm text-slate-500">
            Showing {activeDrivers.length} active and {inactiveDrivers.length}{" "}
            inactive drivers
            {filters.vanDriversOnly && " (van drivers only)"}
            {filters.missingAgreementsOnly && " (missing agreements only)"}
            {filters.selectedZone !== "all" &&
              ` (${filters.selectedZone} zone)`}
          </div>
        )}
      </div>

      {/* Drivers Tabs */}
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active" className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Active Drivers ({activeDrivers.length})
          </TabsTrigger>
          <TabsTrigger value="inactive" className="flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            Inactive Drivers ({inactiveDrivers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-6">
          <div className="grid gap-4">
            {activeDrivers.map((driver) => (
              <Card key={driver.id} className="border border-slate-200">
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg">{driver.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {/* Active Status */}
                        <Badge
                          variant="default"
                          className="bg-green-100 text-green-800 flex items-center gap-1"
                        >
                          <CheckCircle className="w-3 h-3" />
                          Active
                        </Badge>

                        {/* Van Approval */}
                        {driver.vanApproved && (
                          <Badge
                            variant="outline"
                            className="bg-purple-50 text-purple-700 border-purple-200 flex items-center gap-1"
                          >
                            <Truck className="w-3 h-3" />
                            Van Driver
                          </Badge>
                        )}

                        {/* Agreement Status - Clickable */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              disabled={
                                !canEdit || updateAgreementMutation.isPending
                              }
                              className={`cursor-pointer transition-all duration-200 hover:shadow-sm flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold
                                ${
                                  hasSignedAgreement(driver.notes)
                                    ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                                    : "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"
                                }
                                ${!canEdit ? "cursor-not-allowed opacity-50" : ""}
                                ${updateAgreementMutation.isPending ? "animate-pulse" : ""}`}
                            >
                              {updateAgreementMutation.isPending ? (
                                <Clock className="w-3 h-3 animate-spin" />
                              ) : hasSignedAgreement(driver.notes) ? (
                                <FileCheck className="w-3 h-3" />
                              ) : (
                                <AlertTriangle className="w-3 h-3" />
                              )}
                              {hasSignedAgreement(driver.notes)
                                ? "Signed Agreement"
                                : "Missing Agreement"}
                            </button>
                          </DropdownMenuTrigger>

                          <DropdownMenuContent>
                            <DropdownMenuItem
                              onClick={() => updateAgreement(driver, "signed")}
                            >
                              Mark as Signed
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => updateAgreement(driver, "missing")}
                            >
                              Mark as Missing
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0 self-start">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!canEdit}
                        onClick={() => handleEdit(driver)}
                        className="flex items-center gap-1"
                      >
                        <Edit2 className="w-4 h-4" />
                        <span className="hidden xs:inline">Edit</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!canEdit}
                        onClick={() => handleDelete(driver)}
                        className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                      >
                        <X className="w-4 h-4" />
                        <span className="hidden xs:inline">Delete</span>
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-600">
                    {driver.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        {driver.phone}
                      </div>
                    )}
                    {driver.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        {driver.email}
                      </div>
                    )}
                  </div>
                  {driver.availabilityNotes && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <div className="flex items-start gap-2 text-sm text-slate-600">
                        <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Availability:</strong>{" "}
                          {driver.availabilityNotes}
                        </span>
                      </div>
                    </div>
                  )}
                  {driver.homeAddress && (
                    <div className="mt-2">
                      <div className="flex items-start gap-2 text-sm text-slate-600">
                        <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Address:</strong> {driver.homeAddress}
                        </span>
                      </div>
                    </div>
                  )}
                  {driver.routeDescription && (
                    <div className="mt-2">
                      <div className="flex items-start gap-2 text-sm text-slate-600">
                        <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Route:</strong> {driver.routeDescription}
                        </span>
                      </div>
                    </div>
                  )}
                  {driver.hostId && hosts.length > 0 && (
                    <div className="mt-2">
                      <div className="flex items-start gap-2 text-sm text-slate-600">
                        <Truck className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Host:</strong>{" "}
                          {hosts.find((h) => h.id === driver.hostId)?.name ||
                            "Unknown"}
                        </span>
                      </div>
                    </div>
                  )}
                  {getCleanNotesForDisplay(driver.notes, driver.zone) && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <div className="flex items-start gap-2 text-sm text-slate-600">
                        <FileCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Notes:</strong> {getCleanNotesForDisplay(driver.notes, driver.zone)}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="inactive" className="mt-6">
          <div className="grid gap-4">
            {inactiveDrivers.map((driver) => (
              <Card key={driver.id} className="border border-slate-200">
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg">{driver.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {/* Inactive Status */}
                        <Badge
                          variant="secondary"
                          className="bg-gray-100 text-gray-600 flex items-center gap-1"
                        >
                          <XCircle className="w-3 h-3" />
                          Inactive
                        </Badge>

                        {/* Van Approval (for inactive drivers) */}
                        {driver.vanApproved && (
                          <Badge
                            variant="outline"
                            className="bg-purple-50 text-purple-700 border-purple-200 flex items-center gap-1"
                          >
                            <Truck className="w-3 h-3" />
                            Van Driver
                          </Badge>
                        )}

                        {/* Agreement Status - Clickable (for inactive drivers) */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              disabled={
                                !canEdit || updateAgreementMutation.isPending
                              }
                              className={`cursor-pointer transition-all duration-200 hover:shadow-sm flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold
                                ${
                                  hasSignedAgreement(driver.notes)
                                    ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                                    : "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"
                                }
                                ${!canEdit ? "cursor-not-allowed opacity-50" : ""}
                                ${updateAgreementMutation.isPending ? "animate-pulse" : ""}`}
                            >
                              {updateAgreementMutation.isPending ? (
                                <Clock className="w-3 h-3 animate-spin" />
                              ) : hasSignedAgreement(driver.notes) ? (
                                <FileCheck className="w-3 h-3" />
                              ) : (
                                <AlertTriangle className="w-3 h-3" />
                              )}
                              {hasSignedAgreement(driver.notes)
                                ? "Signed Agreement"
                                : "Missing Agreement"}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem
                              onClick={() =>
                                updateAgreementMutation.mutate({
                                  driverId: driver.id,
                                  status: "signed",
                                })
                              }
                              disabled={updateAgreementMutation.isPending}
                              className="flex items-center gap-2"
                            >
                              <FileCheck className="w-4 h-4 text-blue-600" />✅
                              Mark as Signed
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                updateAgreementMutation.mutate({
                                  driverId: driver.id,
                                  status: "missing",
                                })
                              }
                              disabled={updateAgreementMutation.isPending}
                              className="flex items-center gap-2"
                            >
                              <AlertTriangle className="w-4 h-4 text-orange-600" />
                              ❌ Mark as Missing
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Inactive Reason */}
                        {driver.inactiveReason && (
                          <Badge
                            variant="outline"
                            className="bg-gray-50 text-gray-600 border-gray-200 flex items-center gap-1"
                          >
                            {driver.inactiveReason}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0 self-start">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!canEdit}
                        onClick={() => handleEdit(driver)}
                        className="flex items-center gap-1"
                      >
                        <Edit2 className="w-4 h-4" />
                        <span className="hidden xs:inline">Edit</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!canEdit}
                        onClick={() => handleDelete(driver)}
                        className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                      >
                        <X className="w-4 h-4" />
                        <span className="hidden xs:inline">Delete</span>
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-600">
                    {driver.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        {driver.phone}
                      </div>
                    )}
                    {driver.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        {driver.email}
                      </div>
                    )}
                  </div>
                  {driver.availabilityNotes && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <div className="flex items-start gap-2 text-sm text-slate-600">
                        <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Availability:</strong>{" "}
                          {driver.availabilityNotes}
                        </span>
                      </div>
                    </div>
                  )}
                  {driver.homeAddress && (
                    <div className="mt-2">
                      <div className="flex items-start gap-2 text-sm text-slate-600">
                        <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Address:</strong> {driver.homeAddress}
                        </span>
                      </div>
                    </div>
                  )}
                  {driver.routeDescription && (
                    <div className="mt-2">
                      <div className="flex items-start gap-2 text-sm text-slate-600">
                        <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Route:</strong> {driver.routeDescription}
                        </span>
                      </div>
                    </div>
                  )}

                  {driver.hostId && hosts.length > 0 && (
                    <div className="mt-2">
                      <div className="flex items-start gap-2 text-sm text-slate-600">
                        <Truck className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Host:</strong>{" "}
                          {hosts.find((h) => h.id === driver.hostId)?.name ||
                            "Unknown"}
                        </span>
                      </div>
                    </div>
                  )}
                  {getCleanNotesForDisplay(driver.notes, driver.zone) && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <div className="flex items-start gap-2 text-sm text-slate-600">
                        <FileCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Notes:</strong> {getCleanNotesForDisplay(driver.notes, driver.zone)}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Driver Modal */}
      {editingDriver && (
        <Dialog
          open={!!editingDriver}
          onOpenChange={() => setEditingDriver(null)}
        >
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Driver</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-name">Driver Name *</Label>
                  <Input
                    id="edit-name"
                    value={editingDriver.name ?? ""}
                    onChange={(e) =>
                      setEditingDriver({
                        ...editingDriver,
                        name: e.target.value,
                      })
                    }
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-phone">Phone Number *</Label>
                  <Input
                    id="edit-phone"
                    value={editingDriver.phone ?? ""}
                    onChange={(e) =>
                      setEditingDriver({
                        ...editingDriver,
                        phone: e.target.value,
                      })
                    }
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="edit-email">Email Address</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editingDriver.email ?? ""}
                  onChange={(e) =>
                    setEditingDriver({
                      ...editingDriver,
                      email: e.target.value,
                    })
                  }
                  placeholder="email@example.com"
                />
              </div>

              {/* Status and Permissions */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-status">Status</Label>
                  <Select
                    value={editingDriver.isActive ? "active" : "inactive"}
                    onValueChange={(value) =>
                      setEditingDriver({
                        ...editingDriver,
                        isActive: value === "active",
                      })
                    }
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
                  <Label htmlFor="edit-van-approved">Van Driver Status</Label>
                  <Select
                    value={
                      editingDriver.vanApproved ? "approved" : "not_approved"
                    }
                    onValueChange={(value) =>
                      setEditingDriver({
                        ...editingDriver,
                        vanApproved: value === "approved",
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="approved">
                        Van Driver Approved
                      </SelectItem>
                      <SelectItem value="not_approved">
                        Not Van Approved
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Agreement Status */}
              <div>
                <Label htmlFor="edit-agreement">Agreement Status</Label>
                <Select
                  value={
                    hasSignedAgreement(editingDriver.notes)
                      ? "signed"
                      : "missing"
                  }
                  onValueChange={(value) => {
                    let updatedNotes = editingDriver.notes || "";

                    // Remove any existing agreement status from notes
                    updatedNotes = updatedNotes
                      .replace(
                        /agreement:\s*(yes|no|signed|missing|true|false)/gi,
                        "",
                      )
                      .replace(/\s+/g, " ")
                      .trim();

                    // Add new agreement status
                    if (value === "signed") {
                      updatedNotes = updatedNotes
                        ? `${updatedNotes} Agreement: signed`
                        : "Agreement: signed";
                    } else {
                      updatedNotes = updatedNotes
                        ? `${updatedNotes} Agreement: missing`
                        : "Agreement: missing";
                    }

                    setEditingDriver({
                      ...editingDriver,
                      notes: updatedNotes.trim(),
                      emailAgreementSent: value === "signed",
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="signed">Signed Agreement</SelectItem>
                    <SelectItem value="missing">Missing Agreement</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Availability Details */}
              <div>
                <Label htmlFor="edit-availability-notes">
                  Availability Notes
                </Label>
                <Input
                  id="edit-availability-notes"
                  value={editingDriver.availabilityNotes ?? ""}
                  onChange={(e) =>
                    setEditingDriver({
                      ...editingDriver,
                      availabilityNotes: e.target.value,
                    })
                  }
                  placeholder="e.g., M-F after 3; weekends; unavailable until June"
                />
              </div>

              {/* Route and Location */}
              <div>
                <Label htmlFor="edit-route-description">
                  Route Description
                </Label>
                <Input
                  id="edit-route-description"
                  value={
                    editingDriver.routeDescription ?? editingDriver.zone ?? ""
                  }
                  onChange={(e) =>
                    setEditingDriver({
                      ...editingDriver,
                      routeDescription: e.target.value,
                    })
                  }
                  placeholder="e.g., SS to Dunwoody, East Cobb to anywhere"
                />
              </div>

              <div>
                <Label htmlFor="edit-host">Associated Host/Organization</Label>
                <Select
                  value={
                    editingDriver.hostId
                      ? editingDriver.hostId.toString()
                      : "none"
                  }
                  onValueChange={(value) =>
                    setEditingDriver({
                      ...editingDriver,
                      hostId: value === "none" ? undefined : parseInt(value),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select host for directory connection" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No host assigned</SelectItem>
                    {hosts
                      ?.filter((host) => host.status === "active")
                      .map((host) => (
                        <SelectItem key={host.id} value={host.id.toString()}>
                          {host.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Additional Information */}
              <div>
                <Label htmlFor="edit-home-address">Home Address</Label>
                <Input
                  id="edit-home-address"
                  value={editingDriver.homeAddress ?? ""}
                  onChange={(e) =>
                    setEditingDriver({
                      ...editingDriver,
                      homeAddress: e.target.value,
                    })
                  }
                  placeholder="Full home address"
                />
              </div>

              <div>
                <Label htmlFor="edit-notes">Additional Notes</Label>
                <textarea
                  id="edit-notes"
                  className="w-full p-2 border border-gray-300 rounded-md"
                  rows={3}
                  value={editingDriver.notes ?? ""}
                  onChange={(e) =>
                    setEditingDriver({
                      ...editingDriver,
                      notes: e.target.value,
                    })
                  }
                  placeholder="Additional information, special instructions, etc."
                />
              </div>

              {!editingDriver.isActive && (
                <div>
                  <Label htmlFor="edit-inactive-reason">Inactive Reason</Label>
                  <Input
                    id="edit-inactive-reason"
                    value={editingDriver.inactiveReason ?? ""}
                    onChange={(e) =>
                      setEditingDriver({
                        ...editingDriver,
                        inactiveReason: e.target.value,
                      })
                    }
                    placeholder="Reason for inactive status"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setEditingDriver(null)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdate}
                  disabled={updateDriverMutation.isPending}
                >
                  {updateDriverMutation.isPending
                    ? "Updating..."
                    : "Update Driver"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Modal */}
      {deletingDriver && (
        <Dialog
          open={!!deletingDriver}
          onOpenChange={() => setDeletingDriver(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Driver</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-gray-700">
                Are you sure you want to permanently delete{" "}
                <strong>{deletingDriver.name}</strong>? This action cannot be
                undone.
              </p>
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-red-800 text-sm">
                  <strong>Warning:</strong> This will permanently remove all
                  driver information including contact details, route
                  assignments, and availability data.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setDeletingDriver(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmDelete}
                  disabled={deleteDriverMutation.isPending}
                >
                  {deleteDriverMutation.isPending
                    ? "Deleting..."
                    : "Delete Driver"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

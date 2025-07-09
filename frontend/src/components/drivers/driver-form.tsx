import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Car, Phone, Mail, MapPin } from "lucide-react";

interface Driver {
  id: number;
  name: string;
  phone: string;
  email: string;
  vehicleType: string;
  licenseNumber: string;
  availability: "available" | "busy" | "off-duty";
  zone: string;
}

interface DriverFormData {
  name: string;
  phone: string;
  email: string;
  vehicleType: string;
  licenseNumber: string;
  availability: "available" | "busy" | "off-duty";
  zone: string;
}

interface DriverFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: DriverFormData) => void;
  initialData?: Partial<DriverFormData>;
  isSubmitting: boolean;
  title: string;
}

export function DriverForm({ 
  isOpen, 
  onClose, 
  onSubmit, 
  initialData, 
  isSubmitting, 
  title 
}: DriverFormProps) {
  const [formData, setFormData] = useState<DriverFormData>({
    name: "",
    phone: "",
    email: "",
    vehicleType: "",
    licenseNumber: "",
    availability: "available",
    zone: "",
    ...initialData
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleInputChange = (field: keyof DriverFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Driver Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="phone">Phone Number *</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="email">Email Address *</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="vehicleType">Vehicle Type</Label>
            <Select value={formData.vehicleType} onValueChange={(value) => handleInputChange("vehicleType", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select vehicle type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="car">Car</SelectItem>
                <SelectItem value="suv">SUV</SelectItem>
                <SelectItem value="truck">Truck</SelectItem>
                <SelectItem value="van">Van</SelectItem>
                <SelectItem value="motorcycle">Motorcycle</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="licenseNumber">License Number</Label>
            <Input
              id="licenseNumber"
              value={formData.licenseNumber}
              onChange={(e) => handleInputChange("licenseNumber", e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="availability">Availability</Label>
            <Select 
              value={formData.availability} 
              onValueChange={(value: "available" | "busy" | "off-duty") => handleInputChange("availability", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="busy">Busy</SelectItem>
                <SelectItem value="off-duty">Off Duty</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="zone">Zone/Area</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="zone"
                value={formData.zone}
                onChange={(e) => handleInputChange("zone", e.target.value)}
                className="pl-10"
                placeholder="e.g., North Atlanta, Downtown"
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !formData.name.trim() || !formData.phone.trim() || !formData.email.trim()}>
              {isSubmitting ? "Saving..." : "Save Driver"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
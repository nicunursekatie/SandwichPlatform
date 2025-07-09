import { Phone, Mail, Car, MapPin, Edit, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

interface DriverCardProps {
  driver: Driver;
  onEdit: (driver: Driver) => void;
  onDelete: (id: number) => void;
}

export function DriverCard({ driver, onEdit, onDelete }: DriverCardProps) {
  const getAvailabilityColor = () => {
    switch (driver.availability) {
      case "available":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "busy":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "off-duty":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  return (
    <Card className="h-full hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Car className="h-5 w-5" />
            {driver.name}
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(driver)}
              className="h-8 w-8 p-0"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(driver.id)}
              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Badge className={getAvailabilityColor()}>
          {driver.availability.replace("-", " ")}
        </Badge>
      </CardHeader>
      
      <CardContent className="pt-0 space-y-3">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <Phone className="h-4 w-4" />
          <a href={`tel:${driver.phone}`} className="hover:text-blue-600">
            {driver.phone}
          </a>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <Mail className="h-4 w-4" />
          <a href={`mailto:${driver.email}`} className="hover:text-blue-600 truncate">
            {driver.email}
          </a>
        </div>
        
        {driver.vehicleType && (
          <div className="flex items-center gap-2 text-sm">
            <Car className="h-4 w-4 text-gray-400" />
            <span className="font-medium">{driver.vehicleType}</span>
          </div>
        )}
        
        {driver.zone && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <MapPin className="h-4 w-4" />
            <span>{driver.zone}</span>
          </div>
        )}
        
        {driver.licenseNumber && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            License: {driver.licenseNumber}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Host } from "@shared/schema";

interface SearchFilters {
  hostName: string;
  collectionDateFrom: string;
  collectionDateTo: string;
  individualMin: string;
  individualMax: string;
}

interface CollectionFiltersProps {
  searchFilters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  hosts: Host[];
  totalCollections: number;
  filteredCollections: number;
}

export function CollectionFilters({
  searchFilters,
  onFiltersChange,
  hosts,
  totalCollections,
  filteredCollections
}: CollectionFiltersProps) {
  const hasActiveFilters = Object.values(searchFilters).some(value => value.trim() !== "");

  const clearFilters = () => {
    onFiltersChange({
      hostName: "",
      collectionDateFrom: "",
      collectionDateTo: "",
      individualMin: "",
      individualMax: ""
    });
  };

  const updateFilter = (key: keyof SearchFilters, value: string) => {
    onFiltersChange({
      ...searchFilters,
      [key]: value
    });
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filter Collections
            {hasActiveFilters && (
              <span className="ml-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                Active
              </span>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Filter Collections</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="hostFilter">Host Name</Label>
              <Select
                value={searchFilters.hostName}
                onValueChange={(value) => updateFilter("hostName", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All hosts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All hosts</SelectItem>
                  {hosts.map((host) => (
                    <SelectItem key={host.id} value={host.name}>
                      {host.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="dateFrom">Date From</Label>
              <Input
                id="dateFrom"
                type="date"
                value={searchFilters.collectionDateFrom}
                onChange={(e) => updateFilter("collectionDateFrom", e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="dateTo">Date To</Label>
              <Input
                id="dateTo"
                type="date"
                value={searchFilters.collectionDateTo}
                onChange={(e) => updateFilter("collectionDateTo", e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="individualMin">Min Individual Sandwiches</Label>
              <Input
                id="individualMin"
                type="number"
                placeholder="Min"
                value={searchFilters.individualMin}
                onChange={(e) => updateFilter("individualMin", e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="individualMax">Max Individual Sandwiches</Label>
              <Input
                id="individualMax"
                type="number"
                placeholder="Max"
                value={searchFilters.individualMax}
                onChange={(e) => updateFilter("individualMax", e.target.value)}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="h-4 w-4 mr-2" />
          Clear Filters
        </Button>
      )}

      <div className="text-sm text-gray-600 dark:text-gray-400">
        Showing {filteredCollections} of {totalCollections} collections
      </div>
    </div>
  );
}
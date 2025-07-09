import { Search, Filter, Calendar, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { SandwichCollection } from "@shared/schema";

interface FiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  hostFilter: string;
  onHostFilterChange: (value: string) => void;
  dateFilter: string;
  onDateFilterChange: (value: string) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
  collections: SandwichCollection[];
}

export function Filters({
  searchTerm,
  onSearchChange,
  hostFilter,
  onHostFilterChange,
  dateFilter,
  onDateFilterChange,
  sortBy,
  onSortChange,
  collections
}: FiltersProps) {
  // Get unique hosts for filter dropdown
  const uniqueHosts = Array.from(new Set(collections.map(c => c.hostName))).sort();

  const clearFilters = () => {
    onSearchChange("");
    onHostFilterChange("all");
    onDateFilterChange("");
    onSortChange("date-desc");
  };

  const hasActiveFilters = searchTerm || hostFilter !== "all" || dateFilter || sortBy !== "date-desc";

  return (
    <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search collections..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={hostFilter} onValueChange={onHostFilterChange}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <MapPin className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by host" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Hosts</SelectItem>
              {uniqueHosts.map(host => (
                <SelectItem key={host} value={host}>{host}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => onDateFilterChange(e.target.value)}
            className="w-full sm:w-[150px]"
            title="Filter by date"
          />
          
          <Select value={sortBy} onValueChange={onSortChange}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-desc">Date (Newest)</SelectItem>
              <SelectItem value="date-asc">Date (Oldest)</SelectItem>
              <SelectItem value="host-asc">Host (A-Z)</SelectItem>
              <SelectItem value="host-desc">Host (Z-A)</SelectItem>
              <SelectItem value="total-desc">Total (High-Low)</SelectItem>
              <SelectItem value="total-asc">Total (Low-High)</SelectItem>
            </SelectContent>
          </Select>
          
          {hasActiveFilters && (
            <Button variant="outline" onClick={clearFilters} size="sm">
              Clear
            </Button>
          )}
        </div>
      </div>
      
      <div className="flex justify-between items-center text-sm text-gray-600 dark:text-gray-400">
        <span>Showing {collections.length} collections</span>
        {hasActiveFilters && (
          <span className="text-blue-600 dark:text-blue-400">
            Filters active
          </span>
        )}
      </div>
    </div>
  );
}
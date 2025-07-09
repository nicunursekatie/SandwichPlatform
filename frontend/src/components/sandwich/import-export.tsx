import { Upload, Download, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

interface ImportResult {
  totalRecords: number;
  successCount: number;
  errorCount: number;
  errors: string[];
}

interface ImportExportProps {
  onImport: (file: File) => Promise<ImportResult>;
  onExport: () => void;
  isImporting: boolean;
  collections: any[];
}

export function ImportExportDialog({ onImport, onExport, isImporting, collections }: ImportExportProps) {
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({
        title: "Invalid file type",
        description: "Please select a CSV file.",
        variant: "destructive",
      });
      return;
    }

    try {
      setImportProgress(25);
      const result = await onImport(file);
      setImportProgress(100);
      
      setTimeout(() => {
        setImportProgress(0);
        setImportDialogOpen(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 1000);
    } catch (error) {
      setImportProgress(0);
      toast({
        title: "Import failed",
        description: "Failed to import collections. Please check the file format.",
        variant: "destructive",
      });
    }
  };

  const handleExport = () => {
    try {
      // Convert collections to CSV format
      const headers = ['Date', 'Host Name', 'Individual Sandwiches', 'Group Collections'];
      const csvContent = [
        headers.join(','),
        ...collections.map(collection => [
          collection.collectionDate,
          `"${collection.hostName}"`,
          collection.individualSandwiches,
          `"${collection.groupCollections}"`
        ].join(','))
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sandwich-collections-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Export completed",
        description: `Exported ${collections.length} collections to CSV.`,
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export collections.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import Collection Data</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Upload a CSV file with collection data. The file should have columns for:
                Date, Host Name, Individual Sandwiches, and Group Collections.
              </div>
              
              {importProgress > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Importing...</div>
                  <Progress value={importProgress} className="w-full" />
                </div>
              )}
              
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  disabled={isImporting}
                  className="hidden"
                  id="csv-upload"
                />
                <label
                  htmlFor="csv-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Upload className="h-8 w-8 text-gray-400" />
                  <span className="text-sm font-medium">
                    {isImporting ? "Importing..." : "Click to select CSV file"}
                  </span>
                  <span className="text-xs text-gray-500">
                    Supports .csv files up to 10MB
                  </span>
                </label>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <div className="font-medium text-blue-800 dark:text-blue-200 mb-1">
                      CSV Format Requirements
                    </div>
                    <ul className="text-blue-700 dark:text-blue-300 space-y-1">
                      <li>• First row should contain headers</li>
                      <li>• Date format: YYYY-MM-DD</li>
                      <li>• Individual sandwiches: number</li>
                      <li>• Group collections: JSON format or text</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleExport}
          disabled={collections.length === 0}
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>
    </>
  );
}
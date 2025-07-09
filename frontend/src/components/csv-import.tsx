import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Upload, FileText, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ImportResult {
  totalRecords: number;
  successCount: number;
  errorCount: number;
  errors: string[];
}

export default function CSVImport() {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('csvFile', file);
      
      const response = await apiRequest('POST', '/api/import-collections', formData);
      return response.json();
    },
    onSuccess: (result: ImportResult) => {
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ['/api/sandwich-collections'] });
      
      if (result.errorCount === 0) {
        toast({
          title: "Import completed successfully",
          description: `${result.successCount} sandwich collections imported.`,
        });
      } else {
        toast({
          title: "Import completed with errors",
          description: `${result.successCount} imported, ${result.errorCount} errors.`,
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        toast({
          title: "Invalid file type",
          description: "Please select a CSV file.",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
      setImportResult(null);
    }
  };

  const handleImport = () => {
    if (selectedFile) {
      importMutation.mutate(selectedFile);
    }
  };

  const resetImport = () => {
    setSelectedFile(null);
    setImportResult(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Import CSV Data</h2>
        <p className="text-slate-600">Upload sandwich collection data from CSV file</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            CSV File Upload
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedFile ? (
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
              <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <div className="space-y-2">
                <p className="text-slate-600">Select a CSV file to import sandwich collection data</p>
                <p className="text-sm text-slate-500">
                  Expected columns: Host Name, Sandwich Count, Date, Logged By, Notes, Created At
                </p>
              </div>
              <div className="mt-4">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="csvFileInput"
                />
                <label htmlFor="csvFileInput">
                  <Button variant="outline" className="cursor-pointer">
                    Select CSV File
                  </Button>
                </label>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-900">{selectedFile.name}</p>
                    <p className="text-sm text-blue-600">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleImport}
                    disabled={importMutation.isPending}
                    className="btn-tsp-primary"
                  >
                    {importMutation.isPending ? "Importing..." : "Import Data"}
                  </Button>
                  <Button variant="outline" onClick={resetImport}>
                    Cancel
                  </Button>
                </div>
              </div>

              {importMutation.isPending && (
                <div className="text-center py-4">
                  <div className="inline-flex items-center gap-2 text-blue-600">
                    <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                    Processing CSV file...
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {importResult.errorCount === 0 ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-yellow-600" />
              )}
              Import Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-900">
                  {importResult.totalRecords}
                </div>
                <div className="text-sm text-slate-600">Total Records</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {importResult.successCount}
                </div>
                <div className="text-sm text-slate-600">Imported</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {importResult.errorCount}
                </div>
                <div className="text-sm text-slate-600">Errors</div>
              </div>
            </div>

            <div className="flex justify-center">
              <Badge 
                variant={importResult.errorCount === 0 ? "default" : "destructive"}
                className="text-sm"
              >
                {importResult.errorCount === 0 ? "Import Successful" : "Import Completed with Errors"}
              </Badge>
            </div>

            {importResult.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-slate-900 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  Error Details
                </h4>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-40 overflow-y-auto">
                  {importResult.errors.map((error, index) => (
                    <div key={index} className="text-sm text-red-700 py-1">
                      {error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-center">
              <Button onClick={resetImport} variant="outline">
                Import Another File
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
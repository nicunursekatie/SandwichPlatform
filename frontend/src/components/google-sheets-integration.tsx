import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { ExternalLink, Download, Upload, RefreshCw, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-react';

export function GoogleSheetsIntegration() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [analysis, setAnalysis] = useState<any>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [sheetName, setSheetName] = useState('Sheet1');
  const { toast } = useToast();

  // Your provided Google Sheet URL and extracted ID
  const targetSheetUrl = 'https://docs.google.com/spreadsheets/d/1mjx5o6boluo8mNx8tzAV76NBGS6tF0um2Rq9bIdxPo8/edit?gid=2137648950#gid=2137648950';
  const sheetId = '1mjx5o6boluo8mNx8tzAV76NBGS6tF0um2Rq9bIdxPo8';

  const analyzeSheet = async () => {
    setIsAnalyzing(true);
    try {
      const response = await apiRequest('GET', `/api/google-sheets/sync/analyze?sheet=${sheetName}`);
      setAnalysis(response.analysis);
      toast({
        title: "Sheet Analysis Complete",
        description: `Found ${response.analysis.totalRows} rows with ${response.analysis.headers.length} columns`,
      });
    } catch (error) {
      console.error('Analysis failed:', error);
      toast({
        title: "Analysis Failed",
        description: "Unable to connect to Google Sheets. Please check API credentials.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const importFromSheet = async () => {
    setIsImporting(true);
    try {
      const response = await apiRequest('POST', '/api/google-sheets/sync/import', {
        sheetName,
        dryRun
      });
      
      setImportResult(response.result);
      
      if (dryRun) {
        toast({
          title: "Import Preview Complete",
          description: `Preview: ${response.result.preview?.length || 0} rows would be imported`,
        });
      } else {
        toast({
          title: "Import Complete",
          description: `Imported ${response.result.imported} records, skipped ${response.result.skipped}`,
        });
      }
    } catch (error) {
      console.error('Import failed:', error);
      toast({
        title: "Import Failed",
        description: "Unable to import data from Google Sheets",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const exportToSheet = async () => {
    setIsExporting(true);
    try {
      const response = await apiRequest('POST', '/api/google-sheets/sync/export', {
        sheetName: 'Database_Export'
      });
      
      toast({
        title: "Export Complete",
        description: `Exported ${response.result.exported} records to Google Sheets`,
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Export Failed",
        description: "Unable to export data to Google Sheets",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Google Sheets Integration
          </CardTitle>
          <CardDescription>
            Connect to your sandwich collection tracking spreadsheet for real-time data sync
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
            <div>
              <div className="font-medium">Target Spreadsheet</div>
              <div className="text-sm text-gray-600">
                ID: {sheetId.substring(0, 20)}...
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(targetSheetUrl, '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open Sheet
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <div>
              <Label htmlFor="sheet-name">Sheet Name</Label>
              <Input
                id="sheet-name"
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
                placeholder="Sheet1"
                className="w-32"
              />
            </div>
            <Button
              onClick={analyzeSheet}
              disabled={isAnalyzing}
              variant="outline"
            >
              {isAnalyzing ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 mr-2" />
              )}
              Analyze Structure
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle>Sheet Analysis Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{analysis.totalRows}</div>
                <div className="text-sm text-gray-600">Total Rows</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{analysis.headers.length}</div>
                <div className="text-sm text-gray-600">Columns</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{analysis.dateColumns.length}</div>
                <div className="text-sm text-gray-600">Date Columns</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{analysis.sandwichColumns.length}</div>
                <div className="text-sm text-gray-600">Data Columns</div>
              </div>
            </div>

            <div>
              <Label>Detected Headers</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {analysis.headers.map((header: string, index: number) => (
                  <Badge key={index} variant="outline">
                    {header || `Column ${index + 1}`}
                  </Badge>
                ))}
              </div>
            </div>

            {analysis.sampleRow && analysis.sampleRow.length > 0 && (
              <div>
                <Label>Sample Data Row</Label>
                <div className="mt-2 p-3 bg-gray-50 rounded text-sm font-mono">
                  {analysis.sampleRow.slice(0, 5).join(' | ')}
                  {analysis.sampleRow.length > 5 && '...'}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Import Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Import from Google Sheets
          </CardTitle>
          <CardDescription>
            Import sandwich collection data from your Google Sheet to the database
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="dry-run"
              checked={dryRun}
              onCheckedChange={setDryRun}
            />
            <Label htmlFor="dry-run">
              Preview mode (dry run) - recommended for first import
            </Label>
          </div>

          <Button
            onClick={importFromSheet}
            disabled={isImporting || !analysis}
            className="w-full"
          >
            {isImporting ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            {dryRun ? 'Preview Import' : 'Import Data'}
          </Button>

          {!analysis && (
            <div className="flex items-center gap-2 text-amber-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              Please analyze the sheet structure first
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import Results */}
      {importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              {dryRun ? 'Import Preview Results' : 'Import Results'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {importResult.preview && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{importResult.preview.length}</div>
                  <div className="text-sm text-gray-600">Rows Analyzed</div>
                </div>
              )}
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{importResult.imported || 0}</div>
                <div className="text-sm text-gray-600">Imported</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{importResult.skipped || 0}</div>
                <div className="text-sm text-gray-600">Skipped</div>
              </div>
            </div>

            {importResult.errors && importResult.errors.length > 0 && (
              <div>
                <Label className="text-red-600">Errors ({importResult.errors.length})</Label>
                <div className="mt-2 p-3 bg-red-50 rounded text-sm max-h-32 overflow-y-auto">
                  {importResult.errors.slice(0, 5).map((error: string, index: number) => (
                    <div key={index} className="text-red-700">{error}</div>
                  ))}
                  {importResult.errors.length > 5 && (
                    <div className="text-red-600 font-medium">
                      ... and {importResult.errors.length - 5} more errors
                    </div>
                  )}
                </div>
              </div>
            )}

            {dryRun && importResult.preview && (
              <div className="mt-4">
                <Button
                  onClick={() => {
                    setDryRun(false);
                    importFromSheet();
                  }}
                  variant="default"
                  className="w-full"
                >
                  Proceed with Actual Import
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Export Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Export to Google Sheets
          </CardTitle>
          <CardDescription>
            Export current database records to a new sheet in your Google Sheets document
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={exportToSheet}
            disabled={isExporting}
            variant="outline"
            className="w-full"
          >
            {isExporting ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            Export Database to Sheets
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
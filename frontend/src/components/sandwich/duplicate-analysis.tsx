import { AlertTriangle, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { SandwichCollection } from "@shared/schema";

interface DuplicateAnalysis {
  totalCollections: number;
  duplicateGroups: number;
  totalDuplicateEntries: number;
  suspiciousPatterns: number;
  duplicates: Array<{
    entries: SandwichCollection[];
    count: number;
    keepNewest: SandwichCollection;
    toDelete: SandwichCollection[];
  }>;
  suspiciousEntries: SandwichCollection[];
}

interface DuplicateAnalysisProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: DuplicateAnalysis | null;
  onDeleteDuplicates: (ids: number[]) => void;
  isDeleting: boolean;
}

export function DuplicateAnalysisDialog({ 
  isOpen, 
  onClose, 
  analysis, 
  onDeleteDuplicates,
  isDeleting 
}: DuplicateAnalysisProps) {
  if (!analysis) return null;

  const handleDeleteAllDuplicates = () => {
    const duplicateIds = analysis.duplicates.flatMap(group => 
      group.toDelete.map(item => item.id)
    );
    onDeleteDuplicates(duplicateIds);
  };

  const handleDeleteGroup = (groupIndex: number) => {
    const group = analysis.duplicates[groupIndex];
    const idsToDelete = group.toDelete.map(item => item.id);
    onDeleteDuplicates(idsToDelete);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Duplicate Collection Analysis
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-2xl font-bold">{analysis.totalCollections}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Collections</div>
            </div>
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{analysis.duplicateGroups}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Duplicate Groups</div>
            </div>
            <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{analysis.totalDuplicateEntries}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Duplicates</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{analysis.suspiciousPatterns}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Suspicious Patterns</div>
            </div>
          </div>

          {/* Action Buttons */}
          {analysis.duplicateGroups > 0 && (
            <div className="flex gap-2">
              <Button 
                onClick={handleDeleteAllDuplicates}
                disabled={isDeleting}
                variant="destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete All Duplicates ({analysis.totalDuplicateEntries})
              </Button>
            </div>
          )}

          {/* Duplicate Groups */}
          {analysis.duplicates.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Duplicate Groups</h3>
              {analysis.duplicates.map((group, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium">
                      Group {index + 1}: {group.count} entries
                    </h4>
                    <Button
                      onClick={() => handleDeleteGroup(index)}
                      disabled={isDeleting}
                      variant="outline"
                      size="sm"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete {group.toDelete.length} duplicates
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    {/* Keep this one */}
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded border-l-4 border-green-500">
                      <div className="flex justify-between items-center">
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          KEEP
                        </Badge>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {group.keepNewest.collectionDate} - {group.keepNewest.hostName}
                        </div>
                      </div>
                      <div className="text-sm mt-1">
                        Individual: {group.keepNewest.individualSandwiches} | 
                        Groups: {group.keepNewest.groupCollections}
                      </div>
                    </div>
                    
                    {/* Delete these */}
                    {group.toDelete.map((item, itemIndex) => (
                      <div key={itemIndex} className="p-3 bg-red-50 dark:bg-red-900/20 rounded border-l-4 border-red-500">
                        <div className="flex justify-between items-center">
                          <Badge variant="destructive">DELETE</Badge>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {item.collectionDate} - {item.hostName}
                          </div>
                        </div>
                        <div className="text-sm mt-1">
                          Individual: {item.individualSandwiches} | 
                          Groups: {item.groupCollections}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Suspicious Patterns */}
          {analysis.suspiciousEntries.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Suspicious Patterns</h3>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                These entries have unusual patterns that may indicate data quality issues:
              </div>
              <div className="space-y-2">
                {analysis.suspiciousEntries.map((entry, index) => (
                  <div key={index} className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border-l-4 border-yellow-500">
                    <div className="flex justify-between items-center">
                      <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                        REVIEW
                      </Badge>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {entry.collectionDate} - {entry.hostName}
                      </div>
                    </div>
                    <div className="text-sm mt-1">
                      Individual: {entry.individualSandwiches} | 
                      Groups: {entry.groupCollections}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
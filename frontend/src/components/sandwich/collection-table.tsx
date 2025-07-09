import { useState } from "react";
import { Edit, Trash2, Calendar, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SandwichCollection } from "@shared/schema";

interface CollectionTableProps {
  collections: SandwichCollection[];
  onEdit: (collection: SandwichCollection) => void;
  onDelete: (id: number) => void;
  isUpdating: boolean;
  isDeleting: boolean;
}

interface EditDialogProps {
  collection: SandwichCollection | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: Partial<SandwichCollection>) => void;
  isUpdating: boolean;
}

function EditCollectionDialog({ collection, isOpen, onClose, onSave, isUpdating }: EditDialogProps) {
  const [formData, setFormData] = useState({
    collectionDate: collection?.collectionDate || '',
    hostName: collection?.hostName || '',
    individualSandwiches: collection?.individualSandwiches || 0,
    groupCollections: collection?.groupCollections || ''
  });

  const handleSave = () => {
    onSave(formData);
  };

  if (!collection) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Collection</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="collectionDate">Collection Date</Label>
            <Input
              id="collectionDate"
              type="date"
              value={formData.collectionDate}
              onChange={(e) => setFormData({ ...formData, collectionDate: e.target.value })}
            />
          </div>
          
          <div>
            <Label htmlFor="hostName">Host Name</Label>
            <Input
              id="hostName"
              value={formData.hostName}
              onChange={(e) => setFormData({ ...formData, hostName: e.target.value })}
            />
          </div>
          
          <div>
            <Label htmlFor="individualSandwiches">Individual Sandwiches</Label>
            <Input
              id="individualSandwiches"
              type="number"
              min="0"
              value={formData.individualSandwiches}
              onChange={(e) => setFormData({ ...formData, individualSandwiches: parseInt(e.target.value) || 0 })}
            />
          </div>
          
          <div>
            <Label htmlFor="groupCollections">Group Collections</Label>
            <Textarea
              id="groupCollections"
              value={formData.groupCollections}
              onChange={(e) => setFormData({ ...formData, groupCollections: e.target.value })}
              placeholder="JSON format or text description"
              rows={3}
            />
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isUpdating}>
              {isUpdating ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CollectionTable({ collections, onEdit, onDelete, isUpdating, isDeleting }: CollectionTableProps) {
  const [editingCollection, setEditingCollection] = useState<SandwichCollection | null>(null);

  const parseGroupCollections = (groupCollectionsJson: string) => {
    try {
      return JSON.parse(groupCollectionsJson || "[]");
    } catch {
      if (groupCollectionsJson && groupCollectionsJson !== "[]") {
        const parts = groupCollectionsJson.split(',');
        return parts.map(part => {
          const match = part.match(/([^:]+):\s*(\d+)/);
          if (match) {
            return {
              groupName: match[1].trim(),
              sandwichCount: parseInt(match[2])
            };
          }
          return null;
        }).filter(item => item !== null);
      }
      return [];
    }
  };

  const calculateTotal = (collection: SandwichCollection) => {
    const groupCollections = parseGroupCollections(collection.groupCollections);
    const groupTotal = groupCollections.reduce((sum: number, group: any) => 
      sum + (group.sandwichCount || 0), 0
    );
    return collection.individualSandwiches + groupTotal;
  };

  const handleEditClick = (collection: SandwichCollection) => {
    setEditingCollection(collection);
  };

  const handleEditSave = (updates: Partial<SandwichCollection>) => {
    if (editingCollection) {
      onEdit({ ...editingCollection, ...updates });
      setEditingCollection(null);
    }
  };

  const handleEditClose = () => {
    setEditingCollection(null);
  };

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b bg-gray-50 dark:bg-gray-800">
              <th className="text-left p-3 font-medium">Date</th>
              <th className="text-left p-3 font-medium">Host</th>
              <th className="text-left p-3 font-medium">Individual</th>
              <th className="text-left p-3 font-medium">Groups</th>
              <th className="text-left p-3 font-medium">Total</th>
              <th className="text-left p-3 font-medium">Submitted</th>
              <th className="text-right p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {collections.map((collection) => {
              const groupCollections = parseGroupCollections(collection.groupCollections);
              const total = calculateTotal(collection);
              
              return (
                <tr key={collection.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">
                        {new Date(collection.collectionDate).toLocaleDateString()}
                      </span>
                    </div>
                  </td>
                  
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span>{collection.hostName}</span>
                    </div>
                  </td>
                  
                  <td className="p-3">
                    <Badge variant="secondary">
                      {collection.individualSandwiches}
                    </Badge>
                  </td>
                  
                  <td className="p-3">
                    {groupCollections.length > 0 ? (
                      <div className="space-y-1">
                        {groupCollections.map((group: any, idx: number) => (
                          <div key={idx} className="text-sm">
                            <span className="font-medium">{group.groupName}:</span> {group.sandwichCount}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400">No groups</span>
                    )}
                  </td>
                  
                  <td className="p-3">
                    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {total}
                    </Badge>
                  </td>
                  
                  <td className="p-3 text-sm text-gray-600 dark:text-gray-400">
                    {new Date(collection.submittedAt).toLocaleDateString()}
                  </td>
                  
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditClick(collection)}
                        disabled={isUpdating}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(collection.id)}
                        disabled={isDeleting}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <EditCollectionDialog
        collection={editingCollection}
        isOpen={!!editingCollection}
        onClose={handleEditClose}
        onSave={handleEditSave}
        isUpdating={isUpdating}
      />
    </>
  );
}
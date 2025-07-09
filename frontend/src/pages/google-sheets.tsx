import { useState } from"react";
import { useQuery, useMutation, useQueryClient } from"@tanstack/react-query";
import { Plus, Eye, ExternalLink, Settings, Trash2, Share } from"lucide-react";
import { Button } from"@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from"@/components/ui/dialog";
import { Input } from"@/components/ui/input";
import { Label } from"@/components/ui/label";
import { Textarea } from"@/components/ui/textarea";
import { Badge } from"@/components/ui/badge";
import { useForm } from"react-hook-form";
import { apiRequest } from"@/lib/queryClient";
import { useToast } from"@/hooks/use-toast";

interface GoogleSheet {
 id: number;
 name: string;
 description: string;
 sheetId: string;
 isPublic: boolean;
 embedUrl: string;
 directUrl: string;
 createdAt: string;
 updatedAt: string;
}

interface SheetFormData {
 name: string;
 description: string;
 sheetId: string;
 isPublic: boolean;
}

export default function GoogleSheets() {
 const [selectedSheet, setSelectedSheet] = useState<GoogleSheet | null>(null);
 const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
 const [isViewerOpen, setIsViewerOpen] = useState(false);
 const { toast } = useToast();
 const queryClient = useQueryClient();

 const { data: sheets = [], isLoading } = useQuery<GoogleSheet[]>({
 queryKey: ['/api/google-sheets'],
 });

 const form = useForm<SheetFormData>({
 defaultValues: {
 name:"",
 description:"",
 sheetId:"",
 isPublic: true
 }
 });

 const createSheetMutation = useMutation({
 mutationFn: async (data: SheetFormData) => {
 return await apiRequest('POST', '/api/google-sheets', data);
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['/api/google-sheets'] });
 setIsAddDialogOpen(false);
 form.reset();
 toast({
 title:"Success",
 description:"Google Sheet added successfully",
 });
 },
 onError: (error) => {
 toast({
 title:"Error", 
 description: error.message ||"Failed to add Google Sheet",
 variant:"destructive",
 });
 },
 });

 const deleteSheetMutation = useMutation({
 mutationFn: async (id: number) => {
 return await apiRequest('DELETE', `/api/google-sheets/${id}`);
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['/api/google-sheets'] });
 toast({
 title:"Success",
 description:"Google Sheet removed successfully",
 });
 },
 onError: (error) => {
 toast({
 title:"Error",
 description: error.message ||"Failed to remove Google Sheet",
 variant:"destructive",
 });
 },
 });

 const extractSheetId = (url: string) => {
 const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
 return match ? match[1] : url;
 };

 const generateEmbedUrl = (sheetId: string) => {
 return `https://docs.google.com/spreadsheets/d/${sheetId}/edit?usp=sharing&widget=true&headers=false`;
 };

 const handleSubmit = (data: SheetFormData) => {
 const cleanSheetId = extractSheetId(data.sheetId);
 const sheetData = {
 ...data,
 sheetId: cleanSheetId,
 };
 createSheetMutation.mutate(sheetData);
 };

 const handleViewSheet = (sheet: GoogleSheet) => {
 setSelectedSheet(sheet);
 setIsViewerOpen(true);
 };

 const handleDeleteSheet = (id: number) => {
 if (confirm("Are you sure you want to remove this Google Sheet?")) {
 deleteSheetMutation.mutate(id);
 }
 };

 if (isLoading) {
 return (
 <div className="container mx-auto p-6">
 <div className="flex items-center justify-center h-64">
 <div className="text-lg">Loading Google Sheets...</div>
 </div>
 </div>
 );
 }

 return (
 <div className="container mx-auto p-6 space-y-6">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Google Sheets</h1>
 <p className="text-gray-600 dark:text-gray-400 mt-2">
 Embed and manage shared Google Sheets for collaborative access
 </p>
 </div>
 
 <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
 <DialogTrigger asChild>
 <Button className="bg-[#236383] hover:bg-[#1e5671] text-white">
 <Plus className="mr-2 h-4 w-4" />
 Add Google Sheet
 </Button>
 </DialogTrigger>
 <DialogContent className="sm:max-w-md">
 <DialogHeader>
 <DialogTitle>Add Google Sheet</DialogTitle>
 </DialogHeader>
 <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
 <div>
 <Label htmlFor="name">Sheet Name</Label>
 <Input
 id="name"
 {...form.register("name", { required: true })}
 placeholder="e.g., Volunteer Schedule"
 />
 </div>
 
 <div>
 <Label htmlFor="description">Description</Label>
 <Textarea
 id="description"
 {...form.register("description")}
 placeholder="Brief description of this sheet's purpose"
 rows={3}
 />
 </div>
 
 <div>
 <Label htmlFor="sheetId">Google Sheet URL or ID</Label>
 <Input
 id="sheetId"
 {...form.register("sheetId", { required: true })}
 placeholder="https://docs.google.com/spreadsheets/d/... or just the sheet ID"
 />
 <p className="text-xs text-gray-500 mt-1">
 Paste the full Google Sheets URL or just the sheet ID
 </p>
 </div>
 
 <div className="flex items-center space-x-2">
 <input
 type="checkbox"
 id="isPublic"
 {...form.register("isPublic")}
 className="h-4 w-4"
 />
 <Label htmlFor="isPublic" className="text-sm">
 Make accessible to all platform users
 </Label>
 </div>
 
 <div className="flex justify-end space-x-2 pt-4">
 <Button
 type="button"
 variant="outline"
 onClick={() => setIsAddDialogOpen(false)}
 >
 Cancel
 </Button>
 <Button
 type="submit"
 disabled={createSheetMutation.isPending}
 className="bg-[#236383] hover:bg-[#1e5671] text-white"
 >
 {createSheetMutation.isPending ?"Adding..." :"Add Sheet"}
 </Button>
 </div>
 </form>
 </DialogContent>
 </Dialog>
 </div>

 {sheets.length === 0 ? (
 <Card>
 <CardContent className="flex flex-col items-center justify-center py-16">
 <Share className="h-12 w-12 text-gray-400 mb-4" />
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
 No Google Sheets Added
 </h3>
 <p className="text-gray-600 dark:text-gray-400 text-center mb-4">
 Add your first Google Sheet to enable collaborative access for your team.
 </p>
 <Button
 onClick={() => setIsAddDialogOpen(true)}
 className="bg-[#236383] hover:bg-[#1e5671] text-white"
 >
 <Plus className="mr-2 h-4 w-4" />
 Add Google Sheet
 </Button>
 </CardContent>
 </Card>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {sheets.map((sheet) => (
 <Card key={sheet.id} className="hover:shadow-lg transition-shadow">
 <CardHeader>
 <div className="flex items-start justify-between">
 <div className="flex-1">
 <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 {sheet.name}
 </CardTitle>
 <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
 {sheet.description}
 </p>
 </div>
 <div className="flex items-center space-x-1">
 {sheet.isPublic && (
 <Badge variant="secondary" className="text-xs">
 Public
 </Badge>
 )}
 </div>
 </div>
 </CardHeader>
 
 <CardContent>
 <div className="flex items-center justify-between">
 <div className="flex space-x-2">
 <Button
 size="sm"
 variant="outline"
 onClick={() => handleViewSheet(sheet)}
 >
 <Eye className="h-4 w-4 mr-1" />
 View
 </Button>
 
 <Button
 size="sm"
 variant="outline"
 onClick={() => window.open(sheet.directUrl, '_blank')}
 >
 <ExternalLink className="h-4 w-4 mr-1" />
 Edit
 </Button>
 </div>
 
 <Button
 size="sm"
 variant="destructive"
 onClick={() => handleDeleteSheet(sheet.id)}
 >
 <Trash2 className="h-4 w-4" />
 </Button>
 </div>
 
 <div className="mt-3 text-xs text-gray-500">
 Added {new Date(sheet.createdAt).toLocaleDateString()}
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 )}

 {/* Sheet Viewer Dialog */}
 <Dialog open={isViewerOpen} onOpenChange={setIsViewerOpen}>
 <DialogContent className="max-w-6xl h-[80vh]">
 <DialogHeader>
 <DialogTitle className="flex items-center justify-between">
 <span>{selectedSheet?.name}</span>
 {selectedSheet && (
 <Button
 size="sm"
 variant="outline"
 onClick={() => window.open(selectedSheet.directUrl, '_blank')}
 >
 <ExternalLink className="h-4 w-4 mr-1" />
 Open in Google Sheets
 </Button>
 )}
 </DialogTitle>
 </DialogHeader>
 
 {selectedSheet && (
 <div className="flex-1 overflow-hidden">
 <iframe
 src={selectedSheet.embedUrl}
 className="w-full h-full border-0 rounded-md"
 title={selectedSheet.name}
 />
 </div>
 )}
 </DialogContent>
 </Dialog>
 </div>
 );
}
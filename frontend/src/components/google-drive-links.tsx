import { useQuery, useMutation } from "@tanstack/react-query";
import { ExternalLink, Upload, Plus, FileText, Image, Video, Music, Archive } from "lucide-react";
import * as Icons from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import type { DriveLink } from "@shared/schema";

export default function GoogleDriveLinks() {
  const { toast } = useToast();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    url: "",
    icon: "folder",
    iconColor: "blue"
  });

  const { data: links = [], isLoading } = useQuery<DriveLink[]>({
    queryKey: ["/api/drive-links"]
  });

  // File type icons and colors
  const fileTypeIcons = {
    document: { icon: "file-text", color: "blue" },
    spreadsheet: { icon: "sheet", color: "green" },
    presentation: { icon: "presentation", color: "amber" },
    image: { icon: "image", color: "purple" },
    video: { icon: "video", color: "red" },
    audio: { icon: "music", color: "pink" },
    archive: { icon: "archive", color: "gray" },
    pdf: { icon: "file-text", color: "red" },
    folder: { icon: "folder", color: "blue" }
  };

  const iconOptions = [
    { value: "folder", label: "Folder", icon: Icons.Folder },
    { value: "file-text", label: "Document", icon: Icons.FileText },
    { value: "image", label: "Image", icon: Icons.Image },
    { value: "video", label: "Video", icon: Icons.Video },
    { value: "music", label: "Audio", icon: Icons.Music },
    { value: "archive", label: "Archive", icon: Icons.Archive },
    { value: "chart-line", label: "Chart", icon: Icons.TrendingUp },
    { value: "users", label: "Team", icon: Icons.Users },
    { value: "utensils", label: "Food", icon: Icons.Utensils }
  ];

  const colorOptions = [
    { value: "blue", label: "Blue" },
    { value: "green", label: "Green" },
    { value: "amber", label: "Amber" },
    { value: "purple", label: "Purple" },
    { value: "red", label: "Red" },
    { value: "pink", label: "Pink" },
    { value: "gray", label: "Gray" }
  ];

  // Mutations for creating new links
  const createLinkMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/drive-links", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drive-links"] });
      setIsAddModalOpen(false);
      setUploadedFile(null);
      setFormData({
        title: "",
        description: "",
        url: "",
        icon: "folder",
        iconColor: "blue"
      });
      toast({
        title: "Link added",
        description: "File link has been added successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add file link. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      
      // Auto-fill form based on file type
      const fileName = file.name;
      const fileExtension = fileName.split('.').pop()?.toLowerCase();
      
      setFormData(prev => ({
        ...prev,
        title: fileName,
        description: `Uploaded file: ${fileName} (${(file.size / 1024 / 1024).toFixed(2)} MB)`
      }));

      // Set appropriate icon and color based on file type
      if (fileExtension) {
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension)) {
          setFormData(prev => ({ ...prev, icon: "image", iconColor: "purple" }));
        } else if (['mp4', 'avi', 'mov', 'wmv'].includes(fileExtension)) {
          setFormData(prev => ({ ...prev, icon: "video", iconColor: "red" }));
        } else if (['mp3', 'wav', 'flac', 'aac'].includes(fileExtension)) {
          setFormData(prev => ({ ...prev, icon: "music", iconColor: "pink" }));
        } else if (['pdf'].includes(fileExtension)) {
          setFormData(prev => ({ ...prev, icon: "file-text", iconColor: "red" }));
        } else if (['doc', 'docx', 'txt'].includes(fileExtension)) {
          setFormData(prev => ({ ...prev, icon: "file-text", iconColor: "blue" }));
        } else if (['xls', 'xlsx', 'csv'].includes(fileExtension)) {
          setFormData(prev => ({ ...prev, icon: "chart-line", iconColor: "green" }));
        } else if (['zip', 'rar', '7z', 'tar'].includes(fileExtension)) {
          setFormData(prev => ({ ...prev, icon: "archive", iconColor: "gray" }));
        }
      }
    }
  };

  const handleSubmit = () => {
    if (!formData.title || (!formData.url && !uploadedFile)) {
      toast({
        title: "Error",
        description: "Please provide a title and either a URL or upload a file.",
        variant: "destructive",
      });
      return;
    }

    // For now, we'll create a placeholder URL for uploaded files
    // In a real implementation, you'd upload the file to a storage service
    const finalUrl = uploadedFile 
      ? `#uploaded-file-${uploadedFile.name}` 
      : formData.url;

    createLinkMutation.mutate({
      title: formData.title,
      description: formData.description,
      url: finalUrl,
      icon: formData.icon,
      iconColor: formData.iconColor
    });
  };

  const getIcon = (iconName: string) => {
    const iconMap: { [key: string]: any } = {
      folder: Icons.Folder,
      "file-text": Icons.FileText,
      image: Icons.Image,
      video: Icons.Video,
      music: Icons.Music,
      archive: Icons.Archive,
      "chart-line": Icons.TrendingUp,
      utensils: Icons.Utensils,
      users: Icons.Users,
    };
    
    const IconComponent = iconMap[iconName] || Icons.Folder;
    return IconComponent;
  };

  const getIconColor = (color: string) => {
    switch (color) {
      case "blue": return "text-blue-500";
      case "green": return "text-green-500";
      case "amber": return "text-amber-500";
      case "purple": return "text-purple-500";
      default: return "text-blue-500";
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="h-6 bg-slate-200 rounded animate-pulse"></div>
        </div>
        <div className="p-6 space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center p-3 bg-slate-50 rounded-lg">
              <div className="w-6 h-6 bg-slate-200 rounded mr-3 animate-pulse"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-200 rounded animate-pulse"></div>
                <div className="h-3 bg-slate-100 rounded animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
      <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center">
          <Icons.FolderOpen className="text-blue-500 mr-2 w-5 h-5" />
          Files & Links
        </h2>
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add File
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add File or Link</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="file-upload">Upload File</Label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-gray-400 transition-colors">
                  <div className="space-y-1 text-center">
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="flex text-sm text-gray-600">
                      <label
                        htmlFor="file-upload"
                        className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none"
                      >
                        <span>Upload a file</span>
                        <input
                          id="file-upload"
                          name="file-upload"
                          type="file"
                          className="sr-only"
                          onChange={handleFileChange}
                        />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500">Any file type up to 10MB</p>
                  </div>
                </div>
                {uploadedFile && (
                  <p className="mt-2 text-sm text-green-600">Selected: {uploadedFile.name}</p>
                )}
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">Or add link</span>
                </div>
              </div>

              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter file or link title"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter description"
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="url">URL (if adding link)</Label>
                <Input
                  id="url"
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://..."
                  disabled={!!uploadedFile}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="icon">Icon</Label>
                  <Select value={formData.icon} onValueChange={(value) => setFormData({ ...formData, icon: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select icon" />
                    </SelectTrigger>
                    <SelectContent>
                      {iconOptions.map((option) => {
                        const IconComponent = option.icon;
                        return (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center gap-2">
                              <IconComponent className="w-4 h-4" />
                              {option.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="color">Color</Label>
                  <Select value={formData.iconColor} onValueChange={(value) => setFormData({ ...formData, iconColor: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select color" />
                    </SelectTrigger>
                    <SelectContent>
                      {colorOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full bg-${option.value}-500`}></div>
                            {option.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={createLinkMutation.isPending}>
                  {createLinkMutation.isPending ? "Adding..." : "Add File"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="p-6">
        <div className="space-y-3">
          {links.map((link) => {
            const IconComponent = getIcon(link.icon);
            return (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors group"
              >
                <IconComponent className={`${getIconColor(link.iconColor)} mr-3 w-5 h-5`} />
                <div className="flex-1">
                  <h3 className="font-medium text-slate-900 group-hover:text-blue-600">
                    {link.title}
                  </h3>
                  <p className="text-sm text-slate-600">{link.description}</p>
                </div>
                <ExternalLink className="text-slate-400 ml-auto w-4 h-4" />
              </a>
            );
          })}
          
          {links.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              No files or links yet. Click "Add File" to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

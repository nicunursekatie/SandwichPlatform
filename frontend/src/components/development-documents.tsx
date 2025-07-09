import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Eye, ExternalLink } from "lucide-react";
import { DocumentPreview } from "./document-preview";

interface DevelopmentDocument {
  name: string;
  path: string;
  type: 'pdf' | 'xlsx' | 'docx' | 'txt' | 'other';
  category: string;
  description?: string;
}

const developmentDocuments: DevelopmentDocument[] = [
  {
    name: "Articles of Incorporation",
    path: "/attached_assets/Articles of Incorporation_1750817584990.pdf",
    type: "pdf",
    category: "Legal",
    description: "Official Articles of Incorporation for The Sandwich Project"
  },
  {
    name: "IRS Tax Exempt Letter",
    path: "/attached_assets/IRS Tax Exempt Letter (Contains EIN)_1750817584990.pdf",
    type: "pdf",
    category: "Legal",
    description: "IRS Tax Exempt determination letter containing EIN"
  },
  {
    name: "The Sandwich Project Bylaws 2024",
    path: "/attached_assets/The Sandwich Project Bylaws 2024(1)_1750871081277.pdf",
    type: "pdf",
    category: "Legal",
    description: "Official bylaws document outlining organizational structure, governance, and operational procedures"
  },

];

const getFileIcon = (type: string) => {
  switch (type) {
    case 'pdf':
      return <FileText className="h-5 w-5 text-red-500" />;
    case 'xlsx':
      return <FileText className="h-5 w-5 text-green-500" />;
    case 'docx':
      return <FileText className="h-5 w-5 text-blue-500" />;
    case 'txt':
      return <FileText className="h-5 w-5 text-gray-500" />;
    default:
      return <FileText className="h-5 w-5 text-gray-500" />;
  }
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'Legal':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
    case 'Governance':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case 'Financial':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  }
};

export function DevelopmentDocuments() {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [previewDocument, setPreviewDocument] = useState<DevelopmentDocument | null>(null);

  const categories = ['All', ...Array.from(new Set(developmentDocuments.map(doc => doc.category)))];
  
  const filteredDocs = selectedCategory === 'All' 
    ? developmentDocuments 
    : developmentDocuments.filter(doc => doc.category === selectedCategory);

  const handleDownload = (path: string, name: string) => {
    const link = document.createElement('a');
    link.href = path;
    link.download = name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePreview = (doc: DevelopmentDocument) => {
    setPreviewDocument(doc);
  };

  const handleOpenInNewTab = (path: string) => {
    window.open(path, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <Button
            key={category}
            variant={selectedCategory === category ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(category)}
          >
            {category}
          </Button>
        ))}
      </div>

      {/* Document Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredDocs.map((doc, index) => (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {getFileIcon(doc.type)}
                  <CardTitle className="text-base leading-tight">{doc.name}</CardTitle>
                </div>
                <Badge className={getCategoryColor(doc.category)} variant="secondary">
                  {doc.category}
                </Badge>
              </div>
              {doc.description && (
                <CardDescription className="text-sm">
                  {doc.description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex gap-2">
                <Button 
                  onClick={() => handlePreview(doc)}
                  className="flex-1"
                  variant="outline"
                  size="sm"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
                <Button 
                  onClick={() => handleDownload(doc.path, doc.name)}
                  className="flex-1"
                  size="sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
              <Button 
                onClick={() => handleOpenInNewTab(doc.path)}
                className="w-full mt-2"
                variant="ghost"
                size="sm"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in New Tab
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredDocs.length === 0 && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">No documents found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Try selecting a different category
          </p>
        </div>
      )}

      {previewDocument && (
        <DocumentPreview
          documentPath={previewDocument.path}
          documentName={previewDocument.name}
          documentType={previewDocument.type}
          onClose={() => setPreviewDocument(null)}
        />
      )}
    </div>
  );
}
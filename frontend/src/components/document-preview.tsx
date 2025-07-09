import { useState } from 'react';
import { X, Download, ExternalLink, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DocumentPreviewProps {
 documentPath: string;
 documentName: string;
 documentType: string;
 onClose: () => void;
}

export function DocumentPreview({ documentPath, documentName, documentType, onClose }: DocumentPreviewProps) {
 const [isLoading, setIsLoading] = useState(true);

 const handleDownload = () => {
 const link = document.createElement('a');
 link.href = documentPath;
 link.download = documentName;
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 };

 const handleOpenInNewTab = () => {
 window.open(documentPath, '_blank');
 };

 const renderPreview = () => {
 switch (documentType?.toLowerCase()) {
 case 'pdf':
 return (
 <iframe
 src={documentPath}
 className="w-full h-full border-0"
 onLoad={() => setIsLoading(false)}
 title={documentName}
 />
 );
 case 'docx':
 // For DOCX files, show a download option since viewing requires conversion
 return (
 <div className="flex flex-col items-center justify-center h-full p-8 text-center">
 <div className="mb-4">
 <FileText className="w-16 h-16 text-blue-500 mx-auto mb-4" />
 <h3 className="text-lg font-semibold mb-2">{documentName}</h3>
 <p className="text-gray-600 mb-6">
 Word documents require download to view. Click the download button to save the file to your device.
 </p>
 </div>
 <div className="flex gap-4">
 <Button onClick={handleDownload} className="flex items-center gap-2">
 <Download className="w-4 h-4" />
 Download Document
 </Button>
 <Button 
 variant="outline" 
 onClick={handleOpenInNewTab}
 className="flex items-center gap-2"
 >
 <ExternalLink className="w-4 h-4" />
 Open in New Tab
 </Button>
 </div>
 </div>
 );
 case 'xlsx':
 // For Excel files, show a download option since viewing requires conversion
 return (
 <div className="flex flex-col items-center justify-center h-full p-8 text-center">
 <div className="mb-4">
 <FileText className="w-16 h-16 text-green-500 mx-auto mb-4" />
 <h3 className="text-lg font-semibold mb-2">{documentName}</h3>
 <p className="text-gray-600 mb-6">
 Excel files require download to view. Click the download button to save the file to your device.
 </p>
 </div>
 <div className="flex gap-4">
 <Button onClick={handleDownload} className="flex items-center gap-2">
 <Download className="w-4 h-4" />
 Download Document
 </Button>
 <Button 
 variant="outline" 
 onClick={handleOpenInNewTab}
 className="flex items-center gap-2"
 >
 <ExternalLink className="w-4 h-4" />
 Open in New Tab
 </Button>
 </div>
 </div>
 );
 default:
 return (
 <div className="flex flex-col items-center justify-center h-full p-8 text-center">
 <div className="mb-4">
 <FileText className="w-16 h-16 text-gray-500 mx-auto mb-4" />
 <h3 className="text-lg font-semibold mb-2">{documentName}</h3>
 <p className="text-gray-600 mb-6">
 Preview not available for this file type. Download or open in a new tab to view.
 </p>
 </div>
 <div className="flex gap-4">
 <Button onClick={handleDownload} className="flex items-center gap-2">
 <Download className="w-4 h-4" />
 Download Document
 </Button>
 <Button 
 variant="outline" 
 onClick={handleOpenInNewTab}
 className="flex items-center gap-2"
 >
 <ExternalLink className="w-4 h-4" />
 Open in New Tab
 </Button>
 </div>
 </div>
 );
 }
 };

 return (
 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
 <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-6xl h-5/6 flex flex-col">
 {/* Header */}
 <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
 <div className="flex items-center space-x-3">
 <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
 {documentName}
 </h2>
 <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 rounded-full">
 {documentType?.toUpperCase() || 'FILE'}
 </span>
 </div>
 <div className="flex items-center space-x-2">
 <Button onClick={handleDownload} variant="ghost" size="sm">
 <Download className="w-4 h-4" />
 </Button>
 <Button onClick={handleOpenInNewTab} variant="ghost" size="sm">
 <ExternalLink className="w-4 h-4" />
 </Button>
 <Button onClick={onClose} variant="ghost" size="sm">
 <X className="w-4 h-4" />
 </Button>
 </div>
 </div>

 {/* Preview Content */}
 <div className="flex-1 relative">
 {isLoading && (
 <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-800">
 <div className="text-center">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
 <p className="text-gray-600 dark:text-gray-400">Loading preview...</p>
 </div>
 </div>
 )}
 {renderPreview()}
 </div>

 {/* Footer */}
 <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
 <div className="flex justify-between items-center">
 <p className="text-sm text-gray-600 dark:text-gray-400">
 Use the buttons above to download or open in a new tab
 </p>
 <Button onClick={onClose} variant="outline">
 Close Preview
 </Button>
 </div>
 </div>
 </div>
 </div>
 );
}
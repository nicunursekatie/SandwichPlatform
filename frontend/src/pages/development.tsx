import { Building2 } from "lucide-react";
import { DevelopmentDocuments } from "@/components/development-documents";

export default function Development() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex items-center justify-center w-12 h-12 bg-secondary/20 dark:bg-secondary/20 rounded-xl">
            <Building2 className="w-6 h-6 text-secondary dark:text-secondary" />
          </div>
          <div>
            <h1 className="text-3xl font-main-heading text-primary dark:text-secondary">Development & Resources</h1>
            <p className="font-body text-muted-foreground">Organizational documents and development resources</p>
          </div>
        </div>

        <div className="max-w-6xl">
          <DevelopmentDocuments />
        </div>
      </div>
    </div>
  );
}
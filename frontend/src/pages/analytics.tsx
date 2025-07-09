import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import SimpleNav from "@/components/simple-nav";
import AnalyticsDashboard from "@/components/analytics-dashboard";

export default function AnalyticsPage() {
  return (
    <div className="bg-slate-50 min-h-screen flex flex-col">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <img src="/api/placeholder/32/32" alt="Logo" className="w-8 h-8" />
            <span className="text-xl font-semibold text-slate-900">The Sandwich Project</span>
          </div>
          <Button variant="ghost" size="sm">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      <div className="flex flex-1">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
          <SimpleNav onSectionChange={() => {}} />
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          <AnalyticsDashboard />
        </div>
      </div>
    </div>
  );
}
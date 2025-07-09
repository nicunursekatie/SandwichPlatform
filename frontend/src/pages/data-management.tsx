import { ErrorBoundary } from "@/components/error-boundary";
import { DataManagementDashboard } from "@/components/data-management-dashboard";

export default function DataManagementPage() {
  return (
    <ErrorBoundary>
      <DataManagementDashboard />
    </ErrorBoundary>
  );
}
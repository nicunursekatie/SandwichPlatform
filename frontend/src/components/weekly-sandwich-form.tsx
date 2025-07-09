import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function WeeklySandwichForm() {
  const { toast } = useToast();
  const [weekEnding, setWeekEnding] = useState("");
  const [sandwichCount, setSandwichCount] = useState("");
  const [notes, setNotes] = useState("");

  const submitReportMutation = useMutation({
    mutationFn: async (data: { weekEnding: string; sandwichCount: number; notes?: string }) => {
      const response = await apiRequest("POST", "/api/weekly-reports", {
        ...data,
        submittedBy: "John Doe"
      });
      return response.json();
    },
    onSuccess: () => {
      setWeekEnding("");
      setSandwichCount("");
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["/api/weekly-reports"] });
      toast({
        title: "Weekly total submitted",
        description: "Your sandwich count has been recorded successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to submit report",
        description: "Please check your input and try again.",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!weekEnding || !sandwichCount) {
      toast({
        title: "Missing information",
        description: "Please fill in the week ending date and sandwich count.",
        variant: "destructive"
      });
      return;
    }

    const count = parseInt(sandwichCount);
    if (isNaN(count) || count < 0) {
      toast({
        title: "Invalid sandwich count",
        description: "Please enter a valid number.",
        variant: "destructive"
      });
      return;
    }

    submitReportMutation.mutate({
      weekEnding,
      sandwichCount: count,
      notes: notes || undefined
    });
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
      <div className="px-6 py-4 border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center">
          <BarChart3 className="text-green-500 mr-2 w-5 h-5" />
          Weekly Totals
        </h2>
      </div>
      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="week-ending" className="block text-sm font-medium text-slate-700 mb-1">
              Week Ending
            </Label>
            <Input
              id="week-ending"
              type="date"
              value={weekEnding}
              onChange={(e) => setWeekEnding(e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <Label htmlFor="sandwich-count" className="block text-sm font-medium text-slate-700 mb-1">
              Sandwiches Sold
            </Label>
            <Input
              id="sandwich-count"
              type="number"
              placeholder="0"
              value={sandwichCount}
              onChange={(e) => setSandwichCount(e.target.value)}
              className="w-full"
              min="0"
            />
          </div>
          <div>
            <Label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">
              Notes
            </Label>
            <Textarea
              id="notes"
              rows={2}
              placeholder="Any additional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full resize-none"
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-green-600 text-white hover:bg-green-700 focus:ring-green-500"
            disabled={submitReportMutation.isPending}
          >
            {submitReportMutation.isPending ? "Submitting..." : "Submit Weekly Total"}
          </Button>
        </form>
      </div>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import type { MeetingMinutes } from "@shared/schema";

interface MeetingMinutesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MeetingMinutesModal({ open, onOpenChange }: MeetingMinutesModalProps) {
  const { data: minutes = [], isLoading } = useQuery<MeetingMinutes[]>({
    queryKey: ["/api/meeting-minutes"],
    enabled: open
  });

  const getBorderColor = (color: string) => {
    switch (color) {
      case "blue": return "border-l-blue-500";
      case "green": return "border-l-green-500";
      case "amber": return "border-l-amber-500";
      case "purple": return "border-l-purple-500";
      default: return "border-l-blue-500";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <ClipboardList className="text-purple-500 mr-2 w-5 h-5" />
            All Meeting Minutes
          </DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex-1 space-y-4 p-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="border-l-4 border-slate-200 pl-4 space-y-2">
                <div className="h-4 bg-slate-200 rounded animate-pulse"></div>
                <div className="h-3 bg-slate-100 rounded animate-pulse"></div>
                <div className="h-16 bg-slate-50 rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        ) : (
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6">
              {minutes.map((minute) => (
                <div key={minute.id} className={`border-l-4 ${getBorderColor(minute.color)} pl-6 pb-6`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-slate-900">{minute.title}</h3>
                    <span className="text-sm text-slate-500 font-medium">{minute.date}</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">{minute.summary}</p>
                </div>
              ))}
              
              {minutes.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  No meeting minutes found.
                </div>
              )}
            </div>
          </ScrollArea>
        )}
        
        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

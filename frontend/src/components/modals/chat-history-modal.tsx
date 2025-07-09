import { useQuery } from "@tanstack/react-query";
import { MessageCircle, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import type { Message } from "@shared/schema";

interface ChatHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ChatHistoryModal({ open, onOpenChange }: ChatHistoryModalProps) {
  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages"],
    enabled: open
  });

  const formatDateTime = (timestamp: string | Date) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + " at " + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <MessageCircle className="text-blue-500 mr-2 w-5 h-5" />
            Full Chat History
          </DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex-1 space-y-4 p-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="border rounded-lg p-4 space-y-2">
                <div className="h-4 bg-slate-200 rounded animate-pulse"></div>
                <div className="h-3 bg-slate-100 rounded animate-pulse"></div>
                <div className="h-16 bg-slate-50 rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        ) : (
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-slate-900">{message.sender}</h3>
                    <span className="text-sm text-slate-500">{formatDateTime(message.timestamp)}</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">{message.content}</p>
                </div>
              ))}
              
              {messages.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  No messages found.
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

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface AddMeetingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddMeetingModal({ open, onOpenChange }: AddMeetingModalProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [summary, setSummary] = useState("");
  const [color, setColor] = useState("blue");

  const addMeetingMutation = useMutation({
    mutationFn: async (data: { title: string; date: string; summary: string; color: string }) => {
      const response = await apiRequest("POST", "/api/meeting-minutes", data);
      return response.json();
    },
    onSuccess: () => {
      setTitle("");
      setDate("");
      setSummary("");
      setColor("blue");
      queryClient.invalidateQueries({ queryKey: ["/api/meeting-minutes"] });
      onOpenChange(false);
      toast({
        title: "Meeting minutes added",
        description: "The meeting minutes have been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to add meeting minutes",
        description: "Please check your input and try again.",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || !date || !summary) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    addMeetingMutation.mutate({ title, date, summary, color });
  };

  const handleClose = () => {
    setTitle("");
    setDate("");
    setSummary("");
    setColor("blue");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Plus className="text-purple-500 mr-2 w-5 h-5" />
            Add Meeting Minutes
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title" className="block text-sm font-medium text-slate-700 mb-1">
              Meeting Title *
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Weekly Planning Meeting"
              className="w-full"
            />
          </div>
          
          <div>
            <Label htmlFor="date" className="block text-sm font-medium text-slate-700 mb-1">
              Meeting Date *
            </Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full"
            />
          </div>
          
          <div>
            <Label htmlFor="color" className="block text-sm font-medium text-slate-700 mb-1">
              Border Color
            </Label>
            <Select value={color} onValueChange={setColor}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="blue">Blue</SelectItem>
                <SelectItem value="green">Green</SelectItem>
                <SelectItem value="amber">Amber</SelectItem>
                <SelectItem value="purple">Purple</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="summary" className="block text-sm font-medium text-slate-700 mb-1">
              Meeting Summary *
            </Label>
            <Textarea
              id="summary"
              rows={4}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Brief summary of what was discussed and decided..."
              className="w-full"
            />
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={addMeetingMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {addMeetingMutation.isPending ? "Adding..." : "Add Meeting Minutes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

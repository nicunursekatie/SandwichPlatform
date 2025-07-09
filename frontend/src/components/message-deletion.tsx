import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface MessageDeletionProps {
  messageId: number;
  onDelete?: () => void;
}

export default function MessageDeletion({ messageId, onDelete }: MessageDeletionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete message');
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      toast({
        title: "Message deleted",
        description: "The message has been successfully removed.",
      });
      onDelete?.();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete message. Please try again.",
        variant: "destructive",
      });
    }
  });

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => deleteMutation.mutate()}
      disabled={deleteMutation.isPending}
      className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
    >
      <Trash2 className="h-3 w-3" />
    </Button>
  );
}
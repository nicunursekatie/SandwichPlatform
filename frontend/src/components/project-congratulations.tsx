import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Heart, MessageCircle, Trophy, Star, PartyPopper, ThumbsUp } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface ProjectCongratulationsProps {
  projectId: number;
  projectTitle: string;
  currentUser: any;
  isCompleted: boolean;
}

interface CongratulationsMessage {
  id: number;
  userId: string;
  message: string;
  celebrationData: {
    senderName: string;
    emoji: string;
    sentAt: string;
  };
  createdAt: string;
}

export default function ProjectCongratulations({ 
  projectId, 
  projectTitle, 
  currentUser, 
  isCompleted 
}: ProjectCongratulationsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [congratsMessage, setCongratsMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  // Fetch congratulations messages for this project
  const { data: congratulations, refetch } = useQuery<CongratulationsMessage[]>({
    queryKey: ['/api/projects', projectId, 'congratulations'],
    enabled: isCompleted,
  });

  const celebrationEmojis = ['🎉', '🌟', '🎊', '🥳', '🏆', '✨', '👏', '💪', '🎯', '🚀'];

  const handleSendCongratulations = async () => {
    if (!congratsMessage.trim()) return;

    setIsSending(true);
    try {
      const randomEmoji = celebrationEmojis[Math.floor(Math.random() * celebrationEmojis.length)];
      
      const congratulationData = {
        userId: currentUser?.id || 'anonymous',
        type: 'congratulations',
        title: 'Project Congratulations!',
        message: congratsMessage,
        relatedType: 'project',
        relatedId: projectId,
        celebrationData: {
          projectTitle,
          senderName: currentUser?.firstName || currentUser?.displayName || 'Team Member',
          emoji: randomEmoji,
          sentAt: new Date().toISOString()
        }
      };

      await apiRequest('POST', '/api/notifications', congratulationData);
      
      toast({
        title: "Congratulations sent!",
        description: `Your message has been added to the project celebration`,
        duration: 3000,
      });

      setCongratsMessage('');
      setIsOpen(false);
      refetch();
    } catch (error) {
      console.error('Error sending congratulations:', error);
      toast({
        title: "Error sending congratulations",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  if (!isCompleted) {
    return null;
  }

  const congratulationsCount = congratulations?.length || 0;

  return (
    <Card className="bg-gradient-to-r from-green-50 to-teal-50 border-green-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-800">
          <Trophy className="w-5 h-5" />
          Project Completed!
        </CardTitle>
        <CardDescription className="text-green-700">
          {congratulationsCount > 0 
            ? `${congratulationsCount} team ${congratulationsCount === 1 ? 'member has' : 'members have'} congratulated this achievement`
            : 'Be the first to congratulate this achievement'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Display existing congratulations */}
        {congratulations && congratulations.length > 0 && (
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {congratulations.map((congrats) => (
              <div key={congrats.id} className="flex items-start gap-3 p-3 bg-white rounded-lg border">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-teal-100 text-teal-700 text-sm">
                    {congrats.celebrationData.senderName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-gray-900">
                      {congrats.celebrationData.senderName}
                    </span>
                    <span className="text-lg">{congrats.celebrationData.emoji}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(congrats.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{congrats.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Send congratulations button */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button 
              variant="outline" 
              className="w-full border-green-300 text-green-700 hover:bg-green-50"
            >
              <PartyPopper className="w-4 h-4 mr-2" />
              Send Congratulations
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500" />
                Congratulate Project Completion
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-3 bg-teal-50 rounded-lg">
                <p className="text-sm text-teal-800">
                  <strong>Project:</strong> {projectTitle}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Your congratulations message:
                </label>
                <Textarea
                  placeholder="Great work on completing this project! Your dedication and hard work really paid off..."
                  value={congratsMessage}
                  onChange={(e) => setCongratsMessage(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsOpen(false)}
                  disabled={isSending}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSendCongratulations}
                  disabled={isSending || !congratsMessage.trim()}
                  className="bg-teal-600 hover:bg-teal-700"
                >
                  {isSending ? 'Sending...' : 'Send Congratulations'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
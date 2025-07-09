import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Heart, Star, Trophy, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CelebrationToastProps {
  isVisible: boolean;
  onClose: () => void;
  taskTitle: string;
  emoji?: string;
  onSendThanks?: (message: string) => void;
}

export function CelebrationToast({ 
  isVisible, 
  onClose, 
  taskTitle, 
  emoji = "🎉",
  onSendThanks 
}: CelebrationToastProps) {
  const [showThanks, setShowThanks] = useState(false);
  const [thanksMessage, setThanksMessage] = useState('');

  const thankMessages = [
    "Great work on completing this task! 🌟",
    "Thank you for your dedication! 💪",
    "Awesome job getting this done! 🚀",
    "You're making a real difference! ❤️",
    "Amazing teamwork! Keep it up! 🙌",
    "Your hard work is appreciated! ✨"
  ];

  const handleSendThanks = () => {
    const message = thanksMessage || thankMessages[Math.floor(Math.random() * thankMessages.length)];
    onSendThanks?.(message);
    setShowThanks(false);
    setThanksMessage('');
    onClose();
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -100, scale: 0.8 }}
          animate={{ 
            opacity: 1, 
            y: 0, 
            scale: 1,
            rotate: [0, -1, 1, 0] // Slight shake animation
          }}
          exit={{ opacity: 0, y: -100, scale: 0.8 }}
          transition={{ 
            type: "spring",
            stiffness: 300,
            damping: 20,
            duration: 0.6
          }}
          className="fixed top-4 right-4 z-50 max-w-sm"
        >
          <Card className="bg-gradient-to-br from-orange-50 to-yellow-50 border-orange-200 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <motion.span 
                    className="text-2xl"
                    animate={{ rotate: [0, 15, -15, 0] }}
                    transition={{ repeat: 3, duration: 0.3 }}
                  >
                    {emoji}
                  </motion.span>
                  <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                    Task Complete
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-6 w-6 p-0 hover:bg-orange-100"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>

              <h3 className="font-semibold text-gray-900 mb-2">
                Congratulations! 
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                You completed: <span className="font-medium">{taskTitle}</span>
              </p>

              {!showThanks ? (
                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowThanks(true)}
                    size="sm"
                    className="bg-tsp-primary hover:bg-tsp-primary/90 text-white"
                  >
                    <Heart className="h-3 w-3 mr-1" />
                    Send Thanks
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onClose}
                    className="border-orange-200 hover:bg-orange-50"
                  >
                    Close
                  </Button>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-3"
                >
                  <textarea
                    value={thanksMessage}
                    onChange={(e) => setThanksMessage(e.target.value)}
                    placeholder="Write a thank you message (optional)..."
                    className="w-full p-2 text-sm border border-orange-200 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-orange-300"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSendThanks}
                      size="sm"
                      className="bg-tsp-primary hover:bg-tsp-primary/90 text-white"
                    >
                      <Sparkles className="h-3 w-3 mr-1" />
                      Send
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowThanks(false)}
                      className="border-orange-200 hover:bg-orange-50"
                    >
                      Cancel
                    </Button>
                  </div>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Hook to manage celebration state
export function useCelebration() {
  const [celebration, setCelebration] = useState<{
    isVisible: boolean;
    taskTitle: string;
    emoji: string;
    taskId?: number;
  }>({
    isVisible: false,
    taskTitle: '',
    emoji: '🎉'
  });

  const triggerCelebration = (taskTitle: string, taskId?: number) => {
    const celebrationEmojis = ["🎉", "🌟", "🎊", "🥳", "🏆", "✨", "👏", "💪"];
    const randomEmoji = celebrationEmojis[Math.floor(Math.random() * celebrationEmojis.length)];
    
    setCelebration({
      isVisible: true,
      taskTitle,
      emoji: randomEmoji,
      taskId
    });

    // Auto-hide after 8 seconds
    setTimeout(() => {
      setCelebration(prev => ({ ...prev, isVisible: false }));
    }, 8000);
  };

  const hideCelebration = () => {
    setCelebration(prev => ({ ...prev, isVisible: false }));
  };

  return {
    celebration,
    triggerCelebration,
    hideCelebration
  };
}
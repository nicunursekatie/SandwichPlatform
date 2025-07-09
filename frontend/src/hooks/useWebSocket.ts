import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';

export function useWebSocket() {
  const { user } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    // WebSocket is handled by MessageNotifications component
    // This is a placeholder hook for components that need to send messages
  }, [user?.id]);

  const sendMessage = (message: any) => {
    // Messages are sent via API, not WebSocket
    // WebSocket is only used for receiving notifications
    console.log('WebSocket message would be sent:', message);
  };

  return {
    sendMessage,
  };
}
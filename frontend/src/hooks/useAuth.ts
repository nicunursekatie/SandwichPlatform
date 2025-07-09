import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 0, // Force fresh data
    gcTime: 0, // Don't cache
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Enhanced debugging for mobile issues
  if (typeof window !== 'undefined') {
    // Check if we're on mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile && (error || !user)) {
      console.log('[useAuth] Mobile authentication issue detected:', {
        error: error?.message,
        user: !!user,
        isLoading,
        userAgent: navigator.userAgent,
        cookies: document.cookie
      });
    }
  }

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
  };
}
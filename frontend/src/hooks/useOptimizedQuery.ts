import { useQuery, useQueryClient, QueryKey } from "@tanstack/react-query";
import { useMemo, useCallback } from "react";

interface OptimizedQueryOptions {
  staleTime?: number;
  cacheTime?: number;
  refetchOnWindowFocus?: boolean;
  refetchOnMount?: boolean;
  prefetchNextPage?: boolean;
  backgroundRefetch?: boolean;
}

export function useOptimizedQuery<T>(
  queryKey: QueryKey,
  queryFn: () => Promise<T>,
  options: OptimizedQueryOptions = {}
) {
  const queryClient = useQueryClient();

  const optimizedOptions = useMemo(() => ({
    staleTime: options.staleTime || 5 * 60 * 1000, // 5 minutes default
    cacheTime: options.cacheTime || 10 * 60 * 1000, // 10 minutes default
    refetchOnWindowFocus: options.refetchOnWindowFocus ?? false,
    refetchOnMount: options.refetchOnMount ?? false,
    refetchInterval: options.backgroundRefetch ? 30000 : false, // 30 seconds if enabled
    retry: (failureCount: number, error: any) => {
      // Smart retry logic - don't retry on 4xx errors
      if (error?.message?.includes('4')) return false;
      return failureCount < 3;
    }
  }), [options]);

  const query = useQuery({
    queryKey,
    queryFn,
    ...optimizedOptions
  });

  // Prefetch related data
  const prefetch = useCallback((prefetchKey: QueryKey, prefetchFn: () => Promise<any>) => {
    queryClient.prefetchQuery({
      queryKey: prefetchKey,
      queryFn: prefetchFn,
      staleTime: 2 * 60 * 1000 // 2 minutes for prefetched data
    });
  }, [queryClient]);

  // Invalidate cache intelligently
  const invalidateRelated = useCallback((patterns: string[]) => {
    patterns.forEach(pattern => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey.join('.');
          return key.includes(pattern);
        }
      });
    });
  }, [queryClient]);

  return {
    ...query,
    prefetch,
    invalidateRelated
  };
}

// Optimized pagination hook
export function useOptimizedPagination<T>(
  baseKey: string,
  fetchFn: (page: number, limit: number) => Promise<{ data: T[]; total: number; hasMore: boolean }>,
  initialPage = 1,
  pageSize = 20
) {
  const queryClient = useQueryClient();

  const query = useOptimizedQuery(
    [baseKey, 'page', initialPage, 'limit', pageSize],
    () => fetchFn(initialPage, pageSize),
    {
      staleTime: 2 * 60 * 1000, // 2 minutes for paginated data
      prefetchNextPage: true
    }
  );

  // Prefetch next page when current page loads
  const prefetchNextPage = useCallback(async (currentPage: number) => {
    const nextPageKey = [baseKey, 'page', currentPage + 1, 'limit', pageSize];
    
    if (!queryClient.getQueryData(nextPageKey)) {
      await queryClient.prefetchQuery({
        queryKey: nextPageKey,
        queryFn: () => fetchFn(currentPage + 1, pageSize),
        staleTime: 2 * 60 * 1000
      });
    }
  }, [queryClient, baseKey, fetchFn, pageSize]);

  // Prefetch previous page for smoother navigation
  const prefetchPreviousPage = useCallback(async (currentPage: number) => {
    if (currentPage > 1) {
      const prevPageKey = [baseKey, 'page', currentPage - 1, 'limit', pageSize];
      
      if (!queryClient.getQueryData(prevPageKey)) {
        await queryClient.prefetchQuery({
          queryKey: prevPageKey,
          queryFn: () => fetchFn(currentPage - 1, pageSize),
          staleTime: 2 * 60 * 1000
        });
      }
    }
  }, [queryClient, baseKey, fetchFn, pageSize]);

  return {
    ...query,
    prefetchNextPage,
    prefetchPreviousPage
  };
}

// Smart search with debouncing and caching
export function useOptimizedSearch<T>(
  searchFn: (query: string) => Promise<T[]>,
  debounceMs = 300
) {
  const queryClient = useQueryClient();

  const search = useCallback(async (query: string) => {
    if (!query.trim()) return [];

    const cacheKey = ['search', query.toLowerCase().trim()];
    
    // Check cache first
    const cached = queryClient.getQueryData(cacheKey);
    if (cached) return cached as T[];

    // Perform search
    const results = await searchFn(query);
    
    // Cache results
    queryClient.setQueryData(cacheKey, results, {
      updatedAt: Date.now(),
      cacheTime: 10 * 60 * 1000 // 10 minutes
    });

    return results;
  }, [searchFn, queryClient]);

  return { search };
}
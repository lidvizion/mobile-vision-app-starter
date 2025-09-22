import { QueryClient } from '@tanstack/react-query';
import { logger, createLogContext } from './logger';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: (failureCount, error) => {
        const context = createLogContext(undefined, 'QueryClient', 'retry');
        logger.warn(`Query retry attempt ${failureCount}`, context, { error: error.message });
        
        // Don't retry on validation errors
        if (error.message.includes('Validation failed')) {
          return false;
        }
        
        // Retry up to 3 times for other errors
        return failureCount < 3;
      },
    },
    mutations: {
      retry: (failureCount, error) => {
        const context = createLogContext(undefined, 'QueryClient', 'mutation-retry');
        logger.warn(`Mutation retry attempt ${failureCount}`, context, { error: error.message });
        
        // Don't retry on validation errors
        if (error.message.includes('Validation failed')) {
          return false;
        }
        
        // Retry up to 2 times for other errors
        return failureCount < 2;
      },
    }
  }
});

// Query keys for consistent caching
export const queryKeys = {
  cvResults: ['cv-results'] as const,
  cvResult: (id: string) => ['cv-results', id] as const,
  resultHistory: ['result-history'] as const,
  resultHistoryItem: (id: string) => ['result-history', id] as const
};

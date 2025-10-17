'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode, useState } from 'react'
import { queryClient } from '@/lib/query-client'

interface QueryProviderProps {
  children: ReactNode
}

export function QueryProvider({ children }: QueryProviderProps) {
  // Create a new QueryClient instance for each render in development
  // to avoid issues with hot reloading
  const [client] = useState(() => queryClient)

  return (
    <QueryClientProvider client={client}>
      {children}
    </QueryClientProvider>
  )
}

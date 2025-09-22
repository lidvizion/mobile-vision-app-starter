import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { QueryProvider } from '@/components/QueryProvider'
import { ErrorBoundary } from '@/components/ErrorBoundary'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Mobile Vision App Starter',
  description: 'Cross-platform mobile starter kit for camera-based CV apps with React Native and Flutter support',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ErrorBoundary>
          <QueryProvider>
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
              {children}
            </div>
          </QueryProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}

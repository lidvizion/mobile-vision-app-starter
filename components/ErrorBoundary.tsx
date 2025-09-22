'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { logger, createLogContext } from '@/lib/logger'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
  errorId?: string
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { 
      hasError: true, 
      error,
      errorId: crypto.randomUUID()
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const context = createLogContext(undefined, 'ErrorBoundary', 'component-did-catch')
    logger.error('React Error Boundary caught error', context, error, {
      errorId: this.state.errorId,
      componentStack: errorInfo.componentStack
    })
    
    this.setState({ error, errorInfo })
  }

  handleRetry = () => {
    const context = createLogContext(undefined, 'ErrorBoundary', 'retry')
    logger.info('User initiated error boundary retry', context, {
      errorId: this.state.errorId
    })
    
    this.setState({ hasError: false, error: undefined, errorInfo: undefined, errorId: undefined })
  }

  handleReload = () => {
    const context = createLogContext(undefined, 'ErrorBoundary', 'reload')
    logger.info('User initiated page reload from error boundary', context, {
      errorId: this.state.errorId
    })
    
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-wells-beige p-4">
          <div className="max-w-md w-full">
            <div className="bg-white rounded-2xl border border-wells-warm-grey/20 shadow-lg p-8 text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              
              <h2 className="text-2xl font-serif font-bold text-wells-dark-grey mb-4">
                Something went wrong
              </h2>
              
              <p className="text-wells-warm-grey mb-6 leading-relaxed">
                We're sorry, but something unexpected happened. Our team has been notified and we're working to fix it.
              </p>
              
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mb-6 text-left">
                  <summary className="cursor-pointer text-sm font-medium text-wells-dark-grey mb-2">
                    Error Details (Development)
                  </summary>
                  <div className="bg-gray-50 rounded-lg p-3 text-xs font-mono text-gray-700 overflow-auto max-h-32">
                    <div className="mb-2">
                      <strong>Error ID:</strong> {this.state.errorId}
                    </div>
                    <div className="mb-2">
                      <strong>Message:</strong> {this.state.error.message}
                    </div>
                    {this.state.error.stack && (
                      <div>
                        <strong>Stack:</strong>
                        <pre className="whitespace-pre-wrap mt-1">{this.state.error.stack}</pre>
                      </div>
                    )}
                  </div>
                </details>
              )}
              
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={this.handleRetry}
                  className="btn-primary btn-md rounded-2xl flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Try Again</span>
                </button>
                <button
                  onClick={this.handleReload}
                  className="btn-secondary btn-md rounded-2xl"
                >
                  <span>Reload Page</span>
                </button>
              </div>
              
              <p className="text-xs text-wells-warm-grey mt-4">
                If the problem persists, please contact support with Error ID: {this.state.errorId}
              </p>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Higher-order component for easier usage
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    )
  }
}

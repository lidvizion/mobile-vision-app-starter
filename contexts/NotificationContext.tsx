'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { Notification, NotificationType } from '@/components/Notification'

interface NotificationContextType {
  showNotification: (message: string, type?: NotificationType, duration?: number) => void
  notifications: Notification[]
  dismissNotification: (id: string) => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const showNotification = useCallback((message: string, type: NotificationType = 'info', duration: number = 5000) => {
    const id = `notification-${Date.now()}-${Math.random()}`
    const notification: Notification = {
      id,
      message,
      type,
      duration
    }

    setNotifications((prev) => [...prev, notification])
  }, [])

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  return (
    <NotificationContext.Provider value={{ showNotification, notifications, dismissNotification }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotification() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider')
  }
  return context
}


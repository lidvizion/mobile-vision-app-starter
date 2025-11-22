'use client'

import { useNotification } from '@/contexts/NotificationContext'
import { NotificationContainer } from './Notification'

export function NotificationWrapper({ children }: { children: React.ReactNode }) {
  const { notifications, dismissNotification } = useNotification()

  return (
    <>
      {children}
      <NotificationContainer notifications={notifications} onDismiss={dismissNotification} />
    </>
  )
}


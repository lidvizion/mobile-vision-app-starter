'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, ScanEye, Tag, ScanLine, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

export type TaskType = 'detection' | 'classification' | 'segmentation' | 'pose-analysis'

interface TaskTypeSelectDropdownProps {
  selectedTaskType: TaskType
  onTaskTypeChange: (taskType: TaskType) => void
  className?: string
}

// Task type icons mapping
const taskIcons: Record<TaskType, typeof ScanEye> = {
  'detection': ScanEye,
  'classification': Tag,
  'segmentation': ScanLine,
  'pose-analysis': Activity,
}

// Task type labels
const taskLabels: Record<TaskType, string> = {
  'detection': 'Detection',
  'classification': 'Classification',
  'segmentation': 'Segmentation',
  'pose-analysis': 'Pose Analysis',
}

const taskTypes: TaskType[] = ['detection', 'classification', 'segmentation', 'pose-analysis']

export default function TaskTypeSelectDropdown({
  selectedTaskType,
  onTaskTypeChange,
  className
}: TaskTypeSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const SelectedIcon = taskIcons[selectedTaskType]

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      {/* Selected Task Type Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-3 px-4 py-2.5 rounded-lg border border-wells-warm-grey/20 bg-white',
          'focus:outline-none focus:ring-2 focus:ring-wells-dark-grey/10 focus:border-wells-dark-grey',
          'transition-all hover:border-wells-dark-grey/40 font-medium text-sm min-w-[180px]',
          isOpen && 'ring-2 ring-wells-dark-grey/10 border-wells-dark-grey'
        )}
      >
        {/* Selected Task Type Icon */}
        <SelectedIcon className="w-5 h-5 text-wells-dark-grey flex-shrink-0" />
        {/* Selected Task Type Name */}
        <span className="flex-1 text-sm font-medium text-wells-dark-grey text-left">
          {taskLabels[selectedTaskType]}
        </span>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-wells-warm-grey transition-transform flex-shrink-0',
            isOpen && 'transform rotate-180'
          )}
        />
      </button>

      {/* Dropdown Options */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-wells-warm-grey/20 rounded-lg shadow-lg overflow-hidden">
          <div className="py-1">
            {taskTypes.map((taskType) => {
              const Icon = taskIcons[taskType]
              const isSelected = taskType === selectedTaskType

              return (
                <button
                  key={taskType}
                  type="button"
                  onClick={() => {
                    onTaskTypeChange(taskType)
                    setIsOpen(false)
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                    'hover:bg-wells-light-beige/50',
                    isSelected && 'bg-wells-light-beige/30'
                  )}
                >
                  {/* Task Type Icon */}
                  <Icon className="w-5 h-5 text-wells-dark-grey flex-shrink-0" />

                  {/* Task Type Name */}
                  <span className="flex-1 text-sm font-medium text-wells-dark-grey">
                    {taskLabels[taskType]}
                  </span>

                  {/* Checkmark for selected */}
                  {isSelected && (
                    <Check className="w-4 h-4 text-wells-dark-grey flex-shrink-0" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}


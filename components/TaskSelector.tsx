'use client'

import { CVTask } from '@/types'
import { cn } from '@/lib/utils'
import { Target, Tag, Palette, Zap, Check } from 'lucide-react'

interface TaskSelectorProps {
  currentTask: CVTask
  onTaskChange: (task: CVTask) => void
}

const TASKS: { 
  value: CVTask; 
  label: string; 
  description: string; 
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}[] = [
  {
    value: 'detection',
    label: 'Object Detection',
    description: 'Detect and locate objects with bounding boxes',
    icon: Target,
    color: 'red'
  },
  {
    value: 'classification',
    label: 'Image Classification', 
    description: 'Classify images into categories',
    icon: Tag,
    color: 'blue'
  },
  {
    value: 'segmentation',
    label: 'Image Segmentation',
    description: 'Segment images into regions and masks',
    icon: Palette,
    color: 'green'
  },
  {
    value: 'multi-type',
    label: 'Multi-Type Mode',
    description: 'Switch between tasks at runtime',
    icon: Zap,
    color: 'purple'
  }
]

export default function TaskSelector({ currentTask, onTaskChange }: TaskSelectorProps) {
  return (
    <div className="card-floating p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 bg-wells-dark-grey rounded-xl flex items-center justify-center shadow-wells-md">
          <Target className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-serif font-semibold text-wells-dark-grey">Select Task</h3>
          <p className="text-sm text-wells-warm-grey">Choose your computer vision task</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TASKS.map((task, index) => {
          const Icon = task.icon
          const isSelected = currentTask === task.value
          
          return (
            <button
              key={task.value}
              onClick={() => onTaskChange(task.value)}
              className={cn(
                'group relative p-5 rounded-2xl border text-left transition-all duration-300 hover:shadow-lg hover:-translate-y-1',
                isSelected
                  ? 'border-wells-dark-grey bg-wells-light-beige shadow-md'
                  : 'border-wells-warm-grey/30 bg-wells-white hover:border-wells-warm-grey/50 hover:bg-wells-light-beige'
              )}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex items-start gap-4">
                <div className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 shadow-sm',
                  isSelected 
                    ? 'bg-wells-dark-grey text-white' 
                    : 'bg-wells-light-beige text-wells-warm-grey group-hover:bg-wells-dark-grey group-hover:text-white'
                )}>
                  <Icon className="w-6 h-6" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className={cn(
                      'font-semibold transition-colors duration-300',
                      isSelected ? 'text-wells-dark-grey' : 'text-wells-warm-grey group-hover:text-wells-dark-grey'
                    )}>
                      {task.label}
                    </h4>
                    {isSelected && (
                      <div className="w-2 h-2 bg-wells-dark-grey rounded-full animate-scale-in"></div>
                    )}
                  </div>
                  <p className={cn(
                    'text-sm transition-colors duration-300 leading-relaxed',
                    isSelected ? 'text-wells-warm-grey' : 'text-wells-warm-grey/70 group-hover:text-wells-warm-grey'
                  )}>
                    {task.description}
                  </p>
                </div>
              </div>
              
              {isSelected && (
                <div className="absolute top-4 right-4 w-6 h-6 bg-wells-dark-grey rounded-full flex items-center justify-center animate-scale-in shadow-wells-sm">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
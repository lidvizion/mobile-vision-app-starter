'use client'

import { ResultHistoryItem } from '@/types'
import { formatTimestamp } from '@/lib/utils'
import { Trash2, Eye, History, Clock, Zap, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ResultHistoryProps {
  history: ResultHistoryItem[]
  onClearHistory: () => void
  onViewResult: (item: ResultHistoryItem) => void
}

export default function ResultHistory({ history, onClearHistory, onViewResult }: ResultHistoryProps) {
  if (history.length === 0) {
    return (
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-wells-dark-grey rounded-xl flex items-center justify-center shadow-wells-md">
            <History className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-serif font-semibold text-wells-dark-grey">Results History</h3>
            <p className="text-sm text-wells-warm-grey">Previous analysis results</p>
          </div>
        </div>
        <div className="text-center py-16">
          <div className="w-20 h-20 bg-wells-light-beige rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
            <Eye className="w-10 h-10 text-wells-warm-grey" />
          </div>
          <h4 className="text-xl font-serif font-semibold text-wells-dark-grey mb-3">No History Yet</h4>
          <p className="text-wells-warm-grey max-w-md mx-auto leading-relaxed">
            Process some images to see them here. Your analysis history will be saved automatically.
          </p>
        </div>
      </div>
    )
  }

  const getTaskColor = (task: string) => {
    const colors = {
      detection: 'bg-red-50 text-red-700 border-red-200',
      classification: 'bg-blue-50 text-blue-700 border-blue-200',
      segmentation: 'bg-green-50 text-green-700 border-green-200',
      'multi-type': 'bg-purple-50 text-purple-700 border-purple-200'
    }
    return colors[task as keyof typeof colors] || 'bg-wells-light-beige text-wells-warm-grey border-wells-warm-grey/20'
  }

  const getTaskIcon = (task: string) => {
    const icons = {
      detection: '🎯',
      classification: '🏷️',
      segmentation: '🎨',
      'multi-type': '🔄'
    }
    return icons[task as keyof typeof icons] || '❓'
  }

  return (
    <div className="card-elevated p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-wells-dark-grey rounded-xl flex items-center justify-center shadow-wells-md">
            <History className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-serif font-semibold text-wells-dark-grey">Results History</h3>
            <p className="text-sm text-wells-warm-grey">{history.length} analysis results</p>
          </div>
        </div>
        <button
          onClick={onClearHistory}
          className="btn-ghost btn-sm hover:text-red-600 hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4" />
          <span>Clear All</span>
        </button>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-luxury">
        {history.map((item, index) => (
          <div
            key={item.id}
            className="group p-4 bg-wells-light-beige rounded-xl border border-wells-warm-grey/20 hover:border-wells-warm-grey/30 hover:bg-wells-white hover:shadow-md transition-all duration-300 cursor-pointer"
            onClick={() => onViewResult(item)}
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className="flex items-center gap-4">
              {/* Thumbnail */}
              <div className="relative flex-shrink-0">
                <img
                  src={item.image_url}
                  alt="Result thumbnail"
                  className="w-14 h-14 object-cover rounded-xl border border-wells-warm-grey/20 shadow-sm"
                />
                <div className={cn(
                  'absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs border-2 border-white shadow-sm',
                  getTaskColor(item.task)
                )}>
                  {getTaskIcon(item.task)}
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-wells-dark-grey capitalize">{item.task}</span>
                  <span className="px-2 py-1 bg-wells-white text-wells-warm-grey text-xs font-medium rounded-full border border-wells-warm-grey/20">
                    v{item.response.model_version}
                  </span>
                </div>
                
                <div className="flex items-center gap-4 text-sm text-wells-warm-grey mb-1">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    <span>{formatTimestamp(item.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3 h-3" />
                    <span>{item.response.processing_time}s</span>
                  </div>
                </div>
                
                <div className="text-xs text-wells-warm-grey">
                  {item.response.image_metadata.width} × {item.response.image_metadata.height}
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-sm font-semibold text-wells-dark-grey mb-1">
                  {item.response.results.labels?.length || 0} labels
                </div>
                <div className="text-xs text-wells-warm-grey group-hover:text-wells-dark-grey transition-colors">
                  Click to view
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
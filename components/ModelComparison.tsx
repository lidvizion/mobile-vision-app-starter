'use client'

import { ModelMetadata } from '@/types/models'
import { X, Award, Download, Calendar, Tag, ExternalLink } from 'lucide-react'

interface ModelComparisonProps {
  models: ModelMetadata[]
  onRemoveModel: (model: ModelMetadata) => void
  onClearAll: () => void
}

export default function ModelComparison({ models, onRemoveModel, onClearAll }: ModelComparisonProps) {
  const formatNumber = (num?: number) => {
    if (!num) return 'N/A'
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const formatDate = (date?: string) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short' 
    })
  }

  const comparisonRows = [
    { 
      label: 'Source', 
      icon: Tag,
      getValue: (model: ModelMetadata) => model.source === 'roboflow' ? 'Roboflow' : 'Hugging Face'
    },
    { 
      label: 'Task', 
      icon: Tag,
      getValue: (model: ModelMetadata) => model.task.charAt(0).toUpperCase() + model.task.slice(1)
    },
    { 
      label: 'Framework', 
      icon: Tag,
      getValue: (model: ModelMetadata) => model.framework || 'N/A'
    },
    { 
      label: 'Accuracy', 
      icon: Award,
      getValue: (model: ModelMetadata) => model.accuracy ? `${(model.accuracy * 100).toFixed(1)}%` : 'N/A'
    },
    { 
      label: 'Downloads', 
      icon: Download,
      getValue: (model: ModelMetadata) => formatNumber(model.downloads)
    },
    { 
      label: 'Last Updated', 
      icon: Calendar,
      getValue: (model: ModelMetadata) => formatDate(model.updated)
    },
    { 
      label: 'License', 
      icon: Tag,
      getValue: (model: ModelMetadata) => model.license || 'N/A'
    },
  ]

  if (models.length === 0) {
    return null
  }

  return (
    <div className="card-elevated overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-serif font-semibold mb-1">Model Comparison</h3>
            <p className="text-sm text-white/80">
              Comparing {models.length} model{models.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClearAll}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-wells-light-beige border-b border-wells-warm-grey/20">
              <th className="px-4 py-3 text-left text-sm font-semibold text-wells-dark-grey sticky left-0 bg-wells-light-beige">
                Feature
              </th>
              {models.map((model, idx) => (
                <th key={`${model.source}-${model.id}`} className="px-4 py-3 text-left min-w-[200px]">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-wells-dark-grey line-clamp-2">
                        {model.name}
                      </span>
                      <button
                        onClick={() => onRemoveModel(model)}
                        className="text-wells-warm-grey hover:text-red-500 transition-colors flex-shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {model.author && (
                      <p className="text-xs text-wells-warm-grey">by {model.author}</p>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparisonRows.map((row, rowIdx) => (
              <tr 
                key={row.label}
                className={`border-b border-wells-warm-grey/10 ${
                  rowIdx % 2 === 0 ? 'bg-white' : 'bg-wells-light-beige/30'
                }`}
              >
                <td className="px-4 py-3 sticky left-0 bg-inherit">
                  <div className="flex items-center gap-2">
                    <row.icon className="w-4 h-4 text-wells-warm-grey" />
                    <span className="text-sm font-medium text-wells-dark-grey">
                      {row.label}
                    </span>
                  </div>
                </td>
                {models.map((model) => (
                  <td 
                    key={`${model.source}-${model.id}-${row.label}`} 
                    className="px-4 py-3 text-sm text-wells-warm-grey"
                  >
                    {row.getValue(model)}
                  </td>
                ))}
              </tr>
            ))}
            
            {/* Tags Row */}
            <tr className="border-b border-wells-warm-grey/10 bg-white">
              <td className="px-4 py-3 sticky left-0 bg-white">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-wells-warm-grey" />
                  <span className="text-sm font-medium text-wells-dark-grey">Tags</span>
                </div>
              </td>
              {models.map((model) => (
                <td key={`${model.source}-${model.id}-tags`} className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {model.tags?.slice(0, 3).map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 bg-wells-light-beige text-wells-warm-grey text-xs rounded"
                      >
                        {tag}
                      </span>
                    ))}
                    {model.tags && model.tags.length > 3 && (
                      <span className="px-2 py-0.5 text-wells-warm-grey text-xs">
                        +{model.tags.length - 3}
                      </span>
                    )}
                  </div>
                </td>
              ))}
            </tr>

            {/* Actions Row */}
            <tr className="bg-wells-light-beige">
              <td className="px-4 py-3 sticky left-0 bg-wells-light-beige">
                <span className="text-sm font-medium text-wells-dark-grey">Actions</span>
              </td>
              {models.map((model) => (
                <td key={`${model.source}-${model.id}-actions`} className="px-4 py-3">
                  <div className="flex flex-col gap-2">
                    {model.modelUrl && (
                      <a
                        href={model.modelUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary btn-sm rounded-lg flex items-center justify-center gap-2 text-xs"
                      >
                        <span>View</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {model.downloadUrl && (
                      <a
                        href={model.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary btn-sm rounded-lg flex items-center justify-center gap-2 text-xs"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download</span>
                      </a>
                    )}
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Description Row */}
      <div className="p-6 bg-wells-light-beige/30 border-t border-wells-warm-grey/20">
        <h4 className="text-sm font-semibold text-wells-dark-grey mb-3">Descriptions</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {models.map((model) => (
            <div 
              key={`${model.source}-${model.id}-desc`}
              className="p-3 bg-white rounded-lg border border-wells-warm-grey/20"
            >
              <p className="text-sm font-medium text-wells-dark-grey mb-1 line-clamp-1">
                {model.name}
              </p>
              <p className="text-xs text-wells-warm-grey line-clamp-3">
                {model.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


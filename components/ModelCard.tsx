'use client'

import { ModelMetadata } from '@/types/models'
import { ExternalLink, Download, Tag, Calendar, TrendingUp, Award } from 'lucide-react'

interface ModelCardProps {
  model: ModelMetadata
}

export default function ModelCard({ model }: ModelCardProps) {
  const taskColors = {
    detection: 'bg-wells-warm-grey/20 text-wells-dark-grey border-wells-warm-grey/50',
    classification: 'bg-green-50 text-green-700 border-green-200',
    segmentation: 'bg-purple-50 text-purple-700 border-purple-200',
    other: 'bg-gray-50 text-gray-700 border-gray-200',
  }

  const sourceColors = {
    roboflow: 'bg-wells-dark-grey',
    huggingface: 'bg-wells-warm-grey',
  }

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
      month: 'short', 
      day: 'numeric' 
    })
  }

  return (
    <div className="card-floating hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group overflow-hidden bg-white">
      {/* Header with Source Badge */}
      <div className="relative h-36 bg-gradient-to-br from-wells-light-beige via-wells-beige to-wells-white p-5">
        <div className="absolute top-4 right-4">
          <div className={`${sourceColors[model.source]} px-3 py-1.5 rounded-xl text-white text-xs font-bold shadow-lg flex items-center gap-1.5`}>
            <div className="w-2 h-2 bg-white rounded-full"></div>
            <span>{model.source === 'roboflow' ? 'Roboflow' : 'Hugging Face'}</span>
          </div>
        </div>
        <div className="absolute bottom-4 left-4">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${taskColors[model.task]} shadow-sm`}>
            <Tag className="w-3.5 h-3.5" />
            <span className="capitalize">{model.task}</span>
          </div>
        </div>
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-5">
          <div className="w-full h-full bg-gradient-to-br from-transparent via-wells-dark-grey/10 to-transparent"></div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-5">
        {/* Model Name & Author */}
        <div>
          <h3 className="text-lg font-bold text-wells-dark-grey mb-2 group-hover:text-wells-warm-grey transition-colors line-clamp-2 leading-tight">
            {model.name}
          </h3>
          {model.author && (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-wells-dark-grey to-wells-warm-grey rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">{model.author.charAt(0).toUpperCase()}</span>
              </div>
              <p className="text-sm text-wells-warm-grey">by {model.author}</p>
            </div>
          )}
        </div>

        {/* Description */}
        <p className="text-sm text-wells-warm-grey line-clamp-3 leading-relaxed">
          {model.description}
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          {model.downloads !== undefined && (
            <div className="flex items-center gap-2 p-2 bg-wells-warm-grey/10 rounded-lg">
              <Download className="w-4 h-4 text-wells-dark-grey" />
              <div>
                <div className="text-sm font-semibold text-wells-dark-grey">{formatNumber(model.downloads)}</div>
                <div className="text-xs text-wells-warm-grey">downloads</div>
              </div>
            </div>
          )}
          {model.accuracy !== undefined && (
            <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg">
              <Award className="w-4 h-4 text-green-600" />
              <div>
                <div className="text-sm font-semibold text-green-900">{(model.accuracy * 100).toFixed(1)}%</div>
                <div className="text-xs text-green-700">accuracy</div>
              </div>
            </div>
          )}
          {model.updated && (
            <div className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg col-span-2">
              <Calendar className="w-4 h-4 text-purple-600" />
              <div>
                <div className="text-sm font-semibold text-purple-900">{formatDate(model.updated)}</div>
                <div className="text-xs text-purple-700">last updated</div>
              </div>
            </div>
          )}
        </div>

        {/* Tags */}
        {model.tags && model.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {model.tags.slice(0, 3).map((tag, idx) => (
              <span
                key={idx}
                className="px-2 py-1 bg-wells-light-beige text-wells-warm-grey text-xs rounded-md"
              >
                {tag}
              </span>
            ))}
            {model.tags.length > 3 && (
              <span className="px-2 py-1 text-wells-warm-grey text-xs">
                +{model.tags.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Framework Badge */}
        {model.framework && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded-md border border-blue-200">
            <TrendingUp className="w-3 h-3" />
            <span className="capitalize">{model.framework}</span>
          </div>
        )}

        {/* Actions */}
        <div className="pt-4 border-t border-wells-warm-grey/10 flex items-center gap-3">
          {model.modelUrl && (
            <a
              href={model.modelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 btn-primary btn-sm rounded-xl flex items-center justify-center gap-2 text-sm font-medium hover:shadow-md transition-all"
            >
              <span>View Model</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          {model.downloadUrl && (
            <a
              href={model.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 btn-secondary btn-sm rounded-xl flex items-center justify-center gap-2 text-sm font-medium hover:shadow-md transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </a>
          )}
        </div>

        {/* License */}
        {model.license && (
          <div className="text-xs text-wells-warm-grey text-center pt-2 border-t border-wells-warm-grey/10">
            License: {model.license}
          </div>
        )}
      </div>
    </div>
  )
}


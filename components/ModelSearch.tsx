'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Filter, X, Loader2, ChevronDown, Sparkles, TrendingUp, Clock, Zap } from 'lucide-react'
import { useModelSearch } from '@/hooks/useModelSearch'
import { SearchFilters } from '@/types/models'
import ModelCard from '@/components/ModelCard'
import ModelCardSkeleton from '@/components/ModelCardSkeleton'

export default function ModelSearch() {
  const [query, setQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const searchInputRef = useRef<HTMLInputElement>(null)
  
  const [filters, setFilters] = useState<SearchFilters>({
    source: ['roboflow', 'huggingface'],
    task: [],
    framework: [],
    sortBy: 'relevance',
  })

  const { search, clearSearch, isSearching, searchResults, error } = useModelSearch()

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recentModelSearches')
    if (saved) {
      setRecentSearches(JSON.parse(saved))
    }
  }, [])

  // Search suggestions based on common CV terms
  const searchSuggestions = [
    'face detection',
    'object detection',
    'image classification',
    'semantic segmentation',
    'pose estimation',
    'text recognition',
    'medical imaging',
    'autonomous vehicles',
    'quality inspection',
    'surveillance',
    'retail analytics',
    'agriculture monitoring'
  ]

  const handleQueryChange = (value: string) => {
    setQuery(value)
    if (value.length > 1) {
      const filtered = searchSuggestions
        .filter(s => s.toLowerCase().includes(value.toLowerCase()))
        .slice(0, 5)
      setSuggestions(filtered)
      setShowSuggestions(filtered.length > 0)
    } else {
      setShowSuggestions(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      search(query, filters)
      // Save to recent searches
      const newRecent = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5)
      setRecentSearches(newRecent)
      localStorage.setItem('recentModelSearches', JSON.stringify(newRecent))
      setShowSuggestions(false)
    }
  }

  const handleClearSearch = () => {
    setQuery('')
    clearSearch()
    setShowSuggestions(false)
  }

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion)
    setShowSuggestions(false)
    search(suggestion, filters)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  const updateFilter = <K extends keyof SearchFilters>(
    key: K,
    value: SearchFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const toggleArrayFilter = (key: 'source' | 'task' | 'framework', value: string) => {
    setFilters(prev => {
      const current = prev[key] || []
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value]
      return { ...prev, [key]: updated }
    })
  }

  return (
    <div className="w-full">
      {/* Search Header */}
      <div className="card-elevated p-6 mb-6 relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-wells-dark-grey to-wells-warm-grey rounded-2xl flex items-center justify-center shadow-lg">
            <Search className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-serif font-bold text-wells-dark-grey">Model Search</h2>
            <p className="text-sm text-wells-warm-grey">Discover & compare CV models from leading platforms</p>
          </div>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-wells-warm-grey" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search for models (e.g., 'face detection', 'skin classification')"
              className="w-full pl-12 pr-12 py-4 bg-wells-light-beige border border-wells-warm-grey/20 rounded-2xl text-wells-dark-grey placeholder:text-wells-warm-grey focus:outline-none focus:ring-2 focus:ring-wells-dark-grey/20 focus:border-wells-dark-grey transition-all hover:border-wells-warm-grey/40"
            />
            {query && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-wells-warm-grey hover:text-wells-dark-grey transition-colors p-1 rounded-lg hover:bg-wells-warm-grey/10"
              >
                <X className="w-5 h-5" />
              </button>
            )}
            
            {/* Search Suggestions */}
            {showSuggestions && (suggestions.length > 0 || recentSearches.length > 0) && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-wells-warm-grey/20 rounded-2xl shadow-xl z-50 overflow-hidden">
                {recentSearches.length > 0 && query === '' && (
                  <div className="p-3 border-b border-wells-warm-grey/10">
                    <div className="flex items-center gap-2 text-xs font-medium text-wells-warm-grey mb-2">
                      <Clock className="w-3 h-3" />
                      <span>Recent Searches</span>
                    </div>
                    {recentSearches.slice(0, 3).map((recent, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSuggestionClick(recent)}
                        className="w-full text-left px-3 py-2 text-sm text-wells-dark-grey hover:bg-wells-light-beige transition-colors rounded-lg"
                      >
                        {recent}
                      </button>
                    ))}
                  </div>
                )}
                
                {suggestions.length > 0 && (
                  <div className="p-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-wells-warm-grey mb-2">
                      <Sparkles className="w-3 h-3" />
                      <span>Suggestions</span>
                    </div>
                    {suggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="w-full text-left px-3 py-2 text-sm text-wells-dark-grey hover:bg-wells-light-beige transition-colors rounded-lg"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="submit"
              disabled={!query.trim() || isSearching}
              className="btn-primary rounded-2xl flex items-center gap-2 px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all"
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  <span>Search Models</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="btn-secondary rounded-2xl flex items-center gap-2 px-6 py-3 hover:shadow-md transition-all"
            >
              <Filter className="w-5 h-5" />
              <span>Filters</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>

            {/* Quick Filters */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-wells-warm-grey">Quick:</span>
              {['face detection', 'object detection', 'classification'].map((term) => (
                <button
                  key={term}
                  onClick={() => {
                    setQuery(term)
                    search(term, filters)
                  }}
                  className="px-3 py-1.5 text-xs bg-wells-light-beige text-wells-dark-grey rounded-lg hover:bg-wells-warm-grey/20 transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        </form>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-6 p-6 bg-gradient-to-br from-wells-light-beige to-wells-beige rounded-2xl border border-wells-warm-grey/20 space-y-6 animate-fade-in shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-5 h-5 text-blue-500" />
              <h3 className="text-lg font-semibold text-wells-dark-grey">Filter Results</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Source Filter */}
              <div>
                <label className="block text-sm font-semibold text-wells-dark-grey mb-3">Data Sources</label>
                <div className="space-y-2">
                  {[
                    { key: 'roboflow', label: 'Roboflow', icon: '🔵' },
                    { key: 'huggingface', label: 'Hugging Face', icon: '🟠' }
                  ].map((source) => (
                    <button
                      key={source.key}
                      type="button"
                      onClick={() => toggleArrayFilter('source', source.key)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      filters.source?.includes(source.key as any)
                        ? 'bg-wells-dark-grey text-white shadow-md'
                        : 'bg-white text-wells-dark-grey border border-wells-warm-grey/20 hover:border-wells-dark-grey/30'
                      }`}
                    >
                      <span>{source.icon}</span>
                      <span>{source.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Task Filter */}
              <div>
                <label className="block text-sm font-semibold text-wells-dark-grey mb-3">Model Tasks</label>
                <div className="space-y-2">
                  {[
                    { key: 'detection', label: 'Object Detection', icon: '🎯' },
                    { key: 'classification', label: 'Classification', icon: '🏷️' },
                    { key: 'segmentation', label: 'Segmentation', icon: '🎨' },
                    { key: 'other', label: 'Other', icon: '⚡' }
                  ].map((task) => (
                    <button
                      key={task.key}
                      type="button"
                      onClick={() => toggleArrayFilter('task', task.key)}
                      className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      filters.task?.includes(task.key)
                        ? 'bg-wells-warm-grey text-white shadow-md'
                        : 'bg-white text-wells-dark-grey border border-wells-warm-grey/20 hover:border-wells-warm-grey/30'
                      }`}
                    >
                      <span>{task.icon}</span>
                      <span>{task.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort Filter */}
              <div>
                <label className="block text-sm font-semibold text-wells-dark-grey mb-3">Sort Results</label>
                <div className="space-y-2">
                  {[
                    { value: 'relevance', label: 'Relevance', icon: TrendingUp },
                    { value: 'downloads', label: 'Most Popular', icon: TrendingUp },
                    { value: 'date', label: 'Recently Updated', icon: Clock },
                    { value: 'accuracy', label: 'Best Accuracy', icon: Zap }
                  ].map((sort) => (
                    <button
                      key={sort.value}
                      type="button"
                      onClick={() => updateFilter('sortBy', sort.value as any)}
                      className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      filters.sortBy === sort.value
                        ? 'bg-wells-dark-grey text-white shadow-md'
                        : 'bg-white text-wells-dark-grey border border-wells-warm-grey/20 hover:border-wells-dark-grey/30'
                      }`}
                    >
                      <sort.icon className="w-4 h-4" />
                      <span>{sort.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Loading State */}
      {isSearching && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-wells-dark-grey">Searching...</h3>
            <div className="px-3 py-1 bg-wells-warm-grey/20 text-wells-dark-grey rounded-full text-sm font-medium animate-pulse">
              Finding models
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, idx) => (
              <ModelCardSkeleton key={idx} />
            ))}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-red-600 text-sm">⚠️</span>
            </div>
            <div>
              <h4 className="font-semibold">Search Error</h4>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Search Results */}
      {searchResults && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-semibold text-wells-dark-grey">Search Results</h3>
                <div className="px-3 py-1 bg-wells-warm-grey/20 text-wells-dark-grey rounded-full text-sm font-medium">
                  {searchResults.totalCount} found
                </div>
              </div>
              {searchResults.enhancedQuery && searchResults.enhancedQuery !== searchResults.query && (
                <div className="flex items-center gap-2 text-sm text-wells-warm-grey">
                  <Sparkles className="w-4 h-4" />
                  <span>Enhanced search:</span>
                  <span className="italic text-wells-dark-grey">"{searchResults.enhancedQuery}"</span>
                </div>
              )}
            </div>
          </div>

          {searchResults.models.length === 0 ? (
            <div className="card-floating p-16 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
                <Search className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-wells-dark-grey mb-3">No models found</h3>
              <p className="text-wells-warm-grey mb-6 max-w-md mx-auto">
                We couldn't find any models matching your search criteria. Try these suggestions:
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {['object detection', 'image classification', 'face detection'].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setQuery(suggestion)
                      search(suggestion, filters)
                    }}
                    className="px-4 py-2 bg-wells-warm-grey/10 text-wells-dark-grey rounded-lg text-sm font-medium hover:bg-wells-warm-grey/20 transition-colors"
                  >
                    Try "{suggestion}"
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {searchResults.models.map((model) => (
                <ModelCard key={`${model.source}-${model.id}`} model={model} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!searchResults && !isSearching && (
        <div className="space-y-8">
          {/* Featured Categories */}
          <div className="card-floating p-8">
            <h3 className="text-xl font-semibold text-wells-dark-grey mb-6 text-center">Popular Model Categories</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: '🎯', title: 'Object Detection', desc: 'Find objects in images' },
                { icon: '🏷️', title: 'Classification', desc: 'Categorize images' },
                { icon: '🎨', title: 'Segmentation', desc: 'Pixel-level analysis' },
                { icon: '👤', title: 'Face Detection', desc: 'Human face recognition' }
              ].map((category) => (
                <button
                  key={category.title}
                  onClick={() => {
                    setQuery(category.title.toLowerCase())
                    search(category.title.toLowerCase(), filters)
                  }}
                  className="p-6 bg-white border border-wells-warm-grey/20 rounded-2xl hover:shadow-md transition-all text-left group"
                >
                  <div className="text-3xl mb-3">{category.icon}</div>
                  <h4 className="font-semibold text-wells-dark-grey mb-2 group-hover:text-wells-warm-grey transition-colors">
                    {category.title}
                  </h4>
                  <p className="text-sm text-wells-warm-grey">{category.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Getting Started */}
          <div className="card-floating p-12 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-wells-dark-grey/10 to-wells-warm-grey/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="w-10 h-10 text-wells-dark-grey" />
            </div>
            <h3 className="text-2xl font-bold text-wells-dark-grey mb-4">Ready to explore models?</h3>
            <p className="text-wells-warm-grey mb-6 max-w-2xl mx-auto leading-relaxed">
              Search through thousands of pre-trained computer vision models from Roboflow and Hugging Face. 
              Find the perfect model for your project with our intelligent search and comparison tools.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {['face detection', 'medical imaging', 'autonomous vehicles'].map((example) => (
                <button
                  key={example}
                  onClick={() => {
                    setQuery(example)
                    search(example, filters)
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-wells-dark-grey to-wells-warm-grey text-white rounded-xl font-medium hover:shadow-lg transition-all"
                >
                  Try "{example}"
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


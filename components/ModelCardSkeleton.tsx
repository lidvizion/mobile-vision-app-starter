export default function ModelCardSkeleton() {
  return (
    <div className="card-floating overflow-hidden bg-white animate-pulse">
      {/* Header */}
      <div className="h-36 bg-gradient-to-br from-gray-200 to-gray-300 p-5">
        <div className="absolute top-4 right-4">
          <div className="w-20 h-6 bg-gray-300 rounded-xl"></div>
        </div>
        <div className="absolute bottom-4 left-4">
          <div className="w-24 h-6 bg-gray-300 rounded-xl"></div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-5">
        {/* Title */}
        <div className="space-y-2">
          <div className="h-6 bg-gray-200 rounded w-3/4"></div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-2 bg-gray-100 rounded-lg">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-1"></div>
            <div className="h-3 bg-gray-200 rounded w-1/3"></div>
          </div>
          <div className="p-2 bg-gray-100 rounded-lg">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-1"></div>
            <div className="h-3 bg-gray-200 rounded w-1/3"></div>
          </div>
        </div>

        {/* Tags */}
        <div className="flex gap-2">
          <div className="h-6 bg-gray-200 rounded w-16"></div>
          <div className="h-6 bg-gray-200 rounded w-20"></div>
          <div className="h-6 bg-gray-200 rounded w-14"></div>
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-gray-100 flex gap-3">
          <div className="flex-1 h-10 bg-gray-200 rounded-xl"></div>
          <div className="flex-1 h-10 bg-gray-200 rounded-xl"></div>
        </div>
      </div>
    </div>
  )
}

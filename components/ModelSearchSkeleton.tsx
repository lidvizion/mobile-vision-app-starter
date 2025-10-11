/**
 * Animated skeleton loader for model search results
 */
export default function ModelSearchSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <div 
          key={index} 
          className="card-floating p-6 animate-pulse"
        >
          {/* Rank Badge Skeleton */}
          <div className="flex items-center justify-between mb-4">
            <div className="w-20 h-6 bg-wells-warm-grey/20 rounded-full"></div>
          </div>

          {/* Image Skeleton */}
          <div className="w-full h-32 bg-gradient-to-br from-wells-warm-grey/10 to-wells-warm-grey/20 rounded-lg mb-4"></div>

          {/* Badges Skeleton */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-16 h-5 bg-wells-warm-grey/20 rounded"></div>
            <div className="w-20 h-5 bg-wells-warm-grey/20 rounded"></div>
          </div>

          {/* Title Skeleton */}
          <div className="space-y-2 mb-3">
            <div className="w-3/4 h-6 bg-wells-warm-grey/20 rounded"></div>
            <div className="w-1/2 h-4 bg-wells-warm-grey/20 rounded"></div>
          </div>

          {/* Description Skeleton */}
          <div className="space-y-2 mb-4">
            <div className="w-full h-3 bg-wells-warm-grey/20 rounded"></div>
            <div className="w-full h-3 bg-wells-warm-grey/20 rounded"></div>
            <div className="w-2/3 h-3 bg-wells-warm-grey/20 rounded"></div>
          </div>

          {/* Metrics Skeleton */}
          <div className="flex gap-2 mb-4">
            <div className="w-16 h-6 bg-wells-warm-grey/20 rounded"></div>
            <div className="w-16 h-6 bg-wells-warm-grey/20 rounded"></div>
            <div className="w-16 h-6 bg-wells-warm-grey/20 rounded"></div>
          </div>

          {/* Buttons Skeleton */}
          <div className="flex gap-2">
            <div className="flex-1 h-11 bg-wells-warm-grey/20 rounded-lg"></div>
            <div className="w-11 h-11 bg-wells-warm-grey/20 rounded-lg"></div>
          </div>
        </div>
      ))}
    </div>
  )
}


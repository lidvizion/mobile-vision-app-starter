'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Upload, Lightbulb, Bell, Loader2, Play, Pause, RefreshCw } from 'lucide-react'
import { validateMediaFile } from '@/lib/validation'
import { Pose, POSE_CONNECTIONS } from '@mediapipe/pose'
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils'
import { SquatAnalyzer } from '@/lib/pose/exercises/squat'
import { KettlebellAnalyzer } from '@/lib/pose/exercises/kettlebell'
import { LongCycleAnalyzer } from '@/lib/pose/exercises/long_cycle'
import { TemplateExerciseRunner, type ExerciseConfig } from '@/lib/pose/exercises/templates'
import { generateExerciseConfig } from '@/lib/pose/gemini'

export default function KeypointDetectionUI() {
    const [prompt, setPrompt] = useState('')
    const [uploadedVideo, setUploadedVideo] = useState<File | null>(null)
    const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [processingStatus, setProcessingStatus] = useState('')
    const [selectedExercise, setSelectedExercise] = useState<string>('')
    const [isPlaying, setIsPlaying] = useState(false)
    const [reps, setReps] = useState(0)
    const [feedback, setFeedback] = useState('Upload video and select exercise')
    const [isPoseLoaded, setIsPoseLoaded] = useState(false)

    const fileInputRef = useRef<HTMLInputElement>(null)
    const dropZoneRef = useRef<HTMLDivElement>(null)
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const poseRef = useRef<Pose | null>(null)
    const requestRef = useRef<number>(0)

    const exampleExercises = ['Squat', 'Kettlebell', 'Long Cycle']
    const geminiApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''

    // Analyzers - EXACT same as working AnalysisPage
    const squatAnalyzer = useMemo(() => new SquatAnalyzer(), [])
    const kettlebellAnalyzer = useMemo(() => new KettlebellAnalyzer(), [])
    const longCycleAnalyzer = useMemo(() => new LongCycleAnalyzer(), [])
    const [dynamicAnalyzer, setDynamicAnalyzer] = useState<TemplateExerciseRunner | null>(null)

    // Initialize MediaPipe Pose - EXACT same as working AnalysisPage
    useEffect(() => {
        const pose = new Pose({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
        })

        pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
        })

        pose.onResults((results) => {
            if (!canvasRef.current || !videoRef.current) return
            const canvas = canvasRef.current
            const ctx = canvas.getContext('2d')
            if (!ctx) return

            // Draw video frame first
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)

            if (results.poseLandmarks) {
                // Draw skeleton
                drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#00FF00', lineWidth: 2 })
                drawLandmarks(ctx, results.poseLandmarks, { color: '#FF0000', lineWidth: 1 })

                // Run analyzer - EXACT same logic as working AnalysisPage
                let currentAnalyzer
                const normalizedExercise = selectedExercise.toLowerCase().replace(/\s+/g, '_')

                if (normalizedExercise === 'squat') {
                    currentAnalyzer = squatAnalyzer
                } else if (normalizedExercise === 'kettlebell') {
                    currentAnalyzer = kettlebellAnalyzer
                } else if (normalizedExercise === 'long_cycle') {
                    currentAnalyzer = longCycleAnalyzer
                } else if (dynamicAnalyzer) {
                    currentAnalyzer = dynamicAnalyzer
                }

                if (currentAnalyzer) {
                    const state = currentAnalyzer.analyze(results)
                    setReps(state.reps)
                    setFeedback(state.feedback)
                }
            }
        })

        poseRef.current = pose
        setIsPoseLoaded(true)

        return () => {
            pose.close()
            cancelAnimationFrame(requestRef.current)
        }
    }, [selectedExercise, squatAnalyzer, kettlebellAnalyzer, longCycleAnalyzer, dynamicAnalyzer])

    // Frame processing loop - EXACT same as working AnalysisPage
    const processFrame = useCallback(async () => {
        if (videoRef.current && poseRef.current && !videoRef.current.paused && !videoRef.current.ended) {
            await poseRef.current.send({ image: videoRef.current })
            requestRef.current = requestAnimationFrame(processFrame)
        }
    }, [])

    // Handle file upload
    const handleFileSelect = useCallback(async (file: File) => {
        const validation = validateMediaFile(file)
        if (!validation.isValid) {
            alert(validation.error || 'Invalid file format')
            return
        }

        setUploadedVideo(file)
        const previewUrl = URL.createObjectURL(file)
        setVideoPreviewUrl(previewUrl)
        setReps(0)
        setFeedback('Video loaded. Select an exercise.')

        // Reset analyzers
        squatAnalyzer.reset()
        kettlebellAnalyzer.reset()
        longCycleAnalyzer.reset()
    }, [squatAnalyzer, kettlebellAnalyzer, longCycleAnalyzer])

    // Setup exercise analyzer
    const setupExercise = useCallback(async (exerciseName: string) => {
        if (!uploadedVideo) {
            alert('Please upload a video first')
            return
        }

        setIsProcessing(true)
        setProcessingStatus('Setting up analyzer...')

        const normalizedName = exerciseName.toLowerCase().replace(/\s+/g, '_')

        // Check if it's a built-in exercise
        if (['squat', 'kettlebell', 'long_cycle'].includes(normalizedName)) {
            setSelectedExercise(exerciseName)
            setIsProcessing(false)
            setFeedback(`Ready! Press play to analyze ${exerciseName}`)
            return
        }

        // Custom exercise - use Gemini
        setProcessingStatus('Generating config with Gemini AI...')
        try {
            const config = await generateExerciseConfig(geminiApiKey, exerciseName)
            const runner = new TemplateExerciseRunner(config)
            setDynamicAnalyzer(runner)
            setSelectedExercise(exerciseName)
            setProcessingStatus('')
            setIsProcessing(false)
            setFeedback(`Ready! Press play to analyze ${exerciseName}`)
        } catch (err) {
            console.error('Gemini failed:', err)
            // Fallback to squat
            setSelectedExercise('squat')
            setProcessingStatus('')
            setIsProcessing(false)
            setFeedback('Using Squat template as fallback. Press play.')
        }
    }, [uploadedVideo, geminiApiKey])

    // Handle example click
    const handleExampleClick = useCallback((example: string) => {
        setPrompt(example)
        if (uploadedVideo) {
            setupExercise(example)
        }
    }, [uploadedVideo, setupExercise])

    // Toggle video playback - EXACT same as working AnalysisPage
    const togglePlay = useCallback(() => {
        if (!videoRef.current || !canvasRef.current) return

        if (isPlaying) {
            videoRef.current.pause()
            cancelAnimationFrame(requestRef.current)
        } else {
            // Set canvas size to match video
            canvasRef.current.width = videoRef.current.videoWidth
            canvasRef.current.height = videoRef.current.videoHeight
            videoRef.current.play()
            processFrame()
        }
        setIsPlaying(!isPlaying)
    }, [isPlaying, processFrame])

    // Reset
    const resetAnalysis = useCallback(() => {
        squatAnalyzer.reset()
        kettlebellAnalyzer.reset()
        longCycleAnalyzer.reset()
        dynamicAnalyzer?.reset()
        setReps(0)
        setFeedback('Analysis reset')
        if (videoRef.current) {
            videoRef.current.currentTime = 0
            videoRef.current.pause()
            setIsPlaying(false)
        }
    }, [squatAnalyzer, kettlebellAnalyzer, longCycleAnalyzer, dynamicAnalyzer])

    // Drag and drop handlers
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        dropZoneRef.current?.classList.add('border-wells-dark-grey')
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        dropZoneRef.current?.classList.remove('border-wells-dark-grey')
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        dropZoneRef.current?.classList.remove('border-wells-dark-grey')
        const files = e.dataTransfer.files
        if (files.length > 0) handleFileSelect(files[0])
    }, [handleFileSelect])

    return (
        <div className="space-y-6">
            {/* Main Input Section */}
            <div className="bg-white rounded-xl shadow-sm border border-wells-warm-grey/10 p-6">
                <div className="space-y-6">
                    {/* Dropzone */}
                    <div
                        ref={dropZoneRef}
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className="border-2 border-dashed border-wells-warm-grey/30 rounded-xl p-12 text-center cursor-pointer hover:border-wells-dark-grey/50 transition-colors"
                    >
                        {videoPreviewUrl ? (
                            <div className="space-y-4">
                                <video src={videoPreviewUrl} className="max-h-48 mx-auto rounded-lg" controls muted />
                                <p className="text-sm text-wells-warm-grey">Click to change video</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="w-12 h-12 mx-auto rounded-full bg-wells-light-beige/50 flex items-center justify-center">
                                    <Upload className="w-6 h-6 text-wells-warm-grey" />
                                </div>
                                <div>
                                    <p className="text-sm text-wells-dark-grey">
                                        Drop image or <span className="font-medium">click to upload</span>
                                    </p>
                                    <p className="text-xs text-wells-warm-grey mt-1">Supports images and videos</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,video/*"
                        onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleFileSelect(file)
                        }}
                        className="hidden"
                    />

                    {/* Prompt Input + Analyze Button */}
                    <div>
                        <label className="block text-sm font-semibold text-wells-dark-grey mb-2">
                            What would you like to detect keypoints on?
                        </label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="E.g., 'jumping jacks' or 'burpees'"
                            className="w-full px-4 py-3 rounded-lg border border-wells-warm-grey/20 text-sm"
                            rows={2}
                        />
                        <button
                            onClick={() => prompt.trim() && setupExercise(prompt.trim())}
                            disabled={!uploadedVideo || !prompt.trim() || isProcessing}
                            className={`mt-3 w-full py-3 rounded-lg font-medium text-sm flex items-center justify-center gap-2 ${uploadedVideo && prompt.trim() && !isProcessing
                                ? 'bg-wells-dark-grey text-white hover:bg-wells-dark-grey/90'
                                : 'bg-wells-warm-grey/30 text-wells-warm-grey cursor-not-allowed'
                                }`}
                        >
                            {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" />{processingStatus}</> : <>Analyze with MediaPipe</>}
                        </button>
                    </div>

                    {/* Examples */}
                    <div className="pt-4 border-t border-wells-warm-grey/10">
                        <div className="flex items-center gap-2 mb-3">
                            <Lightbulb className="w-4 h-4 text-wells-warm-grey" />
                            <span className="text-xs font-medium text-wells-warm-grey uppercase">Try these examples:</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {exampleExercises.map((exercise) => (
                                <button
                                    key={exercise}
                                    onClick={() => handleExampleClick(exercise)}
                                    disabled={isProcessing}
                                    className={`px-4 py-2.5 text-sm border rounded-lg ${prompt === exercise ? 'bg-wells-light-beige border-wells-dark-grey' : 'bg-white border-wells-warm-grey/20'}`}
                                >
                                    {exercise}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Model Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Model 1: MediaPipe Pose (Active) */}
                <div className="bg-white rounded-xl shadow-sm border-2 border-wells-dark-grey overflow-hidden">
                    <div className="px-5 py-4 border-b border-wells-warm-grey/10 bg-gray-50/50">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-wells-warm-grey uppercase">Model 1</span>
                            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                                {isPoseLoaded ? 'Active' : 'Loading...'}
                            </span>
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                <span className="text-blue-600 font-bold text-sm">MP</span>
                            </div>
                            <div>
                                <div className="font-semibold text-wells-dark-grey">MediaPipe <span className="px-1 py-0.5 bg-purple-200 text-purple-800 rounded text-xs">Pose</span></div>
                                <div className="text-xs text-wells-warm-grey">Google</div>
                            </div>
                        </div>
                    </div>
                    <div className="p-5">
                        {selectedExercise && videoPreviewUrl ? (
                            <div className="space-y-3">
                                {/* Video + Canvas overlay - EXACT same pattern as working AnalysisPage */}
                                <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                                    <video
                                        ref={videoRef}
                                        src={videoPreviewUrl}
                                        className="absolute inset-0 w-full h-full object-contain opacity-0"
                                        onEnded={() => setIsPlaying(false)}
                                        playsInline
                                    />
                                    <canvas
                                        ref={canvasRef}
                                        className="absolute inset-0 w-full h-full object-contain"
                                    />

                                    {/* Reps overlay */}
                                    <div className="absolute top-2 left-2 bg-black/60 text-white px-3 py-1.5 rounded-lg z-10">
                                        <div className="text-xs uppercase font-bold opacity-70">Reps</div>
                                        <div className="text-2xl font-bold font-mono">{reps}</div>
                                    </div>

                                    {/* Controls */}
                                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
                                        <button
                                            onClick={togglePlay}
                                            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white hover:bg-white/30"
                                        >
                                            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                                        </button>
                                        <button
                                            onClick={resetAnalysis}
                                            className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white hover:bg-white/30"
                                        >
                                            <RefreshCw className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                                <p className={`text-sm text-center ${feedback.includes('complete') ? 'text-green-600' : 'text-wells-warm-grey'}`}>{feedback}</p>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center py-16 text-center">
                                <div className="space-y-2">
                                    <div className="w-12 h-12 mx-auto rounded-full bg-gray-100 flex items-center justify-center">
                                        <Upload className="w-6 h-6 text-gray-400" />
                                    </div>
                                    <p className="text-sm text-wells-warm-grey">Upload video & select exercise</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Model 2: YOLOv8 (Coming Soon) */}
                <div className="bg-white rounded-xl shadow-sm border border-wells-warm-grey/10 overflow-hidden opacity-60">
                    <div className="px-5 py-4 border-b bg-gray-50/50">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-wells-warm-grey uppercase">Model 2</span>
                            <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">Coming Soon</span>
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                                <span className="text-purple-600 font-bold text-sm">Y8</span>
                            </div>
                            <div>
                                <div className="font-semibold text-wells-dark-grey">YOLOv8 Pose</div>
                                <div className="text-xs text-wells-warm-grey">Ultralytics</div>
                            </div>
                        </div>
                    </div>
                    <div className="p-5 flex items-center justify-center py-16">
                        <div className="space-y-2 text-center">
                            <Bell className="w-8 h-8 mx-auto text-amber-500" />
                            <p className="text-sm text-wells-warm-grey">YOLOv8 Pose coming soon!</p>
                        </div>
                    </div>
                </div>

                {/* Model 3: YOLOv11 (Coming Soon) */}
                <div className="bg-white rounded-xl shadow-sm border border-wells-warm-grey/10 overflow-hidden opacity-60">
                    <div className="px-5 py-4 border-b bg-gray-50/50">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-wells-warm-grey uppercase">Model 3</span>
                            <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">Coming Soon</span>
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                                <span className="text-purple-600 font-bold text-sm">Y11</span>
                            </div>
                            <div>
                                <div className="font-semibold text-wells-dark-grey">YOLOv11 Pose</div>
                                <div className="text-xs text-wells-warm-grey">Ultralytics</div>
                            </div>
                        </div>
                    </div>
                    <div className="p-5 flex items-center justify-center py-16">
                        <div className="space-y-2 text-center">
                            <Bell className="w-8 h-8 mx-auto text-amber-500" />
                            <p className="text-sm text-wells-warm-grey">YOLOv11 Pose coming soon!</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

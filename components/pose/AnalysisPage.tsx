'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Upload, CheckCircle, Loader2, Camera, AlertCircle, Sparkles, Calendar, Play, Pause } from 'lucide-react';
import { Pose, POSE_CONNECTIONS } from '@mediapipe/pose';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { SquatAnalyzer } from '@/lib/pose/exercises/squat';
import { KettlebellAnalyzer } from '@/lib/pose/exercises/kettlebell';
import { LongCycleAnalyzer } from '@/lib/pose/exercises/long_cycle';
import { TemplateExerciseRunner, type ExerciseConfig } from '@/lib/pose/exercises/templates';
import { useCustomExercises } from '@/hooks/pose/useCustomExercises';
import { generateExerciseConfig } from '@/lib/pose/gemini';
type AnalysisType = 'image' | 'video';

export default function AnalysisPage() {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [analysisType, setAnalysisType] = useState<AnalysisType>('image');
    const [mediaUrl, setMediaUrl] = useState<string | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [feedback, setFeedback] = useState<Array<{ type: 'success' | 'warning' | 'info', text: string, title: string }>>([]);

    // Video specific state
    const [isPlaying, setIsPlaying] = useState(false);
    const [reps, setReps] = useState(0);
    const [videoFeedback, setVideoFeedback] = useState('Ready');
    const [selectedExercise, setSelectedExercise] = useState<string>('squat');

    // Custom Exercise State
    const { exercises: customExercises, addExercise, clearAllExercises } = useCustomExercises();
    const [isAddingExercise, setIsAddingExercise] = useState(false);
    const [newExerciseName, setNewExerciseName] = useState('');
    const [generationStep, setGenerationStep] = useState<'idle' | 'analyzing' | 'planning' | 'coding'>('idle');
    const [generationError, setGenerationError] = useState<string | null>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const requestRef = useRef<number>(0);
    const poseRef = useRef<Pose | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const [isRecording, setIsRecording] = useState(false);

    // Analyzers
    const squatAnalyzer = useMemo(() => new SquatAnalyzer(), []);
    const kettlebellAnalyzer = useMemo(() => new KettlebellAnalyzer(), []);
    const longCycleAnalyzer = useMemo(() => new LongCycleAnalyzer(), []);

    const dynamicAnalyzers = useMemo(() => {
        const map = new Map<string, TemplateExerciseRunner>();
        customExercises.forEach(ex => {
            // ex.logic now contains ExerciseConfig instead of code
            const config = ex.logic as unknown as ExerciseConfig;
            map.set(ex.id, new TemplateExerciseRunner(config));
        });
        return map;
    }, [customExercises]);

    useEffect(() => {
        const pose = new Pose({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
        });

        pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
        });

        pose.onResults((results) => {
            if (!canvasRef.current) return;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            if (analysisType === 'image') {
                // Image Analysis Logic
                const img = new Image();
                img.src = mediaUrl!;

                // We need to wait for image to load to set canvas size, but onResults runs after send()
                // so image should be loaded. However, better to set canvas size before send().
                // Here we just draw.
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                if (results.poseLandmarks) {
                    drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#00FF00', lineWidth: 4 });
                    drawLandmarks(ctx, results.poseLandmarks, { color: '#FF0000', lineWidth: 2 });
                    analyzePosture(results.poseLandmarks);
                } else {
                    setFeedback([{ type: 'warning', title: 'No Pose Detected', text: 'Could not detect a person in the image.' }]);
                    setStep(3);
                    setAnalyzing(false);
                }
            } else {
                // Video Analysis Logic
                // Draw the original video frame first
                if (videoRef.current) {
                    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                }

                if (results.poseLandmarks) {
                    drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
                    drawLandmarks(ctx, results.poseLandmarks, { color: '#FF0000', lineWidth: 1 });

                    // Video Analysis Logic
                    let currentAnalyzer;
                    if (selectedExercise === 'squat') {
                        currentAnalyzer = squatAnalyzer;
                    } else if (selectedExercise === 'kettlebell') {
                        currentAnalyzer = kettlebellAnalyzer;
                    } else if (selectedExercise === 'long_cycle') {
                        currentAnalyzer = longCycleAnalyzer;
                    } else {
                        currentAnalyzer = dynamicAnalyzers.get(selectedExercise);
                    }

                    if (currentAnalyzer) {
                        const state = currentAnalyzer.analyze(results);
                        setReps(state.reps);
                        setVideoFeedback(state.feedback);
                    }
                }
            }
        });

        poseRef.current = pose;

        return () => {
            pose.close();
            cancelAnimationFrame(requestRef.current);
        };
    }, [analysisType, mediaUrl, squatAnalyzer, kettlebellAnalyzer, longCycleAnalyzer, selectedExercise, dynamicAnalyzers]);


    const analyzePosture = (landmarks: any) => {
        const newFeedback: Array<{ type: 'success' | 'warning' | 'info', text: string, title: string }> = [];

        // Check shoulder alignment
        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];
        const shoulderSlope = Math.abs(leftShoulder.y - rightShoulder.y);

        if (shoulderSlope > 0.05) {
            newFeedback.push({ type: 'warning', title: 'Minor Adjustment Needed', text: 'Try to straighten your shoulders a bit more.' });
        } else {
            newFeedback.push({ type: 'success', title: 'Great Job!', text: 'Your shoulder alignment is excellent.' });
        }

        // Check head alignment
        const nose = landmarks[0];
        const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;
        if (Math.abs(nose.x - shoulderCenterX) > 0.05) {
            newFeedback.push({ type: 'info', title: 'Tip', text: 'Your head is slightly tilted. Look straight ahead.' });
        } else {
            newFeedback.push({ type: 'success', title: 'Great Job!', text: 'Your head alignment is excellent.' });
        }

        // Generic tip
        newFeedback.push({ type: 'info', title: 'Tip', text: 'Engage your core muscles to maintain better posture throughout the day.' });

        setFeedback(newFeedback);
        setStep(3);
        setAnalyzing(false);
    };

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const url = URL.createObjectURL(file);
            setMediaUrl(url);
            setStep(2);
            setAnalyzing(true);

            // Check file type more robustly
            const isImage = file.type.startsWith('image');
            const isVideo = file.type.startsWith('video');

            if (isImage) {
                setAnalysisType('image');
                // Delay slightly to allow UI to update
                setTimeout(() => {
                    const img = new Image();
                    img.src = url;
                    img.onload = async () => {
                        if (canvasRef.current && poseRef.current) {
                            canvasRef.current.width = img.width;
                            canvasRef.current.height = img.height;
                            await poseRef.current.send({ image: img });
                        }
                    };
                }, 500);
            } else if (isVideo) {
                setAnalysisType('video');
                setAnalyzing(false); // Video waits for play
                setStep(3); // Go straight to results/player for video
                // Reset analyzers
                squatAnalyzer.reset();
                kettlebellAnalyzer.reset();
                longCycleAnalyzer.reset();
                setReps(0);
                setVideoFeedback('Ready');
            } else {
                // Fallback for unknown types or error
                setAnalyzing(false);
                setStep(1);
                alert('Unsupported file type. Please upload an image or video.');
            }
        }
    };

    const startRecording = () => {
        if (canvasRef.current) {
            const stream = canvasRef.current.captureStream(30); // 30 FPS
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });

            mediaRecorderRef.current = mediaRecorder;
            recordedChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const handleDownload = () => {
        if (recordedChunksRef.current.length === 0) {
            alert('No recording available. Please play the video to generate a recording.');
            return;
        }
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.style.display = 'none';
        a.href = url;
        a.download = 'annotated-analysis.webm';
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const processFrame = async () => {
        if (videoRef.current && poseRef.current && !videoRef.current.paused && !videoRef.current.ended) {
            await poseRef.current.send({ image: videoRef.current });
            requestRef.current = requestAnimationFrame(processFrame);
        }
    };

    const handlePlay = () => {
        if (videoRef.current) {
            videoRef.current.play();
            setIsPlaying(true);
            startRecording();
            processFrame();
        }
    };

    const handlePause = () => {
        if (videoRef.current) {
            videoRef.current.pause();
            setIsPlaying(false);
            stopRecording();
            cancelAnimationFrame(requestRef.current);
        }
    };

    const handleCreateExercise = async () => {
        if (!newExerciseName.trim()) return;

        const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
        if (!apiKey) {
            setGenerationError("API Key missing.");
            return;
        }

        setGenerationError(null);

        try {
            // Single API call - returns simple config, no code generation!
            setGenerationStep('analyzing');
            const config = await generateExerciseConfig(apiKey, newExerciseName);

            // Store config (typed as GeminiResponse for compatibility with hook)
            const newEx = addExercise(newExerciseName, config as any);
            setSelectedExercise(newEx.id);

            // Reset/Transition
            setIsAddingExercise(false);
            setNewExerciseName('');
            setGenerationStep('idle');

            // Force reset of feedback
            setReps(0);
            setVideoFeedback('Calibrating...');

        } catch (e: any) {
            setGenerationError(e.message || "Failed to generate exercise config");
            setGenerationStep('idle');
        }
    };

    const handleVideoLoaded = () => {
        if (videoRef.current && canvasRef.current) {
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
        }
    };

    return (
        <div className="min-h-screen bg-background font-sans text-primary flex flex-col">
            {/* Header */}
            <header className="bg-surface px-8 py-4 flex items-center justify-between shadow-sm border-b border-primary/5">
                <div className="flex items-center gap-8">
                    <h1 className="text-2xl font-bold text-primary">CV Lidvizion</h1>
                    <div className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-full text-primary font-medium">
                        <Camera className="w-5 h-5" />
                        <span>Motion Analysis</span>
                    </div>
                </div>
            </header>

            <main className="flex-grow container mx-auto px-4 py-8 md:px-8 md:py-12">
                {/* Progress Steps */}
                <div className="flex justify-center mb-12">
                    <div className="flex items-center gap-4">
                        {[1, 2, 3].map((s) => (
                            <div key={s} className="flex items-center gap-2">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-colors ${step >= s ? 'bg-primary text-surface' : 'bg-surface text-primary/40 border border-primary/20'}`}>
                                    {s === 1 && <Upload className="w-5 h-5" />}
                                    {s === 2 && <Loader2 className={`w-5 h-5 ${step === 2 ? 'animate-spin' : ''}`} />}
                                    {s === 3 && <CheckCircle className="w-5 h-5" />}
                                </div>
                                <span className={`text-sm font-medium ${step >= s ? 'text-primary' : 'text-primary/40'}`}>
                                    {s === 1 ? 'Upload' : s === 2 ? 'Analyzing' : 'Results'}
                                </span>
                                {s < 3 && <div className={`w-16 h-1 mx-2 rounded-full ${step > s ? 'bg-primary' : 'bg-primary/10'}`} />}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main Content */}
                <div className="max-w-4xl mx-auto bg-surface rounded-[2rem] shadow-xl p-8 md:p-12 border border-white/50 relative overflow-hidden">
                    {/* Background decoration */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-primary/10" />

                    {step === 1 && (
                        <div className="text-center py-8">
                            <div className="border-2 border-dashed border-primary/20 rounded-3xl p-12 bg-secondary/30 mb-8 transition-colors hover:bg-secondary/50 hover:border-primary/30">
                                <div className="w-24 h-24 bg-surface rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                                    <Upload className="w-10 h-10 text-primary" />
                                </div>
                                <h2 className="text-2xl font-bold text-primary mb-3">Upload Media</h2>
                                <p className="text-primary/60 mb-8 text-lg">Drag and drop an image or video, or click to browse</p>

                                <label className="inline-flex items-center gap-3 px-8 py-4 bg-primary text-surface rounded-xl hover:opacity-90 transition-all transform hover:scale-105 shadow-lg cursor-pointer font-bold text-lg">
                                    <Camera className="w-6 h-6" />
                                    <span>Select File</span>
                                    <input type="file" accept="image/*,video/*" onChange={handleUpload} className="hidden" />
                                </label>
                            </div>

                            <div className="grid md:grid-cols-3 gap-6 text-left">
                                <div className="p-6 bg-secondary/30 rounded-2xl">
                                    <Camera className="w-8 h-8 text-primary mb-4" />
                                    <h3 className="font-bold text-primary mb-2">Natural Stance</h3>
                                    <p className="text-sm text-primary/70">Position yourself as you normally stand.</p>
                                </div>
                                <div className="p-6 bg-secondary/30 rounded-2xl">
                                    <Sparkles className="w-8 h-8 text-primary mb-4" />
                                    <h3 className="font-bold text-primary mb-2">Good Lighting</h3>
                                    <p className="text-sm text-primary/70">Ensure your body points are clearly visible.</p>
                                </div>
                                <div className="p-6 bg-secondary/30 rounded-2xl">
                                    <CheckCircle className="w-8 h-8 text-primary mb-4" />
                                    <h3 className="font-bold text-primary mb-2">Full Body</h3>
                                    <p className="text-sm text-primary/70">Include your whole body in the frame.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="text-center py-24">
                            <div className="relative inline-block">
                                <div className={`absolute inset-0 bg-secondary rounded-full animate-ping ${analyzing ? 'opacity-25' : 'opacity-0'}`}></div>
                                <Loader2 className="w-20 h-20 text-primary animate-spin relative z-10" />
                            </div>
                            <h2 className="text-3xl font-bold text-primary mt-8 mb-3">Analyzing Motion...</h2>
                            <p className="text-primary/60 text-lg">Our AI is checking your alignment and form.</p>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-8">
                            <div className="flex items-center justify-center gap-2 bg-green-100 text-green-800 px-6 py-3 rounded-full w-fit mx-auto font-bold mb-8">
                                <CheckCircle className="w-5 h-5" />
                                <span>Analysis Complete</span>
                            </div>

                            <div className="relative rounded-3xl overflow-hidden bg-black shadow-2xl mx-auto max-w-2xl aspect-video border border-primary/10">
                                {analysisType === 'image' ? (
                                    <canvas ref={canvasRef} className="w-full h-full object-contain" />
                                ) : (
                                    <div className="relative w-full h-full">
                                        <video
                                            ref={videoRef}
                                            src={mediaUrl!}
                                            className="w-full h-full object-contain"
                                            onLoadedMetadata={handleVideoLoaded}
                                            onEnded={() => {
                                                setIsPlaying(false);
                                                stopRecording();
                                            }}
                                            playsInline
                                        />
                                        <canvas
                                            ref={canvasRef}
                                            className="absolute inset-0 w-full h-full pointer-events-none"
                                        />
                                        {/* Video Controls Overlay */}
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity">
                                            {!isPlaying ? (
                                                <button onClick={handlePlay} className="p-4 bg-white/20 backdrop-blur rounded-full hover:bg-white/30 transition-colors">
                                                    <Play className="w-12 h-12 text-white fill-current" />
                                                </button>
                                            ) : (
                                                <button onClick={handlePause} className="p-4 bg-white/20 backdrop-blur rounded-full hover:bg-white/30 transition-colors">
                                                    <Pause className="w-12 h-12 text-white fill-current" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="text-center text-sm text-primary/40 font-medium">
                                AI-Enhanced Visualization
                            </div>

                            <div className="space-y-4 max-w-2xl mx-auto">
                                {analysisType === 'image' && feedback.map((item, index) => (
                                    <div key={index} className={`flex gap-4 p-5 rounded-2xl border ${item.type === 'success' ? 'bg-green-50/50 border-green-200' :
                                        item.type === 'warning' ? 'bg-yellow-50/50 border-yellow-200' :
                                            'bg-blue-50/50 border-blue-200'
                                        }`}>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${item.type === 'success' ? 'bg-green-100 text-green-700' :
                                            item.type === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-blue-100 text-blue-700'
                                            }`}>
                                            {item.type === 'success' && <CheckCircle className="w-5 h-5" />}
                                            {item.type === 'warning' && <AlertCircle className="w-5 h-5" />}
                                            {item.type === 'info' && <Sparkles className="w-5 h-5" />}
                                        </div>
                                        <div className="text-left">
                                            <h4 className={`font-bold mb-1 ${item.type === 'success' ? 'text-green-900' :
                                                item.type === 'warning' ? 'text-yellow-900' :
                                                    'text-blue-900'
                                                }`}>{item.title}</h4>
                                            <p className={`${item.type === 'success' ? 'text-green-800' :
                                                item.type === 'warning' ? 'text-yellow-800' :
                                                    'text-blue-800'
                                                }`}>{item.text}</p>
                                        </div>
                                    </div>
                                ))}

                                {analysisType === 'video' && (
                                    <div className="space-y-4">
                                        {/* Custom Exercise Creator Modal */}
                                        {isAddingExercise && (
                                            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                                                <div className="bg-surface rounded-2xl shadow-2xl p-8 w-full max-w-md relative overflow-hidden">
                                                    {generationStep !== 'idle' && (
                                                        <div className="absolute inset-0 bg-surface/90 z-10 flex flex-col items-center justify-center text-center p-6">
                                                            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                                                            <h3 className="text-xl font-bold text-primary">
                                                                {generationStep === 'analyzing' && 'Step 1: Identifying Biomechanics...'}
                                                                {generationStep === 'planning' && 'Step 2: Designing Logic...'}
                                                                {generationStep === 'coding' && 'Step 3: Configuring Tracker...'}
                                                            </h3>
                                                            <p className="text-primary/60 mt-2">
                                                                {generationStep === 'analyzing' && 'Analyzing joint mechanics & key angles'}
                                                                {generationStep === 'planning' && 'Defining rep counting parameters'}
                                                                {generationStep === 'coding' && 'Finalizing exercise template'}
                                                            </p>
                                                        </div>
                                                    )}

                                                    <h3 className="text-xl font-bold text-primary mb-4">Add Custom Exercise</h3>
                                                    <div className="mb-4">
                                                        <label className="block text-sm font-bold text-primary mb-2">Exercise Name</label>
                                                        <input
                                                            type="text"
                                                            value={newExerciseName}
                                                            onChange={(e) => setNewExerciseName(e.target.value)}
                                                            placeholder="e.g. Jumping Jacks"
                                                            className="w-full px-4 py-3 rounded-xl border border-primary/20 bg-secondary/20 focus:outline-none focus:ring-2 focus:ring-primary/50 text-primary"
                                                            autoFocus
                                                        />
                                                    </div>

                                                    {generationError && (
                                                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg mb-4">
                                                            {generationError}
                                                        </div>
                                                    )}

                                                    <div className="flex gap-3">
                                                        <button
                                                            onClick={() => setIsAddingExercise(false)}
                                                            className="flex-1 py-3 text-primary/70 font-bold hover:bg-secondary rounded-xl transition-colors"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            onClick={handleCreateExercise}
                                                            disabled={!newExerciseName}
                                                            className="flex-1 py-3 bg-primary text-surface font-bold rounded-xl hover:opacity-90 transition-colors disabled:opacity-50"
                                                        >
                                                            AI Create
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Exercise Selector */}
                                        <div className="bg-surface p-4 rounded-2xl border border-primary/10 shadow-sm flex flex-col gap-4">
                                            <div className="flex flex-wrap gap-2">
                                                {/* Built-in Exercises */}
                                                <button
                                                    onClick={() => { setSelectedExercise('squat'); setReps(0); setVideoFeedback('Ready'); }}
                                                    className={`px-4 py-2 rounded-lg font-medium transition-all ${selectedExercise === 'squat' ? 'bg-primary text-surface' : 'bg-secondary text-primary'}`}
                                                >
                                                    Squat
                                                </button>
                                                <button
                                                    onClick={() => { setSelectedExercise('kettlebell'); setReps(0); setVideoFeedback('Ready'); }}
                                                    className={`px-4 py-2 rounded-lg font-medium transition-all ${selectedExercise === 'kettlebell' ? 'bg-primary text-surface' : 'bg-secondary text-primary'}`}
                                                >
                                                    Snatch
                                                </button>
                                                <button
                                                    onClick={() => { setSelectedExercise('long_cycle'); setReps(0); setVideoFeedback('Ready'); }}
                                                    className={`px-4 py-2 rounded-lg font-medium transition-all ${selectedExercise === 'long_cycle' ? 'bg-primary text-surface' : 'bg-secondary text-primary'}`}
                                                >
                                                    Long Cycle
                                                </button>

                                                {/* Custom Exercises */}
                                                {customExercises.map(ex => (
                                                    <button
                                                        key={ex.id}
                                                        onClick={() => { setSelectedExercise(ex.id); setReps(0); setVideoFeedback('Ready'); }}
                                                        className={`px-4 py-2 rounded-lg font-medium transition-all ${selectedExercise === ex.id ? 'bg-primary text-surface ring-2 ring-primary ring-offset-2' : 'bg-secondary text-primary border border-dashed border-primary/30'}`}
                                                    >
                                                        {ex.name}
                                                    </button>
                                                ))}

                                                {/* Add Button */}
                                                <button
                                                    onClick={() => setIsAddingExercise(true)}
                                                    className="px-4 py-2 rounded-lg font-medium border-2 border-dashed border-primary/30 text-primary hover:bg-primary/5 transition-all"
                                                >
                                                    + Add Custom
                                                </button>

                                                {/* Clear Button */}
                                                {customExercises.length > 0 && (
                                                    <button
                                                        onClick={clearAllExercises}
                                                        className="px-4 py-2 rounded-lg font-medium text-primary/40 hover:text-red-500 transition-all ml-auto text-sm"
                                                    >
                                                        Clear Custom
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="p-6 bg-secondary/30 rounded-2xl border border-primary/10 text-center">
                                            <h4 className="font-bold text-primary text-lg mb-2">Analysis Summary</h4>
                                            <p className="text-primary/80">
                                                Exercise: <span className="font-bold uppercase">{
                                                    selectedExercise === 'squat' ? 'Squat' :
                                                        selectedExercise === 'kettlebell' ? 'Snatch' :
                                                            selectedExercise === 'long_cycle' ? 'Long Cycle' :
                                                                customExercises.find(e => e.id === selectedExercise)?.name || 'Unknown'
                                                }</span><br />
                                                Completed {reps} repetitions. <br />
                                                <span className="font-bold">{videoFeedback}</span>
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Personalized Plan Section */}
                                <div className="bg-secondary/30 rounded-3xl p-8 mt-12 text-center border border-primary/10">
                                    <div className="w-16 h-16 bg-surface rounded-2xl flex items-center justify-center mx-auto mb-4 text-primary shadow-sm">
                                        <ActivityIcon />
                                    </div>
                                    <h3 className="text-xl font-bold text-primary mb-2">Your Personalized Plan</h3>
                                    <p className="text-primary/70 mb-6 max-w-md mx-auto">Based on your analysis, we can generate a simple 7-day exercise plan to improve your posture.</p>
                                    <button className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-surface rounded-xl font-bold hover:opacity-90 transition-colors shadow-lg">
                                        <Calendar className="w-5 h-5" />
                                        <span>Create My 7-Day Plan</span>
                                    </button>
                                </div>

                                <div className="flex gap-4 justify-center pt-8 border-t border-primary/10">
                                    <button
                                        onClick={() => {
                                            // Stop any active recording/playback
                                            if (videoRef.current) {
                                                videoRef.current.pause();
                                                videoRef.current.currentTime = 0;
                                            }
                                            stopRecording();
                                            setIsPlaying(false);

                                            // Reset State
                                            setStep(1);
                                            setMediaUrl(null);
                                            setFeedback([]);
                                            setReps(0);
                                            setVideoFeedback('Ready');
                                            setAnalyzing(false);

                                            // Reset Analyzers
                                            squatAnalyzer.reset();
                                            kettlebellAnalyzer.reset();
                                            longCycleAnalyzer.reset();

                                            // Clear recording buffer
                                            recordedChunksRef.current = [];
                                        }}
                                        className="px-8 py-3 bg-primary text-surface rounded-xl hover:opacity-90 transition-colors font-bold shadow-lg"
                                    >
                                        Upload Another Video
                                    </button>
                                    <button className="px-8 py-3 bg-surface text-primary border-2 border-primary/10 rounded-xl hover:bg-secondary transition-colors font-bold">
                                        Save Results
                                    </button>
                                    {analysisType === 'video' && (
                                        <button
                                            onClick={handleDownload}
                                            className="px-8 py-3 bg-secondary text-primary rounded-xl hover:bg-secondary/80 transition-colors font-bold"
                                        >
                                            Download Video
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Footer Help */}
            <div className="container mx-auto px-4 pb-8">
                <div className="bg-secondary/30 rounded-2xl p-6 flex items-start gap-4 max-w-4xl mx-auto border border-primary/5">
                    <div className="w-1 bg-primary self-stretch rounded-full"></div>
                    <div>
                        <h4 className="font-bold text-primary mb-1">Need Help?</h4>
                        <p className="text-primary/70 text-sm">If you're having trouble taking a photo, ask a family member or caregiver to help. You can also call support at <span className="text-primary font-bold">1-800-LIDVIZION</span></p>
                    </div>
                </div>
            </div>

        </div>
    );
}

function ActivityIcon() {
    return (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
    )
}

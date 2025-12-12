import { useRef, useState, useEffect, useCallback } from 'react';
import { Pose, POSE_CONNECTIONS } from '@mediapipe/pose';
import type { Results } from '@mediapipe/pose';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';

export default function useVideoPoseDetection(
    videoRef: React.RefObject<HTMLVideoElement | null>,
    canvasRef: React.RefObject<HTMLCanvasElement | null>,
    onResults?: (results: Results) => void
) {
    const [isLoaded, setIsLoaded] = useState(false);
    const poseRef = useRef<Pose | null>(null);

    const onResultsCallback = useCallback((results: Results) => {
        if (!canvasRef.current || !videoRef.current) return;

        const canvas = canvasRef.current;
        const video = videoRef.current;
        const ctx = canvas.getContext('2d');

        if (!ctx) return;

        // Ensure canvas matches video dimensions
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
        }

        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw landmarks
        if (results.poseLandmarks) {
            drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {
                color: '#00FF00',
                lineWidth: 4
            });
            drawLandmarks(ctx, results.poseLandmarks, {
                color: '#FF0000',
                lineWidth: 2
            });
        }
        ctx.restore();

        if (onResults) {
            onResults(results);
        }
    }, [canvasRef, videoRef, onResults]);

    useEffect(() => {
        const pose = new Pose({
            locateFile: (file: string) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
            }
        });

        pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        pose.onResults(onResultsCallback);
        poseRef.current = pose;
        setIsLoaded(true);

        return () => {
            pose.close();
        };
    }, [onResultsCallback]);

    // Frame processing loop
    useEffect(() => {
        let animationFrameId: number;

        const processFrame = async () => {
            if (
                videoRef.current &&
                !videoRef.current.paused &&
                !videoRef.current.ended &&
                poseRef.current
            ) {
                await poseRef.current.send({ image: videoRef.current });
            }
            animationFrameId = requestAnimationFrame(processFrame);
        };

        if (videoRef.current) {
            // Start loop when video is played
            videoRef.current.addEventListener('play', processFrame);
        }

        return () => {
            cancelAnimationFrame(animationFrameId);
            if (videoRef.current) {
                videoRef.current.removeEventListener('play', processFrame);
            }
        };
    }, [isLoaded]); // Depend on load to ensure poseRef is ready

    return { isLoaded };
}

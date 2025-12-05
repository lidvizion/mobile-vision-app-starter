'use client'

import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CVTask, CVResponse } from '@/types'
import { validateCVResponse } from '@/lib/validation'
import { logger, createLogContext } from '@/lib/logger'
import { queryKeys } from '@/lib/query-client'
import { ModelMetadata } from '@/types/models'
import { modelViewStore } from '@/stores/modelViewStore'

export function useCVTask(selectedModel?: ModelMetadata | null) {
  const [currentTask, setCurrentTask] = useState<CVTask>('multi-type')
  const queryClient = useQueryClient()

  const switchTask = useCallback((task: CVTask) => {
    const context = createLogContext(task, 'useCVTask', 'switch-task')
    logger.info('Switching CV task', context)
    setCurrentTask(task)
  }, [])

  const processImageMutation = useMutation({
    mutationFn: async (imageFile: File): Promise<CVResponse> => {
      const context = createLogContext(currentTask, 'useCVTask', 'process-image')
      logger.info('Starting image processing', context, {
        fileName: imageFile.name,
        fileSize: imageFile.size,
        fileType: imageFile.type,
        selectedModel: selectedModel?.name
      })
      
      try {
        // If model is selected and supports inference, use HF Inference API
        if (selectedModel?.supportsInference && selectedModel?.inferenceEndpoint) {
          logger.info('Using HF Inference API', context, { 
            model: selectedModel.name,
            supportsInference: selectedModel.supportsInference,
            inferenceEndpoint: selectedModel.inferenceEndpoint
          })
          
          // Compress image if it's too large (to avoid 413 Request Entity Too Large errors)
          let processedImageFile = imageFile
          try {
            const { compressImage, needsCompression, getFileSizeString } = await import('@/lib/imageUtils')
            if (needsCompression(imageFile, 500)) { // Compress if > 500KB
              logger.info('Image is large, compressing before sending', context, {
                originalSize: getFileSizeString(imageFile),
                fileName: imageFile.name
              })
              processedImageFile = await compressImage(imageFile, {
                maxWidth: 2048,
                maxHeight: 2048,
                quality: 0.85,
                maxSizeKB: 500
              })
              logger.info('Image compressed successfully', context, {
                originalSize: getFileSizeString(imageFile),
                compressedSize: getFileSizeString(processedImageFile),
                compressionRatio: `${((1 - processedImageFile.size / imageFile.size) * 100).toFixed(1)}%`
              })
            }
          } catch (compressionError) {
            logger.warn('Image compression failed, using original image', context, compressionError as Error)
            // Continue with original image if compression fails
          }
          
          // Convert image to base64
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(processedImageFile)
          })
          
          // Prepare task-specific parameters for better compatibility
          const parameters: Record<string, any> = {}
          
          // Add parameters based on task type and model source
          // NOTE: We don't set confidence threshold here - API returns ALL results
          // Client-side filtering happens in ResultsDisplay using MobX store
          if (selectedModel.source === 'roboflow') {
            // Roboflow models - explicitly set confidence=0 to get ALL results
            // Roboflow API defaults to 50% confidence threshold, so we must set to 0 to get everything
            if (selectedModel.task?.toLowerCase().includes('detection') || selectedModel.task?.toLowerCase().includes('segmentation')) {
              parameters.confidence = 0 // Set to 0 to get ALL detections (0-100% confidence)
              parameters.overlap = 0.3 // Standard overlap threshold
            }
          } else {
            // Hugging Face models
            if (selectedModel.task?.toLowerCase().includes('classification')) {
              parameters.top_k = 5 // Return top 5 predictions
            } else if (selectedModel.task?.toLowerCase().includes('detection')) {
              // Some HF models may filter by default, set threshold=0 to get ALL results
              parameters.threshold = 0 // Set to 0 to get ALL detections (0-100% confidence)
            }
          }
          
          // Call appropriate inference API based on model source 
          let response: Response
          
          if (selectedModel.source === 'roboflow') {
            // Use Roboflow inference API
            // Ensure inference endpoint is available (required for Roboflow models)
            if (!selectedModel.inferenceEndpoint) {
              throw new Error(`Roboflow model ${selectedModel.id} is missing inference endpoint. Please select a different model or try searching again.`)
            }
            
            response = await fetch('/api/roboflow-inference', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model_url: selectedModel.inferenceEndpoint,
                api_key: selectedModel.apiKey,
                image: base64,
                model_id: selectedModel.id, // Pass model ID for tracking
                task_type: selectedModel.task, // Pass task type for proper categorization 
                parameters: Object.keys(parameters).length > 0 ? parameters : undefined
              })
            })
          } else {
            // Use Hugging Face inference API
            response = await fetch('/api/run-inference', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model_id: selectedModel.id,
                inputs: base64,
                parameters: Object.keys(parameters).length > 0 ? parameters : undefined
              })
            })
          }
          
          if (!response.ok) {
            const error = await response.json()
            const errorMessage = error.error || 'Inference failed'
            const errorDetails = error.details ? ` - ${error.details}` : ''
            const errorStatus = error.status ? ` (Status: ${error.status})` : ''
            
            // Create enhanced error with Hugging Face redirect info 
            const enhancedError = new Error(`${errorMessage}${errorDetails}${errorStatus}`)
            if (error.redirectToHF && error.modelUrl) {
              (enhancedError as any).modelUrl = error.modelUrl
              (enhancedError as any).redirectToHF = error.redirectToHF
            }
            
            logger.error('Inference API error', context, enhancedError)
            throw enhancedError
          }
          
          const inferenceData = await response.json()
          
          // Get actual image dimensions (use processed image if compressed)
          let imageDimensions: { width: number; height: number } | undefined
          try {
            imageDimensions = await getImageDimensions(processedImageFile)
            logger.info('Image dimensions retrieved', context, imageDimensions)
          } catch (dimError) {
            logger.warn('Failed to get image dimensions, using defaults', context, dimError as Error)
          }
          
          // Transform response to CVResponse format based on model source 
          const cvResponse: CVResponse = selectedModel.source === 'roboflow' 
            ? transformRoboflowToCVResponse(inferenceData, selectedModel, imageDimensions)
            : transformHFToCVResponse(inferenceData, selectedModel, imageDimensions)
          
          logger.info('Inference completed successfully', context, {
            resultsCount: inferenceData.results?.length || inferenceData.predictions?.length,
            modelSource: selectedModel.source,
            task: cvResponse.task
          })
          
          // Save inference result to MongoDB (inference_jobs collection with host property)
          let jobId: string | undefined = undefined
          try {
            // Prepare response data for saving - use the transformed CVResponse format
            // This ensures classification labels are saved correctly
            let responseData: any[] = []
            
            // Check task types in order of specificity
            // 1. Classification (no spatial data)
            if (cvResponse.task === 'classification' && cvResponse.results.labels && cvResponse.results.labels.length > 0) {
              // Classification: save labels as array with label and score
              responseData = cvResponse.results.labels.map((label: any) => ({
                label: label.class,
                score: label.score || (typeof label.confidence === 'number' ? label.confidence : 0.0)
              }))
            } 
            // 2. Keypoint detection (most specific spatial task)
            else if (cvResponse.results.keypoint_detections && cvResponse.results.keypoint_detections.length > 0) {
              // Keypoint detection: save detections with bbox and keypoints
              responseData = cvResponse.results.keypoint_detections.map((det: any) => ({
                label: det.class,
                score: det.confidence,
                box: det.bbox,
                keypoints: det.keypoints || [] // Include keypoints array
              }))
            }
            // 3. Segmentation (includes instance segmentation which may have both detections and regions)
            else if (cvResponse.results.segmentation?.regions && cvResponse.results.segmentation.regions.length > 0) {
              // Segmentation: save regions with bbox, points, and mask
              responseData = cvResponse.results.segmentation.regions.map((reg: any) => ({
                label: reg.class,
                score: reg.area,
                box: reg.bbox || null,
                points: reg.points || null, // Include polygon points for segmentation
                mask: reg.mask || null // Include mask data if available
              }))
            }
            // 4. Detection (standard object detection)
            else if (cvResponse.results.detections && cvResponse.results.detections.length > 0) {
              // Detection: save detections with bbox
              responseData = cvResponse.results.detections.map((det: any) => ({
                label: det.class,
                score: det.confidence,
                box: det.bbox
              }))
            } else {
              // Fallback: use original inferenceData format
              // For Roboflow, use predictions; for HF, use results
              if (selectedModel.source === 'roboflow') {
                responseData = inferenceData.predictions || inferenceData.results || []
              } else {
                responseData = inferenceData.results || []
              }
            }
            
            const savePayload: any = {
              user_id: 'anonymous',
              model_id: selectedModel.id,
              query: modelViewStore.queryText || 'unknown',
              image_url: base64, // Using base64 as image_url for now 
              response: responseData
            }
            
            // Add inference endpoint for Roboflow models (required for future inference calls)
            if (selectedModel.source === 'roboflow' && selectedModel.inferenceEndpoint) {
              savePayload.inference_endpoint = selectedModel.inferenceEndpoint
            }
            
            const saveResponse = await fetch('/api/save-inference-result', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(savePayload)
            })
            
            if (saveResponse.ok) {
              const saveResult = await saveResponse.json()
              jobId = saveResult.result_id
              logger.info(`Inference job saved to MongoDB (inference_jobs collection, host: ${selectedModel.source}, job_id: ${jobId})`, context)
            } else {
              logger.warn('Failed to save inference job - response not ok', context)
            }
          } catch (saveError) {
            logger.error('Failed to save inference job', context, saveError as Error)
            // Don't fail the inference if save fails
          }
          
          // Add job_id to response for later use when saving annotations
          return {
            ...cvResponse,
            job_id: jobId
          }
        } else {
          // No model selected - require model selection first 
          logger.warn('No model selected for inference', context, { 
            selectedModel: selectedModel ? {
              name: selectedModel.name,
              supportsInference: selectedModel.supportsInference,
              inferenceEndpoint: selectedModel.inferenceEndpoint
            } : null
          })
          throw new Error('Please select a model first before processing images. Use the guided model flow to find and select an appropriate model for your use case.')
        }
      } catch (error) {
        logger.error('Image processing failed', context, error as Error)
        throw error
      }
    },
    onSuccess: (data) => {
      const context = createLogContext(currentTask, 'useCVTask', 'process-success')
      logger.info('CV processing mutation succeeded', context)
      
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.cvResults })
      queryClient.setQueryData(queryKeys.cvResult(data.timestamp), data)
    },
    onError: (error) => {
      const context = createLogContext(currentTask, 'useCVTask', 'process-error')
      logger.error('CV processing mutation failed', context, error as Error)
    }
  })

  const processImage = useCallback(async (file: File): Promise<CVResponse> => {
    return new Promise((resolve, reject) => {
      processImageMutation.mutate(file, {
        onSuccess: (data) => resolve(data),
        onError: (error) => reject(error)
      })
    })
  }, [processImageMutation])

  return {
    currentTask,
    switchTask,
    processImage,
    isProcessing: processImageMutation.isPending,
    lastResponse: processImageMutation.data || null,
    error: processImageMutation.error,
  }
}

/**
 * Get image dimensions from a File object
 * Only works in browser environment
 */
function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  // Check if we're in browser environment
  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    return Promise.resolve({ width: 640, height: 480 })
  }
  
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      reject(new Error('Failed to load image'))
    }
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Transform Hugging Face Inference API response to CVResponse format 
 */
function transformHFToCVResponse(inferenceData: any, model: ModelMetadata, imageDimensions?: { width: number; height: number }): CVResponse {
  // Debug: Check what Gemini/API is actually returning
  console.log('🔍 [transformHFToCVResponse] Input inferenceData:', {
    hasResults: !!inferenceData.results,
    resultsType: typeof inferenceData.results,
    resultsIsArray: Array.isArray(inferenceData.results),
    resultsValue: inferenceData.results,
    resultsKeys: inferenceData.results && typeof inferenceData.results === 'object' ? Object.keys(inferenceData.results) : null,
    hasDetections: !!(inferenceData.results as any)?.detections,
    detectionsValue: (inferenceData.results as any)?.detections,
    modelName: model.name,
    modelId: model.id,
    fullInferenceData: inferenceData
  })
  
  // Handle both formats: array (old HF) or object with detections (new Gemini)
  const results = Array.isArray(inferenceData.results) 
    ? inferenceData.results 
    : (inferenceData.results?.detections || [])
  
  console.log('🔍 [transformHFToCVResponse] Extracted results:', {
    resultsLength: results.length,
    resultsType: typeof results,
    resultsIsArray: Array.isArray(results),
    resultsSample: results.slice(0, 2),
    willTransform: results.length > 0
  })
  
  // Determine task type from model and results
  let task = model.task || 'detection'
  
  // Check for specific data types to determine task
  if (results.length > 0) {
    const firstResult = results[0]
    
    // Instance segmentation: has both box and mask
    if (firstResult.box && firstResult.mask) {
      task = 'segmentation'
    }
    // Object detection: has box but no mask
    else if (firstResult.box) {
      task = 'detection'
    }
    // Image segmentation: has mask but no box
    else if (firstResult.mask) {
      task = 'segmentation'
    }
    // Classification: has label and score but no spatial data
    else if (firstResult.label && firstResult.score && !firstResult.box && !firstResult.mask) {
      task = 'classification'
    }
  }
  
  // Transform based on task type
  // Calculate processing time from API response (duration is in milliseconds)
  const processingTime = inferenceData.duration ? (inferenceData.duration / 1000) : 0.5
  
  if (task === 'detection' || task.includes('detection')) {
    // Object Detection
    return {
      task: 'detection',
      model_version: model.name,
      processing_time: processingTime,
      timestamp: inferenceData.timestamp || new Date().toISOString(),
      image_metadata: {
        width: imageDimensions?.width || 640,
        height: imageDimensions?.height || 480,
        format: 'jpeg'
      },
      results: {
        detections: results.map((det: any) => {
          // Preserve descriptive labels exactly as returned
          const classLabel = det.label || 'unknown'
          
          // Handle bounding box - Gemini returns normalized coordinates (0-1)
          let bbox = { x: 0, y: 0, width: 0, height: 0 }
          if (det.box && 
              typeof det.box.xmin === 'number' && 
              typeof det.box.ymin === 'number' &&
              typeof det.box.xmax === 'number' && 
              typeof det.box.ymax === 'number') {
            // Gemini returns normalized coordinates (0-1), convert to normalized bbox format
            bbox = {
              x: det.box.xmin,  // Already normalized 0-1
              y: det.box.ymin,  // Already normalized 0-1
              width: det.box.xmax - det.box.xmin,  // Width as fraction (0-1)
              height: det.box.ymax - det.box.ymin  // Height as fraction (0-1)
            }
            // Ensure valid dimensions
            if (bbox.width <= 0 || bbox.height <= 0 || bbox.x < 0 || bbox.y < 0 || bbox.x + bbox.width > 1 || bbox.y + bbox.height > 1) {
              console.warn('⚠️ Invalid bbox detected, using default:', { det, bbox })
              bbox = { x: 0, y: 0, width: 0, height: 0 }
            }
          }
          
          return {
            class: classLabel,
            confidence: det.score || det.confidence || 0,
            bbox
          }
        })
      }
    }
  } else if (task === 'classification' || task.includes('classification')) {
    // Image Classification 
    return {
      task: 'classification',
      model_version: model.name,
      processing_time: processingTime,
      timestamp: inferenceData.timestamp || new Date().toISOString(),
      image_metadata: {
        width: imageDimensions?.width || 640,
        height: imageDimensions?.height || 480,
        format: 'jpeg'
      },
      results: {
        labels: results.map((cls: any) => ({
          class: cls.label,
          score: cls.score,
          confidence: cls.score > 0.8 ? 'high' : cls.score > 0.5 ? 'medium' : cls.score > 0.3 ? 'low' : 'very_low'
        }))
      }
    }
  } else if (task === 'segmentation' || task.includes('segmentation')) {
    // Instance Segmentation or Image Segmentation
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F']
    
    return {
      task: 'segmentation',
      model_version: model.name,
      processing_time: processingTime,
      timestamp: inferenceData.timestamp || new Date().toISOString(),
      image_metadata: {
        width: imageDimensions?.width || 640,
        height: imageDimensions?.height || 480,
        format: 'jpeg'
      },
      results: {
        // For instance segmentation, include both detections and segmentation
        detections: results.filter((seg: any) => seg.box).map((seg: any, index: number) => ({
          class: seg.label,
          confidence: seg.score || 0.9,
          bbox: seg.box ? {
            x: seg.box.xmin,
            y: seg.box.ymin,
            width: seg.box.xmax - seg.box.xmin,
            height: seg.box.ymax - seg.box.ymin
          } : { x: 0, y: 0, width: 0, height: 0 }
        })),
        segmentation: {
          regions: results.map((seg: any, index: number) => {
            // Calculate actual area from mask data if available
            let calculatedArea = 0.1; // Default fallback
            
            if (seg.mask) {
              try {
                // Estimate area from mask size (base64 encoded PNG)
                // This is a rough estimation - actual mask parsing would require PNG decoder
                const maskBase64Length = seg.mask.length;
                const imageSize = (imageDimensions?.width || 640) * (imageDimensions?.height || 480);
                
                // Rough estimation: assume mask represents roughly maskSize/imageSize coverage
                // Base64 encoding increases size by ~33%, so we adjust for that
                const estimatedPixels = (maskBase64Length * 3 / 4) / 4; // Approximate pixel count (4 bytes per pixel)
                calculatedArea = Math.min(0.95, Math.max(0.01, estimatedPixels / imageSize));
              } catch (error) {
                console.warn('Failed to calculate mask area, using fallback:', error);
                calculatedArea = 0.1;
              }
            } else if (seg.box) {
              // Use bounding box area if available
              calculatedArea = ((seg.box.xmax - seg.box.xmin) * (seg.box.ymax - seg.box.ymin)) / 
                ((imageDimensions?.width || 640) * (imageDimensions?.height || 480));
            } else if (seg.area) {
              // Use provided area if available
              calculatedArea = seg.area;
            }
            
            return {
              class: seg.label,
              area: calculatedArea,
              color: colors[index % colors.length],
              mask: seg.mask || null, // Store mask data if available
              bbox: seg.box ? {
                x: seg.box.xmin,
                y: seg.box.ymin,
                width: seg.box.xmax - seg.box.xmin,
                height: seg.box.ymax - seg.box.ymin
              } : null
            };
          })
        }
      }
    }
  }
  
  // Default fallback
  return {
    task: 'multi-type',
    model_version: model.name,
    processing_time: processingTime,
    timestamp: inferenceData.timestamp || new Date().toISOString(),
    image_metadata: {
      width: 640,
      height: 480,
      format: 'jpeg'
    },
    results: {
      labels: []
    }
  }
}

/**
 * Transform Roboflow API response to CVResponse format with pixel strips
 */
function transformRoboflowToCVResponse(inferenceData: any, model: ModelMetadata, imageDimensions?: { width: number; height: number }): CVResponse {
  // Roboflow API returns predictions, not results
  const predictions = inferenceData.predictions || inferenceData.results || []
  
  // Calculate processing time from API response (processing_time or duration in milliseconds)
  const processingTime = inferenceData.processing_time 
    ? (inferenceData.processing_time / 1000) 
    : inferenceData.duration 
      ? (inferenceData.duration / 1000) 
      : 0.5 // Fallback to 0.5 seconds
  
  // Determine task type from model and results
  // Prioritize model's explicit task type, but verify with actual data
  let task = model.task || 'detection'
  
  // Normalize model task to lowercase for easier comparison
  const modelTaskLower = (model.task || '').toLowerCase()
  
  // Check for specific data types to determine task
  if (predictions.length > 0) {
    const firstPrediction = predictions[0]
    
    // Keypoint detection: has keypoints array (check first, as it's most specific)
    // Check both direct keypoints property and also check if any prediction has keypoints
    const hasKeypoints = (firstPrediction.keypoints && Array.isArray(firstPrediction.keypoints) && firstPrediction.keypoints.length > 0) ||
                         predictions.some((p: any) => p.keypoints && Array.isArray(p.keypoints) && p.keypoints.length > 0)
    
    if (hasKeypoints) {
      task = 'keypoint-detection'
    }
    // Check for segmentation only if:
    // 1. Model explicitly indicates segmentation, OR
    // 2. There's a mask (pixel-level segmentation), OR
    // 3. There are points AND model indicates segmentation (not detection)
    else if (modelTaskLower.includes('segmentation') || 
             firstPrediction.mask ||
             (firstPrediction.points && modelTaskLower.includes('segmentation'))) {
      task = 'segmentation'
    }
    // Object detection: 
    // - Has bbox
    // - Model explicitly indicates detection (or is not segmentation)
    // - No mask (mask indicates segmentation)
    // - Points alone don't mean segmentation (could be polygon annotations for detection)
    else if (firstPrediction.bbox && !firstPrediction.mask) {
      // Trust model's task type if it explicitly says detection
      if (modelTaskLower.includes('detection') || (!modelTaskLower.includes('segmentation') && !modelTaskLower.includes('keypoint'))) {
      task = 'detection'
      }
    }
    // Image segmentation: has mask or points but no bbox (and model indicates segmentation)
    else if ((firstPrediction.mask || firstPrediction.points) && !firstPrediction.bbox) {
      if (modelTaskLower.includes('segmentation')) {
      task = 'segmentation'
      }
    }
  }
  
  // Also check if model task type explicitly indicates keypoint detection
  if (model.task && (modelTaskLower.includes('keypoint') || modelTaskLower.includes('key-point') || modelTaskLower.includes('pose'))) {
    task = 'keypoint-detection'
  }
  
  // Check if model task type explicitly indicates classification
  if (model.task && modelTaskLower.includes('classification')) {
    task = 'classification'
  }
  
  // Final check: If model explicitly says "Object Detection", don't override to segmentation
  // unless there's a clear mask indicating segmentation
  if (modelTaskLower.includes('object') && modelTaskLower.includes('detection') && 
      task === 'segmentation' && predictions.length > 0) {
    const hasMask = predictions.some((p: any) => p.mask)
    if (!hasMask) {
      // No mask found, trust the model's task type (Object Detection)
      task = 'detection'
    }
  }
  
  // Transform based on task type
  // Check for classification first (no spatial data, just class and confidence/score)
  if (task === 'classification' || task.includes('classification') || 
      (predictions.length > 0 && predictions.every((p: any) => p.class && (p.confidence !== undefined || p.score !== undefined) && !p.bbox && !p.x && !p.y && !p.mask && !p.points && !p.keypoints))) {
    // Image Classification - predictions have class and confidence/score but no spatial data
    return {
      task: 'classification',
      model_version: model.name,
      processing_time: processingTime,
      timestamp: inferenceData.timestamp || new Date().toISOString(),
      image_metadata: {
        width: imageDimensions?.width || 640,
        height: imageDimensions?.height || 480,
        format: 'jpeg'
      },
      results: {
        labels: predictions.map((cls: any) => ({
          class: cls.class || cls.top || 'unknown',
          score: cls.score || cls.confidence || 0.0,
          confidence: (cls.score || cls.confidence || 0.0) > 0.8 ? 'high' : 
                      (cls.score || cls.confidence || 0.0) > 0.5 ? 'medium' : 
                      (cls.score || cls.confidence || 0.0) > 0.3 ? 'low' : 'very_low'
        }))
      }
    }
  } else if (task === 'keypoint-detection' || (task.includes('keypoint') && predictions.some((p: any) => p.keypoints))) {
    // Keypoint Detection - has bounding box + keypoints (separate schema)
    return {
      task: 'keypoint-detection',
      model_version: model.name,
      processing_time: processingTime,
      timestamp: inferenceData.timestamp || new Date().toISOString(),
      image_metadata: {
        width: imageDimensions?.width || 640,
        height: imageDimensions?.height || 480,
        format: 'jpeg'
      },
      results: {
        keypoint_detections: predictions.map((prediction: any) => {
          // Roboflow returns center coordinates (x, y) and width/height
          // If bbox exists, use it (it's already converted to top-left), otherwise use direct x/y/width/height
          let bbox
          if (prediction.bbox) {
            // bbox is already in top-left format from Python script
            bbox = prediction.bbox
          } else if (prediction.x !== undefined && prediction.y !== undefined) {
            // Roboflow returns center coordinates, convert to top-left
            const center_x = prediction.x
            const center_y = prediction.y
            const width = prediction.width || 0
            const height = prediction.height || 0
            bbox = {
              x: center_x - (width / 2),
              y: center_y - (height / 2),
              width: width,
              height: height
            }
          } else {
            bbox = { x: 0, y: 0, width: 0, height: 0 }
          }
          
          return {
            class: prediction.class,
            confidence: prediction.confidence,
            bbox: {
              x: bbox.x,
              y: bbox.y,
              width: bbox.width,
              height: bbox.height
            },
            keypoints: (prediction.keypoints || []).map((kp: any) => ({
              x: kp.x,
              y: kp.y,
              confidence: kp.confidence || 1.0,
              class_id: kp.class_id,
              class: kp.class
            })),
            // NOTE: Roboflow does NOT provide skeleton connection data in the API response
            // Skeleton connections are manually defined in project settings but are only used
            // for visualization in Roboflow's UI, not returned via API
            // Our implementation uses heuristic detection for human pose models instead
            class_id: prediction.class_id,
            detection_id: prediction.detection_id
          }
        })
      }
    }
  } else if (task === 'detection' || task.includes('detection')) {
    // Object Detection
    return {
      task: 'detection',
      model_version: model.name,
      processing_time: processingTime,
      timestamp: inferenceData.timestamp || new Date().toISOString(),
      image_metadata: {
        width: imageDimensions?.width || 640,
        height: imageDimensions?.height || 480,
        format: 'jpeg'
      },
      results: {
        detections: predictions.map((detection: any) => {
          // Preserve descriptive class labels exactly as returned
          const classLabel = detection.class || 'unknown'
          
          // Convert Roboflow bbox format to our format
          // Roboflow returns pixel coordinates (center-based or top-left)
          const bbox = detection.bbox || {
            x: detection.x || 0,
            y: detection.y || 0,
            width: detection.width || 0,
            height: detection.height || 0
          }
          
          // Ensure bbox is in top-left format with valid values
          const finalBbox = {
            x: bbox.x || detection.x || 0,
            y: bbox.y || detection.y || 0,
            width: Math.max(0, bbox.width || detection.width || 0),
            height: Math.max(0, bbox.height || detection.height || 0)
          }
          
          return {
            class: classLabel, // Preserve descriptive labels (e.g., "white bottle", "green bottle")
            confidence: detection.confidence || 0,
            bbox: finalBbox
          }
        })
      }
    }
  } else if (task === 'segmentation' || task.includes('segmentation')) {
    // Segmentation with pixel strips
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F']
    
    return {
      task: 'segmentation',
      model_version: model.name,
      processing_time: processingTime,
      timestamp: inferenceData.timestamp || new Date().toISOString(),
      image_metadata: {
        width: imageDimensions?.width || 640,
        height: imageDimensions?.height || 480,
        format: 'jpeg'
      },
      results: {
        segmentation: {
          regions: predictions.map((seg: any, index: number) => {
            // Calculate area from bbox if not provided
            let area = seg.area || 0.1
            
            // Handle bbox conversion (Roboflow may return center coordinates)
            let bbox = seg.bbox || null
            if (!bbox && seg.x !== undefined && seg.y !== undefined && seg.width && seg.height) {
              // Convert center coordinates to top-left format
              bbox = {
                x: seg.x - (seg.width / 2),
                y: seg.y - (seg.height / 2),
                width: seg.width,
                height: seg.height
              }
            } else if (bbox && bbox.x !== undefined && bbox.y !== undefined) {
              // bbox already exists, ensure it's in top-left format
              // (should already be converted by Python script, but double-check)
              bbox = {
                x: bbox.x,
                y: bbox.y,
                width: bbox.width || seg.width || 0,
                height: bbox.height || seg.height || 0
              }
            }
            
            if (!seg.area && bbox) {
              const bboxArea = bbox.width * bbox.height
              const imageArea = (imageDimensions?.width || 640) * (imageDimensions?.height || 480)
              area = Math.min(0.95, Math.max(0.01, bboxArea / imageArea))
            }
            
            return {
              class: seg.class,
              area: area,
              color: colors[index % colors.length],
              mask: seg.mask || null,
              points: seg.points || null, // Include polygon points if available
              bbox: bbox,
              pixelStrip: seg.pixelStrip || null // Include pixel strip data
            }
          })
        }
      }
    }
  }
  
  // Default fallback
  return {
    task: 'multi-type',
    model_version: model.name,
    processing_time: processingTime,
    timestamp: inferenceData.timestamp || new Date().toISOString(),
    image_metadata: {
      width: imageDimensions?.width || 640,
      height: imageDimensions?.height || 480,
      format: 'jpeg'
    },
    results: {
      labels: []
    }
  }
}
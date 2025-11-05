/**
 * Get image dimensions from a File object
 * Only works in browser environment
 */
export function getImageDimensions(file) {
    // Check if we're in browser environment
    if (typeof window === 'undefined' || typeof Image === 'undefined') {
        return Promise.resolve({ width: 640, height: 480 });
    }
    return new Promise(function (resolve, reject) {
        var img = new Image();
        img.onload = function () {
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = function () {
            reject(new Error('Failed to load image'));
        };
        img.src = URL.createObjectURL(file);
    });
}
/**
 * Transform Hugging Face Inference API response to CVResponse format
 */
export function transformHFToCVResponse(inferenceData, model, imageDimensions) {
    var results = inferenceData.results || [];
    // Determine task type from model and results
    var task = model.task || 'detection';
    // Check for specific data types to determine task
    if (results.length > 0) {
        var firstResult = results[0];
        // Instance segmentation: has both box and mask
        if (firstResult.box && firstResult.mask) {
            task = 'segmentation';
        }
        // Object detection: has box but no mask
        else if (firstResult.box) {
            task = 'detection';
        }
        // Image segmentation: has mask but no box
        else if (firstResult.mask) {
            task = 'segmentation';
        }
        // Classification: has label and score but no spatial data
        else if (firstResult.label && firstResult.score && !firstResult.box && !firstResult.mask) {
            task = 'classification';
        }
    }
    // Transform based on task type
    if (task === 'detection' || task.includes('detection')) {
        // Object Detection
        return {
            task: 'detection',
            model_version: model.name,
            processing_time: 0.5,
            timestamp: inferenceData.timestamp || new Date().toISOString(),
            image_metadata: {
                width: (imageDimensions === null || imageDimensions === void 0 ? void 0 : imageDimensions.width) || 640,
                height: (imageDimensions === null || imageDimensions === void 0 ? void 0 : imageDimensions.height) || 480,
                format: 'jpeg'
            },
            results: {
                detections: results.map(function (det) { return ({
                    class: det.label,
                    confidence: det.score,
                    bbox: det.box ? {
                        x: det.box.xmin,
                        y: det.box.ymin,
                        width: det.box.xmax - det.box.xmin,
                        height: det.box.ymax - det.box.ymin
                    } : { x: 0, y: 0, width: 0, height: 0 }
                }); })
            }
        };
    }
    else if (task === 'classification' || task.includes('classification')) {
        // Image Classification
        return {
            task: 'classification',
            model_version: model.name,
            processing_time: 0.3,
            timestamp: inferenceData.timestamp || new Date().toISOString(),
            image_metadata: {
                width: (imageDimensions === null || imageDimensions === void 0 ? void 0 : imageDimensions.width) || 640,
                height: (imageDimensions === null || imageDimensions === void 0 ? void 0 : imageDimensions.height) || 480,
                format: 'jpeg'
            },
            results: {
                labels: results.map(function (cls) { return ({
                    class: cls.label,
                    score: cls.score,
                    confidence: cls.score > 0.8 ? 'high' : cls.score > 0.5 ? 'medium' : cls.score > 0.3 ? 'low' : 'very_low'
                }); })
            }
        };
    }
    else if (task === 'segmentation' || task.includes('segmentation')) {
        // Instance Segmentation or Image Segmentation
        var colors_1 = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
        return {
            task: 'segmentation',
            model_version: model.name,
            processing_time: 0.8,
            timestamp: inferenceData.timestamp || new Date().toISOString(),
            image_metadata: {
                width: (imageDimensions === null || imageDimensions === void 0 ? void 0 : imageDimensions.width) || 640,
                height: (imageDimensions === null || imageDimensions === void 0 ? void 0 : imageDimensions.height) || 480,
                format: 'jpeg'
            },
            results: {
                // For instance segmentation, include both detections and segmentation
                detections: results.filter(function (seg) { return seg.box; }).map(function (seg, index) { return ({
                    class: seg.label,
                    confidence: seg.score || 0.9,
                    bbox: seg.box ? {
                        x: seg.box.xmin,
                        y: seg.box.ymin,
                        width: seg.box.xmax - seg.box.xmin,
                        height: seg.box.ymax - seg.box.ymin
                    } : { x: 0, y: 0, width: 0, height: 0 }
                }); }),
                segmentation: {
                    regions: results.map(function (seg, index) { return ({
                        class: seg.label,
                        area: seg.area || (seg.box ?
                            ((seg.box.xmax - seg.box.xmin) * (seg.box.ymax - seg.box.ymin)) /
                                (((imageDimensions === null || imageDimensions === void 0 ? void 0 : imageDimensions.width) || 640) * ((imageDimensions === null || imageDimensions === void 0 ? void 0 : imageDimensions.height) || 480)) : 0.1),
                        color: colors_1[index % colors_1.length],
                        mask: seg.mask || null, // Store mask data if available
                        bbox: seg.box ? {
                            x: seg.box.xmin,
                            y: seg.box.ymin,
                            width: seg.box.xmax - seg.box.xmin,
                            height: seg.box.ymax - seg.box.ymin
                        } : null
                    }); })
                }
            }
        };
    }
    // Default fallback
    return {
        task: 'multi-type',
        model_version: model.name,
        processing_time: 0.5,
        timestamp: inferenceData.timestamp || new Date().toISOString(),
        image_metadata: {
            width: 640,
            height: 480,
            format: 'jpeg'
        },
        results: {
            labels: []
        }
    };
}
//# sourceMappingURL=utils.js.map
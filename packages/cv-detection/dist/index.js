'use strict';

var react = require('react');
var reactQuery = require('@tanstack/react-query');
var zod = require('zod');

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol, Iterator */


function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

function __generator(thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

/**
 * Get image dimensions from a File object
 * Only works in browser environment
 */
function getImageDimensions(file) {
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
function transformHFToCVResponse(inferenceData, model, imageDimensions) {
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

// Image file validation
var ImageFileSchema = zod.z.object({
    type: zod.z.string().refine(function (type) { return ['image/jpeg', 'image/png', 'image/webp'].includes(type); }, { message: 'Only JPEG, PNG, and WebP files are supported' }),
    size: zod.z.number().max(10 * 1024 * 1024, 'File size must be less than 10MB'),
    name: zod.z.string().min(1, 'File name is required')
});
// Video file validation
var VideoFileSchema = zod.z.object({
    type: zod.z.string().refine(function (type) { return ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'].includes(type); }, { message: 'Only MP4, WebM, MOV, and AVI files are supported' }),
    size: zod.z.number().max(100 * 1024 * 1024, 'File size must be less than 100MB'),
    name: zod.z.string().min(1, 'File name is required')
});
// Combined media file validation
zod.z.union([ImageFileSchema, VideoFileSchema]);
// Bounding box schema
var BoundingBoxSchema = zod.z.object({
    x: zod.z.number().min(0),
    y: zod.z.number().min(0),
    width: zod.z.number().min(0),
    height: zod.z.number().min(0)
});
// Detection result schema
var DetectionSchema = zod.z.object({
    class: zod.z.string(),
    confidence: zod.z.number().min(0).max(1),
    bbox: BoundingBoxSchema
});
// Classification result schema
var ClassificationSchema = zod.z.object({
    class: zod.z.string(),
    score: zod.z.number().min(0).max(1),
    confidence: zod.z.enum(['high', 'medium', 'low', 'very_low'])
});
// Segmentation region schema
var SegmentationRegionSchema = zod.z.object({
    class: zod.z.string(),
    area: zod.z.number().min(0).max(1),
    color: zod.z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color'),
    mask: zod.z.string().nullable().optional(), // Base64 mask data
    bbox: BoundingBoxSchema.nullable().optional() // Bounding box for instance segmentation
});
// Segmentation schema
var SegmentationSchema = zod.z.object({
    mask_url: zod.z.string().optional(),
    regions: zod.z.array(SegmentationRegionSchema)
});
// Image metadata schema
var ImageMetadataSchema = zod.z.object({
    width: zod.z.number().min(1),
    height: zod.z.number().min(1),
    format: zod.z.string()
});
// CV Results schema
var CVResultsSchema = zod.z.object({
    labels: zod.z.array(ClassificationSchema).optional(),
    detections: zod.z.array(DetectionSchema).optional(),
    segmentation: SegmentationSchema.optional()
});
// Main CV Response schema
var CVResponseSchema = zod.z.object({
    task: zod.z.enum(['detection', 'classification', 'segmentation', 'multi-type']),
    model_version: zod.z.string(),
    processing_time: zod.z.number().min(0),
    timestamp: zod.z.string(),
    image_metadata: ImageMetadataSchema,
    results: CVResultsSchema
});
var validateCVResponse = function (data) {
    try {
        var validatedData = CVResponseSchema.parse(data);
        return { isValid: true, data: validatedData };
    }
    catch (error) {
        if (error instanceof zod.z.ZodError) {
            return {
                isValid: false,
                error: "Validation failed: ".concat(error.issues.map(function (e) { return e.message; }).join(', '))
            };
        }
        return { isValid: false, error: 'Invalid response format' };
    }
};

/**
 * Hook for computer vision detection tasks
 * Provides detection processing functionality for BaaS integration
 */
function useCVDetection(selectedModel) {
    var _this = this;
    var _a = react.useState('multi-type'), currentTask = _a[0], setCurrentTask = _a[1];
    var switchTask = react.useCallback(function (task) {
        setCurrentTask(task);
    }, []);
    var processImageMutation = reactQuery.useMutation({
        mutationFn: function (imageFile) { return __awaiter(_this, void 0, void 0, function () {
            var imageDimensions, base64, parameters, response, inferenceData, cvResponse, validation;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(selectedModel === null || selectedModel === void 0 ? void 0 : selectedModel.supportsInference) || !(selectedModel === null || selectedModel === void 0 ? void 0 : selectedModel.inferenceEndpoint)) {
                            throw new Error('No model selected or model does not support inference');
                        }
                        return [4 /*yield*/, getImageDimensions(imageFile)];
                    case 1:
                        imageDimensions = _a.sent();
                        return [4 /*yield*/, new Promise(function (resolve, reject) {
                                var reader = new FileReader();
                                reader.onloadend = function () { return resolve(reader.result); };
                                reader.onerror = reject;
                                reader.readAsDataURL(imageFile);
                            })];
                    case 2:
                        base64 = _a.sent();
                        parameters = {};
                        if (currentTask === 'detection') {
                            parameters.threshold = 0.5;
                        }
                        else if (currentTask === 'classification') {
                            parameters.top_k = 5;
                        }
                        return [4 /*yield*/, fetch(selectedModel.inferenceEndpoint, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': "Bearer ".concat(process.env.NEXT_PUBLIC_HF_TOKEN || ''),
                                },
                                body: JSON.stringify({
                                    inputs: base64,
                                    parameters: parameters,
                                }),
                            })];
                    case 3:
                        response = _a.sent();
                        if (!response.ok) {
                            throw new Error("Inference failed: ".concat(response.status, " ").concat(response.statusText));
                        }
                        return [4 /*yield*/, response.json()];
                    case 4:
                        inferenceData = _a.sent();
                        cvResponse = transformHFToCVResponse(inferenceData, selectedModel, imageDimensions);
                        validation = validateCVResponse(cvResponse);
                        if (!validation.isValid) {
                            throw new Error("Invalid response format: ".concat(validation.error));
                        }
                        return [2 /*return*/, validation.data];
                }
            });
        }); },
    });
    var processImage = react.useCallback(function (imageFile) { return __awaiter(_this, void 0, void 0, function () {
        var result, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, processImageMutation.mutateAsync(imageFile)];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, {
                            success: true,
                            data: result,
                            processingTime: result.processing_time,
                        }];
                case 2:
                    error_1 = _a.sent();
                    return [2 /*return*/, {
                            success: false,
                            error: error_1 instanceof Error ? error_1.message : 'Unknown error',
                        }];
                case 3: return [2 /*return*/];
            }
        });
    }); }, [processImageMutation]);
    return {
        currentTask: currentTask,
        switchTask: switchTask,
        processImage: processImage,
        isProcessing: processImageMutation.isPending,
        error: processImageMutation.error,
    };
}
/**
 * Hook for processing images with a specific model configuration
 * Useful for BaaS integration where you know the exact model to use
 */
function useModelDetection(config) {
    var _this = this;
    var processWithModel = reactQuery.useMutation({
        mutationFn: function (imageFile) { return __awaiter(_this, void 0, void 0, function () {
            var imageDimensions, base64, inferenceEndpoint, response, inferenceData, cvResponse, validation, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 5, , 6]);
                        return [4 /*yield*/, getImageDimensions(imageFile)];
                    case 1:
                        imageDimensions = _a.sent();
                        return [4 /*yield*/, new Promise(function (resolve, reject) {
                                var reader = new FileReader();
                                reader.onloadend = function () { return resolve(reader.result); };
                                reader.onerror = reject;
                                reader.readAsDataURL(imageFile);
                            })];
                    case 2:
                        base64 = _a.sent();
                        inferenceEndpoint = "https://router.huggingface.co/hf-inference/models/".concat(config.modelId);
                        return [4 /*yield*/, fetch(inferenceEndpoint, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': "Bearer ".concat(process.env.NEXT_PUBLIC_HF_TOKEN || ''),
                                },
                                body: JSON.stringify({
                                    inputs: base64,
                                    parameters: config.parameters || {},
                                }),
                            })];
                    case 3:
                        response = _a.sent();
                        if (!response.ok) {
                            throw new Error("Inference failed: ".concat(response.status, " ").concat(response.statusText));
                        }
                        return [4 /*yield*/, response.json()];
                    case 4:
                        inferenceData = _a.sent();
                        cvResponse = transformHFToCVResponse(inferenceData, { name: config.modelId, task: 'detection' }, imageDimensions);
                        validation = validateCVResponse(cvResponse);
                        if (!validation.isValid) {
                            throw new Error("Invalid response format: ".concat(validation.error));
                        }
                        return [2 /*return*/, {
                                success: true,
                                data: validation.data,
                                processingTime: validation.data.processing_time,
                            }];
                    case 5:
                        error_2 = _a.sent();
                        return [2 /*return*/, {
                                success: false,
                                error: error_2 instanceof Error ? error_2.message : 'Unknown error',
                            }];
                    case 6: return [2 /*return*/];
                }
            });
        }); },
    });
    return {
        processImage: processWithModel.mutateAsync,
        isProcessing: processWithModel.isPending,
        error: processWithModel.error,
    };
}

exports.getImageDimensions = getImageDimensions;
exports.transformHFToCVResponse = transformHFToCVResponse;
exports.useCVDetection = useCVDetection;
exports.useModelDetection = useModelDetection;
//# sourceMappingURL=index.js.map

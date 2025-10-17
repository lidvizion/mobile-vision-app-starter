'use strict';

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

function __spreadArray(to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

/**
 * Video utility functions for snapshot extraction and processing
 */
/**
 * Extract a snapshot from a video file at a specific timestamp
 * @param videoFile - The video file to extract snapshot from
 * @param timestamp - Time in seconds to extract snapshot (default: 0.5)
 * @returns Promise<File> - The extracted image as a File object
 */
var extractVideoSnapshot = function (videoFile_1) {
    var args_1 = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args_1[_i - 1] = arguments[_i];
    }
    return __awaiter(void 0, __spreadArray([videoFile_1], args_1, true), void 0, function (videoFile, timestamp) {
        if (timestamp === void 0) { timestamp = 0.5; }
        return __generator(this, function (_a) {
            return [2 /*return*/, new Promise(function (resolve, reject) {
                    var video = document.createElement('video');
                    var canvas = document.createElement('canvas');
                    var context = canvas.getContext('2d');
                    if (!context) {
                        reject(new Error('Failed to get canvas context'));
                        return;
                    }
                    video.onloadedmetadata = function () {
                        // Set canvas dimensions to match video
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        // Seek to the specified timestamp
                        video.currentTime = Math.min(timestamp, video.duration - 0.1);
                    };
                    video.onseeked = function () {
                        try {
                            // Draw the current frame to canvas
                            context.drawImage(video, 0, 0, canvas.width, canvas.height);
                            // Convert canvas to blob
                            canvas.toBlob(function (blob) {
                                if (!blob) {
                                    reject(new Error('Failed to extract video frame'));
                                    return;
                                }
                                // Create a File object from the blob
                                var fileName = videoFile.name.replace(/\.[^/.]+$/, '_snapshot.jpg');
                                var snapshotFile = new File([blob], fileName, { type: 'image/jpeg' });
                                resolve(snapshotFile);
                            }, 'image/jpeg', 0.9);
                        }
                        catch (error) {
                            reject(error);
                        }
                    };
                    video.onerror = function () {
                        reject(new Error('Failed to load video file'));
                    };
                    // Load the video file
                    video.src = URL.createObjectURL(videoFile);
                    video.load();
                })];
        });
    });
};
/**
 * Get video duration in seconds
 * @param videoFile - The video file
 * @returns Promise<number> - Duration in seconds
 */
var getVideoDuration = function (videoFile) {
    return new Promise(function (resolve, reject) {
        var video = document.createElement('video');
        video.onloadedmetadata = function () {
            resolve(video.duration);
            URL.revokeObjectURL(video.src);
        };
        video.onerror = function () {
            reject(new Error('Failed to load video file'));
            URL.revokeObjectURL(video.src);
        };
        video.src = URL.createObjectURL(videoFile);
        video.load();
    });
};
/**
 * Check if a file is a video file
 * @param file - The file to check
 * @returns boolean - True if the file is a video
 */
var isVideoFile = function (file) {
    return file.type.startsWith('video/');
};
/**
 * Format file size in human readable format
 * @param bytes - File size in bytes
 * @returns string - Formatted file size
 */
var formatFileSize = function (bytes) {
    if (bytes === 0)
        return '0 Bytes';
    var k = 1024;
    var sizes = ['Bytes', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

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
var MediaFileSchema = zod.z.union([ImageFileSchema, VideoFileSchema]);
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
zod.z.object({
    task: zod.z.enum(['detection', 'classification', 'segmentation', 'multi-type']),
    model_version: zod.z.string(),
    processing_time: zod.z.number().min(0),
    timestamp: zod.z.string(),
    image_metadata: ImageMetadataSchema,
    results: CVResultsSchema
});
var validateVideoFile = function (file) {
    try {
        VideoFileSchema.parse({
            type: file.type,
            size: file.size,
            name: file.name
        });
        return { isValid: true };
    }
    catch (error) {
        if (error instanceof zod.z.ZodError) {
            return { isValid: false, error: error.issues[0].message };
        }
        return { isValid: false, error: 'Invalid file format' };
    }
};
var validateMediaFile = function (file) {
    try {
        MediaFileSchema.parse({
            type: file.type,
            size: file.size,
            name: file.name
        });
        // Determine if it's a video file
        var isVideo = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'].includes(file.type);
        return { isValid: true, isVideo: isVideo };
    }
    catch (error) {
        if (error instanceof zod.z.ZodError) {
            return { isValid: false, error: error.issues[0].message };
        }
        return { isValid: false, error: 'Invalid file format' };
    }
};

exports.extractVideoSnapshot = extractVideoSnapshot;
exports.formatFileSize = formatFileSize;
exports.getVideoDuration = getVideoDuration;
exports.isVideoFile = isVideoFile;
exports.validateMediaFile = validateMediaFile;
exports.validateVideoFile = validateVideoFile;
//# sourceMappingURL=index.js.map

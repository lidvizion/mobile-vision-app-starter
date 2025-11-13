import { __awaiter, __generator } from "tslib";
import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { getImageDimensions, transformHFToCVResponse } from './utils';
import { validateCVResponse } from '@lidvizion/cv-validation';
/**
 * Hook for computer vision detection tasks
 * Provides detection processing functionality for BaaS integration
 */
export function useCVDetection(selectedModel) {
    var _this = this;
    var _a = useState('multi-type'), currentTask = _a[0], setCurrentTask = _a[1];
    var switchTask = useCallback(function (task) {
        setCurrentTask(task);
    }, []);
    var processImageMutation = useMutation({
        mutationFn: function (imageFile) { return __awaiter(_this, void 0, void 0, function () {
            var imageDimensions, base64, parameters, modelId, inferenceEndpoint, response, inferenceData, cvResponse, validation;
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
                        modelId = selectedModel.inferenceEndpoint.split('/').pop() || selectedModel.id;
                        inferenceEndpoint = "https://router.huggingface.co/hf-inference/models/".concat(modelId);
                        return [4 /*yield*/, fetch(inferenceEndpoint, {
                                method: 'POST',
                                headers: {
                                    'Authorization': "Bearer ".concat(process.env.NEXT_PUBLIC_HF_TOKEN || ''),
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    inputs: base64,
                                    parameters: parameters
                                })
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
    var processImage = useCallback(function (imageFile) { return __awaiter(_this, void 0, void 0, function () {
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
export function useModelDetection(config) {
    var _this = this;
    var processWithModel = useMutation({
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
//# sourceMappingURL=hooks.js.map
import { z } from 'zod';

declare const ImageFileSchema: z.ZodObject<{
    type: z.ZodEffects<z.ZodString, string, string>;
    size: z.ZodNumber;
    name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: string;
    size: number;
    name: string;
}, {
    type: string;
    size: number;
    name: string;
}>;
declare const VideoFileSchema: z.ZodObject<{
    type: z.ZodEffects<z.ZodString, string, string>;
    size: z.ZodNumber;
    name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: string;
    size: number;
    name: string;
}, {
    type: string;
    size: number;
    name: string;
}>;
declare const MediaFileSchema: z.ZodUnion<[z.ZodObject<{
    type: z.ZodEffects<z.ZodString, string, string>;
    size: z.ZodNumber;
    name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: string;
    size: number;
    name: string;
}, {
    type: string;
    size: number;
    name: string;
}>, z.ZodObject<{
    type: z.ZodEffects<z.ZodString, string, string>;
    size: z.ZodNumber;
    name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: string;
    size: number;
    name: string;
}, {
    type: string;
    size: number;
    name: string;
}>]>;
declare const BoundingBoxSchema: z.ZodObject<{
    x: z.ZodNumber;
    y: z.ZodNumber;
    width: z.ZodNumber;
    height: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    x: number;
    y: number;
    width: number;
    height: number;
}, {
    x: number;
    y: number;
    width: number;
    height: number;
}>;
declare const DetectionSchema: z.ZodObject<{
    class: z.ZodString;
    confidence: z.ZodNumber;
    bbox: z.ZodObject<{
        x: z.ZodNumber;
        y: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        x: number;
        y: number;
        width: number;
        height: number;
    }, {
        x: number;
        y: number;
        width: number;
        height: number;
    }>;
}, "strip", z.ZodTypeAny, {
    class: string;
    confidence: number;
    bbox: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}, {
    class: string;
    confidence: number;
    bbox: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}>;
declare const ClassificationSchema: z.ZodObject<{
    class: z.ZodString;
    score: z.ZodNumber;
    confidence: z.ZodEnum<["high", "medium", "low", "very_low"]>;
}, "strip", z.ZodTypeAny, {
    class: string;
    confidence: "high" | "medium" | "low" | "very_low";
    score: number;
}, {
    class: string;
    confidence: "high" | "medium" | "low" | "very_low";
    score: number;
}>;
declare const SegmentationRegionSchema: z.ZodObject<{
    class: z.ZodString;
    area: z.ZodNumber;
    color: z.ZodString;
    mask: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    bbox: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        x: z.ZodNumber;
        y: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        x: number;
        y: number;
        width: number;
        height: number;
    }, {
        x: number;
        y: number;
        width: number;
        height: number;
    }>>>;
}, "strip", z.ZodTypeAny, {
    class: string;
    area: number;
    color: string;
    bbox?: {
        x: number;
        y: number;
        width: number;
        height: number;
    } | null | undefined;
    mask?: string | null | undefined;
}, {
    class: string;
    area: number;
    color: string;
    bbox?: {
        x: number;
        y: number;
        width: number;
        height: number;
    } | null | undefined;
    mask?: string | null | undefined;
}>;
declare const SegmentationSchema: z.ZodObject<{
    mask_url: z.ZodOptional<z.ZodString>;
    regions: z.ZodArray<z.ZodObject<{
        class: z.ZodString;
        area: z.ZodNumber;
        color: z.ZodString;
        mask: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        bbox: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
            width: z.ZodNumber;
            height: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
            width: number;
            height: number;
        }, {
            x: number;
            y: number;
            width: number;
            height: number;
        }>>>;
    }, "strip", z.ZodTypeAny, {
        class: string;
        area: number;
        color: string;
        bbox?: {
            x: number;
            y: number;
            width: number;
            height: number;
        } | null | undefined;
        mask?: string | null | undefined;
    }, {
        class: string;
        area: number;
        color: string;
        bbox?: {
            x: number;
            y: number;
            width: number;
            height: number;
        } | null | undefined;
        mask?: string | null | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    regions: {
        class: string;
        area: number;
        color: string;
        bbox?: {
            x: number;
            y: number;
            width: number;
            height: number;
        } | null | undefined;
        mask?: string | null | undefined;
    }[];
    mask_url?: string | undefined;
}, {
    regions: {
        class: string;
        area: number;
        color: string;
        bbox?: {
            x: number;
            y: number;
            width: number;
            height: number;
        } | null | undefined;
        mask?: string | null | undefined;
    }[];
    mask_url?: string | undefined;
}>;
declare const ImageMetadataSchema: z.ZodObject<{
    width: z.ZodNumber;
    height: z.ZodNumber;
    format: z.ZodString;
}, "strip", z.ZodTypeAny, {
    width: number;
    height: number;
    format: string;
}, {
    width: number;
    height: number;
    format: string;
}>;
declare const CVResultsSchema: z.ZodObject<{
    labels: z.ZodOptional<z.ZodArray<z.ZodObject<{
        class: z.ZodString;
        score: z.ZodNumber;
        confidence: z.ZodEnum<["high", "medium", "low", "very_low"]>;
    }, "strip", z.ZodTypeAny, {
        class: string;
        confidence: "high" | "medium" | "low" | "very_low";
        score: number;
    }, {
        class: string;
        confidence: "high" | "medium" | "low" | "very_low";
        score: number;
    }>, "many">>;
    detections: z.ZodOptional<z.ZodArray<z.ZodObject<{
        class: z.ZodString;
        confidence: z.ZodNumber;
        bbox: z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
            width: z.ZodNumber;
            height: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
            width: number;
            height: number;
        }, {
            x: number;
            y: number;
            width: number;
            height: number;
        }>;
    }, "strip", z.ZodTypeAny, {
        class: string;
        confidence: number;
        bbox: {
            x: number;
            y: number;
            width: number;
            height: number;
        };
    }, {
        class: string;
        confidence: number;
        bbox: {
            x: number;
            y: number;
            width: number;
            height: number;
        };
    }>, "many">>;
    segmentation: z.ZodOptional<z.ZodObject<{
        mask_url: z.ZodOptional<z.ZodString>;
        regions: z.ZodArray<z.ZodObject<{
            class: z.ZodString;
            area: z.ZodNumber;
            color: z.ZodString;
            mask: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            bbox: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                width: z.ZodNumber;
                height: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                x: number;
                y: number;
                width: number;
                height: number;
            }, {
                x: number;
                y: number;
                width: number;
                height: number;
            }>>>;
        }, "strip", z.ZodTypeAny, {
            class: string;
            area: number;
            color: string;
            bbox?: {
                x: number;
                y: number;
                width: number;
                height: number;
            } | null | undefined;
            mask?: string | null | undefined;
        }, {
            class: string;
            area: number;
            color: string;
            bbox?: {
                x: number;
                y: number;
                width: number;
                height: number;
            } | null | undefined;
            mask?: string | null | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        regions: {
            class: string;
            area: number;
            color: string;
            bbox?: {
                x: number;
                y: number;
                width: number;
                height: number;
            } | null | undefined;
            mask?: string | null | undefined;
        }[];
        mask_url?: string | undefined;
    }, {
        regions: {
            class: string;
            area: number;
            color: string;
            bbox?: {
                x: number;
                y: number;
                width: number;
                height: number;
            } | null | undefined;
            mask?: string | null | undefined;
        }[];
        mask_url?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    labels?: {
        class: string;
        confidence: "high" | "medium" | "low" | "very_low";
        score: number;
    }[] | undefined;
    detections?: {
        class: string;
        confidence: number;
        bbox: {
            x: number;
            y: number;
            width: number;
            height: number;
        };
    }[] | undefined;
    segmentation?: {
        regions: {
            class: string;
            area: number;
            color: string;
            bbox?: {
                x: number;
                y: number;
                width: number;
                height: number;
            } | null | undefined;
            mask?: string | null | undefined;
        }[];
        mask_url?: string | undefined;
    } | undefined;
}, {
    labels?: {
        class: string;
        confidence: "high" | "medium" | "low" | "very_low";
        score: number;
    }[] | undefined;
    detections?: {
        class: string;
        confidence: number;
        bbox: {
            x: number;
            y: number;
            width: number;
            height: number;
        };
    }[] | undefined;
    segmentation?: {
        regions: {
            class: string;
            area: number;
            color: string;
            bbox?: {
                x: number;
                y: number;
                width: number;
                height: number;
            } | null | undefined;
            mask?: string | null | undefined;
        }[];
        mask_url?: string | undefined;
    } | undefined;
}>;
declare const CVResponseSchema: z.ZodObject<{
    task: z.ZodEnum<["detection", "classification", "segmentation", "multi-type"]>;
    model_version: z.ZodString;
    processing_time: z.ZodNumber;
    timestamp: z.ZodString;
    image_metadata: z.ZodObject<{
        width: z.ZodNumber;
        height: z.ZodNumber;
        format: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        width: number;
        height: number;
        format: string;
    }, {
        width: number;
        height: number;
        format: string;
    }>;
    results: z.ZodObject<{
        labels: z.ZodOptional<z.ZodArray<z.ZodObject<{
            class: z.ZodString;
            score: z.ZodNumber;
            confidence: z.ZodEnum<["high", "medium", "low", "very_low"]>;
        }, "strip", z.ZodTypeAny, {
            class: string;
            confidence: "high" | "medium" | "low" | "very_low";
            score: number;
        }, {
            class: string;
            confidence: "high" | "medium" | "low" | "very_low";
            score: number;
        }>, "many">>;
        detections: z.ZodOptional<z.ZodArray<z.ZodObject<{
            class: z.ZodString;
            confidence: z.ZodNumber;
            bbox: z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
                width: z.ZodNumber;
                height: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                x: number;
                y: number;
                width: number;
                height: number;
            }, {
                x: number;
                y: number;
                width: number;
                height: number;
            }>;
        }, "strip", z.ZodTypeAny, {
            class: string;
            confidence: number;
            bbox: {
                x: number;
                y: number;
                width: number;
                height: number;
            };
        }, {
            class: string;
            confidence: number;
            bbox: {
                x: number;
                y: number;
                width: number;
                height: number;
            };
        }>, "many">>;
        segmentation: z.ZodOptional<z.ZodObject<{
            mask_url: z.ZodOptional<z.ZodString>;
            regions: z.ZodArray<z.ZodObject<{
                class: z.ZodString;
                area: z.ZodNumber;
                color: z.ZodString;
                mask: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                bbox: z.ZodOptional<z.ZodNullable<z.ZodObject<{
                    x: z.ZodNumber;
                    y: z.ZodNumber;
                    width: z.ZodNumber;
                    height: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    x: number;
                    y: number;
                    width: number;
                    height: number;
                }, {
                    x: number;
                    y: number;
                    width: number;
                    height: number;
                }>>>;
            }, "strip", z.ZodTypeAny, {
                class: string;
                area: number;
                color: string;
                bbox?: {
                    x: number;
                    y: number;
                    width: number;
                    height: number;
                } | null | undefined;
                mask?: string | null | undefined;
            }, {
                class: string;
                area: number;
                color: string;
                bbox?: {
                    x: number;
                    y: number;
                    width: number;
                    height: number;
                } | null | undefined;
                mask?: string | null | undefined;
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            regions: {
                class: string;
                area: number;
                color: string;
                bbox?: {
                    x: number;
                    y: number;
                    width: number;
                    height: number;
                } | null | undefined;
                mask?: string | null | undefined;
            }[];
            mask_url?: string | undefined;
        }, {
            regions: {
                class: string;
                area: number;
                color: string;
                bbox?: {
                    x: number;
                    y: number;
                    width: number;
                    height: number;
                } | null | undefined;
                mask?: string | null | undefined;
            }[];
            mask_url?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        labels?: {
            class: string;
            confidence: "high" | "medium" | "low" | "very_low";
            score: number;
        }[] | undefined;
        detections?: {
            class: string;
            confidence: number;
            bbox: {
                x: number;
                y: number;
                width: number;
                height: number;
            };
        }[] | undefined;
        segmentation?: {
            regions: {
                class: string;
                area: number;
                color: string;
                bbox?: {
                    x: number;
                    y: number;
                    width: number;
                    height: number;
                } | null | undefined;
                mask?: string | null | undefined;
            }[];
            mask_url?: string | undefined;
        } | undefined;
    }, {
        labels?: {
            class: string;
            confidence: "high" | "medium" | "low" | "very_low";
            score: number;
        }[] | undefined;
        detections?: {
            class: string;
            confidence: number;
            bbox: {
                x: number;
                y: number;
                width: number;
                height: number;
            };
        }[] | undefined;
        segmentation?: {
            regions: {
                class: string;
                area: number;
                color: string;
                bbox?: {
                    x: number;
                    y: number;
                    width: number;
                    height: number;
                } | null | undefined;
                mask?: string | null | undefined;
            }[];
            mask_url?: string | undefined;
        } | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    task: "segmentation" | "detection" | "classification" | "multi-type";
    model_version: string;
    processing_time: number;
    timestamp: string;
    image_metadata: {
        width: number;
        height: number;
        format: string;
    };
    results: {
        labels?: {
            class: string;
            confidence: "high" | "medium" | "low" | "very_low";
            score: number;
        }[] | undefined;
        detections?: {
            class: string;
            confidence: number;
            bbox: {
                x: number;
                y: number;
                width: number;
                height: number;
            };
        }[] | undefined;
        segmentation?: {
            regions: {
                class: string;
                area: number;
                color: string;
                bbox?: {
                    x: number;
                    y: number;
                    width: number;
                    height: number;
                } | null | undefined;
                mask?: string | null | undefined;
            }[];
            mask_url?: string | undefined;
        } | undefined;
    };
}, {
    task: "segmentation" | "detection" | "classification" | "multi-type";
    model_version: string;
    processing_time: number;
    timestamp: string;
    image_metadata: {
        width: number;
        height: number;
        format: string;
    };
    results: {
        labels?: {
            class: string;
            confidence: "high" | "medium" | "low" | "very_low";
            score: number;
        }[] | undefined;
        detections?: {
            class: string;
            confidence: number;
            bbox: {
                x: number;
                y: number;
                width: number;
                height: number;
            };
        }[] | undefined;
        segmentation?: {
            regions: {
                class: string;
                area: number;
                color: string;
                bbox?: {
                    x: number;
                    y: number;
                    width: number;
                    height: number;
                } | null | undefined;
                mask?: string | null | undefined;
            }[];
            mask_url?: string | undefined;
        } | undefined;
    };
}>;

declare const validateImageFile: (file: File) => {
    isValid: boolean;
    error?: string;
};
declare const validateVideoFile: (file: File) => {
    isValid: boolean;
    error?: string;
};
declare const validateMediaFile: (file: File) => {
    isValid: boolean;
    error?: string;
    isVideo?: boolean;
};
declare const validateCVResponse: (data: unknown) => {
    isValid: boolean;
    data?: any;
    error?: string;
};

type CVResponse = z.infer<typeof CVResponseSchema>;
type CVResults = z.infer<typeof CVResultsSchema>;
type Detection = z.infer<typeof DetectionSchema>;
type Classification = z.infer<typeof ClassificationSchema>;
type SegmentationRegion = z.infer<typeof SegmentationRegionSchema>;
type ImageMetadata = z.infer<typeof ImageMetadataSchema>;
type BoundingBox = z.infer<typeof BoundingBoxSchema>;

export { BoundingBoxSchema, CVResponseSchema, CVResultsSchema, ClassificationSchema, DetectionSchema, ImageFileSchema, ImageMetadataSchema, MediaFileSchema, SegmentationRegionSchema, SegmentationSchema, VideoFileSchema, validateCVResponse, validateImageFile, validateMediaFile, validateVideoFile };
export type { BoundingBox, CVResponse, CVResults, Classification, Detection, ImageMetadata, SegmentationRegion };

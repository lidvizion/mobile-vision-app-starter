export declare const validateImageFile: (file: File) => {
    isValid: boolean;
    error?: string;
};
export declare const validateVideoFile: (file: File) => {
    isValid: boolean;
    error?: string;
};
export declare const validateMediaFile: (file: File) => {
    isValid: boolean;
    error?: string;
    isVideo?: boolean;
};
export declare const validateCVResponse: (data: unknown) => {
    isValid: boolean;
    data?: any;
    error?: string;
};
//# sourceMappingURL=validation-functions.d.ts.map
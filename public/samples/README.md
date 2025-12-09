# Sample Images Directory

Add your sample images here. The app will ONLY use local images - no placeholders or fallbacks.

## Required Images for Detection

Place these 4 images in `/public/samples/detection/`:

1. **construction-ppe.jpg** - Worker with hard hat and safety vest
2. **construction-workers.jpg** - Three workers at construction site
3. **construction-team.jpg** - Two engineers/managers
4. **warehouse.jpg** - Two men in warehouse with hard hats

## Image Requirements

- **Format**: JPG or PNG
- **Size**: Recommended 400x300 pixels
- **File Size**: Under 100KB each
- **Naming**: Use the EXACT filenames listed above (case-sensitive)

## How to Use

1. Add your 4 images to `/public/samples/detection/`
2. Name them exactly as listed above
3. The app will automatically load them when Detection task is selected
4. If an image is missing, it simply won't appear (no fallback)

## File Structure

```
public/samples/
└── detection/
    ├── construction-ppe.jpg
    ├── construction-workers.jpg
    ├── construction-team.jpg
    └── warehouse.jpg
```


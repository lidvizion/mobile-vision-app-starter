# 🏷️ Model Classes Implementation

## Overview

Model recommendations now include a `classes` array that shows the expected output labels for each model. This helps users understand what the model can detect/classify before using it.

---

## ✅ What Was Implemented

### 1. **Updated MongoDB Schema**
**File:** `lib/mongodb/schemas.ts`

Added `classes` field to model recommendations:
```typescript
models: Array<{
  name: string
  model_id?: string // e.g., "Falconsai/nsfw_image_detection"
  source: 'Roboflow' | 'Hugging Face'
  task: string
  classes?: string[] // e.g., ["normal", "nsfw"]
  metrics: { ... }
  url: string
  selected: boolean
}>
```

**Example:**
```json
{
  "name": "nsfw_image_detection",
  "model_id": "Falconsai/nsfw_image_detection",
  "source": "Hugging Face",
  "task": "classification",
  "classes": ["normal", "nsfw"],
  "metrics": { "accuracy": 0.95 },
  "url": "https://huggingface.co/Falconsai/nsfw_image_detection",
  "selected": false
}
```

---

### 2. **Created Classes Fetcher Utility**
**File:** `lib/huggingface/fetchModelClasses.ts`

**Key Functions:**
- `fetchModelClasses(modelId)` - Fetch classes for a single model
- `fetchMultipleModelClasses(modelIds[])` - Fetch classes for multiple models in parallel

**How it works:**
1. Fetches `config.json` from Hugging Face
2. Extracts `id2label` mapping: `{"0": "normal", "1": "nsfw"}`
3. Converts to sorted array: `["normal", "nsfw"]`

**Example Usage:**
```typescript
const result = await fetchModelClasses("Falconsai/nsfw_image_detection")
// result.classes = ["normal", "nsfw"]
```

---

### 3. **Integrated into Save Recommendations API**
**File:** `app/api/save-recommendations/route.ts`

**Flow:**
1. Receive model recommendations from frontend
2. Filter Hugging Face models that have `model_id`
3. **Fetch classes in parallel** for all HF models
4. Attach classes to each model
5. Save to MongoDB with classes included

**Code:**
```typescript
// Fetch classes for HF models
const hfModelIds = models
  .filter(m => m.source === 'Hugging Face' && m.model_id)
  .map(m => m.model_id!)

const classesResults = await fetchMultipleModelClasses(hfModelIds)

// Add classes to models
const modelsWithClasses = models.map(model => ({
  ...model,
  classes: model.model_id && classesMap[model.model_id]
    ? classesMap[model.model_id]
    : undefined
}))
```

---

## 📊 Example Data Flow

### **User Query:** "detect inappropriate content"

### **Step 1: Model Search**
Returns models with `model_id`:
```json
{
  "name": "nsfw_image_detection",
  "model_id": "Falconsai/nsfw_image_detection",
  "source": "Hugging Face",
  "task": "classification"
}
```

### **Step 2: Save Recommendations**
Fetches classes and saves:
```json
{
  "recommendation_id": "uuid-modelrec-1760210000",
  "query_id": "uuid-query-123",
  "models": [
    {
      "name": "nsfw_image_detection",
      "model_id": "Falconsai/nsfw_image_detection",
      "source": "Hugging Face",
      "task": "classification",
      "classes": ["normal", "nsfw"],  ← Added!
      "url": "https://huggingface.co/Falconsai/nsfw_image_detection",
      "selected": false
    }
  ],
  "created_at": "2025-10-12T01:00:00Z"
}
```

### **Step 3: User Sees Classes**
Frontend can now display:
- "This model detects: normal, nsfw"
- "Expected outputs: 2 classes"

---

## 🎯 Benefits

### **For Users:**
✅ **Know what to expect** - See all possible outputs before using model  
✅ **Better model selection** - Choose models based on their classes  
✅ **Avoid surprises** - No unexpected labels in results

### **For Developers:**
✅ **Validation** - Verify inference results match expected classes  
✅ **UI Enhancement** - Display classes on model cards  
✅ **Analytics** - Track which classes are most common

---

## 🧪 Testing

### **Test with cURL:**
```bash
# Test single model classes fetch
curl -s "https://huggingface.co/Falconsai/nsfw_image_detection/raw/main/config.json" \
  | jq '.id2label'

# Expected output:
# {
#   "0": "normal",
#   "1": "nsfw"
# }
```

### **Test the API:**
```typescript
// In your code
import { fetchModelClasses } from '@/lib/huggingface/fetchModelClasses'

const result = await fetchModelClasses("Falconsai/nsfw_image_detection")
console.log(result.classes) // ["normal", "nsfw"]
```

---

## 📝 MongoDB Collections Updated

### **model_recommendations**
- Now includes `classes` array for each model
- Only Hugging Face models have classes (Roboflow models will be `undefined`)

### **Example Query:**
```javascript
db.model_recommendations.findOne({ query_id: "uuid-query-123" })
```

**Result:**
```json
{
  "_id": ObjectId("..."),
  "recommendation_id": "uuid-modelrec-1760210000",
  "query_id": "uuid-query-123",
  "models": [
    {
      "name": "nsfw_image_detection",
      "model_id": "Falconsai/nsfw_image_detection",
      "classes": ["normal", "nsfw"],
      ...
    }
  ],
  "created_at": "2025-10-12T01:00:00Z"
}
```

---

## 🔄 Future Enhancements

1. **Display classes in UI** - Show on model cards
2. **Class-based filtering** - Filter models by specific classes
3. **Class validation** - Verify inference results match expected classes
4. **Roboflow classes** - Fetch classes for Roboflow models too
5. **Class descriptions** - Add human-friendly descriptions for classes

---

## ✅ Summary

**Status:** ✅ **IMPLEMENTED & TESTED**

- ✅ Schema updated with `classes` field
- ✅ Utility created to fetch classes from HF
- ✅ API integrated to save classes with recommendations
- ✅ Tested with real model (nsfw_image_detection)
- ✅ No linter errors

**Example:**
- Model: `Falconsai/nsfw_image_detection`
- Classes: `["normal", "nsfw"]`
- Saved to MongoDB: ✅
- Ready for frontend display: ✅


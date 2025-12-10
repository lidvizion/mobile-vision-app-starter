# Gemini API Timeout Analysis

## Current Timeout Settings

### 1. CLIENT-SIDE (Frontend) - ⚠️ NO EXPLICIT TIMEOUT
**Location**: `hooks/useCVTask.ts` (line 162)
- **Current**: No timeout specified in fetch calls
- **Default**: Browser default timeout (typically **30 seconds**)
- **Issue**: If Gemini takes longer than 30s, browser will timeout

**Code**:
```typescript
response = await fetch('/api/run-inference', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({...})
  // ❌ NO TIMEOUT SET
})
```

### 2. NEXT.JS API ROUTE - `/api/gemini-inference`
**Location**: `app/api/gemini-inference/route.ts` (line 5)
- **Current**: `maxDuration = 60` seconds
- **Status**: ✅ Configured (60 seconds)

**Code**:
```typescript
export const maxDuration = 60  // 60 seconds
export const runtime = 'nodejs'
```

### 3. NEXT.JS API ROUTE - `/api/run-inference`
**Location**: `app/api/run-inference/route.ts` (line 8)
- **Current**: `maxDuration = 300` seconds (5 minutes)
- **Status**: ✅ Configured (300 seconds)

**Internal fetch timeouts**:
- Line 261: `AbortSignal.timeout(15000)` - 15 seconds for HF API calls
- Line 517: `AbortSignal.timeout(30000)` - 30 seconds for another call
- Line 417: Fetch to `/api/gemini-inference` - **NO TIMEOUT** ⚠️

### 4. AWS LAMBDA FUNCTION
**Location**: `lambda/deploy.sh` (lines 68, 80)
- **Current**: `--timeout 300` (300 seconds = 5 minutes)
- **Status**: ✅ Configured (300 seconds)

**Code**:
```bash
--timeout 300  # 5 minutes
```

### 5. AWS API GATEWAY
**Location**: Configured via AWS Console or deploy script
- **Current**: **30 seconds** (AWS default maximum)
- **Status**: ⚠️ **BOTTLENECK** - This is likely the issue!

**Note**: API Gateway REST API has a hard limit of 30 seconds maximum timeout.

## Timeout Flow Analysis

```
Browser (30s default) 
  ↓
Next.js /api/run-inference (300s maxDuration)
  ↓
  → Calls /api/gemini-inference (60s maxDuration) [NO TIMEOUT on fetch]
  → OR Calls Lambda via API Gateway (30s max) ⚠️ BOTTLENECK
    ↓
    Lambda Function (300s timeout)
```

## Identified Issues

### Issue 1: Client-Side No Timeout
- **Problem**: Browser will timeout at 30s, but Gemini might take 40-60s
- **Fix**: Add explicit timeout to fetch calls

### Issue 2: API Gateway 30s Limit
- **Problem**: API Gateway max timeout is 30s, but Lambda is set to 300s
- **Impact**: If using Lambda via API Gateway, requests will timeout at 30s
- **Fix**: Use Lambda Function URL instead of API Gateway, or use async job pattern

### Issue 3: No Timeout on Internal API Call
- **Problem**: `/api/run-inference` calls `/api/gemini-inference` without timeout
- **Fix**: Add timeout to internal fetch call

## Recommendations

1. **Add client-side timeout** (60-90 seconds for Gemini)
2. **Use async job pattern** when Lambda is configured (already implemented)
3. **Add timeout to internal API calls**
4. **Consider using Lambda Function URL** instead of API Gateway for longer timeouts


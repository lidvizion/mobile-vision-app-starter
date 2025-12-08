# AWS Amplify Production Troubleshooting Guide

## Issue: Lambda Integration Works Locally but Fails in Production

### Root Cause
The internal `fetch()` call from `/api/run-inference` to `/api/gemini-inference` doesn't work reliably in AWS Amplify's serverless environment. The request body was being lost during the internal API route call.

### Solution Applied
✅ **Eliminated internal fetch call** - `/api/run-inference` now directly calls Lambda when `GEMINI_LAMBDA_ENDPOINT` is configured
✅ **Extracted shared utilities** - Created `lib/geminiUtils.ts` for shared prompt generation
✅ **Added comprehensive logging** - Better debugging for production issues

### Changes Made

1. **Created `/lib/geminiUtils.ts`**
   - Shared `generatePrompt()` function
   - Used by both routes

2. **Updated `/app/api/run-inference/route.ts`**
   - Direct Lambda call when `GEMINI_LAMBDA_ENDPOINT` is set
   - No intermediate fetch to `/api/gemini-inference`
   - Fallback to internal route only when Lambda not configured

3. **Updated `/app/api/gemini-inference/route.ts`**
   - Uses shared `generatePrompt()` from utils
   - Still available as fallback for local development

### Amplify Configuration Checklist

#### 1. Environment Variables in Amplify Console
Go to **App Settings → Environment Variables** and verify:

```
GEMINI_LAMBDA_ENDPOINT=https://kgbpeji4q2nnabzmwzbljj4kby0qvncc.lambda-url.us-east-1.on.aws/
GEMINI_API_KEY=your_gemini_api_key_here
```

**Important**: 
- ✅ Set in Amplify Console (not just `.env.local`)
- ✅ No trailing slash on Lambda URL (remove if present)
- ✅ Variables are available at build time AND runtime

#### 2. Verify Environment Variable Access
The `next.config.js` has:
```javascript
env: {
  GEMINI_LAMBDA_ENDPOINT: process.env.GEMINI_LAMBDA_ENDPOINT,
  // ...
}
```

However, for **server-side API routes**, you should use `process.env` directly (which we do). The `env` object in `next.config.js` is for client-side variables.

#### 3. Check Lambda Function URL Configuration
Your Lambda Function URL should:
- ✅ Allow CORS from your Amplify domain
- ✅ Accept POST requests
- ✅ Have proper timeout (300s recommended)
- ✅ Have sufficient memory (1GB recommended)

### Debugging Steps

#### 1. Check Amplify Build Logs
Look for these log messages during deployment:
```
✅ Using Lambda endpoint directly (bypassing internal fetch)
📤 Sending to Lambda
```

#### 2. Check Lambda CloudWatch Logs
After deployment, check Lambda logs for:
```
=== Gemini Inference Lambda Started ===
Request params: { model: 'gemini-3-pro-preview', promptLength: 517, hasImage: true }
```

**If you see `promptLength: undefined` or `hasImage: false`:**
- Environment variable not set in Amplify
- Request body not reaching Lambda

#### 3. Test Lambda Directly
```bash
curl -X POST https://kgbpeji4q2nnabzmwzbljj4kby0qvncc.lambda-url.us-east-1.on.aws/ \
  -H "Content-Type: application/json" \
  -d '{
    "image": "data:image/jpeg;base64,/9j/4AAQ...",
    "prompt": "Analyze this image...",
    "model": "gemini-3-pro-preview",
    "task": "object-detection"
  }'
```

#### 4. Check Next.js API Route Logs
In Amplify, check the serverless function logs for `/api/run-inference`:
- Should see: `✅ Using Lambda endpoint directly`
- Should see: `📤 Sending to Lambda` with `promptLength: 517`
- Should see: `✅ Lambda response received`

### Common Issues

#### Issue: "Prompt is required" from Lambda
**Cause**: `GEMINI_LAMBDA_ENDPOINT` not set in Amplify
**Fix**: Set environment variable in Amplify Console

#### Issue: Lambda receives empty body
**Cause**: Internal fetch call failing (old code)
**Fix**: ✅ Already fixed - direct Lambda call now

#### Issue: Environment variable not available
**Cause**: Variable set only in `.env.local` (not in Amplify)
**Fix**: Set in Amplify Console → App Settings → Environment Variables

#### Issue: CORS errors
**Cause**: Lambda Function URL CORS not configured
**Fix**: Update Lambda CORS settings to allow your Amplify domain

### Verification After Deployment

1. **Deploy latest code** (commit 411c855 or later)
2. **Verify environment variables** in Amplify Console
3. **Test image upload** in production
4. **Check CloudWatch logs** for Lambda
5. **Check Amplify logs** for Next.js API routes

### Expected Flow (After Fix)

```
Frontend → /api/run-inference
  ↓
Check: Is GEMINI_LAMBDA_ENDPOINT set?
  ↓ YES
Generate prompt using generatePrompt()
  ↓
Direct fetch to Lambda (no internal API call)
  ↓
Lambda processes request
  ↓
Return results to frontend
```

### Key Differences: Local vs Production

| Aspect | Local | Production (Amplify) |
|--------|-------|---------------------|
| Internal fetch | ✅ Works | ❌ Fails (body lost) |
| Direct Lambda call | ✅ Works | ✅ Works (fixed) |
| Environment vars | `.env.local` | Amplify Console |
| Logging | Terminal | CloudWatch + Amplify |

### Next Steps

1. ✅ Code changes committed
2. ⏳ Deploy to Amplify
3. ⏳ Verify `GEMINI_LAMBDA_ENDPOINT` in Amplify Console
4. ⏳ Test image upload
5. ⏳ Check logs for success indicators

### Support

If issues persist after these changes:
1. Check Amplify build logs for errors
2. Verify Lambda Function URL is accessible
3. Test Lambda directly with curl
4. Check CloudWatch logs for detailed error messages
5. Verify environment variables are set correctly in Amplify Console


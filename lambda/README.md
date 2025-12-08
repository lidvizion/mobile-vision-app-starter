# Gemini Inference Lambda Function

Standalone AWS Lambda function for Gemini inference, separate from the Amplify SSR app.

## Requirements

- AWS CLI configured with appropriate credentials
- Node.js 20.x (for local testing)
- GEMINI_API_KEY environment variable set

## Quick Deployment

The easiest way to deploy is using the provided script:

```bash
cd lambda
export GEMINI_API_KEY=your_api_key_here
./deploy.sh
```

## Manual Deployment (AWS CLI Commands)

If you prefer to run commands manually, follow these steps:

### 1. Create IAM Role

```bash
# Create role
aws iam create-role \
  --role-name gemini-inference-lambda-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }' \
  --region us-east-1

# Attach CloudWatch logs policy
aws iam attach-role-policy \
  --role-name gemini-inference-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole \
  --region us-east-1

# Get role ARN (save this for next step)
ROLE_ARN=$(aws iam get-role \
  --role-name gemini-inference-lambda-role \
  --query 'Role.Arn' \
  --output text \
  --region us-east-1)
```

### 2. Package Lambda Function

```bash
cd lambda/gemini-inference
npm install --production
zip -r ../function.zip . -x "*.git*" "*.DS_Store*"
cd ../..
```

### 3. Create Lambda Function

```bash
aws lambda create-function \
  --function-name gemini-inference-api \
  --runtime nodejs20.x \
  --role $ROLE_ARN \
  --handler index.handler \
  --zip-file fileb://lambda/function.zip \
  --timeout 300 \
  --memory-size 1024 \
  --environment Variables="{GEMINI_API_KEY=$GEMINI_API_KEY}" \
  --region us-east-1

# Get function ARN (save this for API Gateway)
FUNCTION_ARN=$(aws lambda get-function \
  --function-name gemini-inference-api \
  --region us-east-1 \
  --query 'Configuration.FunctionArn' \
  --output text)
```

### 4. Create API Gateway REST API

```bash
# Create API
API_ID=$(aws apigateway create-rest-api \
  --name gemini-inference-api \
  --description "API Gateway for Gemini inference Lambda" \
  --region us-east-1 \
  --query 'id' \
  --output text)

# Get root resource ID
ROOT_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id $API_ID \
  --region us-east-1 \
  --query 'items[?path==`/`].id' \
  --output text)

# Create /inference resource
INFERENCE_RESOURCE_ID=$(aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $ROOT_RESOURCE_ID \
  --path-part "inference" \
  --region us-east-1 \
  --query 'id' \
  --output text)
```

### 5. Configure POST Method

```bash
# Create POST method
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $INFERENCE_RESOURCE_ID \
  --http-method POST \
  --authorization-type NONE \
  --region us-east-1

# Set up integration (AWS_PROXY)
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $INFERENCE_RESOURCE_ID \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/$FUNCTION_ARN/invocations" \
  --region us-east-1
```

### 6. Configure OPTIONS Method for CORS

```bash
# Create OPTIONS method
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $INFERENCE_RESOURCE_ID \
  --http-method OPTIONS \
  --authorization-type NONE \
  --region us-east-1

# Set up MOCK integration
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $INFERENCE_RESOURCE_ID \
  --http-method OPTIONS \
  --type MOCK \
  --request-templates '{"application/json":"{\"statusCode\":200}"}' \
  --region us-east-1

# Set up method response
aws apigateway put-method-response \
  --rest-api-id $API_ID \
  --resource-id $INFERENCE_RESOURCE_ID \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters "method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Origin=false" \
  --region us-east-1

# Set up integration response
aws apigateway put-integration-response \
  --rest-api-id $API_ID \
  --resource-id $INFERENCE_RESOURCE_ID \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'POST,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'https://cv.lidvizion.ai'"'"'"}' \
  --region us-east-1
```

### 7. Grant API Gateway Permission

```bash
aws lambda add-permission \
  --function-name gemini-inference-api \
  --statement-id apigateway-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:us-east-1:*:$API_ID/*/*" \
  --region us-east-1
```

### 8. Deploy to Production

```bash
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name prod \
  --region us-east-1
```

### 9. Get Endpoint URL

```bash
echo "https://$API_ID.execute-api.us-east-1.amazonaws.com/prod/inference"
```

## Update Environment Variable

After deployment, update your `.env.local` file:

```bash
GEMINI_LAMBDA_ENDPOINT=https://xxx.execute-api.us-east-1.amazonaws.com/prod/inference
```

## Updating the Function

To update the Lambda function code:

```bash
cd lambda/gemini-inference
npm install --production
zip -r ../function.zip . -x "*.git*" "*.DS_Store*"
cd ../..

aws lambda update-function-code \
  --function-name gemini-inference-api \
  --zip-file fileb://lambda/function.zip \
  --region us-east-1
```

## Testing

Test the Lambda function directly:

```bash
aws lambda invoke \
  --function-name gemini-inference-api \
  --payload '{"httpMethod":"POST","body":"{\"image\":\"data:image/jpeg;base64,/9j/4AAQ...\",\"prompt\":\"\",\"model\":\"gemini-3-pro-preview\"}"}' \
  --region us-east-1 \
  response.json

cat response.json
```

Test via API Gateway:

```bash
curl -X POST https://$API_ID.execute-api.us-east-1.amazonaws.com/prod/inference \
  -H "Content-Type: application/json" \
  -d '{
    "image": "data:image/jpeg;base64,/9j/4AAQ...",
    "prompt": "",
    "model": "gemini-3-pro-preview"
  }'
```

## Output

After successful deployment, you'll receive:

- **Lambda Function ARN**: `arn:aws:lambda:us-east-1:ACCOUNT_ID:function:gemini-inference-api`
- **API Gateway Endpoint**: `https://xxx.execute-api.us-east-1.amazonaws.com/prod/inference`


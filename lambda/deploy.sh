#!/bin/bash

# AWS Lambda deployment script for Gemini inference
# This script creates the Lambda function, API Gateway, and configures CORS
# Region: us-east-1

set -e

REGION="us-east-1"
FUNCTION_NAME="gemini-inference-api"
ROLE_NAME="gemini-inference-lambda-role"
API_NAME="gemini-inference-api"
STAGE="prod"

echo "🚀 Starting deployment of Gemini inference Lambda function..."

# Step 1: Create IAM role for Lambda
echo "📋 Step 1: Creating IAM role..."
ROLE_ARN=$(aws iam create-role \
  --role-name $ROLE_NAME \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }]
  }' \
  --query 'Role.Arn' \
  --output text \
  --region $REGION 2>/dev/null || \
  aws iam get-role \
    --role-name $ROLE_NAME \
    --query 'Role.Arn' \
    --output text \
    --region $REGION)

echo "✅ IAM Role ARN: $ROLE_ARN"

# Attach basic Lambda execution policy (CloudWatch logs)
echo "📋 Attaching CloudWatch logs policy..."
aws iam attach-role-policy \
  --role-name $ROLE_NAME \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole \
  --region $REGION 2>/dev/null || echo "Policy already attached"

# Wait for role to be ready
echo "⏳ Waiting for IAM role to be ready..."
sleep 5

# Step 2: Package Lambda function
echo "📦 Step 2: Packaging Lambda function..."
cd gemini-inference
npm install --production
zip -r ../function.zip . -x "*.git*" "*.DS_Store*"
cd ..

# Step 3: Create or update Lambda function
echo "🔧 Step 3: Creating/updating Lambda function..."
FUNCTION_ARN=$(aws lambda create-function \
  --function-name $FUNCTION_NAME \
  --runtime nodejs20.x \
  --role $ROLE_ARN \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --timeout 300 \
  --memory-size 1024 \
  --environment Variables="{GEMINI_API_KEY=$GEMINI_API_KEY}" \
  --region $REGION \
  --query 'FunctionArn' \
  --output text 2>/dev/null || \
  aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://function.zip \
    --region $REGION > /dev/null && \
  aws lambda update-function-configuration \
    --function-name $FUNCTION_NAME \
    --timeout 300 \
    --memory-size 1024 \
    --environment Variables="{GEMINI_API_KEY=$GEMINI_API_KEY}" \
    --region $REGION > /dev/null && \
  aws lambda get-function \
    --function-name $FUNCTION_NAME \
    --region $REGION \
    --query 'Configuration.FunctionArn' \
    --output text)

echo "✅ Lambda Function ARN: $FUNCTION_ARN"

# Step 4: Create API Gateway REST API
echo "🌐 Step 4: Creating API Gateway..."
API_ID=$(aws apigateway create-rest-api \
  --name $API_NAME \
  --description "API Gateway for Gemini inference Lambda" \
  --region $REGION \
  --query 'id' \
  --output text 2>/dev/null || \
  aws apigateway get-rest-apis \
    --region $REGION \
    --query "items[?name=='$API_NAME'].id" \
    --output text | head -1)

if [ -z "$API_ID" ]; then
  echo "❌ Failed to create or find API Gateway"
  exit 1
fi

echo "✅ API Gateway ID: $API_ID"

# Get root resource ID
ROOT_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id $API_ID \
  --region $REGION \
  --query 'items[?path==`/`].id' \
  --output text)

# Create /inference resource
echo "📋 Creating /inference resource..."
INFERENCE_RESOURCE_ID=$(aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $ROOT_RESOURCE_ID \
  --path-part "inference" \
  --region $REGION \
  --query 'id' \
  --output text 2>/dev/null || \
  aws apigateway get-resources \
    --rest-api-id $API_ID \
    --region $REGION \
    --query "items[?path=='/inference'].id" \
    --output text)

echo "✅ Inference Resource ID: $INFERENCE_RESOURCE_ID"

# Create POST method
echo "📋 Creating POST method..."
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $INFERENCE_RESOURCE_ID \
  --http-method POST \
  --authorization-type NONE \
  --region $REGION 2>/dev/null || echo "POST method already exists"

# Create OPTIONS method for CORS
echo "📋 Creating OPTIONS method for CORS..."
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $INFERENCE_RESOURCE_ID \
  --http-method OPTIONS \
  --authorization-type NONE \
  --region $REGION 2>/dev/null || echo "OPTIONS method already exists"

# Set up POST method integration (AWS_PROXY)
echo "📋 Setting up POST method integration..."
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $INFERENCE_RESOURCE_ID \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$FUNCTION_ARN/invocations" \
  --region $REGION 2>/dev/null || echo "POST integration already exists"

# Set up OPTIONS method integration (MOCK for CORS)
echo "📋 Setting up OPTIONS method integration..."
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $INFERENCE_RESOURCE_ID \
  --http-method OPTIONS \
  --type MOCK \
  --request-templates '{"application/json":"{\"statusCode\":200}"}' \
  --region $REGION 2>/dev/null || echo "OPTIONS integration already exists"

# Set up OPTIONS method response
echo "📋 Setting up OPTIONS method response..."
aws apigateway put-method-response \
  --rest-api-id $API_ID \
  --resource-id $INFERENCE_RESOURCE_ID \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters "method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Origin=false" \
  --region $REGION 2>/dev/null || echo "OPTIONS method response already exists"

# Set up OPTIONS integration response
echo "📋 Setting up OPTIONS integration response..."
aws apigateway put-integration-response \
  --rest-api-id $API_ID \
  --resource-id $INFERENCE_RESOURCE_ID \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'POST,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'https://cv.lidvizion.ai'"'"'"}' \
  --region $REGION 2>/dev/null || echo "OPTIONS integration response already exists"

# Grant API Gateway permission to invoke Lambda
echo "📋 Granting API Gateway permission to invoke Lambda..."
aws lambda add-permission \
  --function-name $FUNCTION_NAME \
  --statement-id apigateway-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:$REGION:*:$API_ID/*/*" \
  --region $REGION 2>/dev/null || echo "Permission already exists"

# Deploy API to prod stage
echo "🚀 Step 5: Deploying API to $STAGE stage..."
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name $STAGE \
  --region $REGION 2>/dev/null || \
  aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name $STAGE \
    --region $REGION

# Get API endpoint URL
API_ENDPOINT="https://$API_ID.execute-api.$REGION.amazonaws.com/$STAGE/inference"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Deployment Summary:"
echo "  Lambda Function ARN: $FUNCTION_ARN"
echo "  API Gateway Endpoint: $API_ENDPOINT"
echo ""
echo "🔧 To update the function code in the future, run:"
echo "  cd lambda/gemini-inference && npm install --production && zip -r ../../function.zip ."
echo "  aws lambda update-function-code --function-name $FUNCTION_NAME --zip-file fileb://function.zip --region $REGION"
echo ""

# Clean up
rm -f function.zip


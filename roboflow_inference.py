#!/usr/bin/env python3
"""
Roboflow Inference Script
Supports both serverless.roboflow.com and detect.roboflow.com endpoints
"""

import sys
import json
import base64
import requests
import warnings
import re

# Suppress warnings and verbose output
warnings.filterwarnings('ignore')

def run_inference(model_url, api_key, image_base64, parameters=None):
    """
    Run inference using Roboflow API (serverless or detect endpoint)
    """
    try:
        # Parse the model URL to determine endpoint type
        if 'serverless.roboflow.com' in model_url:
            # Serverless endpoint format: https://serverless.roboflow.com/project-name/version
            # Extract project and version from URL
            url_clean = model_url.split('?')[0]  # Remove query params if any
            url_parts = url_clean.replace('https://serverless.roboflow.com/', '').split('/')
            
            if len(url_parts) >= 2:
                model_name = url_parts[0]
                version = url_parts[1]
            else:
                return {
                    'success': False,
                    'error': 'Invalid serverless URL format. Expected: https://serverless.roboflow.com/project-name/version',
                    'model_id': 'unknown'
                }
            
            api_endpoint = f"https://serverless.roboflow.com/{model_name}/{version}"
            use_serverless = True
            
        elif 'detect.roboflow.com' in model_url:
            # Detect endpoint format: https://detect.roboflow.com/project-name/version
            if '?model=' in model_url:
                # Template format: https://detect.roboflow.com/?model=name&version=1
                model_match = re.search(r'model=([^&]+)', model_url)
                version_match = re.search(r'version=([^&]+)', model_url)
                
                if model_match and version_match:
                    model_name = model_match.group(1)
                    version = version_match.group(1)
                else:
                    return {
                        'success': False,
                        'error': 'Could not extract model name and version from URL',
                        'model_id': 'unknown'
                    }
            else:
                # Direct format: https://detect.roboflow.com/project_id/version
                url_parts = model_url.replace('https://detect.roboflow.com/', '').split('/')
                if len(url_parts) >= 2:
                    model_name = url_parts[0]
                    version = url_parts[1]
                else:
                    return {
                        'success': False,
                        'error': 'Invalid detect URL format',
                        'model_id': 'unknown'
                    }
            
            api_endpoint = f"https://detect.roboflow.com/{model_name}/{version}"
            use_serverless = False
            
        else:
            return {
                'success': False,
                'error': 'Please provide a serverless.roboflow.com or detect.roboflow.com URL',
                'model_id': 'unknown'
            }
        
        # Decode base64 image
        if image_base64.startswith('data:'):
            # Remove data URL prefix
            image_base64 = image_base64.split(',')[1]
        
        # Prepare query parameters
        query_params = {
            'api_key': api_key
        }
        
        # Add optional parameters for both endpoint types
        if parameters:
            if 'confidence' in parameters:
                query_params['confidence'] = parameters['confidence']
            if 'overlap' in parameters:
                query_params['overlap'] = parameters['overlap']
            if 'max_detections' in parameters:
                query_params['max_detections'] = parameters['max_detections']
        
        # Make the API request based on endpoint type
        if use_serverless:
            # Serverless endpoint expects raw base64 data with specific headers
            # Confidence and other parameters are passed in query params
            response = requests.post(
                api_endpoint,
                params=query_params,
                data=image_base64,
                headers={
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout=30
            )
        else:
            # Detect endpoint expects multipart form data
            response = requests.post(
                api_endpoint,
                params=query_params,
                files={'file': ('image.jpg', base64.b64decode(image_base64), 'image/jpeg')},
                timeout=30
            )
        
        if response.status_code != 200:
            return {
                'success': False,
                'error': f'API request failed with status {response.status_code}: {response.text}',
                'model_id': f'{model_name}/{version}'
            }
        
        # Parse the response
        result = response.json()
        
        # Convert to our expected format
        predictions = []
        
        # Handle classification models (different response format)
        # Classification can return:
        # 1. {"top": "class_name", "confidence": 0.95} - simple format
        # 2. {"predictions": {"Class1": {"confidence": 0.5, "class_id": 0}, ...}} - dict format
        # 3. {"predictions": [{"class": "...", "confidence": ...}, ...]} - array format
        # 4. List format: [{"class": "...", "confidence": ...}, ...]
        
        if 'top' in result:
            # Simple classification format: {"top": "class_name", "confidence": 0.95}
            predictions.append({
                'class': result.get('top', 'unknown'),
                'confidence': result.get('confidence', 0.0),
                'score': result.get('confidence', 0.0)
            })
        elif 'predictions' in result:
            # Check if predictions is a dictionary (classification format)
            if isinstance(result['predictions'], dict):
                # Classification format: {"predictions": {"Class1": {"confidence": 0.5, "class_id": 0}, ...}}
                # Convert dictionary to array, sorted by confidence (descending)
                pred_dict = result['predictions']
                pred_list = [
                    {
                        'class': class_name,
                        'confidence': pred_data.get('confidence', 0.0),
                        'score': pred_data.get('confidence', 0.0),
                        'class_id': pred_data.get('class_id')
                    }
                    for class_name, pred_data in pred_dict.items()
                    if isinstance(pred_data, dict)
                ]
                # Sort by confidence descending
                pred_list.sort(key=lambda x: x['confidence'], reverse=True)
                predictions.extend(pred_list)
            elif isinstance(result['predictions'], list):
                # Check if it's classification format (no spatial data) or detection format
                if len(result['predictions']) > 0:
                    first_pred = result['predictions'][0]
                    # Classification: has 'top' or no spatial data (no 'x', 'bbox', etc.)
                    if isinstance(first_pred, dict) and ('top' in first_pred or ('class' in first_pred and 'x' not in first_pred and 'bbox' not in first_pred)):
                        for pred in result['predictions']:
                            if isinstance(pred, dict):
                                predictions.append({
                                    'class': pred.get('top', pred.get('class', 'unknown')),
                                    'confidence': pred.get('confidence', 0.0),
                                    'score': pred.get('confidence', 0.0)
                                })
                    else:
                        # Detection/segmentation format - handled below
                        pass
        elif isinstance(result, list):
            # List format: [{"class": "...", "confidence": ...}, ...]
            for pred in result:
                if isinstance(pred, dict):
                    predictions.append({
                        'class': pred.get('class', pred.get('top', 'unknown')),
                        'confidence': pred.get('confidence', pred.get('score', 0.0)),
                        'score': pred.get('confidence', pred.get('score', 0.0))
                    })
        elif 'class' in result:
            # Fallback for other classification-like data
            predictions.append({
                'class': result.get('class', 'unknown'),
                'confidence': result.get('confidence', 0.0),
                'score': result.get('confidence', 0.0)
            })
        
        # Handle detection/segmentation models (standard format with predictions array)
        if 'predictions' in result and isinstance(result['predictions'], list) and len(predictions) == 0:
            for pred in result['predictions']:
                # Ensure pred is a dictionary, not a string
                if not isinstance(pred, dict):
                    continue
                    
                # Roboflow returns center coordinates, convert to top-left
                center_x = pred.get('x', 0)
                center_y = pred.get('y', 0)
                width = pred.get('width', 0)
                height = pred.get('height', 0)
                
                # Calculate top-left coordinates (bounding box)
                x = center_x - (width / 2)
                y = center_y - (height / 2)
                
                pred_data = {
                    'class': pred.get('class', 'unknown'),
                    'confidence': pred.get('confidence', 0.0),
                    'bbox': {
                        'x': x,
                        'y': y,
                        'width': width,
                        'height': height,
                        'center_x': center_x,  # Keep original center coords too
                        'center_y': center_y
                    }
                }
                
                # Include additional fields if present (for segmentation models)
                if 'points' in pred:
                    pred_data['points'] = pred['points']  # Polygon points for segmentation
                if 'mask' in pred:
                    pred_data['mask'] = pred['mask']  # Binary mask data
                if 'class_id' in pred:
                    pred_data['class_id'] = pred['class_id']  # Numeric class ID
                if 'detection_id' in pred:
                    pred_data['detection_id'] = pred['detection_id']  # Unique detection ID
                
                # Include keypoints if present (for keypoint detection models)
                if 'keypoints' in pred and isinstance(pred['keypoints'], list):
                    pred_data['keypoints'] = pred['keypoints']  # Keypoints array
                    # Also keep original bbox format (x, y, width, height) as Roboflow returns
                    pred_data['x'] = center_x
                    pred_data['y'] = center_y
                    pred_data['width'] = width
                    pred_data['height'] = height
                    # NOTE: Roboflow does NOT provide skeleton connection data in the API response
                    # Skeleton connections are manually defined in project settings but are only used
                    # for visualization in Roboflow's UI, not returned via API
                
                predictions.append(pred_data)
        
        return {
            'success': True,
            'predictions': predictions,
            'model_id': f'{model_name}/{version}',
            'endpoint_type': 'serverless' if use_serverless else 'detect'
        }
                
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'model_id': f'{model_name}/{version}' if 'model_name' in locals() and 'version' in locals() else 'unknown'
        }

def main():
    try:
        if len(sys.argv) < 3:
            print(json.dumps({
                'success': False,
                'error': 'Usage: python roboflow_inference.py <model_url> <api_key> [parameters_json] < image_base64 (via stdin)'
            }), flush=True)
            sys.exit(1)
        
        model_url = sys.argv[1]
        api_key = sys.argv[2]
        
        # Parse parameters if provided, handle JSON errors gracefully
        parameters = None
        if len(sys.argv) > 3:
            try:
                parameters = json.loads(sys.argv[3]) if sys.argv[3].strip() else None
            except (json.JSONDecodeError, ValueError) as e:
                # If JSON parsing fails, use None (empty parameters)
                parameters = None
        
        # Read image data from stdin to avoid command line argument size limits
        image_base64 = sys.stdin.read()
        
        if not image_base64 or not image_base64.strip():
            print(json.dumps({
                'success': False,
                'error': 'No image data provided via stdin'
            }), flush=True)
            sys.exit(1)
        
        result = run_inference(model_url, api_key, image_base64, parameters)
        print(json.dumps(result), flush=True)
        sys.stdout.flush()
        
    except Exception as e:
        import traceback
        error_result = {
            'success': False,
            'error': str(e),
            'error_trace': traceback.format_exc()
        }
        print(json.dumps(error_result), flush=True)
        sys.stdout.flush()
        sys.exit(1)

if __name__ == '__main__':
    main()
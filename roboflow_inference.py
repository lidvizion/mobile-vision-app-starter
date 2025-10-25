#!/usr/bin/env python3
"""
Roboflow Inference Script
Uses the official Roboflow Python SDK with serverless endpoint
"""

import sys
import json
import base64
import tempfile
import os
import warnings
from roboflow import Roboflow

# Suppress warnings and verbose output
warnings.filterwarnings('ignore')

def run_inference(model_url, api_key, image_base64, parameters=None):
    """
    Run inference using Roboflow Python SDK
    """
    try:
        # Initialize Roboflow client
        rf = Roboflow(api_key=api_key)
        
        # Extract model ID from URL
        # Format: https://serverless.roboflow.com/project-name/version
        # or: https://universe.roboflow.com/username/project-name/model/version
        # or: https://detect.roboflow.com/project-name/version
        if 'universe.roboflow.com' in model_url:
            # Convert universe URL to model ID
            url_parts = model_url.split('/')
            model_index = url_parts.index('model')
            project_name = url_parts[model_index - 1]
            version = url_parts[model_index + 1]
            model_id = f"{project_name}/{version}"
        elif 'serverless.roboflow.com' in model_url:
            # Extract from serverless URL
            url_parts = model_url.replace('https://serverless.roboflow.com/', '').split('/')
            model_id = f"{url_parts[0]}/{url_parts[1]}"
        elif 'detect.roboflow.com' in model_url:
            # Extract from detect URL
            url_parts = model_url.replace('https://detect.roboflow.com/', '').split('/')
            model_id = f"{url_parts[0]}/{url_parts[1]}"
        else:
            # Assume it's already a model ID
            model_id = model_url
        
        # Decode base64 image
        if image_base64.startswith('data:'):
            # Remove data URL prefix
            image_base64 = image_base64.split(',')[1]
        
        image_data = base64.b64decode(image_base64)
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as temp_file:
            temp_file.write(image_data)
            temp_path = temp_file.name
        
        try:
            # Load model and run inference
            workspace = rf.workspace()
            project = workspace.project(model_id.split('/')[0])
            version = project.version(int(model_id.split('/')[1]))
            model = version.model
            
            # Prepare parameters (only use supported ones)
            # Use sensible defaults if no parameters provided
            inference_params = {
                'confidence': 0.3,  # Lower confidence to catch more detections
                'overlap': 0.3      # Standard overlap threshold
            }
            
            if parameters:
                if 'confidence' in parameters:
                    inference_params['confidence'] = parameters['confidence']
                if 'overlap' in parameters:
                    inference_params['overlap'] = parameters['overlap']
                # Note: max_detections is not supported by Roboflow SDK
            
            # Run inference
            result = model.predict(temp_path, **inference_params)
            
            # Convert to JSON-serializable format
            predictions = []
            for prediction in result:
                # Access prediction data directly from the JSON representation
                pred_json = prediction.json()
                
                # Convert Roboflow center coordinates to top-left coordinates
                center_x = pred_json.get('x', 0)
                center_y = pred_json.get('y', 0)
                width = pred_json.get('width', 0)
                height = pred_json.get('height', 0)
                
                # Calculate top-left coordinates
                x = center_x - (width / 2)
                y = center_y - (height / 2)
                
                pred_data = {
                    'class': pred_json.get('class', 'unknown'),
                    'confidence': pred_json.get('confidence', 0.0),
                    'bbox': {
                        'x': x,
                        'y': y,
                        'width': width,
                        'height': height
                    }
                }
                predictions.append(pred_data)
            
            return {
                'success': True,
                'predictions': predictions,
                'model_id': model_id
            }
            
        finally:
            # Clean up temporary file
            if os.path.exists(temp_path):
                os.unlink(temp_path)
                
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'model_id': model_id if 'model_id' in locals() else 'unknown'
        }

def main():
    if len(sys.argv) < 4:
        print(json.dumps({
            'success': False,
            'error': 'Usage: python roboflow_inference.py <model_url> <api_key> <image_base64> [parameters_json]'
        }))
        sys.exit(1)
    
    model_url = sys.argv[1]
    api_key = sys.argv[2]
    image_base64 = sys.argv[3]
    parameters = json.loads(sys.argv[4]) if len(sys.argv) > 4 else None
    
    result = run_inference(model_url, api_key, image_base64, parameters)
    print(json.dumps(result))

if __name__ == '__main__':
    main()

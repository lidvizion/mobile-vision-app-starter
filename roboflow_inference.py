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
    Run inference using Roboflow SDK with proper model identification
    """
    try:
        # Initialize Roboflow client
        rf = Roboflow(api_key=api_key)
        
        # Extract model information from the URL
        # Handle different URL formats from the search agent
        if 'detect.roboflow.com' in model_url:
            # Extract model and version from detect URL
            if '?model=' in model_url:
                # Template format: https://detect.roboflow.com/?model=name&version=1&api_key=
                import re
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
                # Direct format: https://detect.roboflow.com/project_id/model_id
                url_parts = model_url.replace('https://detect.roboflow.com/', '').split('/')
                if len(url_parts) >= 2:
                    # For direct URLs, we need to use the workspace approach
                    # This is more complex and might not work with all models
                    return {
                        'success': False,
                        'error': 'Direct detect URLs require workspace access. Please use template URLs.',
                        'model_id': 'unknown'
                    }
                else:
                    return {
                        'success': False,
                        'error': 'Invalid detect URL format',
                        'model_id': 'unknown'
                    }
        else:
            return {
                'success': False,
                'error': 'Please provide a detect.roboflow.com URL',
                'model_id': 'unknown'
            }
        
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
            # Use the Roboflow SDK to load the model
            # For public models, we need to use the workspace approach
            workspace = rf.workspace()
            
            # Try to find the project by name
            # Note: This might not work for all models as they might be in private workspaces
            try:
                project = workspace.project(model_name)
                model_version = project.version(int(version))
                model = model_version.model
            except Exception as e:
                # If workspace approach fails, try using the model directly
                # This is a fallback approach
                return {
                    'success': False,
                    'error': f'Could not access model {model_name} version {version}. Model might be private or require different authentication. Error: {str(e)}',
                    'model_id': f'{model_name}/{version}'
                }
            
            # Prepare parameters
            inference_params = {
                'confidence': 0.3,
                'overlap': 0.3
            }
            
            if parameters:
                if 'confidence' in parameters:
                    inference_params['confidence'] = parameters['confidence']
                if 'overlap' in parameters:
                    inference_params['overlap'] = parameters['overlap']
            
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
                'model_id': f'{model_name}/{version}'
            }
            
        finally:
            # Clean up temporary file
            if os.path.exists(temp_path):
                os.unlink(temp_path)
                
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'model_id': f'{model_name}/{version}' if 'model_name' in locals() and 'version' in locals() else 'unknown'
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

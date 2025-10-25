#!/usr/bin/env python3
"""
Roboflow Universe Search Agent using Gemini 2.5 Computer Use
Following the official documentation: https://ai.google.dev/gemini-api/docs/computer-use
"""

import os
import json
import time
from typing import Any, List, Dict
from playwright.sync_api import sync_playwright
import google.genai as genai
from google.genai import types

# Configure Gemini API
api_key = os.getenv('GEMINI_API_KEY')
if not api_key:
    print("❌ GEMINI_API_KEY environment variable is required")
    exit(1)

# Constants for screen dimensions
SCREEN_WIDTH = 1440
SCREEN_HEIGHT = 900

def denormalize_x(x: int, screen_width: int) -> int:
    """Convert normalized x coordinate (0-1000) to actual pixel coordinate."""
    return int(x / 1000 * screen_width)

def denormalize_y(y: int, screen_height: int) -> int:
    """Convert normalized y coordinate (0-1000) to actual pixel coordinate."""
    return int(y / 1000 * screen_height)

def execute_function_calls(candidate, page, screen_width, screen_height):
    """Execute function calls from Gemini Computer Use response."""
    results = []
    function_calls = []
    
    for part in candidate.content.parts:
        if part.function_call:
            function_calls.append(part.function_call)

    for function_call in function_calls:
        action_result = {}
        fname = function_call.name
        args = function_call.args
        print(f"  -> Executing: {fname}")

        try:
            if fname == "open_web_browser":
                pass  # Already open
            elif fname == "click_at":
                actual_x = denormalize_x(args["x"], screen_width)
                actual_y = denormalize_y(args["y"], screen_height)
                page.mouse.click(actual_x, actual_y)
            elif fname == "type_text_at":
                actual_x = denormalize_x(args["x"], screen_width)
                actual_y = denormalize_y(args["y"], screen_height)
                text = args["text"]
                press_enter = args.get("press_enter", False)

                page.mouse.click(actual_x, actual_y)
                # Simple clear (Command+A, Backspace for Mac)
                page.keyboard.press("Meta+A")
                page.keyboard.press("Backspace")
                page.keyboard.type(text)
                if press_enter:
                    page.keyboard.press("Enter")
            elif fname == "navigate":
                page.goto(args["url"], wait_until="networkidle")
            elif fname == "scroll_document":
                direction = args.get("direction", "down")
                delta_y = 500 if direction == "down" else -500
                page.mouse.wheel(0, delta_y)
            elif fname == "wait_5_seconds":
                time.sleep(5)
            elif fname == "go_back":
                page.go_back()
            elif fname == "go_forward":
                page.go_forward()
            elif fname == "search":
                page.goto("https://www.google.com", wait_until="networkidle")
            elif fname == "hover_at":
                actual_x = denormalize_x(args["x"], screen_width)
                actual_y = denormalize_y(args["y"], screen_height)
                page.mouse.move(actual_x, actual_y)
            elif fname == "scroll_document":
                direction = args.get("direction", "down")
                delta_y = 500 if direction == "down" else -500
                page.mouse.wheel(0, delta_y)
            else:
                print(f"Warning: Unimplemented or custom function {fname}")

            # Wait for potential navigations/renders
            page.wait_for_load_state(timeout=5000)
            time.sleep(1)

        except Exception as e:
            print(f"Error executing {fname}: {e}")
            action_result = {"error": str(e)}

        results.append((fname, action_result))

    return results

def get_function_responses(page, results):
    """Capture function responses with screenshots."""
    try:
        screenshot_bytes = page.screenshot(type="png", timeout=10000)  # 10 second timeout
    except Exception as e:
        print(f"⚠️ Screenshot failed: {e}")
        screenshot_bytes = None
    
    current_url = page.url
    function_responses = []
    
    for name, result in results:
        response_data = {"url": current_url}
        response_data.update(result)
        
        # Only include screenshot if we have one
        parts = []
        if screenshot_bytes:
            parts.append(types.FunctionResponsePart(
                inline_data=types.FunctionResponseBlob(
                    mime_type="image/png",
                    data=screenshot_bytes
                )
            ))
        
        function_responses.append(
            types.FunctionResponse(
                name=name,
                response=response_data,
                parts=parts
            )
        )
    return function_responses

def search_roboflow_models(keywords: str, max_models: int = 1) -> List[Dict]:
    """
    Search Roboflow Universe for models using Gemini Computer Use.
    
    Args:
        keywords: Search query for models
        max_models: Maximum number of models to return
        
    Returns:
        List of model dictionaries with extracted information
    """
    print(f"🤖 Starting Gemini Computer Use agent for: {keywords}")
    
    # Setup Playwright
    print("Initializing browser...")
    playwright = sync_playwright().start()
    browser = playwright.chromium.launch(headless=False)
    context = browser.new_context(viewport={"width": SCREEN_WIDTH, "height": SCREEN_HEIGHT})
    page = context.new_page()
    
    try:
        # Go to initial page with extended timeout handling
        try:
            page.goto("https://universe.roboflow.com", timeout=30000)
        except Exception as e:
            print(f"⚠️ Navigation timeout, trying with shorter timeout: {e}")
            try:
                page.goto("https://universe.roboflow.com", timeout=15000)
            except Exception as e2:
                print(f"⚠️ Second navigation attempt failed: {e2}")
                # Continue anyway - the agent might still work
        
        # Configure the model with Computer Use tool
        config = types.GenerateContentConfig(
            tools=[types.Tool(computer_use=types.ComputerUse(
                environment=types.Environment.ENVIRONMENT_BROWSER
            ))],
        )
        
        # Initialize history
        initial_screenshot = page.screenshot(type="png")
        USER_PROMPT = f"""You are a professional model researcher. Your task is to find EXACTLY {max_models} different "{keywords}" models on Roboflow Universe. This is critical - you MUST find {max_models} unique models.

DETAILED STRATEGY:
1. Navigate to https://universe.roboflow.com
2. Search for "{keywords}" in the search box
3. Enable "Has a Model" filter if available
4. Scroll through ALL search results to find {max_models} different projects
5. For EACH project, systematically:
   - Click on the project card
   - Navigate to Deploy > Model section
   - Extract ALL model details (mAP, precision, recall, training images, etc.)
   - Copy the model URL and API endpoint
   - Go back to search results
   - Find the next different project
   - Repeat until you have {max_models} unique models

CRITICAL REQUIREMENTS:
- Find EXACTLY {max_models} different models (not duplicates)
- Each model must be from a different project/author
- Extract complete information for each model
- Be thorough and systematic - scroll through all results
- Don't stop until you have {max_models} models
- If you can't find enough models, try different search terms or scroll more

For each model, extract these EXACT fields:
[
  {{
    "model_identifier": "actual-model-id/version",
    "model_name": "Project Name", 
    "model_url": "https://universe.roboflow.com/project-url",
    "author": "Creator Name",
    "mAP": "value or N/A",
    "precision": "value or N/A",
    "recall": "value or N/A", 
    "training_images": "count or N/A",
    "tags": ["tag1", "tag2"],
    "classes": ["class1", "class2"],
    "description": "Model description",
    "api_endpoint": "https://detect.roboflow.com/model-id/version"
  }},
  {{
    "model_identifier": "second-model-id/version",
    "model_name": "Second Project Name", 
    "model_url": "https://universe.roboflow.com/second-project-url",
    "author": "Second Creator Name",
    "mAP": "value or N/A",
    "precision": "value or N/A",
    "recall": "value or N/A", 
    "training_images": "count or N/A",
    "tags": ["tag1", "tag2"],
    "classes": ["class1", "class2"],
    "description": "Second model description",
    "api_endpoint": "https://detect.roboflow.com/second-model-id/version"
  }}
  // ... continue for {max_models} models total
]"""

        print(f"Goal: {USER_PROMPT}")

        contents = [
            types.Content(role="user", parts=[
                types.Part(text=USER_PROMPT),
                types.Part.from_bytes(data=initial_screenshot, mime_type='image/png')
            ])
        ]

        # Agent Loop - optimized turn limit for faster completion
        turn_limit = 30
        for i in range(turn_limit):
            print(f"\n--- Turn {i+1} ---")
            print("Thinking...")
            
            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model='gemini-2.5-computer-use-preview-10-2025',
                contents=contents,
                config=config,
            )

            candidate = response.candidates[0]
            
            # Check if candidate has content to prevent AttributeError
            if not candidate.content or not candidate.content.parts:
                print("⚠️ Empty response from Gemini, continuing...")
                continue
                
            contents.append(candidate.content)

            has_function_calls = any(part.function_call for part in candidate.content.parts)
            if not has_function_calls:
                text_response = " ".join([part.text for part in candidate.content.parts if part.text])
                print("Agent finished:", text_response)
                
                # Try to extract JSON from response
                try:
                    # Look for JSON array in the response
                    json_start = text_response.find('[')
                    json_end = text_response.rfind(']') + 1
                    if json_start != -1 and json_end > json_start:
                        json_str = text_response[json_start:json_end]
                        models_data = json.loads(json_str)
                        if isinstance(models_data, list) and len(models_data) >= max_models:
                            print(f'✅ Successfully extracted {len(models_data)} models (target: {max_models})')
                            return models_data[:max_models]  # Return only the requested number
                        elif isinstance(models_data, list):
                            print(f'✅ Found {len(models_data)} models, continuing to find more...')
                            # Continue searching for more models
                        else:
                            print('⚠️ JSON is not an array, treating as single model')
                            return [models_data]
                    else:
                        # Fallback: look for single object
                        json_start = text_response.find('{')
                        json_end = text_response.rfind('}') + 1
                        if json_start != -1 and json_end > json_start:
                            json_str = text_response[json_start:json_end]
                            model_data = json.loads(json_str)
                            print('✅ Successfully extracted single model data')
                            return [model_data]
                        else:
                            print('⚠️ No JSON found in response')
                            break
                except json.JSONDecodeError as e:
                    print(f'⚠️ JSON parsing error: {e}')
                    break

            print("Executing actions...")
            results = execute_function_calls(candidate, page, SCREEN_WIDTH, SCREEN_HEIGHT)

            print("Capturing state...")
            try:
                function_responses = get_function_responses(page, results)
                contents.append(
                    types.Content(role="user", parts=[types.Part(function_response=fr) for fr in function_responses])
                )
            except Exception as e:
                print(f"⚠️ Error capturing state: {e}")
                # Continue without function responses
                continue

        print("Max turns reached without completion")
        print(f"⚠️ Agent did not find {max_models} models within turn limit")
        return []

    finally:
        # Cleanup
        print("\nClosing browser...")
        browser.close()
        playwright.stop()

def main():
    """Main function to test the Roboflow search agent."""
    if not os.getenv('GEMINI_API_KEY'):
        print("❌ GEMINI_API_KEY environment variable is required")
        return
    
    # Get search parameters from environment or command line
    keywords = os.getenv('SEARCH_KEYWORDS', 'basketball detection')
    max_models = int(os.getenv('MAX_MODELS', '1'))
    
    print(f"🔍 Searching for: {keywords}")
    print(f"📊 Max models: {max_models}")
    
    models = search_roboflow_models(keywords, max_models)
    
    if models:
        print(f"\n✅ Found {len(models)} models:")
        for model in models:
            print(json.dumps(model, indent=2))
    else:
        print("❌ No models found - agent needs more time or better search strategy")
        print("💡 Consider:")
        print("   - Increasing turn limit")
        print("   - Improving search keywords")
        print("   - Checking if Roboflow Universe is accessible")

if __name__ == "__main__":
    main()

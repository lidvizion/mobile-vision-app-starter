#!/usr/bin/env python3
"""
roboflow_search_agent.py - IMPROVED API ENDPOINT EXTRACTION
🔍 Extracts API endpoints from Model/API pages with better reliability
"""

import os
import sys
import json
import re
from pathlib import Path
from datetime import datetime
from urllib.parse import urlparse
from typing import List, Dict, Optional
from playwright.sync_api import sync_playwright, TimeoutError
import time

BASE_URL = "https://universe.roboflow.com"
SCREEN = {"width": 1440, "height": 900}
MODEL_SCROLLS = 15
RESULT_SCROLLS = 30
RETRY_COUNT = 3
RETRY_WAIT = 3

# ---------- Utilities ----------
def connect_browser(headless=True):
    quiet_mode = os.getenv("OUTPUT_JSON", "false").lower() == "true"
    
    if not quiet_mode:
        print("🔧 Starting Playwright browser...")
    
    playwright = sync_playwright().start()
    
    browser_options = {
        "headless": headless,
        "args": [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--no-first-run",
            "--no-zygote",
            "--disable-gpu"
        ]
    }
    
    browser = playwright.chromium.launch(**browser_options)
    context = browser.new_context(
        viewport=SCREEN,
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    )
    page = context.new_page()
    
    if not quiet_mode:
        print("✅ Browser connected successfully")
    
    return playwright, browser, context, page

def extract_number(text: str) -> Optional[str]:
    """Extract first number from text (handles k/K notation)"""
    if not text or text == "N/A":
        return None
    
    match = re.search(r'(\d+\.?\d*)\s*[kK]', text)
    if match:
        return str(int(float(match.group(1)) * 1000))
    
    match = re.search(r'(\d+)', text)
    return match.group(1) if match else None

def extract_percentage(text: str) -> Optional[str]:
    """Extract percentage value"""
    if not text or text == "N/A":
        return None
    match = re.search(r'(\d+\.?\d*)\s*%', text)
    return f"{match.group(1)}%" if match else None

def clean_html_entities(text: str) -> str:
    """Clean HTML entities from text"""
    if not text:
        return text
    return text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")

def extract_api_endpoint(page, project_type: str, page_text: str, page_html: str, quiet_mode=False) -> Optional[str]:
    """Extract API endpoint - IMPROVED VERSION with better detection"""
    
    if not quiet_mode:
        print(f"   🔍 Searching for API endpoint...")
        print(f"   📍 Current URL: {page.url[:80]}...")
    
    # Strategy 1: Look in JavaScript code blocks (most reliable source)
    # The API endpoint appears in code snippets with url: "https://serverless.roboflow.com/..."
    js_patterns = [
        r'url:\s*["\']https://serverless\.roboflow\.com/([^"\'?\s]+)["\']',
        r'"https://serverless\.roboflow\.com/([^"\'?\s]+)"',
        r'https://serverless\.roboflow\.com/([a-z0-9\-_]+/\d+)',
    ]
    
    for pattern in js_patterns:
        match = re.search(pattern, page_html)
        if match:
            if '/' in match.group(1):  # Has project/version format
                endpoint = f"https://serverless.roboflow.com/{match.group(1)}"
                if not quiet_mode:
                    print(f"   ✅ Found in JS code: {endpoint}")
                return clean_html_entities(endpoint)
    
    # Strategy 2: Look for model_id in code (format: "workspace-project/version")
    model_id_patterns = [
        r'model_id["\']?\s*[:=]\s*["\']([a-z0-9\-_]+/\d+)["\']',
        r'MODEL_ENDPOINT["\']?\s*[:=]\s*["\']([a-z0-9\-_]+/\d+)["\']',
        r'PROJECT_ID["\']?\s*[:=]\s*["\']([a-z0-9\-_]+)["\']',
    ]
    
    for pattern in model_id_patterns:
        match = re.search(pattern, page_html, re.IGNORECASE)
        if match:
            model_id = match.group(1)
            endpoint = f"https://serverless.roboflow.com/{model_id}"
            if not quiet_mode:
                print(f"   ✅ Found model_id: {endpoint}")
            return endpoint
    
    # Strategy 3: Look in input fields and textareas
    input_selectors = [
        "input[value*='serverless.roboflow.com']",
        "textarea",
        "code",
    ]
    
    for selector in input_selectors:
        try:
            elements = page.query_selector_all(selector)
            for el in elements:
                text = el.get_attribute("value") or el.inner_text() or ""
                if text and "serverless.roboflow.com" in text:
                    match = re.search(r'https://serverless\.roboflow\.com/([a-z0-9\-_]+/\d+)', text)
                    if match:
                        endpoint = clean_html_entities(match.group(0))
                        if not quiet_mode:
                            print(f"   ✅ Found in {selector}: {endpoint}")
                        return endpoint
        except:
            continue
    
    # Strategy 4: Check visible page text for endpoint patterns
    serverless_match = re.search(r'https://serverless\.roboflow\.com/([a-z0-9\-_]+/\d+)', page_text)
    if serverless_match:
        endpoint = clean_html_entities(serverless_match.group(0))
        if not quiet_mode:
            print(f"   ✅ Found in page text: {endpoint}")
        return endpoint
    
    # Strategy 5: Legacy endpoint fallback (still used by some older models)
    legacy_patterns = [
        r'https://detect\.roboflow\.com/([a-z0-9\-_]+/\d+)',
        r'https://classify\.roboflow\.com/([a-z0-9\-_]+/\d+)',
        r'https://outline\.roboflow\.com/([a-z0-9\-_]+/\d+)',
        r'https://segment\.roboflow\.com/([a-z0-9\-_]+/\d+)',
    ]
    
    for pattern in legacy_patterns:
        match = re.search(pattern, page_html)
        if match:
            endpoint = clean_html_entities(match.group(0))
            if not quiet_mode:
                print(f"   ✅ Found legacy endpoint: {endpoint}")
            return endpoint
    
    # Strategy 6: Construct from URL structure if on a model page
    try:
        current_url = page.url
        
        # Parse URL: https://universe.roboflow.com/workspace/project/model/3
        if '/model/' in current_url:
            parts = current_url.split('/')
            model_idx = parts.index('model')
            if model_idx >= 2:
                workspace = parts[model_idx - 2]
                project = parts[model_idx - 1]
                version = parts[model_idx + 1] if len(parts) > model_idx + 1 else None
                
                if version and version.isdigit():
                    # All modern models use serverless endpoint
                    endpoint = f"https://serverless.roboflow.com/{project}/{version}"
                    if not quiet_mode:
                        print(f"   ✅ Constructed from URL: {endpoint}")
                    return endpoint
        
        # Fallback: Try URL without /model/ path
        elif len(current_url.split('/')) >= 5:
            parts = [p for p in current_url.split('/') if p]
            if 'universe.roboflow.com' in current_url and len(parts) >= 2:
                workspace = parts[-2]
                project = parts[-1]
                
                # Look for version in page text
                version_match = re.search(r'Version\s+(\d+)|Model\s+(\d+)', page_text)
                if version_match:
                    version = version_match.group(1) or version_match.group(2)
                    endpoint = f"https://serverless.roboflow.com/{project}/{version}"
                    if not quiet_mode:
                        print(f"   ✅ Constructed from project: {endpoint}")
                    return endpoint
    except:
        pass
    
    if not quiet_mode:
        print(f"   ❌ No API endpoint found")
    
    return None

def clean_text(text: str) -> str:
    """Clean extracted text"""
    if not text or text == "N/A":
        return "N/A"
    text = re.sub(r'\s+', ' ', text)
    text = text.strip()
    noise = ["Go to Roboflow App", "Universe Home", "Sign In or Sign Up", 
             "Roboflow App", "Documentation", "Universe", "Back"]
    for n in noise:
        text = text.replace(n, "")
    return text.strip() or "N/A"

def scroll_page(page, max_scrolls=15):
    """Scroll with progress checks"""
    last_height = 0
    for i in range(max_scrolls):
        page.evaluate("window.scrollBy(0, window.innerHeight)")
        page.wait_for_timeout(800)
        new_height = page.evaluate("document.body.scrollHeight")
        if new_height == last_height:
            break
        last_height = new_height

# ---------- Model extraction ----------
def extract_model_details(page, quiet_mode=False) -> Dict:
    """Extract model details with IMPROVED API endpoint detection"""
    
    # CRITICAL: Navigate to Model/API page FIRST to get API endpoint
    # The API endpoint is shown in code snippets on the Model page
    current_url = page.url
    base_url = current_url.split('/model/')[0] if '/model/' in current_url else current_url
    
    if not quiet_mode:
        print(f"   📄 Extracting from: {base_url.split('/')[-1]}")
    
    # Try to navigate to the model page if not already there
    if '/model/' not in current_url:
        try:
            # Look for Model tab, API Docs link, or construct model URL
            model_selectors = [
                "a:has-text('Model')",
                "button:has-text('Model')",
                "a:has-text('API Docs')",
                "[href*='/model/']",
            ]
            
            clicked = False
            for selector in model_selectors:
                try:
                    link = page.query_selector(selector)
                    if link and link.is_visible():
                        if not quiet_mode:
                            print(f"   🔗 Clicking {selector} to find API endpoint...")
                        link.click()
                        page.wait_for_timeout(2500)
                        clicked = True
                        break
                except:
                    continue
            
            # If no link found, try to construct model URL manually
            if not clicked:
                try:
                    # Look for version number in page
                    page_text_temp = page.inner_text("body")
                    version_match = re.search(r'Version\s+(\d+)|Model\s+(\d+)', page_text_temp)
                    if version_match:
                        version = version_match.group(1) or version_match.group(2)
                        model_url = f"{base_url}/model/{version}"
                        if not quiet_mode:
                            print(f"   🔗 Navigating to: {model_url}")
                        page.goto(model_url, wait_until="domcontentloaded", timeout=15000)
                        page.wait_for_timeout(2000)
                except:
                    pass
        except:
            pass
    
    # Wait for code snippets to load
    page.wait_for_timeout(2000)
    
    # Scroll to ensure all code is loaded
    scroll_page(page, max_scrolls=10)
    
    # Get page content for API extraction
    page_text = page.inner_text("body")
    page_html = page.content()
    
    # Extract API endpoint FIRST (while on Model page)
    api_endpoint = extract_api_endpoint(page, "", page_text, page_html, quiet_mode)
    
    # If not found, try clicking through different code tabs
    if not api_endpoint:
        if not quiet_mode:
            print(f"   🔄 Trying different code tabs...")
        
        tab_selectors = [
            "button:has-text('Javascript')",
            "button:has-text('JavaScript')",
            "button:has-text('Python')",
            "button:has-text('cURL')",
        ]
        
        for selector in tab_selectors:
            try:
                tab = page.query_selector(selector)
                if tab and tab.is_visible():
                    tab.click()
                    page.wait_for_timeout(1500)
                    
                    # Re-extract content
                    page_text = page.inner_text("body")
                    page_html = page.content()
                    api_endpoint = extract_api_endpoint(page, "", page_text, page_html, quiet_mode)
                    
                    if api_endpoint:
                        break
            except:
                continue
    
    # Clean up API endpoint (remove query parameters)
    if api_endpoint and '?' in api_endpoint:
        api_endpoint = api_endpoint.split('?')[0]
    
    # NOW navigate back to Overview for other details
    if not quiet_mode:
        print(f"   📊 Getting project details from Overview...")
    
    try:
        if page.url != base_url:
            page.goto(base_url, wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(2000)
    except:
        pass
    
    # Make sure Overview tab is selected
    try:
        overview_tab = page.query_selector("a:has-text('Overview'), button:has-text('Overview')")
        if overview_tab and overview_tab.is_visible():
            overview_tab.click()
            page.wait_for_timeout(1500)
    except:
        pass
    
    scroll_page(page, max_scrolls=MODEL_SCROLLS)
    
    # Get overview page content
    page_text = page.inner_text("body")
    page_html = page.content()
    
    # Extract title
    title = "N/A"
    for selector in ["h1", "h2", "[class*='title']"]:
        el = page.query_selector(selector)
        if el:
            title = clean_text(el.inner_text())
            if title != "N/A" and len(title) > 3:
                break
    
    # Extract author
    author = "N/A"
    author_el = page.query_selector("a[href*='/profile']")
    if author_el:
        author = clean_text(author_el.inner_text())
    else:
        match = re.search(r'by\s+([A-Za-z0-9\s_-]+?)(?:\n|Updated|\d)', page_text)
        if match:
            author = clean_text(match.group(1))
    
    # Extract project type from TAGS section
    project_type = "N/A"
    
    # Strategy 1: Look for TAGS followed by badges/buttons
    tags_section = re.search(r'TAGS\s+(.*?)(?:CLASSES|Model|Dataset|\n\n)', page_text, re.DOTALL)
    if tags_section:
        tags_text = tags_section.group(1)
        if "Keypoint Detection" in tags_text or "Keypoint" in tags_text:
            project_type = "Keypoint Detection"
        elif "Instance Segmentation" in tags_text:
            project_type = "Instance Segmentation"
        elif "Object Detection" in tags_text:
            project_type = "Object Detection"
        elif "Classification" in tags_text:
            project_type = "Image Classification"
    
    # Strategy 2: Look near project title on page
    if project_type == "N/A":
        title_area = page_text[:500]  # Check first 500 chars
        if "Keypoint Detection" in title_area or "Keypoint" in title_area:
            project_type = "Keypoint Detection"
        elif "Instance Segmentation" in title_area:
            project_type = "Instance Segmentation"
        elif "Object Detection" in title_area:
            project_type = "Object Detection"
        elif "Classification" in title_area:
            project_type = "Image Classification"
    
    # Extract metrics from METRICS section on Overview page
    mAP = None
    precision = None
    recall = None
    
    # Look for METRICS section with percentages
    metrics_section = re.search(r'METRICS\s+(.*?)(?:Try This Model|CLASSES|\n\n\n)', page_text, re.DOTALL)
    if metrics_section:
        metrics_text = metrics_section.group(1)
        
        # Extract mAP@50
        map_match = re.search(r'mAP@50[^\d]*(\d+\.?\d*)\s*%', metrics_text)
        if map_match:
            mAP = f"{map_match.group(1)}%"
        
        # Extract Precision
        prec_match = re.search(r'Precision[^\d]*(\d+\.?\d*)\s*%', metrics_text)
        if prec_match:
            precision = f"{prec_match.group(1)}%"
        
        # Extract Recall
        recall_match = re.search(r'Recall[^\d]*(\d+\.?\d*)\s*%', metrics_text)
        if recall_match:
            recall = f"{recall_match.group(1)}%"
    
    # Fallback: broader search if not found in METRICS section
    if not mAP:
        map_patterns = [
            r'mAP@50[^\d]*(\d+\.?\d*)\s*%',
            r'mAP[^\d]*(\d+\.?\d*)\s*%',
        ]
        for pattern in map_patterns:
            match = re.search(pattern, page_text)
            if match:
                mAP = f"{match.group(1)}%"
                break
    
    if not precision:
        match = re.search(r'Precision[^\d]*(\d+\.?\d*)\s*%', page_text)
        if match:
            precision = f"{match.group(1)}%"
    
    if not recall:
        match = re.search(r'Recall[^\d]*(\d+\.?\d*)\s*%', page_text)
        if match:
            recall = f"{match.group(1)}%"
    
    # Extract image count
    images_match = re.search(r'(\d+\.?\d*[kK]?)\s*images', page_text)
    images = extract_number(images_match.group(1)) if images_match else None
    
    # Check if it has a trained model
    has_model = bool(re.search(r'Model\s+\d+', page_text) or 
                    re.search(r'Version\s+\d+', page_text) or
                    'trained model' in page_text.lower())
    
    # Extract classes from CLASSES section
    classes = []
    class_count = "0"
    
    # Find CLASSES section with count
    classes_match = re.search(r'CLASSES\s*\((\d+)\)', page_text)
    if classes_match:
        class_count = classes_match.group(1)
        
        # Get the next 300-500 characters after CLASSES
        start_pos = classes_match.end()
        class_section = page_text[start_pos:start_pos+500]
        
        # Look for actual class badges
        potential_classes = re.findall(r'\b([a-z][a-z0-9_\-]{0,25})\b', class_section)
        
        # Filter out common UI text and keep actual class names
        ui_noise = {
            'try', 'this', 'model', 'drop', 'an', 'image', 'or', 'browse', 
            'your', 'device', 'description', 'for', 'project', 'has', 'not',
            'been', 'published', 'yet', 'cite', 'license', 'by', 'updated',
            'views', 'downloads', 'tags', 'classes', 'the', 'and', 'to', 'a',
            'of', 'in', 'on', 'is', 'it', 'that', 'with'
        }
        
        # Keep classes that look valid
        for cls in potential_classes:
            if len(cls) > 1 and cls not in ui_noise and cls not in classes:
                classes.append(cls)
                if len(classes) >= int(class_count):
                    break
        
        # Limit to actual class count or 10, whichever is smaller
        max_classes = min(int(class_count) if class_count.isdigit() else 10, 10)
        classes = classes[:max_classes]
    
    # Extract tags
    tags = []
    if project_type != "N/A":
        tags.append(project_type)
    model_types = re.findall(r'(yolov\d+|yolo|efficientdet|faster-?rcnn|ssd|retinanet)', page_text, re.IGNORECASE)
    if model_types:
        tags.extend([m.lower() for m in model_types[:3]])
    
    # Extract model identifier from URL
    url_parts = base_url.split('/')
    workspace = url_parts[-2] if len(url_parts) >= 2 else "N/A"
    project = url_parts[-1] if len(url_parts) >= 1 else "N/A"
    
    model_id = f"{workspace}/{project}" if workspace != "N/A" and project != "N/A" else "N/A"
    
    # Extract updated time
    updated = "N/A"
    updated_patterns = [
        r'Updated\s+(\d+\s+(?:year|month|week|day|hour)s?\s+ago)',
        r'Updated\s+([^•\n]{5,30})',
    ]
    for pattern in updated_patterns:
        updated_match = re.search(pattern, page_text)
        if updated_match:
            updated = clean_text(updated_match.group(1))
            if updated != "N/A" and len(updated) > 3:
                break
    
    data = {
        "project_title": title,
        "url": base_url,
        "author": author,
        "project_type": project_type,
        "has_model": has_model,
        "updated": updated,
        "mAP": mAP,
        "precision": precision,
        "recall": recall,
        "training_images": images,
        "tags": tags,
        "classes": classes,
        "class_count": class_count,
        "api_endpoint": api_endpoint,
        "model_identifier": model_id,
    }
    
    # Summary for logging
    if not quiet_mode:
        metrics = f"mAP:{mAP or 'N/A'} P:{precision or 'N/A'} R:{recall or 'N/A'}"
        api_status = "✓API" if api_endpoint else "✗API"
        type_short = project_type.split()[0] if project_type != "N/A" else "N/A"
        print(f"   ✅ {title[:30]:<30} | {type_short:<12} | {metrics} | {api_status}")
    
    return data

def open_model_with_retry(context, url, quiet_mode=False) -> Optional[Dict]:
    """Try opening a model page with retries"""
    for attempt in range(1, RETRY_COUNT + 1):
        model_page = context.new_page()
        try:
            model_page.goto(url, wait_until="domcontentloaded", timeout=60000)
            model_page.wait_for_timeout(3000)
            data = extract_model_details(model_page, quiet_mode=quiet_mode)
            model_page.close()
            return data
        except Exception as e:
            if not quiet_mode:
                print(f"⚠️ Attempt {attempt} failed: {str(e)[:50]}")
            model_page.close()
            if attempt < RETRY_COUNT:
                time.sleep(RETRY_WAIT)
    return None


# ---------- Search & scrape ----------
def search_roboflow_models(keywords: str, max_projects: int = 10, headless=True) -> List[Dict]:
    start_time = time.time()
    playwright, browser, context, page = connect_browser(headless=headless)
    models = []
    
    quiet_mode = os.getenv("OUTPUT_JSON", "false").lower() == "true"
    
    if not quiet_mode:
        print(f"⏱️ Browser connected in {time.time() - start_time:.2f}s")

    try:
        # ✅ USE KEYWORDS AS-IS from TypeScript (already prioritized and formatted) 
        # TypeScript has already done the prioritization: domain keywords + "model" + task type
        # Example: "basketball model instance segmentation" or "soccer ball model object detection"
        # We should preserve this order to maintain domain-specific keyword priority
        
        keywords_lower = keywords.lower()
        keywords_list = keywords.split()
        
        # Check if keywords already contain properly formatted task type phrases (from TypeScript)
        has_task_phrase = (
            'instance segmentation' in keywords_lower or
            'keypoint detection' in keywords_lower or
            'object detection' in keywords_lower or
            'image classification' in keywords_lower
        )
        
        if has_task_phrase and 'model' in keywords_lower:
            # Keywords are already properly formatted by TypeScript - use as-is
            # Just limit to 5 terms to match Roboflow search expectations
            search_keywords = ' '.join(keywords_list[:5])
        else:
            # Fallback: Keywords might not be fully formatted - do minimal processing
            # This should rarely happen as TypeScript handles this, but keep as safety net
            prioritized_keywords = []
            
            # Keep first 2 words (usually domain keywords from TypeScript)
            prioritized_keywords.extend(keywords_list[:2])
            
            # Add "model" if not present
            if 'model' not in [k.lower() for k in prioritized_keywords]:
                prioritized_keywords.append('model')
            
            # Only add task type if it's clearly missing
            if 'instance segmentation' not in keywords_lower and 'keypoint detection' not in keywords_lower:
                if 'segment' in keywords_lower or 'segmentation' in keywords_lower:
                    prioritized_keywords.append('instance segmentation')
                elif 'detect' in keywords_lower or 'detection' in keywords_lower:
                    prioritized_keywords.append('object detection')
                elif 'classif' in keywords_lower or 'classification' in keywords_lower:
                    prioritized_keywords.append('image classification')
            
            search_keywords = ' '.join(prioritized_keywords[:5])
        
        # Always print URL for debugging (even in quiet mode)
        search_url = f"{BASE_URL}/search?q={search_keywords.replace(' ', '+')}"
        # URL logging removed for cleaner output
        
        if not quiet_mode:
            print(f"🎯 Prioritized search keywords (domain first): {search_keywords}")
            print("🌐 Connecting to Roboflow Universe…")
            print(f"🔗 {BASE_URL}/search?q={search_keywords.replace(' ', '+')}")
        
        page.goto(search_url, wait_until="domcontentloaded", timeout=60000)
        if not quiet_mode:
            print(f"✅ Page loaded in {time.time() - start_time:.2f}s")
        page.wait_for_timeout(5000)
        
        # Try to apply "Has a Model" filter
        try:
            if not quiet_mode:
                print("🔘 Applying 'Has a Model' filter...")
            
            has_model_selectors = [
                "button:has-text('Has a Model')",
                "[data-filter='has-model']",
                "input[type='checkbox'][value*='model']",
                "label:has-text('Has a Model')",
                "text=Has a Model"
            ]
            
            for selector in has_model_selectors:
                try:
                    filter_btn = page.query_selector(selector)
                    if filter_btn and filter_btn.is_visible():
                        filter_btn.click()
                        page.wait_for_timeout(3000)
                        if not quiet_mode:
                            print("   ✓ Filter applied")
                            break
                except:
                    continue
        except Exception as e:
            if not quiet_mode:
                print(f"   ⚠️ Could not apply filter: {str(e)[:50]}")
        
        # Wait for content
        try:
            page.wait_for_selector("[class*='project'], a[href*='/']", timeout=10000)
        except TimeoutError:
            pass
        
        # Scroll
        if not quiet_mode:
            print("📜 Scrolling...")
        scroll_page(page, max_scrolls=RESULT_SCROLLS)
        
        # Extract URLs
        all_links = page.query_selector_all("a[href]")
        urls = []
        seen_paths = set()
        
        for link in all_links:
            try:
                href = link.get_attribute("href")
                if not href or not "universe.roboflow.com" in (href if href.startswith("http") else f"{BASE_URL}{href}"):
                    continue
                
                if not href.startswith("http"):
                    href = f"{BASE_URL}{href}"
                
                path = href.split("universe.roboflow.com")[-1]
                segments = [s for s in path.split("/") if s]
                
                if len(segments) >= 2 and segments[0] not in ['search', 'browse', 'docs', 'api']:
                    project_path = f"/{segments[0]}/{segments[1]}"
                    if project_path not in seen_paths:
                        seen_paths.add(project_path)
                        urls.append(f"{BASE_URL}{project_path}")
            except:
                continue

        urls = urls[:max_projects]
        if not quiet_mode:
            print(f"🔹 Found {len(urls)} projects, processing...")
        
        # Extract models
        for idx, url in enumerate(urls, 1):
            if not quiet_mode:
                print(f"\n➡️ [{idx}/{len(urls)}] {url.split('/')[-1]}")
            model_data = open_model_with_retry(context, url, quiet_mode=quiet_mode)
            if model_data:
                models.append(model_data)
        
        if not quiet_mode:
            print(f"\n✅ Extracted {len(models)} models")
        return models

    finally:
        browser.close()
        playwright.stop()


# ---------- CLI ----------
def main():
    keywords = os.getenv("SEARCH_KEYWORDS", "basketball detection")
    max_projects = int(os.getenv("MAX_PROJECTS", "6"))
    headless = os.getenv("HEADLESS", "true").lower() == "true"
    
    output_json = os.getenv("OUTPUT_JSON", "false").lower() == "true"

    if not output_json:
        print("=" * 60)
        print("🏀 ROBOFLOW UNIVERSE SEARCH")
        print("=" * 60)
        print(f"Keywords: {keywords} | Max: {max_projects} | Headless: {headless}")
        print("=" * 60 + "\n")

    results = search_roboflow_models(keywords, max_projects=max_projects, headless=headless)
    
    if results:
        if output_json:
            print(json.dumps(results, ensure_ascii=False))
        else:
            print(f"\n🎉 SUCCESS! Extracted {len(results)} models")
            
            with_models = sum(1 for r in results if r.get('has_model'))
            with_metrics = sum(1 for r in results if r.get('mAP'))
            with_segmentation = sum(1 for r in results if 'Segmentation' in r.get('project_type', ''))
            
            print(f"\n📊 Summary:")
            print(f"   • {with_models} projects with trained models")
            print(f"   • {with_metrics} projects with performance metrics")
            print(f"   • {with_segmentation} instance segmentation projects")
    else:
        if output_json:
            print("[]")
        else:
            print("\n❌ No data collected")

if __name__ == "__main__":
    main()
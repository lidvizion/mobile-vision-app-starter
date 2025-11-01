#!/usr/bin/env python3
"""
roboflow_search_agent.py - FIXED VERSION
🔍 Accurate project type, API endpoint, and data extraction
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

def extract_api_endpoint(page, project_type: str, page_text: str, page_html: str) -> Optional[str]:
    """Extract API endpoint - prioritizes serverless.roboflow.com (used by all modern models)"""
    
    # Strategy 1: Look for serverless endpoint in HTML (most common now)
    serverless_match = re.search(r'https://serverless\.roboflow\.com/[^\s\'"<>]+', page_html)
    if serverless_match:
        endpoint = clean_html_entities(serverless_match.group(0))
        return endpoint
    
    # Strategy 2: Look in input fields for any roboflow endpoint
    for selector in ["input[value*='https://serverless.roboflow.com']",
                    "input[value*='https://detect.roboflow.com']", 
                    "input[value*='https://classify.roboflow.com']",
                    "input[value*='https://segment.roboflow.com']"]:
        el = page.query_selector(selector)
        if el:
            val = el.get_attribute("value")
            if val and "roboflow.com" in val:
                return clean_html_entities(val)
    
    # Strategy 3: Look in code blocks and text areas
    code_blocks = page.query_selector_all("code, pre, textarea")
    for block in code_blocks:
        try:
            text = block.inner_text()
            if not text:
                continue
            
            # Check for serverless first (most common)
            match = re.search(r'https://serverless\.roboflow\.com/[^\s\'"<>]+', text)
            if match:
                return clean_html_entities(match.group(0))
            
            # Then check for legacy endpoints
            match = re.search(r'https://(detect|classify|segment)\.roboflow\.com/[^\s\'"<>]+', text)
            if match:
                return clean_html_entities(match.group(0))
        except:
            continue
    
    # Strategy 4: Search page text for serverless endpoint
    serverless_text_match = re.search(r'https://serverless\.roboflow\.com/[^\s\'"<>]+', page_text)
    if serverless_text_match:
        return clean_html_entities(serverless_text_match.group(0))
    
    # Strategy 5: Legacy endpoint fallback
    legacy_match = re.search(r'https://(detect|classify|segment)\.roboflow\.com/[^\s\'"<>]+', page_html)
    if legacy_match:
        return clean_html_entities(legacy_match.group(0))
    
    # Strategy 6: Construct serverless endpoint from URL if we're on a project page
    try:
        url_parts = page.url.split('/')
        if len(url_parts) >= 2 and '/model/' not in page.url:
            workspace = url_parts[-2]
            project = url_parts[-1]
            
            # Look for version number
            version_match = re.search(r'Model\s+(\d+)', page_text)
            if version_match:
                version = version_match.group(1)
                # All modern models use serverless endpoint
                return f"https://serverless.roboflow.com/{project}/{version}"
    except:
        pass
    
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
    """Extract model details with improved project type and API detection"""
    
    # Ensure we're on the Overview page, not the Model/API page
    current_url = page.url
    base_url = current_url.split('/model/')[0] if '/model/' in current_url else current_url
    
    # Start on Overview page
    if '/model/' in current_url or not page.query_selector("text=METRICS"):
        try:
            page.goto(base_url, wait_until="domcontentloaded", timeout=30000)
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
    
    # Get page content
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
    
    # FIXED: Extract project type from TAGS section
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
    
    # Extract classes from CLASSES section - FIXED to get actual class names
    classes = []
    class_count = "0"
    
    # Find CLASSES section with count
    classes_match = re.search(r'CLASSES\s*\((\d+)\)', page_text)
    if classes_match:
        class_count = classes_match.group(1)
        
        # Get the next 300-500 characters after CLASSES
        start_pos = classes_match.end()
        class_section = page_text[start_pos:start_pos+500]
        
        # Look for actual class badges (they appear as individual words/tokens)
        # Split by whitespace and filter
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
    
    # Now try to get API endpoint by navigating to API Docs
    api_endpoint = None
    try:
        # First try to extract from current page
        current_page_html = page.content()
        current_page_text = page.inner_text("body")
        api_endpoint = extract_api_endpoint(page, project_type, current_page_text, current_page_html)
        
        # If not found, try clicking API Docs
        if not api_endpoint:
            api_selectors = [
                "a:has-text('API Docs')",
                "button:has-text('API Docs')",
                "text=API Docs",
            ]
            
            for selector in api_selectors:
                try:
                    api_link = page.query_selector(selector)
                    if api_link and api_link.is_visible():
                        api_link.click()
                        page.wait_for_timeout(3000)
                        # Update content after navigation
                        page_text_api = page.inner_text("body")
                        page_html_api = page.content()
                        api_endpoint = extract_api_endpoint(page, project_type, page_text_api, page_html_api)
                        if api_endpoint:
                            break
                except:
                    continue
    except:
        pass
    
    # FIXED: Clean up API endpoint (remove query parameters)
    if api_endpoint and '?' in api_endpoint:
        api_endpoint = api_endpoint.split('?')[0]
    
    # Extract model identifier from URL - FIXED
    url_parts = page.url.split('/')
    workspace = url_parts[-2] if len(url_parts) >= 2 else "N/A"
    project = url_parts[-1] if len(url_parts) >= 1 else "N/A"
    
    # Clean up if we're on a model page
    if '/model/' in project:
        project = project.split('/model/')[0]
    if '/model/' in workspace:
        workspace = workspace.split('/model/')[0]
    
    model_id = f"{workspace}/{project}" if workspace != "N/A" and project != "N/A" else "N/A"
    
    # Extract updated time - FIXED
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
        "url": base_url,  # Use cleaned base URL without /model/ path
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
    
    # Summary for logging (only if not in quiet mode)
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
        # Prioritize domain-specific keywords over generic ones
        # Generic terms that should be deprioritized
        generic_terms = {'segmentation', 'segformer', 'image-segmentation', 'detection', 'classification', 'object-detection', 'instance-segmentation'}
        
        keywords_list = keywords.split()
        domain_keywords = [k for k in keywords_list if k.lower() not in generic_terms]
        generic_keywords = [k for k in keywords_list if k.lower() in generic_terms]
        
        # Build search query matching Roboflow URL format: domain_keyword + model + instance + segmentation
        # Example: "basketball+model+instance+segmentation" or "soccer+ball+model+instance+segmentation"
        prioritized_keywords = []
        
        # Add domain-specific keywords first (most important) - e.g., "soccer", "ball"
        prioritized_keywords.extend(domain_keywords[:2])  # Up to 2 domain keywords
        
        # Add "model" keyword (Roboflow search expects this format)
        if 'model' not in [k.lower() for k in prioritized_keywords]:
            prioritized_keywords.append('model')
        
        # Add task-specific keywords based on what's in the search
        keywords_lower = keywords.lower()
        
        # Add "keypoint detection" if keypoint/pose-related (check first as it's more specific)
        if (('keypoint' in keywords_lower or 'key-point' in keywords_lower or 'pose' in keywords_lower or 'landmark' in keywords_lower) 
            and 'keypoint detection' not in keywords_lower):
            prioritized_keywords.append('keypoint detection')
        
        # Add "instance segmentation" if segmentation-related (but not keypoint)
        elif ('segment' in keywords_lower or 'segmentation' in keywords_lower) and 'instance segmentation' not in keywords_lower:
            prioritized_keywords.append('instance segmentation')
        
        # Add "object detection" if detection-related (but not segmentation or keypoint)
        elif (('detect' in keywords_lower or 'detection' in keywords_lower) 
              and 'segment' not in keywords_lower 
              and 'keypoint' not in keywords_lower 
              and 'pose' not in keywords_lower):
            if 'object detection' not in keywords_lower:
                prioritized_keywords.append('object detection')
        
        # Add "image classification" if classification-related (but not detection, segmentation, or keypoint)
        elif (('classif' in keywords_lower or 'classification' in keywords_lower) 
              and 'detect' not in keywords_lower 
              and 'segment' not in keywords_lower 
              and 'keypoint' not in keywords_lower):
            # Only add if "image classification" isn't already present as a phrase in keywords
            # and "classification" isn't already in prioritized keywords
            has_image_classification_phrase = 'image classification' in keywords_lower
            has_classification_in_prioritized = 'classification' in [k.lower() for k in prioritized_keywords]
            if not has_image_classification_phrase and not has_classification_in_prioritized:
                prioritized_keywords.append('image classification')
        
        # Build final search query (limit to 4-5 terms for better Roboflow search results)
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
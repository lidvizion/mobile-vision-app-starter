#!/usr/bin/env python3
"""
roboflow_search_agent.py - IMPROVED VERSION
🔍 Better data extraction with precise selectors and parsing
"""

import os
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
    playwright = sync_playwright().start()
    browser = playwright.chromium.launch(headless=headless)
    context = browser.new_context(
        viewport=SCREEN,
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    )
    page = context.new_page()
    return playwright, browser, context, page

def extract_number(text: str) -> Optional[str]:
    """Extract first number from text (handles k/K notation)"""
    if not text or text == "N/A":
        return None
    
    # Handle "4.5k images" -> "4500"
    match = re.search(r'(\d+\.?\d*)\s*[kK]', text)
    if match:
        return str(int(float(match.group(1)) * 1000))
    
    # Handle regular numbers
    match = re.search(r'(\d+)', text)
    return match.group(1) if match else None

def extract_percentage(text: str) -> Optional[str]:
    """Extract percentage value"""
    if not text or text == "N/A":
        return None
    match = re.search(r'(\d+\.?\d*)\s*%', text)
    return f"{match.group(1)}%" if match else None

def extract_api_endpoint(page) -> Optional[str]:
    """Extract API endpoint with multiple strategies"""
    
    # Strategy 1: Look for input field with API URL
    for selector in ["input[value*='https://detect.roboflow.com']", 
                    "input[value*='https://classify.roboflow.com']",
                    "input[value*='https://segment.roboflow.com']",
                    "input[value*='roboflow.com']"]:
        el = page.query_selector(selector)
        if el:
            val = el.get_attribute("value")
            if val and "roboflow.com" in val and ("detect" in val or "classify" in val or "segment" in val):
                return val
    
    # Strategy 2: Look in code blocks and pre tags
    code_blocks = page.query_selector_all("code, pre, textarea")
    for block in code_blocks:
        try:
            text = block.inner_text()
            if not text:
                continue
            # Look for API endpoint pattern
            match = re.search(r'https://(detect|classify|segment)\.roboflow\.com/[^\s\'"<>]+', text)
            if match:
                return match.group(0)
        except:
            continue
    
    # Strategy 3: Look for the endpoint in the page HTML
    try:
        html = page.content()
        match = re.search(r'https://(detect|classify|segment)\.roboflow\.com/[^\s\'"<>]+', html)
        if match:
            return match.group(0)
    except:
        pass
    
    # Strategy 4: Construct from workspace/project if we can find version info
    try:
        url_parts = page.url.split('/')
        if len(url_parts) >= 2:
            workspace = url_parts[-2]
            project = url_parts[-1]
            # Look for version number in page
            page_text = page.inner_text("body")
            version_match = re.search(r'Version\s+(\d+)', page_text)
            if version_match:
                version = version_match.group(1)
                return f"https://detect.roboflow.com/{project}/{version}"
    except:
        pass
    
    return None

def clean_text(text: str) -> str:
    """Clean extracted text"""
    if not text or text == "N/A":
        return "N/A"
    # Remove extra whitespace and navigation clutter
    text = re.sub(r'\s+', ' ', text)
    text = text.strip()
    # Remove common navigation phrases
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
def extract_model_details(page) -> Dict:
    """Extract model details with improved selectors and navigation"""
    
    # First, try clicking on Model tab if it exists (to see metrics)
    try:
        model_tab = page.query_selector("a:has-text('Model'), button:has-text('Model')")
        if model_tab and model_tab.is_visible():
            model_tab.click()
            page.wait_for_timeout(2000)
    except:
        pass
    
    scroll_page(page, max_scrolls=MODEL_SCROLLS)
    
    # Get initial page text
    page_text = page.inner_text("body")
    page_html = page.content()
    
    # Try to click API Docs to reveal endpoint (try multiple selectors)
    api_endpoint = None
    try:
        # Try multiple ways to find and click API Docs
        api_selectors = [
            "a:has-text('API Docs')",
            "button:has-text('API Docs')",
            "[href*='api'], [href*='API']",
            "text=API Docs"
        ]
        
        for selector in api_selectors:
            try:
                api_link = page.query_selector(selector)
                if api_link and api_link.is_visible():
                    api_link.click()
                    page.wait_for_timeout(3000)  # Wait longer for API content to load
                    print(f"      → Clicked API Docs")
                    break
            except:
                continue
        
        # Update page text after clicking
        page_text = page.inner_text("body")
        page_html = page.content()
    except Exception as e:
        pass
    
    # Extract title
    title = "N/A"
    for selector in ["h1", "h2", "[class*='title']"]:
        el = page.query_selector(selector)
        if el:
            title = clean_text(el.inner_text())
            if title != "N/A" and len(title) > 3:
                break
    
    # Extract author (improved)
    author = "N/A"
    author_el = page.query_selector("a[href*='/profile']")
    if author_el:
        author = clean_text(author_el.inner_text())
    else:
        # Look for "by Author Name" pattern
        match = re.search(r'by\s+([A-Za-z0-9\s_-]+?)(?:\n|Updated|\d)', page_text)
        if match:
            author = clean_text(match.group(1))
    
    # Extract metrics from page text with multiple patterns
    mAP = None
    precision = None
    recall = None
    
    # Pattern 1: "mAP 46.0%" or "mAP@50 46.0%"
    map_patterns = [
        r'mAP(?:@50)?\s*[:\s]*(\d+\.?\d*)\s*%',
        r'(?:^|\n)(\d+\.?\d*)\s*%\s*mAP',
    ]
    for pattern in map_patterns:
        match = re.search(pattern, page_text, re.IGNORECASE)
        if match:
            mAP = f"{match.group(1)}%"
            break
    
    # Pattern 2: Precision
    prec_patterns = [
        r'Precision\s*[:\s]*(\d+\.?\d*)\s*%',
        r'precision\s*[:\s]*(\d+\.?\d*)\s*%',
    ]
    for pattern in prec_patterns:
        match = re.search(pattern, page_text, re.IGNORECASE)
        if match:
            precision = f"{match.group(1)}%"
            break
    
    # Pattern 3: Recall
    recall_patterns = [
        r'Recall\s*[:\s]*(\d+\.?\d*)\s*%',
        r'recall\s*[:\s]*(\d+\.?\d*)\s*%',
    ]
    for pattern in recall_patterns:
        match = re.search(pattern, page_text, re.IGNORECASE)
        if match:
            recall = f"{match.group(1)}%"
            break
    
    # Extract image count
    images_match = re.search(r'(\d+\.?\d*[kK]?)\s*images', page_text)
    images = extract_number(images_match.group(1)) if images_match else None
    
    # Extract project type
    project_type = "N/A"
    if "Object Detection" in page_text:
        project_type = "Object Detection"
    elif "Classification" in page_text:
        project_type = "Image Classification"
    elif "Segmentation" in page_text:
        project_type = "Instance Segmentation"
    
    # Check if it has a trained model (look for Model count in sidebar)
    has_model = bool(re.search(r'Model\s+\d+', page_text) or 
                    re.search(r'Version\s+\d+', page_text) or
                    'trained model' in page_text.lower())
    
    # Extract classes from CLASSES section
    classes = []
    class_count = "0"
    classes_section = re.search(r'CLASSES\s*\((\d+)\)', page_text)
    if classes_section:
        class_count = classes_section.group(1)
        # Look for class badges/buttons after CLASSES
        after_classes = page_text[classes_section.end():classes_section.end()+500]
        # Match class names (shown as buttons/badges)
        class_matches = re.findall(r'([a-z][a-z0-9_-]{1,20})(?:\s|$)', after_classes)
        # Filter out common words
        common_words = {'the', 'and', 'or', 'for', 'to', 'in', 'on', 'at', 'by'}
        classes = [c for c in class_matches if c not in common_words][:10]
        classes = list(dict.fromkeys(classes))  # Remove duplicates while preserving order
    
    # Extract tags
    tags = []
    if "Object Detection" in page_text:
        tags.append("Object Detection")
    # Look for model types
    model_types = re.findall(r'(yolov\d+|yolo|efficientdet|faster-?rcnn|ssd|retinanet)', page_text, re.IGNORECASE)
    if model_types:
        tags.extend([m.lower() for m in model_types[:3]])
    
    # Extract API endpoint with improved methods
    api_endpoint = extract_api_endpoint(page)
    
    # If no API found, search more aggressively in HTML and text
    if not api_endpoint:
        # Pattern 1: detect.roboflow.com or classify.roboflow.com
        api_match = re.search(r'(https://(?:detect|classify|segment)\.roboflow\.com/[^\s\'"<>]+)', page_html)
        if api_match:
            api_endpoint = api_match.group(1)
        else:
            # Pattern 2: Look for workspace/model pattern in API context
            api_match = re.search(r'roboflow\.com/([^/\s]+/[^/\s]+)', page_html)
            if api_match:
                api_endpoint = f"https://detect.roboflow.com/{api_match.group(1)}"
    
    # Extract model identifier from URL
    url_parts = page.url.split('/')
    model_id = f"{url_parts[-2]}/{url_parts[-1]}" if len(url_parts) >= 2 else "N/A"
    
    # Extract updated time
    updated = "N/A"
    updated_match = re.search(r'Updated\s+(.+?)(?:\n|Use this|$)', page_text)
    if updated_match:
        updated = clean_text(updated_match.group(1))
    
    data = {
        "project_title": title,
        "url": page.url,
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
    metrics = f"mAP:{mAP or 'N/A'} P:{precision or 'N/A'} R:{recall or 'N/A'}"
    api_status = "✓API" if api_endpoint else "✗API"
    print(f"   ✅ {title[:35]:<35} | {metrics} | {api_status}")
    
    return data

def open_model_with_retry(context, url, quiet_mode=False) -> Optional[Dict]:
    """Try opening a model page with retries"""
    for attempt in range(1, RETRY_COUNT + 1):
        model_page = context.new_page()
        try:
            model_page.goto(url, wait_until="domcontentloaded", timeout=60000)
            model_page.wait_for_timeout(3000)
            data = extract_model_details(model_page)
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
    playwright, browser, context, page = connect_browser(headless=headless)
    models = []
    
    # Check if we should suppress logs (API mode)
    quiet_mode = os.getenv("OUTPUT_JSON", "false").lower() == "true"

    try:
        if not quiet_mode:
            print("🌐 Connecting to Roboflow Universe…")
            print(f"🔗 {BASE_URL}/search?q={keywords.replace(' ', '+')}")
        
        search_url = f"{BASE_URL}/search?q={keywords.replace(' ', '+')}"
        
        page.goto(search_url, wait_until="domcontentloaded", timeout=60000)
        if not quiet_mode:
            print("✅ Page loaded")
        page.wait_for_timeout(5000)
        
        # Click "Has a Model" filter to only show projects with trained models
        try:
            if not quiet_mode:
                print("🔘 Applying 'Has a Model' filter...")
            
            # Look for the "Has a Model" button/checkbox
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
                        page.wait_for_timeout(3000)  # Wait for results to update
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

# ---------- Save JSON ----------
def save_models_to_json(models: List[Dict], keywords: str):
    out_dir = Path("roboflow_results")
    out_dir.mkdir(exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_kw = keywords.replace(" ", "_")
    filename = out_dir / f"{safe_kw}_{ts}.json"

    with open(filename, "w", encoding="utf-8") as f:
        json.dump(models, f, indent=2, ensure_ascii=False)

    print(f"\n💾 {filename}")
    return filename

# ---------- CLI ----------
def main():
    keywords = os.getenv("SEARCH_KEYWORDS", "basketball detection")
    max_projects = int(os.getenv("MAX_PROJECTS", "6"))
    headless = os.getenv("HEADLESS", "true").lower() == "true"
    
    # Check if being called from API (should output JSON to stdout)
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
            # Output JSON to stdout for API consumption
            print(json.dumps(results, ensure_ascii=False))
        else:
            # Normal CLI mode - save to file and show summary
            #filename = save_models_to_json(results, keywords)
            print(f"\n🎉 SUCCESS! Saved {len(results)} models")
            
            # Show summary
            with_models = sum(1 for r in results if r.get('has_model'))
            with_metrics = sum(1 for r in results if r.get('mAP'))
            print(f"\n📊 Summary:")
            print(f"   • {with_models} projects with trained models")
            print(f"   • {with_metrics} projects with performance metrics")
    else:
        if output_json:
            print("[]")
        else:
            print("\n❌ No data collected")

if __name__ == "__main__":
    main()
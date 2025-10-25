#!/usr/bin/env python3
"""
Roboflow Universe Search Agent using Playwright
Fully dynamic, reliable multi-version extraction with JSON saving
and real-time logging
"""

import os
import json
from typing import List, Dict
from urllib.parse import urlparse
from datetime import datetime
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError

# Constants
SCREEN_WIDTH = 1440
SCREEN_HEIGHT = 900
SEARCH_URL = "https://universe.roboflow.com"

# Selectors
SEARCH_BOX = "input[placeholder='Search Universe']"
PROJECT_CARD = ".project-card"
PROJECT_TITLE = "h3"
AUTHOR_SELECTOR = ".author"
DEPLOY_TAB_SELECTOR = "text=Deploy"
MODEL_SECTION_SELECTOR = "text=Model"
MAP_SELECTOR = ".metric-mAP"
PRECISION_SELECTOR = ".metric-precision"
RECALL_SELECTOR = ".metric-recall"
TRAINING_IMAGES_SELECTOR = ".training-images-count"
TAGS_SELECTOR = ".tags span"
CLASSES_SELECTOR = ".classes span"
DESCRIPTION_SELECTOR = ".project-description"
API_ENDPOINT_SELECTOR = "input.api-endpoint"

MAX_RETRIES = 3


def connect_browser(headless=True):
    playwright = sync_playwright().start()
    browser = playwright.chromium.launch(headless=headless)
    context = browser.new_context(viewport={"width": SCREEN_WIDTH, "height": SCREEN_HEIGHT})
    page = context.new_page()
    return playwright, browser, page


def safe_text(page, selector):
    try:
        el = page.query_selector(selector)
        return el.inner_text().strip() if el else "N/A"
    except:
        return "N/A"


def safe_list(page, selector):
    try:
        els = page.query_selector_all(selector)
        return [el.inner_text().strip() for el in els] if els else []
    except:
        return []


def get_model_identifier(api_endpoint: str) -> str:
    try:
        parsed = urlparse(api_endpoint)
        return parsed.path.strip("/").replace("detect.roboflow.com/", "")
    except:
        return "N/A"


def extract_model_details(page, models: List[Dict]) -> Dict:
    api_endpoint_el = page.query_selector(API_ENDPOINT_SELECTOR)
    api_endpoint = api_endpoint_el.get_attribute("value") if api_endpoint_el else "N/A"
    model_data = {
        "model_identifier": get_model_identifier(api_endpoint),
        "model_name": safe_text(page, PROJECT_TITLE),
        "model_url": page.url,
        "author": safe_text(page, AUTHOR_SELECTOR),
        "mAP": safe_text(page, MAP_SELECTOR),
        "precision": safe_text(page, PRECISION_SELECTOR),
        "recall": safe_text(page, RECALL_SELECTOR),
        "training_images": safe_text(page, TRAINING_IMAGES_SELECTOR),
        "tags": safe_list(page, TAGS_SELECTOR),
        "classes": safe_list(page, CLASSES_SELECTOR),
        "description": safe_text(page, DESCRIPTION_SELECTOR),
        "api_endpoint": api_endpoint
    }
    print(f"   ✅ Extracted model: {model_data['model_identifier']} | Total models: {len(models)+1}")
    return model_data


def scroll_to_load_all(page):
    previous_height = 0
    while True:
        page.mouse.wheel(0, 1000)
        page.wait_for_timeout(1000)
        current_height = page.evaluate("document.body.scrollHeight")
        if current_height == previous_height:
            break
        previous_height = current_height


def get_model_version_buttons(page):
    try:
        buttons = page.query_selector_all("button")
        return [btn for btn in buttons if "v" in btn.inner_text().strip().lower() or "version" in btn.inner_text().lower()]
    except:
        return []


def click_with_retry(element, retries=MAX_RETRIES):
    for _ in range(retries):
        try:
            element.scroll_into_view_if_needed()
            element.click()
            return True
        except:
            continue
    return False


def search_roboflow_models(keywords: str, max_projects: int = 1, max_models: int = 50, headless=True) -> List[Dict]:
    playwright, browser, page = connect_browser(headless=headless)
    models = []

    try:
        print(f"🌐 Navigating to {SEARCH_URL}...")
        page.goto(SEARCH_URL, wait_until="load", timeout=60000)  # increased timeout

        # Wait for search box
        page.wait_for_selector(SEARCH_BOX, timeout=15000)
        page.fill(SEARCH_BOX, keywords)
        page.keyboard.press("Enter")

        # Wait for results to load
        page.wait_for_selector(PROJECT_CARD, timeout=30000)
        scroll_to_load_all(page)
        cards = page.query_selector_all(PROJECT_CARD)

        if not cards:
            print("❌ No projects found")
            return []

        print(f"🔹 Found {len(cards)} projects. Extracting up to {max_models} models...")

        for idx, card in enumerate(cards[:max_projects], 1):
            if len(models) >= max_models:
                break

            if not click_with_retry(card):
                continue
            page.wait_for_load_state("load")
            print(f"➡️ Clicking project {idx}/{len(cards[:max_projects])}: {safe_text(page, PROJECT_TITLE)}")

            # Open Deploy → Model
            try:
                deploy_tab = page.wait_for_selector(DEPLOY_TAB_SELECTOR, timeout=5000)
                click_with_retry(deploy_tab)
                model_section = page.wait_for_selector(MODEL_SECTION_SELECTOR, timeout=5000)
                click_with_retry(model_section)
            except TimeoutError:
                print("⚠️ Deploy → Model section not found")

            version_buttons = get_model_version_buttons(page)
            if not version_buttons:
                if len(models) < max_models:
                    models.append(extract_model_details(page, models))
            else:
                for v_idx, btn in enumerate(version_buttons, 1):
                    if len(models) >= max_models:
                        break
                    if click_with_retry(btn):
                        page.wait_for_timeout(500)
                        print(f"   🔹 Clicking version {v_idx}/{len(version_buttons)}")
                        models.append(extract_model_details(page, models))

            page.go_back()
            page.wait_for_selector(PROJECT_CARD, timeout=5000)

        print(f"✅ Finished extracting {len(models)} models.")
        return models

    finally:
        browser.close()
        playwright.stop()


def save_models_to_json(models: List[Dict], keywords: str):
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_keyword = keywords.replace(" ", "_")
    output_dir = Path("roboflow_results")
    output_dir.mkdir(exist_ok=True)
    filename = output_dir / f"{safe_keyword}_{timestamp}.json"

    with open(filename, "w", encoding="utf-8") as f:
        json.dump(models, f, indent=2, ensure_ascii=False)

    print(f"✅ Saved {len(models)} models to {filename}")


def main():
    keywords = os.getenv("SEARCH_KEYWORDS", "basketball detection")
    max_projects = int(os.getenv("MAX_PROJECTS", "5"))
    max_models = int(os.getenv("MAX_MODELS", "50"))

    models = search_roboflow_models(keywords, max_projects, max_models, headless=True)
    if models:
        save_models_to_json(models, keywords)
    else:
        print("❌ No models found")


if __name__ == "__main__":
    main()

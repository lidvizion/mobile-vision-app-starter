#!/usr/bin/env python3
"""
Test script for the Python Roboflow search agent
"""

import os
import sys

def test_imports():
    """Test if all required packages can be imported."""
    try:
        import google.genai as genai
        print("✅ google.genai imported successfully")
    except ImportError as e:
        print(f"❌ Failed to import google.genai: {e}")
        return False
    
    try:
        from playwright.sync_api import sync_playwright
        print("✅ playwright imported successfully")
    except ImportError as e:
        print(f"❌ Failed to import playwright: {e}")
        return False
    
    try:
        from google.genai import types
        print("✅ google.genai.types imported successfully")
    except ImportError as e:
        print(f"❌ Failed to import google.genai.types: {e}")
        return False
    
    return True

def test_environment():
    """Test environment variables."""
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        print("❌ GEMINI_API_KEY environment variable not set")
        return False
    else:
        print("✅ GEMINI_API_KEY is set")
        return True

def test_playwright():
    """Test if Playwright browsers are installed."""
    try:
        from playwright.sync_api import sync_playwright
        playwright = sync_playwright().start()
        browser = playwright.chromium.launch(headless=True)
        browser.close()
        playwright.stop()
        print("✅ Playwright browsers are working")
        return True
    except Exception as e:
        print(f"❌ Playwright test failed: {e}")
        return False

def main():
    """Run all tests."""
    print("🧪 Testing Python Roboflow Agent Setup...")
    print("=" * 50)
    
    tests = [
        ("Import Test", test_imports),
        ("Environment Test", test_environment),
        ("Playwright Test", test_playwright)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n🔍 {test_name}:")
        if test_func():
            passed += 1
            print(f"✅ {test_name} PASSED")
        else:
            print(f"❌ {test_name} FAILED")
    
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Python agent is ready to use.")
        return 0
    else:
        print("⚠️ Some tests failed. Please check the setup.")
        return 1

if __name__ == "__main__":
    sys.exit(main())

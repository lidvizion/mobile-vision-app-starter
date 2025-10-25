#!/usr/bin/env python3
"""
Embedded Browser for Roboflow Search using PyQt5 QWebEngineView
Provides a Chromium-based browser that can be controlled by Gemini Computer Use via CDP
"""

import os
import sys
from PyQt5.QtWidgets import QApplication, QMainWindow, QVBoxLayout, QWidget, QLabel, QPushButton, QHBoxLayout
from PyQt5.QtWebEngineWidgets import QWebEngineView
from PyQt5.QtCore import QUrl, QTimer
from PyQt5.QtGui import QIcon

class EmbeddedBrowser(QMainWindow):
    def __init__(self, start_url="https://universe.roboflow.com"):
        super().__init__()
        self.setWindowTitle("Roboflow Embedded Browser - Gemini Computer Use")
        self.resize(1280, 800)
        
        # Create central widget and layout
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        layout = QVBoxLayout(central_widget)
        
        # Add status bar
        status_layout = QHBoxLayout()
        self.status_label = QLabel("🔄 Initializing embedded browser...")
        status_layout.addWidget(self.status_label)
        
        # Add control buttons
        self.refresh_btn = QPushButton("🔄 Refresh")
        self.refresh_btn.clicked.connect(self.refresh_page)
        status_layout.addWidget(self.refresh_btn)
        
        self.home_btn = QPushButton("🏠 Home")
        self.home_btn.clicked.connect(self.go_home)
        status_layout.addWidget(self.home_btn)
        
        layout.addLayout(status_layout)
        
        # Create browser
        self.browser = QWebEngineView()
        self.browser.setUrl(QUrl(start_url))
        
        # Connect signals
        self.browser.urlChanged.connect(self.on_url_changed)
        self.browser.loadFinished.connect(self.on_load_finished)
        
        layout.addWidget(self.browser)
        
        # Update status
        self.status_label.setText("✅ Embedded browser ready - Gemini Computer Use can now control this browser")
        
        print("🌐 Embedded browser initialized")
        print(f"🔗 DevTools endpoint: http://localhost:9222")
        print(f"🌍 Starting URL: {start_url}")

    def on_url_changed(self, url):
        """Handle URL changes"""
        self.status_label.setText(f"🌐 Navigating to: {url.toString()}")

    def on_load_finished(self, success):
        """Handle page load completion"""
        if success:
            self.status_label.setText("✅ Page loaded successfully")
        else:
            self.status_label.setText("❌ Page load failed")

    def refresh_page(self):
        """Refresh the current page"""
        self.browser.reload()
        self.status_label.setText("🔄 Refreshing page...")

    def go_home(self):
        """Navigate to Roboflow Universe"""
        self.browser.setUrl(QUrl("https://universe.roboflow.com"))
        self.status_label.setText("🏠 Navigating to Roboflow Universe...")

    def get_current_url(self):
        """Get the current URL"""
        return self.browser.url().toString()

    def navigate_to(self, url):
        """Navigate to a specific URL"""
        self.browser.setUrl(QUrl(url))
        self.status_label.setText(f"🌐 Navigating to: {url}")

def main():
    """Main function to run the embedded browser"""
    print("🚀 Starting Roboflow Embedded Browser...")
    print("📋 This browser will be controlled by Gemini Computer Use")
    print("🔗 DevTools Protocol enabled on port 9222")
    
    # Enable remote debugging for Gemini Computer Use
    os.environ["QTWEBENGINE_REMOTE_DEBUGGING"] = "9222"
    
    # Create application
    app = QApplication(sys.argv)
    app.setApplicationName("Roboflow Embedded Browser")
    
    # Create and show window
    window = EmbeddedBrowser()
    window.show()
    
    print("✅ Embedded browser is now running")
    print("🤖 Gemini Computer Use can now connect to this browser")
    print("🔗 DevTools endpoint: http://localhost:9222/json")
    
    # Run the application
    sys.exit(app.exec_())

if __name__ == "__main__":
    main()
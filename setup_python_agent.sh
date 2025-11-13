#!/bin/bash

echo "🐍 Setting up Python Roboflow Search Agent..."

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip install google-genai playwright

# Install Playwright browsers
echo "🌐 Installing Playwright browsers..."
playwright install chromium

# Set up environment
echo "🔧 Setting up environment..."
if [ ! -f .env ]; then
    echo "GEMINI_API_KEY=your_gemini_api_key_here" > .env
    echo "⚠️  Please update .env with your actual GEMINI_API_KEY"
fi

echo "✅ Setup complete!"
echo "📝 To run the agent:"
echo "   python roboflow_search_agent.py"

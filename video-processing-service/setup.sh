#!/bin/bash

# Video Processing Service Setup Script

echo "🚀 Setting up Video Processing Service..."

# Create virtual environment
echo "📦 Creating virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📚 Installing dependencies..."
pip install -r requirements.txt

# Generate Prisma client
echo "🗄️ Generating Prisma client..."
prisma generate

echo "✅ Setup complete!"
echo ""
echo "To start the service:"
echo "1. Activate virtual environment: source venv/bin/activate"
echo "2. Copy .env.example to .env and configure your settings"
echo "3. Run: python main.py"
echo ""
echo "Or use uvicorn directly:"
echo "uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
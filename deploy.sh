#!/bin/bash

# ===========================================
# WORLDGPZ Deployment Script
# Automated deployment for all platforms
# ===========================================

echo "🌍 WORLDGPZ Deployment Script"
echo "© 2024 ThaddeusTechz - All Rights Reserved"
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Functions
log_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

log_info() {
    echo -e "${YELLOW}→ $1${NC}"
}

log_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check Node.js
check_node() {
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi
    log_success "Node.js version: $(node -v)"
}

# Deploy to Render
deploy_render() {
    log_info "Deploying to Render.com..."
    echo ""
    echo "1. Go to https://render.com"
    echo "2. Connect your GitHub repository"
    echo "3. Create Web Service for backend (port 5000)"
    echo "4. Create Static Site for frontend"
    echo "5. Set environment variables"
    echo ""
    echo "Backend settings:"
    echo "  - Build Command: cd backend && npm install"
    echo "  - Start Command: cd backend && npm start"
    echo ""
    echo "Frontend settings:"
    echo "  - Root Directory: frontend"
    echo "  - Build Command: npm install && npm run build"
    echo "  - Publish Directory: dist"
    echo ""
}

# Deploy to Vercel
deploy_vercel() {
    log_info "Deploying to Vercel..."
    cd frontend
    npx vercel --prod
    cd ..
}

# Deploy to Netlify
deploy_netlify() {
    log_info "Deploying to Netlify..."
    cd frontend
    npx netlify deploy --prod
    cd ..
}

# Main menu
show_menu() {
    echo ""
    echo "Select deployment platform:"
    echo ""
    echo "1. Render.com (Recommended - Free)"
    echo "2. Vercel (Frontend only)"
    echo "3. Netlify (Frontend only)"
    echo "4. Railway.app"
    echo "5. Deploy all locally"
    echo "6. Full instructions"
    echo "7. Exit"
    echo ""
    read -p "Enter your choice (1-7): " choice
    
    case $choice in
        1) deploy_render ;;
        2) deploy_vercel ;;
        3) deploy_netlify ;;
        4) 
            log_info "Railway.app deployment:"
            echo "  1. Go to https://railway.app"
            echo "  2. Connect GitHub repo"
            echo "  3. railway login"
            echo "  4. railway init"
            echo "  5. railway up"
            ;;
        5) 
            log_info "Starting local deployment..."
            echo ""
            log_info "Starting backend on port 5000..."
            cd backend && npm install && npm run dev &
            sleep 3
            log_info "Starting frontend on port 3000..."
            cd ../frontend && npm install && npm run dev &
            echo ""
            log_success "Services started!"
            echo "Backend: http://localhost:5000"
            echo "Frontend: http://localhost:3000"
            ;;
        6) 
            echo ""
            echo "Opening deployment documentation..."
            cat docs/DEPLOYMENT.md
            ;;
        7) 
            echo "Goodbye!"
            exit 0
            ;;
        *)
            log_error "Invalid option"
            show_menu
            ;;
    esac
}

# Run
check_node
show_menu
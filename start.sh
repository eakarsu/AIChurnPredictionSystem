#!/bin/bash

# AI Churn Prediction System - Startup Script
# This script cleans ports, seeds the database, and starts the application with hot-reload

echo "========================================"
echo "  AI Churn Prediction System Startup"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
BACKEND_PORT=3001
FRONTEND_PORT=3000

# Function to kill process on a port
kill_port() {
    local port=$1
    echo -e "${YELLOW}Checking port $port...${NC}"

    # Find PID using the port
    local pid=$(lsof -ti:$port 2>/dev/null)

    if [ ! -z "$pid" ]; then
        echo -e "${YELLOW}Killing process on port $port (PID: $pid)${NC}"
        kill -9 $pid 2>/dev/null
        sleep 1
        echo -e "${GREEN}Port $port cleared${NC}"
    else
        echo -e "${GREEN}Port $port is available${NC}"
    fi
}

# Function to check if PostgreSQL is running
check_postgres() {
    echo -e "${YELLOW}Checking PostgreSQL connection...${NC}"
    if pg_isready -q 2>/dev/null; then
        echo -e "${GREEN}PostgreSQL is running${NC}"
        return 0
    else
        echo -e "${RED}PostgreSQL is not running. Please start PostgreSQL first.${NC}"
        echo "On macOS: brew services start postgresql"
        echo "On Linux: sudo systemctl start postgresql"
        return 1
    fi
}

# Function to install dependencies
install_deps() {
    echo ""
    echo -e "${YELLOW}Installing backend dependencies...${NC}"
    cd backend
    npm install
    cd ..

    echo ""
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    cd frontend
    npm install
    cd ..
}

# Function to seed the database
seed_database() {
    echo ""
    echo -e "${YELLOW}Seeding database with sample data...${NC}"
    echo -e "${CYAN}This includes all 7 AI features with 15+ items each:${NC}"
    echo -e "${CYAN}  - AI Sentiment Analysis${NC}"
    echo -e "${CYAN}  - AI Customer Journey Mapper${NC}"
    echo -e "${CYAN}  - AI Win-Back Campaigns${NC}"
    echo -e "${CYAN}  - AI Customer Health Score${NC}"
    echo -e "${CYAN}  - AI Escalation Predictor${NC}"
    echo -e "${CYAN}  - AI Service Level Predictor${NC}"
    echo -e "${CYAN}  - AI Response Suggester${NC}"
    cd backend
    node seed.js
    cd ..
    echo -e "${GREEN}Database seeded successfully${NC}"
}

# Function to start the backend with hot-reload
start_backend() {
    echo ""
    echo -e "${YELLOW}Starting backend server on port $BACKEND_PORT (with nodemon hot-reload)...${NC}"
    cd backend
    npm run dev &
    BACKEND_PID=$!
    cd ..
    echo -e "${GREEN}Backend started with nodemon (PID: $BACKEND_PID)${NC}"
    echo -e "${CYAN}Backend will auto-reload on code changes${NC}"
}

# Function to start the frontend with hot-reload
start_frontend() {
    echo ""
    echo -e "${YELLOW}Starting frontend on port $FRONTEND_PORT (with hot-reload)...${NC}"
    cd frontend
    BROWSER=none npm start &
    FRONTEND_PID=$!
    cd ..
    echo -e "${GREEN}Frontend started (PID: $FRONTEND_PID)${NC}"
    echo -e "${CYAN}Frontend will auto-reload on code changes${NC}"
}

# Main execution
main() {
    # Navigate to project root
    cd "$(dirname "$0")"

    echo ""
    echo "Step 1: Cleaning up ports..."
    echo "----------------------------"
    kill_port $BACKEND_PORT
    kill_port $FRONTEND_PORT

    # Also clean up any orphaned node processes
    echo -e "${YELLOW}Cleaning up orphaned node processes...${NC}"
    pkill -f "node.*seed.js" 2>/dev/null
    pkill -f "nodemon" 2>/dev/null

    echo ""
    echo "Step 2: Checking PostgreSQL..."
    echo "------------------------------"
    if ! check_postgres; then
        exit 1
    fi

    echo ""
    echo "Step 3: Installing dependencies..."
    echo "----------------------------------"
    install_deps

    echo ""
    echo "Step 4: Seeding database..."
    echo "---------------------------"
    seed_database

    echo ""
    echo "Step 5: Starting services with hot-reload..."
    echo "---------------------------------------------"
    start_backend

    # Wait for backend to be ready
    echo -e "${YELLOW}Waiting for backend to be ready...${NC}"
    sleep 3

    start_frontend

    echo ""
    echo "========================================"
    echo -e "${GREEN}  Application Started Successfully!${NC}"
    echo "========================================"
    echo ""
    echo "Access the application at:"
    echo -e "  Frontend: ${GREEN}http://localhost:$FRONTEND_PORT${NC}"
    echo -e "  Backend:  ${GREEN}http://localhost:$BACKEND_PORT${NC}"
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  Login Credentials:${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo -e "  Email:    ${GREEN}demo@churnpredict.com${NC}"
    echo -e "  Password: ${GREEN}password123${NC}"
    echo ""
    echo -e "  Or click ${CYAN}'Fill Demo Credentials'${NC} button on the login page"
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  NEW AI Features Available:${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo -e "  ${CYAN}1. AI Sentiment Analysis${NC} - Analyze customer feedback for churn signals"
    echo -e "  ${CYAN}2. AI Journey Mapper${NC} - Visualize touchpoints before churn"
    echo -e "  ${CYAN}3. AI Win-Back Campaigns${NC} - Create personalized retention offers"
    echo -e "  ${CYAN}4. AI Health Score${NC} - Real-time account health dashboard"
    echo -e "  ${CYAN}5. AI Escalation Predictor${NC} - Identify frustrated customers early"
    echo -e "  ${CYAN}6. AI Service Level Predictor${NC} - Predict response/resolution times & SLA"
    echo -e "  ${CYAN}7. AI Response Suggester${NC} - Generate personalized service responses"
    echo ""
    echo -e "${YELLOW}Hot-reload is enabled:${NC}"
    echo -e "  - Backend changes will auto-reload via nodemon"
    echo -e "  - Frontend changes will auto-reload via React"
    echo ""
    echo "Press Ctrl+C to stop all services"

    # Wait for user interrupt
    trap cleanup INT
    wait
}

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down services...${NC}"
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    kill_port $BACKEND_PORT
    kill_port $FRONTEND_PORT
    pkill -f "nodemon" 2>/dev/null
    echo -e "${GREEN}Services stopped${NC}"
    exit 0
}

# Run main function
main

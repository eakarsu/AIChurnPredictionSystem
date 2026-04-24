# AI Churn Prediction System

A comprehensive SaaS application for predicting and preventing customer churn using AI-powered analytics.

## Features

- **Customer Management**: Track and manage customer data
- **Churn Predictions**: AI-powered churn risk analysis using OpenRouter
- **Risk Scores**: Automated risk assessment for customers
- **Customer Segments**: Group customers by behavior and attributes
- **Interventions**: AI-suggested actions to prevent churn
- **Behavior Analytics**: Track customer behavior patterns
- **Usage Metrics**: Monitor product usage statistics
- **Engagement Scores**: Measure customer engagement levels
- **Support Tickets**: Track support interactions
- **Billing History**: Monitor payment history
- **Feature Usage**: Track feature adoption rates
- **User Sessions**: Analyze user session data
- **NPS Scores**: Track Net Promoter Scores
- **Health Scores**: Overall customer health metrics
- **Alerts**: Real-time notifications for at-risk customers

## Tech Stack

- **Frontend**: React 18, React Router, Recharts
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **AI**: OpenRouter API (Claude, GPT, etc.)

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- OpenRouter API key

## Quick Start

1. **Configure environment**:
   ```bash
   # Edit .env file and add your OpenRouter API key
   OPENROUTER_API_KEY=your_key_here
   ```

2. **Start the application**:
   ```bash
   ./start.sh
   ```

3. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001

4. **Login credentials**:
   - Email: demo@churnpredict.com
   - Password: password123

## Manual Setup

If you prefer manual setup:

```bash
# Install backend dependencies
cd backend
npm install

# Seed the database
node seed.js

# Start backend
npm start

# In another terminal, install frontend dependencies
cd frontend
npm install

# Start frontend
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Customers
- `GET /api/customers` - List all customers
- `GET /api/customers/:id` - Get customer details
- `POST /api/customers` - Create customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer

### AI Features
- `POST /api/ai/analyze-churn` - Analyze churn risk
- `POST /api/ai/suggest-intervention` - Get AI intervention suggestions
- `POST /api/ai/segment-analysis` - Analyze customer segment
- `POST /api/ai/predict-revenue-impact` - Predict revenue impact
- `POST /api/ai/generate-report` - Generate AI report

### Other Endpoints
All CRUD endpoints follow the same pattern:
- `/api/predictions`
- `/api/risk-scores`
- `/api/segments`
- `/api/interventions`
- `/api/behavior`
- `/api/metrics`
- `/api/engagement`
- `/api/tickets`
- `/api/billing`
- `/api/features`
- `/api/sessions`
- `/api/nps`
- `/api/health`
- `/api/alerts`

## Database Schema

The system uses 16 interconnected tables:
- users
- customers
- churn_predictions
- risk_scores
- customer_segments
- interventions
- behavior_analytics
- usage_metrics
- engagement_scores
- support_tickets
- billing_history
- feature_usage
- user_sessions
- nps_scores
- health_scores
- alerts

## License

MIT

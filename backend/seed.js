const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

function requireDemoPassword() {
  const password = process.env.DEMO_PASSWORD || process.env.SEED_DEMO_PASSWORD || process.env.DEMO_SEED_PASSWORD || '';
  if (password.length < 12 || password.length > 1024) throw new Error('DEMO_PASSWORD must contain 12-1024 characters');
  return password;
}

async function seed() {
  const client = await pool.connect();

  try {
    // Create database if not exists
    const dbCheck = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'churn_prediction'"
    );

    if (dbCheck.rows.length === 0) {
      await client.query('CREATE DATABASE churn_prediction');
      console.log('Database created');
    }

    await client.release();

    // Connect to the new database
    const appPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'churn_prediction',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });

    const appClient = await appPool.connect();

    // Drop existing tables
    await appClient.query(`
      DROP TABLE IF EXISTS response_suggestions CASCADE;
      DROP TABLE IF EXISTS service_level_predictions CASCADE;
      DROP TABLE IF EXISTS escalation_predictions CASCADE;
      DROP TABLE IF EXISTS customer_health_dashboard CASCADE;
      DROP TABLE IF EXISTS winback_campaigns CASCADE;
      DROP TABLE IF EXISTS customer_journeys CASCADE;
      DROP TABLE IF EXISTS sentiment_analysis CASCADE;
      DROP TABLE IF EXISTS alerts CASCADE;
      DROP TABLE IF EXISTS health_scores CASCADE;
      DROP TABLE IF EXISTS nps_scores CASCADE;
      DROP TABLE IF EXISTS user_sessions CASCADE;
      DROP TABLE IF EXISTS feature_usage CASCADE;
      DROP TABLE IF EXISTS billing_history CASCADE;
      DROP TABLE IF EXISTS support_tickets CASCADE;
      DROP TABLE IF EXISTS engagement_scores CASCADE;
      DROP TABLE IF EXISTS usage_metrics CASCADE;
      DROP TABLE IF EXISTS behavior_analytics CASCADE;
      DROP TABLE IF EXISTS interventions CASCADE;
      DROP TABLE IF EXISTS customer_segments CASCADE;
      DROP TABLE IF EXISTS risk_scores CASCADE;
      DROP TABLE IF EXISTS churn_predictions CASCADE;
      DROP TABLE IF EXISTS customers CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);

    // Create tables
    await appClient.query(`
      -- Users table for authentication
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        email_verified BOOLEAN DEFAULT false,
        verification_token VARCHAR(255),
        reset_token VARCHAR(255),
        reset_token_expires TIMESTAMP,
        avatar VARCHAR(500),
        phone VARCHAR(50),
        department VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Customers table
      CREATE TABLE customers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        company VARCHAR(255),
        plan VARCHAR(100),
        monthly_revenue DECIMAL(10,2),
        signup_date DATE,
        last_activity DATE,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Churn Predictions table
      CREATE TABLE churn_predictions (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        prediction_score DECIMAL(5,2),
        prediction_date DATE,
        confidence_level DECIMAL(5,2),
        factors TEXT[],
        status VARCHAR(50) DEFAULT 'pending',
        ai_analysis TEXT,
        ai_response JSONB,
        ai_response_time_ms INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Risk Scores table
      CREATE TABLE risk_scores (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        risk_level VARCHAR(50),
        score DECIMAL(5,2),
        category VARCHAR(100),
        contributing_factors TEXT[],
        recommended_actions TEXT[],
        ai_response JSONB,
        ai_response_time_ms INTEGER,
        calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Customer Segments table
      CREATE TABLE customer_segments (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        criteria JSONB,
        customer_count INTEGER DEFAULT 0,
        avg_revenue DECIMAL(10,2),
        churn_rate DECIMAL(5,2),
        ai_response JSONB,
        ai_response_time_ms INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Interventions table
      CREATE TABLE interventions (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        type VARCHAR(100),
        description TEXT,
        priority VARCHAR(50),
        status VARCHAR(50) DEFAULT 'pending',
        suggested_by VARCHAR(100) DEFAULT 'AI',
        effectiveness_score DECIMAL(5,2),
        due_date DATE,
        completed_at TIMESTAMP,
        ai_suggestions JSONB,
        ai_response_time_ms INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Behavior Analytics table
      CREATE TABLE behavior_analytics (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        event_type VARCHAR(100),
        event_data JSONB,
        session_id VARCHAR(255),
        page_visited VARCHAR(255),
        action_taken VARCHAR(255),
        ai_response JSONB,
        ai_response_time_ms INTEGER,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Usage Metrics table
      CREATE TABLE usage_metrics (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        metric_name VARCHAR(100),
        metric_value DECIMAL(15,2),
        period_start DATE,
        period_end DATE,
        trend VARCHAR(50),
        comparison_value DECIMAL(15,2),
        ai_response JSONB,
        ai_response_time_ms INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Engagement Scores table
      CREATE TABLE engagement_scores (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        overall_score DECIMAL(5,2),
        login_frequency DECIMAL(5,2),
        feature_adoption DECIMAL(5,2),
        support_interaction DECIMAL(5,2),
        feedback_score DECIMAL(5,2),
        ai_response JSONB,
        ai_response_time_ms INTEGER,
        calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Support Tickets table
      CREATE TABLE support_tickets (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        subject VARCHAR(255),
        description TEXT,
        priority VARCHAR(50),
        status VARCHAR(50) DEFAULT 'open',
        category VARCHAR(100),
        assigned_to VARCHAR(255),
        resolution TEXT,
        ai_response JSONB,
        ai_response_time_ms INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP
      );

      -- Billing History table
      CREATE TABLE billing_history (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        invoice_number VARCHAR(100),
        amount DECIMAL(10,2),
        currency VARCHAR(10) DEFAULT 'USD',
        status VARCHAR(50),
        payment_method VARCHAR(100),
        billing_date DATE,
        due_date DATE,
        paid_at TIMESTAMP,
        ai_response JSONB,
        ai_response_time_ms INTEGER
      );

      -- Feature Usage table
      CREATE TABLE feature_usage (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        feature_name VARCHAR(255),
        usage_count INTEGER,
        last_used TIMESTAMP,
        adoption_rate DECIMAL(5,2),
        time_spent_minutes INTEGER,
        period VARCHAR(50),
        ai_response JSONB,
        ai_response_time_ms INTEGER
      );

      -- User Sessions table
      CREATE TABLE user_sessions (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        session_start TIMESTAMP,
        session_end TIMESTAMP,
        duration_minutes INTEGER,
        pages_viewed INTEGER,
        actions_taken INTEGER,
        device_type VARCHAR(100),
        browser VARCHAR(100),
        ip_address VARCHAR(50),
        ai_response JSONB,
        ai_response_time_ms INTEGER
      );

      -- NPS Scores table
      CREATE TABLE nps_scores (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        score INTEGER CHECK (score >= 0 AND score <= 10),
        feedback TEXT,
        category VARCHAR(50),
        survey_date DATE,
        follow_up_required BOOLEAN DEFAULT FALSE,
        ai_response JSONB,
        ai_response_time_ms INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Health Scores table
      CREATE TABLE health_scores (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        overall_health DECIMAL(5,2),
        product_usage DECIMAL(5,2),
        customer_satisfaction DECIMAL(5,2),
        growth_potential DECIMAL(5,2),
        support_health DECIMAL(5,2),
        financial_health DECIMAL(5,2),
        trend VARCHAR(50),
        ai_response JSONB,
        ai_response_time_ms INTEGER,
        calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Alerts table
      CREATE TABLE alerts (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        alert_type VARCHAR(100),
        severity VARCHAR(50),
        message TEXT,
        is_read BOOLEAN DEFAULT FALSE,
        is_resolved BOOLEAN DEFAULT FALSE,
        ai_response JSONB,
        ai_response_time_ms INTEGER,
        triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP
      );

      -- Sentiment Analysis table (NEW FEATURE)
      CREATE TABLE sentiment_analysis (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        feedback_source VARCHAR(100),
        feedback_text TEXT,
        sentiment_score DECIMAL(5,2),
        sentiment_label VARCHAR(50),
        churn_signal_strength DECIMAL(5,2),
        key_phrases TEXT[],
        emotions JSONB,
        urgency_level VARCHAR(50),
        recommended_action TEXT,
        ai_response JSONB,
        ai_response_time_ms INTEGER,
        analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Customer Journeys table (NEW FEATURE)
      CREATE TABLE customer_journeys (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        journey_stage VARCHAR(100),
        touchpoint_type VARCHAR(100),
        touchpoint_name VARCHAR(255),
        touchpoint_date TIMESTAMP,
        sentiment_at_touchpoint VARCHAR(50),
        engagement_level DECIMAL(5,2),
        is_churn_indicator BOOLEAN DEFAULT FALSE,
        days_before_churn INTEGER,
        journey_path JSONB,
        ai_insights TEXT,
        ai_response JSONB,
        ai_response_time_ms INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Win-Back Campaigns table (NEW FEATURE)
      CREATE TABLE winback_campaigns (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        campaign_name VARCHAR(255),
        campaign_type VARCHAR(100),
        offer_type VARCHAR(100),
        offer_details TEXT,
        discount_percentage DECIMAL(5,2),
        personalization_score DECIMAL(5,2),
        predicted_success_rate DECIMAL(5,2),
        email_subject VARCHAR(255),
        email_body TEXT,
        status VARCHAR(50) DEFAULT 'draft',
        sent_at TIMESTAMP,
        opened_at TIMESTAMP,
        responded_at TIMESTAMP,
        conversion_status VARCHAR(50),
        ai_response JSONB,
        ai_response_time_ms INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Customer Health Dashboard table (NEW FEATURE)
      CREATE TABLE customer_health_dashboard (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        health_score DECIMAL(5,2),
        engagement_index DECIMAL(5,2),
        satisfaction_index DECIMAL(5,2),
        financial_health DECIMAL(5,2),
        product_adoption DECIMAL(5,2),
        support_sentiment DECIMAL(5,2),
        risk_indicators JSONB,
        positive_signals JSONB,
        trend_direction VARCHAR(50),
        trend_percentage DECIMAL(5,2),
        last_activity_days INTEGER,
        recommended_actions TEXT[],
        ai_summary TEXT,
        ai_response JSONB,
        ai_response_time_ms INTEGER,
        calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Escalation Predictions table (NEW FEATURE)
      CREATE TABLE escalation_predictions (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        frustration_score DECIMAL(5,2),
        escalation_probability DECIMAL(5,2),
        frustration_indicators TEXT[],
        recent_issues JSONB,
        communication_sentiment VARCHAR(50),
        response_urgency VARCHAR(50),
        predicted_escalation_type VARCHAR(100),
        recommended_preemptive_action TEXT,
        agent_talking_points TEXT[],
        priority_level VARCHAR(50),
        status VARCHAR(50) DEFAULT 'active',
        escalated_at TIMESTAMP,
        resolved_at TIMESTAMP,
        ai_response JSONB,
        ai_response_time_ms INTEGER,
        predicted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Service Level Predictions table (NEW FEATURE)
      CREATE TABLE service_level_predictions (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        predicted_response_time INTEGER,
        predicted_resolution_time INTEGER,
        sla_compliance_probability DECIMAL(5,2),
        service_tier VARCHAR(50),
        priority_score DECIMAL(5,2),
        queue_position INTEGER,
        expected_first_response VARCHAR(100),
        expected_resolution VARCHAR(100),
        bottleneck_factors TEXT[],
        optimization_suggestions TEXT[],
        agent_workload_impact VARCHAR(50),
        customer_patience_index DECIMAL(5,2),
        ai_response JSONB,
        ai_response_time_ms INTEGER,
        predicted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Response Suggestions table (NEW FEATURE)
      CREATE TABLE response_suggestions (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        ticket_subject VARCHAR(255),
        ticket_description TEXT,
        suggested_response TEXT,
        response_tone VARCHAR(50),
        personalization_level DECIMAL(5,2),
        key_points TEXT[],
        empathy_phrases TEXT[],
        solution_steps TEXT[],
        follow_up_actions JSONB,
        estimated_satisfaction DECIMAL(5,2),
        alternative_responses JSONB,
        knowledge_base_links TEXT[],
        ai_response JSONB,
        ai_response_time_ms INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Tables created successfully');

    // Seed Users
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(requireDemoPassword(), 10);

    await appClient.query(`
      INSERT INTO users (email, password, name, role, email_verified, phone, department) VALUES
      ('admin@churnpredict.com', $1, 'Admin User', 'admin', true, '+1-555-100-0001', 'Engineering'),
      ('demo@churnpredict.com', $1, 'Demo User', 'user', true, '+1-555-100-0002', 'Sales'),
      ('analyst@churnpredict.com', $1, 'Data Analyst', 'analyst', true, '+1-555-100-0003', 'Data Science'),
      ('manager@churnpredict.com', $1, 'Team Manager', 'manager', true, '+1-555-100-0004', 'Operations'),
      ('viewer@churnpredict.com', $1, 'Report Viewer', 'viewer', false, '+1-555-100-0005', 'Marketing')
    `, [hashedPassword]);

    console.log('Users seeded');

    // Seed Customers (15+ items)
    await appClient.query(`
      INSERT INTO customers (name, email, company, plan, monthly_revenue, signup_date, last_activity, status) VALUES
      ('John Smith', 'john.smith@techcorp.com', 'TechCorp Inc', 'Enterprise', 2500.00, '2023-01-15', '2024-01-10', 'active'),
      ('Sarah Johnson', 'sarah.j@startup.io', 'Startup.io', 'Professional', 500.00, '2023-03-20', '2024-01-08', 'active'),
      ('Mike Williams', 'mike.w@bigdata.com', 'BigData Solutions', 'Enterprise', 3500.00, '2022-11-01', '2024-01-12', 'active'),
      ('Emily Brown', 'emily.b@smallbiz.net', 'SmallBiz Network', 'Starter', 99.00, '2023-06-15', '2023-12-20', 'at-risk'),
      ('David Lee', 'david.lee@innovate.co', 'Innovate Co', 'Professional', 750.00, '2023-02-28', '2024-01-11', 'active'),
      ('Jennifer Davis', 'jen.d@marketpro.com', 'MarketPro', 'Enterprise', 4000.00, '2022-08-10', '2024-01-09', 'active'),
      ('Robert Wilson', 'rob.w@fintech.io', 'FinTech Solutions', 'Professional', 1200.00, '2023-04-05', '2023-11-15', 'at-risk'),
      ('Lisa Anderson', 'lisa.a@healthtech.com', 'HealthTech Inc', 'Enterprise', 5500.00, '2022-05-20', '2024-01-12', 'active'),
      ('James Taylor', 'james.t@edulearn.org', 'EduLearn', 'Starter', 150.00, '2023-07-01', '2023-10-30', 'churned'),
      ('Amanda Martinez', 'amanda.m@retailplus.com', 'RetailPlus', 'Professional', 850.00, '2023-01-10', '2024-01-07', 'active'),
      ('Christopher Garcia', 'chris.g@logisticspro.com', 'LogisticsPro', 'Enterprise', 2800.00, '2022-12-15', '2024-01-11', 'active'),
      ('Michelle Robinson', 'michelle.r@mediamax.io', 'MediaMax', 'Professional', 600.00, '2023-05-25', '2023-12-28', 'at-risk'),
      ('Daniel Clark', 'daniel.c@constructco.com', 'ConstructCo', 'Starter', 199.00, '2023-08-10', '2024-01-05', 'active'),
      ('Jessica Lewis', 'jessica.l@travelwise.com', 'TravelWise', 'Professional', 950.00, '2023-02-14', '2024-01-10', 'active'),
      ('Matthew Walker', 'matt.w@foodchain.io', 'FoodChain', 'Enterprise', 3200.00, '2022-09-30', '2024-01-12', 'active'),
      ('Ashley Hall', 'ashley.h@fitnesshub.com', 'FitnessHub', 'Starter', 125.00, '2023-09-15', '2023-12-01', 'at-risk'),
      ('Andrew Young', 'andrew.y@automate.io', 'Automate.io', 'Professional', 1100.00, '2023-03-08', '2024-01-08', 'active'),
      ('Stephanie King', 'steph.k@beautybox.com', 'BeautyBox', 'Professional', 700.00, '2023-04-20', '2023-11-20', 'churned')
    `);

    console.log('Customers seeded');

    // Seed Churn Predictions (15+ items)
    await appClient.query(`
      INSERT INTO churn_predictions (customer_id, prediction_score, prediction_date, confidence_level, factors, status, ai_analysis) VALUES
      (1, 15.5, '2024-01-10', 92.0, ARRAY['High engagement', 'Regular payments', 'Feature adoption'], 'low-risk', 'Customer shows strong product engagement and consistent payment history. Low churn probability.'),
      (2, 25.0, '2024-01-10', 88.5, ARRAY['Moderate usage', 'Some support tickets', 'Good retention'], 'low-risk', 'Startup customer with moderate activity. Monitor feature adoption.'),
      (3, 12.0, '2024-01-10', 95.0, ARRAY['Enterprise commitment', 'High usage', 'Multiple users'], 'low-risk', 'Enterprise customer with deep product integration. Very low churn risk.'),
      (4, 72.5, '2024-01-10', 85.0, ARRAY['Declining usage', 'Payment delays', 'Low engagement'], 'high-risk', 'Significant usage decline detected. Immediate intervention recommended.'),
      (5, 18.0, '2024-01-10', 90.0, ARRAY['Good engagement', 'Regular logins', 'Feature exploration'], 'low-risk', 'Healthy engagement patterns. Continue current success path.'),
      (6, 8.5, '2024-01-10', 94.0, ARRAY['Top tier usage', 'Multiple integrations', 'Champion user'], 'low-risk', 'Power user with extensive platform investment. Minimal churn risk.'),
      (7, 65.0, '2024-01-10', 82.0, ARRAY['Reduced activity', 'Support complaints', 'Feature abandonment'], 'high-risk', 'Customer showing disengagement signs. Schedule check-in call.'),
      (8, 5.0, '2024-01-10', 96.0, ARRAY['Exceptional usage', 'Long-term contract', 'High satisfaction'], 'low-risk', 'Premium enterprise customer with high satisfaction. Excellent retention probability.'),
      (9, 95.0, '2024-01-10', 78.0, ARRAY['No activity', 'Cancelled meetings', 'No response'], 'churned', 'Customer has churned. Post-mortem analysis recommended.'),
      (10, 22.0, '2024-01-10', 89.0, ARRAY['Stable usage', 'Regular payments', 'Moderate engagement'], 'low-risk', 'Consistent customer behavior. Standard retention activities sufficient.'),
      (11, 14.0, '2024-01-10', 91.0, ARRAY['Growing usage', 'Team expansion', 'New integrations'], 'low-risk', 'Expanding account with growth potential. Upsell opportunities exist.'),
      (12, 58.0, '2024-01-10', 80.0, ARRAY['Sporadic usage', 'Billing issues', 'Limited adoption'], 'medium-risk', 'Mixed signals detected. Proactive engagement recommended.'),
      (13, 35.0, '2024-01-10', 86.0, ARRAY['New customer', 'Learning phase', 'Active support'], 'medium-risk', 'New customer in onboarding. Close monitoring during ramp-up period.'),
      (14, 20.0, '2024-01-10', 88.0, ARRAY['Good retention', 'Feature usage', 'Positive feedback'], 'low-risk', 'Healthy customer relationship. Standard nurturing recommended.'),
      (15, 10.0, '2024-01-10', 93.0, ARRAY['High value', 'Deep integration', 'Strong advocacy'], 'low-risk', 'Strategic account with excellent health indicators.'),
      (16, 78.0, '2024-01-10', 84.0, ARRAY['Minimal usage', 'No growth', 'Price sensitivity'], 'high-risk', 'At-risk customer requiring immediate attention.'),
      (17, 28.0, '2024-01-10', 87.0, ARRAY['Moderate engagement', 'Consistent payments', 'Some growth'], 'low-risk', 'Stable customer with potential for expansion.'),
      (18, 98.0, '2024-01-10', 92.0, ARRAY['Account closed', 'Competitor switch', 'Budget cuts'], 'churned', 'Customer churned to competitor. Win-back campaign possible.')
    `);

    console.log('Churn predictions seeded');

    // Seed Risk Scores (15+ items)
    await appClient.query(`
      INSERT INTO risk_scores (customer_id, risk_level, score, category, contributing_factors, recommended_actions) VALUES
      (1, 'Low', 15.5, 'Engagement', ARRAY['Regular logins', 'Feature adoption'], ARRAY['Continue current engagement', 'Explore upsell']),
      (2, 'Low', 25.0, 'Usage', ARRAY['Moderate activity', 'Growing team'], ARRAY['Increase feature awareness', 'Schedule training']),
      (3, 'Low', 12.0, 'Enterprise', ARRAY['High investment', 'Multiple departments'], ARRAY['Maintain relationship', 'Quarterly reviews']),
      (4, 'High', 72.5, 'Engagement', ARRAY['Declining logins', 'Reduced usage'], ARRAY['Immediate outreach', 'Offer incentives']),
      (5, 'Low', 18.0, 'Usage', ARRAY['Consistent patterns', 'Good adoption'], ARRAY['Share best practices', 'Feature highlights']),
      (6, 'Low', 8.5, 'Enterprise', ARRAY['Champion users', 'Deep integration'], ARRAY['Nurture relationship', 'Case study opportunity']),
      (7, 'High', 65.0, 'Support', ARRAY['Frequent complaints', 'Unresolved issues'], ARRAY['Escalate to management', 'Priority support']),
      (8, 'Low', 5.0, 'Enterprise', ARRAY['Strategic account', 'Long contract'], ARRAY['Executive engagement', 'Innovation preview']),
      (9, 'Critical', 95.0, 'Churn', ARRAY['No activity', 'Cancelled subscription'], ARRAY['Win-back campaign', 'Exit interview']),
      (10, 'Low', 22.0, 'Financial', ARRAY['On-time payments', 'Stable revenue'], ARRAY['Standard nurturing', 'Annual review']),
      (11, 'Low', 14.0, 'Growth', ARRAY['Expanding team', 'New use cases'], ARRAY['Support expansion', 'Additional training']),
      (12, 'Medium', 58.0, 'Engagement', ARRAY['Inconsistent usage', 'Support gaps'], ARRAY['Check-in call', 'Usage review']),
      (13, 'Medium', 35.0, 'Onboarding', ARRAY['New customer', 'Learning curve'], ARRAY['Enhanced onboarding', 'Success planning']),
      (14, 'Low', 20.0, 'Satisfaction', ARRAY['Positive NPS', 'Good feedback'], ARRAY['Maintain quality', 'Referral program']),
      (15, 'Low', 10.0, 'Strategic', ARRAY['Key account', 'High revenue'], ARRAY['White glove service', 'Strategic planning']),
      (16, 'High', 78.0, 'Usage', ARRAY['Minimal activity', 'No growth'], ARRAY['Re-engagement campaign', 'Value demonstration']),
      (17, 'Low', 28.0, 'General', ARRAY['Balanced metrics', 'Stable account'], ARRAY['Regular touchpoints', 'Feature updates'])
    `);

    console.log('Risk scores seeded');

    // Seed Customer Segments (15+ items)
    await appClient.query(`
      INSERT INTO customer_segments (name, description, criteria, customer_count, avg_revenue, churn_rate) VALUES
      ('Enterprise Champions', 'High-value enterprise customers with excellent engagement', '{"plan": "Enterprise", "health_score": ">80"}', 4, 3800.00, 2.5),
      ('Growing Startups', 'Early-stage companies with growth potential', '{"plan": "Starter", "growth_rate": ">20%"}', 3, 125.00, 15.0),
      ('Professional Core', 'Mid-market customers on professional plans', '{"plan": "Professional", "tenure": ">6months"}', 6, 850.00, 8.0),
      ('At-Risk Accounts', 'Customers showing churn indicators', '{"risk_score": ">60"}', 4, 320.00, 45.0),
      ('Power Users', 'Highly engaged users across all plans', '{"engagement_score": ">90"}', 5, 2200.00, 3.0),
      ('New Customers', 'Recently onboarded within 90 days', '{"signup_date": "last_90_days"}', 3, 450.00, 12.0),
      ('Dormant Accounts', 'Low activity in the past 30 days', '{"last_activity": ">30_days"}', 2, 175.00, 55.0),
      ('Price Sensitive', 'Customers on discount or starter plans', '{"plan": "Starter", "discount": ">20%"}', 4, 100.00, 25.0),
      ('Feature Adopters', 'Using 80%+ of available features', '{"feature_adoption": ">80%"}', 6, 1500.00, 4.0),
      ('Support Heavy', 'High support ticket volume', '{"support_tickets": ">5/month"}', 3, 600.00, 20.0),
      ('Expansion Ready', 'Accounts showing upgrade potential', '{"usage": ">plan_limit", "satisfaction": "high"}', 5, 700.00, 5.0),
      ('Long-Term Loyal', 'Customers for 2+ years', '{"tenure": ">24months"}', 4, 2800.00, 2.0),
      ('Multi-Product', 'Using multiple product lines', '{"products": ">2"}', 3, 3500.00, 3.5),
      ('Seasonal Users', 'Usage patterns tied to seasons', '{"usage_pattern": "seasonal"}', 2, 450.00, 18.0),
      ('Advocacy Potential', 'High NPS willing to refer', '{"nps": ">8", "referrals": ">0"}', 4, 1200.00, 2.5),
      ('Technical Users', 'Heavy API and integration users', '{"api_calls": ">1000/day"}', 3, 2000.00, 4.0)
    `);

    console.log('Customer segments seeded');

    // Seed Interventions (15+ items)
    await appClient.query(`
      INSERT INTO interventions (customer_id, type, description, priority, status, suggested_by, effectiveness_score, due_date) VALUES
      (4, 'Outreach Call', 'Schedule call to discuss declining engagement and understand concerns', 'High', 'pending', 'AI', 85.0, '2024-01-15'),
      (7, 'Success Review', 'Conduct quarterly success review to address support complaints', 'High', 'in-progress', 'AI', 78.0, '2024-01-12'),
      (12, 'Training Session', 'Offer personalized training to improve feature adoption', 'Medium', 'pending', 'AI', 72.0, '2024-01-20'),
      (16, 'Discount Offer', 'Provide renewal discount to retain at-risk customer', 'High', 'pending', 'AI', 65.0, '2024-01-14'),
      (9, 'Win-Back Campaign', 'Initiate win-back campaign with special offer', 'Medium', 'pending', 'AI', 45.0, '2024-01-25'),
      (1, 'Upsell Opportunity', 'Present enterprise add-on features for power user', 'Low', 'pending', 'Sales', 90.0, '2024-02-01'),
      (6, 'Case Study Request', 'Request participation in customer success story', 'Low', 'completed', 'Marketing', 95.0, '2024-01-05'),
      (3, 'Executive Briefing', 'Schedule executive briefing on product roadmap', 'Medium', 'pending', 'AI', 88.0, '2024-01-18'),
      (5, 'Feature Workshop', 'Host workshop on advanced features', 'Low', 'pending', 'Success', 75.0, '2024-01-22'),
      (11, 'Expansion Discussion', 'Discuss team expansion and additional licenses', 'Medium', 'in-progress', 'Sales', 82.0, '2024-01-16'),
      (13, 'Onboarding Check-in', 'Complete 30-day onboarding check-in', 'Medium', 'pending', 'AI', 80.0, '2024-01-13'),
      (2, 'Integration Support', 'Provide dedicated support for new integration', 'Low', 'completed', 'Support', 85.0, '2024-01-08'),
      (8, 'Roadmap Preview', 'Share upcoming features with strategic account', 'Low', 'pending', 'Product', 92.0, '2024-01-30'),
      (14, 'Referral Program', 'Invite to customer referral program', 'Low', 'pending', 'Marketing', 70.0, '2024-02-05'),
      (10, 'Annual Review', 'Conduct annual business review', 'Medium', 'pending', 'Success', 85.0, '2024-01-28'),
      (15, 'Strategic Planning', 'Quarterly strategic planning session', 'Medium', 'in-progress', 'Executive', 90.0, '2024-01-17'),
      (17, 'Feature Feedback', 'Gather feedback on recent feature release', 'Low', 'pending', 'Product', 68.0, '2024-01-24')
    `);

    console.log('Interventions seeded');

    // Seed Behavior Analytics (15+ items)
    await appClient.query(`
      INSERT INTO behavior_analytics (customer_id, event_type, event_data, session_id, page_visited, action_taken, timestamp) VALUES
      (1, 'feature_use', '{"feature": "dashboard", "duration": 1200}', 'sess_001', '/dashboard', 'view_analytics', '2024-01-10 09:30:00'),
      (1, 'report_export', '{"format": "pdf", "size": "2.5MB"}', 'sess_001', '/reports', 'export_report', '2024-01-10 10:15:00'),
      (2, 'login', '{"method": "sso", "device": "desktop"}', 'sess_002', '/login', 'successful_login', '2024-01-10 08:00:00'),
      (3, 'api_call', '{"endpoint": "/data/sync", "count": 150}', 'sess_003', '/api', 'data_sync', '2024-01-10 11:00:00'),
      (4, 'page_view', '{"page": "pricing", "time_on_page": 300}', 'sess_004', '/pricing', 'view_pricing', '2024-01-09 14:30:00'),
      (5, 'feature_use', '{"feature": "integrations", "duration": 600}', 'sess_005', '/integrations', 'configure_integration', '2024-01-10 13:45:00'),
      (6, 'support_access', '{"type": "documentation", "article": "api-guide"}', 'sess_006', '/help', 'read_docs', '2024-01-10 16:20:00'),
      (7, 'feature_abandon', '{"feature": "automation", "step": 3}', 'sess_007', '/automation', 'abandon_setup', '2024-01-08 10:00:00'),
      (8, 'team_invite', '{"invites_sent": 5, "role": "analyst"}', 'sess_008', '/team', 'invite_members', '2024-01-10 11:30:00'),
      (9, 'cancel_flow', '{"reason": "too_expensive", "step": 2}', 'sess_009', '/settings', 'start_cancel', '2024-01-05 09:00:00'),
      (10, 'upgrade_view', '{"current_plan": "Professional", "viewed_plan": "Enterprise"}', 'sess_010', '/upgrade', 'view_upgrade', '2024-01-10 15:00:00'),
      (11, 'data_import', '{"records": 5000, "source": "csv"}', 'sess_011', '/import', 'import_data', '2024-01-10 08:45:00'),
      (12, 'error_encounter', '{"error_code": "E401", "page": "/reports"}', 'sess_012', '/reports', 'error_displayed', '2024-01-09 11:20:00'),
      (13, 'onboarding', '{"step": "welcome", "completion": 20}', 'sess_013', '/onboarding', 'start_onboarding', '2024-01-10 10:00:00'),
      (14, 'search', '{"query": "export data", "results": 12}', 'sess_014', '/search', 'search_performed', '2024-01-10 14:15:00'),
      (15, 'billing_view', '{"section": "invoices", "action": "download"}', 'sess_015', '/billing', 'download_invoice', '2024-01-10 09:00:00'),
      (16, 'login_fail', '{"attempts": 3, "reason": "wrong_password"}', 'sess_016', '/login', 'failed_login', '2024-01-07 08:30:00')
    `);

    console.log('Behavior analytics seeded');

    // Seed Usage Metrics (15+ items)
    await appClient.query(`
      INSERT INTO usage_metrics (customer_id, metric_name, metric_value, period_start, period_end, trend, comparison_value) VALUES
      (1, 'API Calls', 15000, '2024-01-01', '2024-01-10', 'up', 12000),
      (1, 'Active Users', 25, '2024-01-01', '2024-01-10', 'stable', 24),
      (2, 'Data Storage (GB)', 45.5, '2024-01-01', '2024-01-10', 'up', 38.2),
      (3, 'Reports Generated', 250, '2024-01-01', '2024-01-10', 'up', 180),
      (4, 'Login Sessions', 5, '2024-01-01', '2024-01-10', 'down', 25),
      (5, 'Integrations Active', 8, '2024-01-01', '2024-01-10', 'up', 6),
      (6, 'Team Members', 45, '2024-01-01', '2024-01-10', 'up', 40),
      (7, 'API Calls', 500, '2024-01-01', '2024-01-10', 'down', 2500),
      (8, 'Data Exports', 120, '2024-01-01', '2024-01-10', 'stable', 115),
      (9, 'Active Users', 0, '2024-01-01', '2024-01-10', 'down', 8),
      (10, 'Dashboard Views', 180, '2024-01-01', '2024-01-10', 'up', 150),
      (11, 'Automations Run', 500, '2024-01-01', '2024-01-10', 'up', 320),
      (12, 'Support Tickets', 8, '2024-01-01', '2024-01-10', 'up', 3),
      (13, 'Onboarding Progress', 65, '2024-01-01', '2024-01-10', 'up', 20),
      (14, 'Feature Adoption %', 78, '2024-01-01', '2024-01-10', 'up', 65),
      (15, 'Revenue Generated', 85000, '2024-01-01', '2024-01-10', 'up', 72000),
      (16, 'Active Days', 3, '2024-01-01', '2024-01-10', 'down', 15),
      (17, 'Collaboration Score', 85, '2024-01-01', '2024-01-10', 'stable', 82)
    `);

    console.log('Usage metrics seeded');

    // Seed Engagement Scores (15+ items)
    await appClient.query(`
      INSERT INTO engagement_scores (customer_id, overall_score, login_frequency, feature_adoption, support_interaction, feedback_score) VALUES
      (1, 92.5, 95.0, 88.0, 90.0, 95.0),
      (2, 75.0, 70.0, 72.0, 85.0, 78.0),
      (3, 95.0, 98.0, 92.0, 88.0, 97.0),
      (4, 35.0, 25.0, 40.0, 55.0, 30.0),
      (5, 82.0, 85.0, 78.0, 80.0, 85.0),
      (6, 98.0, 99.0, 95.0, 92.0, 100.0),
      (7, 42.0, 35.0, 48.0, 65.0, 38.0),
      (8, 96.0, 95.0, 98.0, 90.0, 98.0),
      (9, 5.0, 0.0, 10.0, 15.0, 5.0),
      (10, 78.0, 80.0, 75.0, 72.0, 80.0),
      (11, 88.0, 90.0, 85.0, 82.0, 90.0),
      (12, 55.0, 50.0, 58.0, 70.0, 52.0),
      (13, 65.0, 70.0, 55.0, 80.0, 62.0),
      (14, 80.0, 82.0, 78.0, 75.0, 82.0),
      (15, 94.0, 92.0, 95.0, 88.0, 96.0),
      (16, 28.0, 20.0, 32.0, 45.0, 25.0),
      (17, 76.0, 78.0, 72.0, 75.0, 78.0)
    `);

    console.log('Engagement scores seeded');

    // Seed Support Tickets (15+ items)
    await appClient.query(`
      INSERT INTO support_tickets (customer_id, subject, description, priority, status, category, assigned_to, resolution) VALUES
      (1, 'API Rate Limit Question', 'Need clarification on API rate limits for our usage pattern', 'Low', 'resolved', 'Technical', 'John Support', 'Explained rate limits and provided optimization tips'),
      (4, 'Cannot Access Dashboard', 'Getting 403 error when trying to access analytics dashboard', 'High', 'open', 'Bug', 'Sarah Tech', NULL),
      (7, 'Billing Discrepancy', 'Invoice amount does not match expected charges', 'Medium', 'in-progress', 'Billing', 'Mike Billing', NULL),
      (3, 'Feature Request: Custom Reports', 'Would like ability to create custom report templates', 'Low', 'resolved', 'Feature Request', 'Product Team', 'Added to roadmap for Q2'),
      (2, 'Integration Not Syncing', 'Salesforce integration stopped syncing yesterday', 'High', 'open', 'Integration', 'Tech Team', NULL),
      (5, 'Password Reset Issue', 'Password reset email not being received', 'Medium', 'resolved', 'Account', 'Support Team', 'Fixed email delivery issue'),
      (6, 'Performance Slow', 'Dashboard loading very slowly in the morning', 'Medium', 'resolved', 'Performance', 'DevOps', 'Scaled infrastructure'),
      (8, 'Training Request', 'Need training session for new team members', 'Low', 'open', 'Training', 'Success Team', NULL),
      (12, 'Data Export Failed', 'Large data export timing out', 'High', 'in-progress', 'Bug', 'Tech Team', NULL),
      (11, 'License Addition', 'Need to add 10 more user licenses', 'Low', 'resolved', 'Billing', 'Sales Team', 'Licenses added and invoice sent'),
      (7, 'API Documentation', 'Documentation unclear for webhook endpoints', 'Medium', 'open', 'Documentation', 'Doc Team', NULL),
      (4, 'Account Downgrade', 'Considering downgrading to starter plan', 'High', 'open', 'Account', 'Success Team', NULL),
      (13, 'Onboarding Help', 'Need assistance completing onboarding steps', 'Medium', 'in-progress', 'Onboarding', 'Success Team', NULL),
      (10, 'SSO Configuration', 'Help setting up SAML SSO', 'Medium', 'resolved', 'Technical', 'Security Team', 'SSO configured and tested'),
      (15, 'Contract Renewal', 'Questions about upcoming contract renewal', 'Low', 'open', 'Sales', 'Account Manager', NULL),
      (16, 'Cancellation Request', 'Requesting to cancel subscription', 'High', 'open', 'Account', 'Retention Team', NULL)
    `);

    console.log('Support tickets seeded');

    // Seed Billing History (15+ items)
    await appClient.query(`
      INSERT INTO billing_history (customer_id, invoice_number, amount, currency, status, payment_method, billing_date, due_date, paid_at) VALUES
      (1, 'INV-2024-001', 2500.00, 'USD', 'paid', 'Credit Card', '2024-01-01', '2024-01-15', '2024-01-05 10:30:00'),
      (2, 'INV-2024-002', 500.00, 'USD', 'paid', 'Bank Transfer', '2024-01-01', '2024-01-15', '2024-01-10 14:20:00'),
      (3, 'INV-2024-003', 3500.00, 'USD', 'paid', 'Credit Card', '2024-01-01', '2024-01-15', '2024-01-02 09:00:00'),
      (4, 'INV-2024-004', 99.00, 'USD', 'overdue', 'Credit Card', '2024-01-01', '2024-01-15', NULL),
      (5, 'INV-2024-005', 750.00, 'USD', 'paid', 'Credit Card', '2024-01-01', '2024-01-15', '2024-01-08 11:45:00'),
      (6, 'INV-2024-006', 4000.00, 'USD', 'paid', 'Bank Transfer', '2024-01-01', '2024-01-15', '2024-01-03 16:00:00'),
      (7, 'INV-2024-007', 1200.00, 'USD', 'pending', 'Credit Card', '2024-01-01', '2024-01-15', NULL),
      (8, 'INV-2024-008', 5500.00, 'USD', 'paid', 'Bank Transfer', '2024-01-01', '2024-01-15', '2024-01-01 08:00:00'),
      (9, 'INV-2024-009', 150.00, 'USD', 'cancelled', 'Credit Card', '2024-01-01', '2024-01-15', NULL),
      (10, 'INV-2024-010', 850.00, 'USD', 'paid', 'Credit Card', '2024-01-01', '2024-01-15', '2024-01-07 13:30:00'),
      (11, 'INV-2024-011', 2800.00, 'USD', 'paid', 'Bank Transfer', '2024-01-01', '2024-01-15', '2024-01-04 10:15:00'),
      (12, 'INV-2024-012', 600.00, 'USD', 'pending', 'Credit Card', '2024-01-01', '2024-01-15', NULL),
      (13, 'INV-2024-013', 199.00, 'USD', 'paid', 'Credit Card', '2024-01-01', '2024-01-15', '2024-01-09 15:45:00'),
      (14, 'INV-2024-014', 950.00, 'USD', 'paid', 'Credit Card', '2024-01-01', '2024-01-15', '2024-01-06 12:00:00'),
      (15, 'INV-2024-015', 3200.00, 'USD', 'paid', 'Bank Transfer', '2024-01-01', '2024-01-15', '2024-01-02 14:30:00'),
      (16, 'INV-2024-016', 125.00, 'USD', 'overdue', 'Credit Card', '2024-01-01', '2024-01-15', NULL),
      (17, 'INV-2024-017', 1100.00, 'USD', 'paid', 'Credit Card', '2024-01-01', '2024-01-15', '2024-01-05 09:20:00')
    `);

    console.log('Billing history seeded');

    // Seed Feature Usage (15+ items)
    await appClient.query(`
      INSERT INTO feature_usage (customer_id, feature_name, usage_count, last_used, adoption_rate, time_spent_minutes, period) VALUES
      (1, 'Dashboard Analytics', 450, '2024-01-10 16:30:00', 95.0, 2500, 'monthly'),
      (1, 'API Integration', 1200, '2024-01-10 18:00:00', 88.0, 0, 'monthly'),
      (2, 'Report Builder', 85, '2024-01-10 14:00:00', 72.0, 420, 'monthly'),
      (3, 'Team Collaboration', 320, '2024-01-10 17:45:00', 92.0, 1800, 'monthly'),
      (4, 'Dashboard Analytics', 12, '2024-01-05 10:00:00', 25.0, 45, 'monthly'),
      (5, 'Data Import', 45, '2024-01-10 11:30:00', 78.0, 180, 'monthly'),
      (6, 'Advanced Filters', 280, '2024-01-10 15:20:00', 98.0, 950, 'monthly'),
      (7, 'Email Notifications', 8, '2024-01-08 09:00:00', 35.0, 15, 'monthly'),
      (8, 'Custom Dashboards', 150, '2024-01-10 16:00:00', 95.0, 720, 'monthly'),
      (10, 'Report Scheduling', 65, '2024-01-10 08:00:00', 75.0, 120, 'monthly'),
      (11, 'Workflow Automation', 200, '2024-01-10 13:00:00', 85.0, 480, 'monthly'),
      (12, 'Data Export', 22, '2024-01-09 11:00:00', 55.0, 90, 'monthly'),
      (13, 'Getting Started Guide', 15, '2024-01-10 10:30:00', 60.0, 180, 'monthly'),
      (14, 'Search & Filter', 180, '2024-01-10 14:45:00', 82.0, 300, 'monthly'),
      (15, 'Executive Reports', 95, '2024-01-10 09:30:00', 90.0, 450, 'monthly'),
      (16, 'Basic Reports', 5, '2024-01-06 14:00:00', 20.0, 25, 'monthly'),
      (17, 'Integrations Hub', 75, '2024-01-10 12:15:00', 78.0, 280, 'monthly')
    `);

    console.log('Feature usage seeded');

    // Seed User Sessions (15+ items)
    await appClient.query(`
      INSERT INTO user_sessions (customer_id, session_start, session_end, duration_minutes, pages_viewed, actions_taken, device_type, browser, ip_address) VALUES
      (1, '2024-01-10 09:00:00', '2024-01-10 11:30:00', 150, 25, 45, 'Desktop', 'Chrome', '192.168.1.100'),
      (1, '2024-01-10 14:00:00', '2024-01-10 16:45:00', 165, 30, 52, 'Desktop', 'Chrome', '192.168.1.100'),
      (2, '2024-01-10 08:30:00', '2024-01-10 09:15:00', 45, 8, 12, 'Desktop', 'Firefox', '10.0.0.50'),
      (3, '2024-01-10 10:00:00', '2024-01-10 12:00:00', 120, 18, 35, 'Desktop', 'Safari', '172.16.0.25'),
      (4, '2024-01-09 14:00:00', '2024-01-09 14:20:00', 20, 4, 3, 'Mobile', 'Safari', '192.168.2.80'),
      (5, '2024-01-10 13:00:00', '2024-01-10 15:30:00', 150, 22, 40, 'Desktop', 'Chrome', '10.10.10.100'),
      (6, '2024-01-10 08:00:00', '2024-01-10 17:00:00', 540, 85, 150, 'Desktop', 'Chrome', '192.168.5.50'),
      (7, '2024-01-08 09:30:00', '2024-01-08 10:00:00', 30, 5, 8, 'Desktop', 'Edge', '172.20.0.15'),
      (8, '2024-01-10 09:00:00', '2024-01-10 18:00:00', 540, 95, 180, 'Desktop', 'Chrome', '10.0.5.200'),
      (10, '2024-01-10 10:30:00', '2024-01-10 12:00:00', 90, 15, 28, 'Desktop', 'Firefox', '192.168.8.75'),
      (11, '2024-01-10 08:00:00', '2024-01-10 10:30:00', 150, 28, 55, 'Desktop', 'Chrome', '10.20.30.40'),
      (12, '2024-01-09 11:00:00', '2024-01-09 11:45:00', 45, 7, 10, 'Tablet', 'Safari', '172.16.5.100'),
      (13, '2024-01-10 09:00:00', '2024-01-10 10:00:00', 60, 12, 18, 'Desktop', 'Chrome', '192.168.10.25'),
      (14, '2024-01-10 14:00:00', '2024-01-10 16:00:00', 120, 20, 38, 'Desktop', 'Chrome', '10.50.0.80'),
      (15, '2024-01-10 07:30:00', '2024-01-10 12:00:00', 270, 45, 85, 'Desktop', 'Safari', '192.168.15.150'),
      (16, '2024-01-06 13:00:00', '2024-01-06 13:30:00', 30, 3, 2, 'Mobile', 'Chrome', '172.30.0.50'),
      (17, '2024-01-10 11:00:00', '2024-01-10 13:30:00', 150, 24, 42, 'Desktop', 'Firefox', '10.100.0.200')
    `);

    console.log('User sessions seeded');

    // Seed NPS Scores (15+ items)
    await appClient.query(`
      INSERT INTO nps_scores (customer_id, score, feedback, category, survey_date, follow_up_required) VALUES
      (1, 9, 'Great product, very intuitive dashboard. Love the analytics features!', 'Promoter', '2024-01-05', FALSE),
      (2, 7, 'Good overall, but could use more integrations', 'Passive', '2024-01-06', FALSE),
      (3, 10, 'Absolutely essential for our business. Best investment we made!', 'Promoter', '2024-01-04', FALSE),
      (4, 4, 'Hard to use, not seeing value for the price', 'Detractor', '2024-01-03', TRUE),
      (5, 8, 'Solid product with good support', 'Promoter', '2024-01-07', FALSE),
      (6, 10, 'Cannot imagine running our business without it', 'Promoter', '2024-01-02', FALSE),
      (7, 3, 'Too many bugs, support takes too long to respond', 'Detractor', '2024-01-08', TRUE),
      (8, 9, 'Excellent enterprise features and great account management', 'Promoter', '2024-01-01', FALSE),
      (9, 2, 'Did not meet our needs, switching to competitor', 'Detractor', '2023-12-20', TRUE),
      (10, 8, 'Reliable and gets the job done', 'Promoter', '2024-01-06', FALSE),
      (11, 9, 'Love the automation features, saves us hours every week', 'Promoter', '2024-01-05', FALSE),
      (12, 5, 'Mixed experience, some features great, others lacking', 'Detractor', '2024-01-04', TRUE),
      (13, 7, 'Still learning but promising so far', 'Passive', '2024-01-09', FALSE),
      (14, 8, 'Good value for money, responsive support', 'Promoter', '2024-01-07', FALSE),
      (15, 10, 'Industry-leading solution, highly recommend', 'Promoter', '2024-01-03', FALSE),
      (16, 3, 'Too expensive for what we get', 'Detractor', '2024-01-02', TRUE),
      (17, 8, 'Solid platform with regular improvements', 'Promoter', '2024-01-08', FALSE)
    `);

    console.log('NPS scores seeded');

    // Seed Health Scores (15+ items)
    await appClient.query(`
      INSERT INTO health_scores (customer_id, overall_health, product_usage, customer_satisfaction, growth_potential, support_health, financial_health, trend) VALUES
      (1, 92.0, 95.0, 90.0, 85.0, 95.0, 92.0, 'up'),
      (2, 75.0, 72.0, 78.0, 80.0, 75.0, 70.0, 'stable'),
      (3, 96.0, 98.0, 95.0, 90.0, 92.0, 98.0, 'up'),
      (4, 32.0, 25.0, 35.0, 20.0, 55.0, 40.0, 'down'),
      (5, 82.0, 80.0, 85.0, 78.0, 82.0, 85.0, 'up'),
      (6, 98.0, 99.0, 98.0, 95.0, 95.0, 100.0, 'up'),
      (7, 38.0, 35.0, 30.0, 40.0, 45.0, 50.0, 'down'),
      (8, 97.0, 96.0, 98.0, 92.0, 95.0, 100.0, 'stable'),
      (9, 5.0, 0.0, 10.0, 0.0, 15.0, 0.0, 'down'),
      (10, 78.0, 75.0, 80.0, 72.0, 78.0, 82.0, 'stable'),
      (11, 88.0, 90.0, 85.0, 92.0, 82.0, 88.0, 'up'),
      (12, 52.0, 48.0, 55.0, 45.0, 65.0, 55.0, 'down'),
      (13, 68.0, 65.0, 72.0, 75.0, 70.0, 60.0, 'up'),
      (14, 80.0, 78.0, 82.0, 75.0, 80.0, 85.0, 'stable'),
      (15, 95.0, 94.0, 96.0, 90.0, 92.0, 98.0, 'up'),
      (16, 25.0, 18.0, 22.0, 15.0, 40.0, 35.0, 'down'),
      (17, 76.0, 74.0, 78.0, 72.0, 75.0, 80.0, 'stable')
    `);

    console.log('Health scores seeded');

    // Seed Alerts (15+ items)
    await appClient.query(`
      INSERT INTO alerts (customer_id, alert_type, severity, message, is_read, is_resolved) VALUES
      (4, 'Churn Risk', 'high', 'Customer showing high churn risk (72.5%). Immediate intervention recommended.', FALSE, FALSE),
      (7, 'Churn Risk', 'high', 'Customer showing high churn risk (65%). Support complaints increasing.', FALSE, FALSE),
      (16, 'Churn Risk', 'high', 'Customer showing high churn risk (78%). Minimal product usage detected.', FALSE, FALSE),
      (4, 'Payment Overdue', 'medium', 'Invoice INV-2024-004 is overdue by 5 days.', FALSE, FALSE),
      (16, 'Payment Overdue', 'medium', 'Invoice INV-2024-016 is overdue by 5 days.', FALSE, FALSE),
      (7, 'Engagement Drop', 'medium', 'Login frequency dropped by 80% compared to last month.', TRUE, FALSE),
      (12, 'Support Volume', 'medium', 'Support ticket volume increased by 150% this month.', FALSE, FALSE),
      (9, 'Churned Customer', 'critical', 'Customer has churned. Win-back campaign initiated.', TRUE, FALSE),
      (11, 'Expansion Opportunity', 'low', 'Customer usage approaching plan limits. Upsell opportunity.', FALSE, FALSE),
      (6, 'Renewal Coming', 'low', 'Contract renewal in 30 days. Schedule review meeting.', FALSE, FALSE),
      (3, 'Positive Feedback', 'low', 'Customer left 10/10 NPS score with positive feedback.', TRUE, TRUE),
      (13, 'Onboarding Stalled', 'medium', 'Customer onboarding at 65% for over a week.', FALSE, FALSE),
      (2, 'Integration Issue', 'medium', 'Salesforce integration sync failed 3 times today.', FALSE, FALSE),
      (5, 'Feature Milestone', 'low', 'Customer reached 80% feature adoption milestone.', TRUE, TRUE),
      (8, 'Strategic Account', 'low', 'Quarterly review due for strategic account.', FALSE, FALSE),
      (15, 'Contract Milestone', 'low', '2-year customer anniversary. Send appreciation note.', FALSE, FALSE),
      (1, 'Usage Spike', 'low', 'API usage increased 25% this week. Monitor for plan limits.', TRUE, FALSE)
    `);

    console.log('Alerts seeded');

    // Seed Sentiment Analysis (15+ items) - NEW FEATURE
    await appClient.query(`
      INSERT INTO sentiment_analysis (customer_id, feedback_source, feedback_text, sentiment_score, sentiment_label, churn_signal_strength, key_phrases, emotions, urgency_level, recommended_action) VALUES
      (1, 'Survey', 'The product has been incredibly helpful for our team. The dashboard analytics are exactly what we needed!', 85.0, 'Positive', 10.0, ARRAY['incredibly helpful', 'exactly what we needed', 'dashboard analytics'], '{"joy": 0.8, "satisfaction": 0.9, "trust": 0.85}', 'Low', 'Send thank you note and request testimonial'),
      (2, 'Support Ticket', 'Having some trouble with the integration. Would appreciate faster response times.', 45.0, 'Neutral', 35.0, ARRAY['trouble with integration', 'faster response'], '{"frustration": 0.4, "hope": 0.5}', 'Medium', 'Prioritize support response and schedule call'),
      (3, 'Email', 'Your platform has transformed how we manage our business. Absolutely essential tool.', 95.0, 'Very Positive', 5.0, ARRAY['transformed', 'essential tool', 'manage business'], '{"joy": 0.95, "trust": 0.9, "satisfaction": 1.0}', 'Low', 'Feature in case study and explore expansion'),
      (4, 'Survey', 'Considering alternatives. The price does not match the value we are getting anymore.', 20.0, 'Negative', 80.0, ARRAY['considering alternatives', 'price', 'value'], '{"disappointment": 0.7, "frustration": 0.6}', 'Critical', 'Schedule immediate retention call with discount offer'),
      (5, 'Chat', 'Quick question about the new feature. Overall very happy with the service!', 75.0, 'Positive', 15.0, ARRAY['new feature', 'very happy', 'service'], '{"curiosity": 0.6, "satisfaction": 0.8}', 'Low', 'Provide feature guide and check-in next week'),
      (6, 'NPS', 'Best investment our company has made. The ROI is incredible and support is top-notch.', 98.0, 'Very Positive', 2.0, ARRAY['best investment', 'ROI incredible', 'support top-notch'], '{"joy": 1.0, "trust": 0.95, "advocacy": 0.9}', 'Low', 'Invite to customer advisory board'),
      (7, 'Support Ticket', 'This is the third time I am reporting this bug. Very frustrated with the lack of resolution.', 15.0, 'Negative', 75.0, ARRAY['third time', 'bug', 'frustrated', 'lack of resolution'], '{"anger": 0.7, "frustration": 0.9}', 'Critical', 'Escalate to engineering and provide direct contact'),
      (8, 'Email', 'Looking forward to the upcoming features. Our team relies heavily on your platform.', 88.0, 'Positive', 8.0, ARRAY['looking forward', 'relies heavily', 'platform'], '{"anticipation": 0.8, "trust": 0.85}', 'Low', 'Share roadmap preview and gather feature requests'),
      (9, 'Survey', 'Did not meet our expectations. We have decided to move to a competitor.', 5.0, 'Very Negative', 95.0, ARRAY['did not meet expectations', 'competitor'], '{"disappointment": 0.9, "sadness": 0.6}', 'Critical', 'Initiate win-back with executive involvement'),
      (10, 'Chat', 'The new update is nice. A few minor issues but nothing major.', 60.0, 'Neutral', 25.0, ARRAY['new update', 'minor issues'], '{"acceptance": 0.7, "mild_frustration": 0.3}', 'Low', 'Follow up on minor issues and request specifics'),
      (11, 'Email', 'We are expanding our usage. Can we discuss volume pricing?', 82.0, 'Positive', 5.0, ARRAY['expanding usage', 'volume pricing'], '{"interest": 0.8, "trust": 0.75}', 'Medium', 'Schedule sales call for upsell opportunity'),
      (12, 'Support Ticket', 'The billing is confusing. I do not understand the recent charges.', 35.0, 'Negative', 50.0, ARRAY['billing confusing', 'understand charges'], '{"confusion": 0.8, "frustration": 0.5}', 'High', 'Provide detailed billing breakdown and credit if needed'),
      (13, 'Survey', 'Just started using the product. So far so good, still learning.', 55.0, 'Neutral', 30.0, ARRAY['just started', 'still learning'], '{"curiosity": 0.7, "hope": 0.6}', 'Medium', 'Offer onboarding session and send learning resources'),
      (14, 'NPS', 'Solid product that does what it promises. Good value for money.', 72.0, 'Positive', 18.0, ARRAY['solid product', 'good value'], '{"satisfaction": 0.75, "trust": 0.7}', 'Low', 'Maintain engagement and share tips for advanced use'),
      (15, 'Email', 'Your customer success team has been exceptional. Sarah deserves recognition!', 92.0, 'Very Positive', 5.0, ARRAY['customer success', 'exceptional', 'recognition'], '{"gratitude": 0.9, "joy": 0.85}', 'Low', 'Forward to Sarah and management, consider referral program'),
      (16, 'Chat', 'Why is this so complicated? I just want to export my data.', 25.0, 'Negative', 65.0, ARRAY['complicated', 'export data'], '{"frustration": 0.75, "confusion": 0.6}', 'High', 'Provide step-by-step guide and offer screen share assistance'),
      (17, 'Survey', 'The product is good but I wish there were more integrations available.', 58.0, 'Neutral', 28.0, ARRAY['product good', 'more integrations'], '{"satisfaction": 0.5, "hope": 0.6}', 'Medium', 'Share integration roadmap and gather specific requests')
    `);

    console.log('Sentiment analysis seeded');

    // Seed Customer Journeys (15+ items) - NEW FEATURE
    await appClient.query(`
      INSERT INTO customer_journeys (customer_id, journey_stage, touchpoint_type, touchpoint_name, touchpoint_date, sentiment_at_touchpoint, engagement_level, is_churn_indicator, days_before_churn, journey_path, ai_insights) VALUES
      (1, 'Expansion', 'Product', 'Upgraded to Enterprise', '2024-01-05 10:00:00', 'Positive', 95.0, FALSE, NULL, '{"path": ["Trial", "Starter", "Professional", "Enterprise"]}', 'Customer followed ideal expansion path. Strong advocate potential.'),
      (2, 'Growth', 'Support', 'Feature Request Submitted', '2024-01-08 14:30:00', 'Neutral', 70.0, FALSE, NULL, '{"path": ["Trial", "Professional", "Feature Request"]}', 'Engaged customer seeking additional functionality. Good retention signal.'),
      (3, 'Advocacy', 'Marketing', 'Provided Case Study', '2024-01-02 11:00:00', 'Very Positive', 98.0, FALSE, NULL, '{"path": ["Enterprise", "Success Story", "Reference Customer"]}', 'High-value advocate. Leverage for referrals and testimonials.'),
      (4, 'At-Risk', 'Billing', 'Payment Failed', '2024-01-09 08:00:00', 'Negative', 25.0, TRUE, 15, '{"path": ["Active", "Declining Usage", "Payment Issue", "At-Risk"]}', 'Critical churn indicator. Payment failure combined with declining usage.'),
      (5, 'Active', 'Product', 'New Integration Setup', '2024-01-10 16:45:00', 'Positive', 82.0, FALSE, NULL, '{"path": ["Onboarding", "Active Use", "Integration"]}', 'Healthy engagement pattern. Integration shows investment in platform.'),
      (6, 'Champion', 'Success', 'Quarterly Business Review', '2024-01-04 09:00:00', 'Very Positive', 99.0, FALSE, NULL, '{"path": ["Enterprise", "Executive Sponsor", "QBR", "Renewal"]}', 'Strategic account with strong executive sponsorship. Focus on innovation.'),
      (7, 'Declining', 'Support', 'Complaint Ticket', '2024-01-07 13:20:00', 'Negative', 35.0, TRUE, 30, '{"path": ["Active", "Issues", "Complaints", "Declining"]}', 'Warning: Multiple complaints indicate frustration. Immediate intervention needed.'),
      (8, 'Expanding', 'Sales', 'Additional Licenses', '2024-01-10 11:30:00', 'Positive', 96.0, FALSE, NULL, '{"path": ["Enterprise", "Team Growth", "License Expansion"]}', 'Strong growth signal. Customer is scaling usage significantly.'),
      (9, 'Churned', 'Account', 'Cancellation Request', '2024-01-05 09:00:00', 'Negative', 5.0, TRUE, 0, '{"path": ["Active", "Declining", "At-Risk", "Cancel Request", "Churned"]}', 'Lost customer. Analyze journey for prevention insights.'),
      (10, 'Stable', 'Product', 'Regular Usage', '2024-01-10 14:00:00', 'Neutral', 75.0, FALSE, NULL, '{"path": ["Onboarding", "Adoption", "Regular Use"]}', 'Consistent user with stable engagement. Potential for growth.'),
      (11, 'Growing', 'Training', 'Team Training Session', '2024-01-08 10:00:00', 'Positive', 88.0, FALSE, NULL, '{"path": ["Setup", "Training", "Adoption", "Growth"]}', 'Investment in training indicates long-term commitment.'),
      (12, 'At-Risk', 'Product', 'Feature Abandonment', '2024-01-06 15:00:00', 'Negative', 45.0, TRUE, 45, '{"path": ["Active", "Trying Features", "Confusion", "Abandonment"]}', 'User struggling with features. Needs proactive assistance.'),
      (13, 'Onboarding', 'Success', 'Welcome Call', '2024-01-09 11:00:00', 'Positive', 65.0, FALSE, NULL, '{"path": ["Sign Up", "Welcome", "Onboarding"]}', 'New customer in onboarding. Critical period for establishing habits.'),
      (14, 'Renewal', 'Sales', 'Renewal Discussion', '2024-01-07 16:00:00', 'Positive', 80.0, FALSE, NULL, '{"path": ["Active", "Pre-Renewal", "Renewal Discussion"]}', 'Approaching renewal with positive sentiment. Good conversion likelihood.'),
      (15, 'Strategic', 'Executive', 'Roadmap Preview', '2024-01-03 14:00:00', 'Very Positive', 95.0, FALSE, NULL, '{"path": ["Enterprise", "Strategic Partner", "Roadmap Influence"]}', 'Key strategic account influencing product direction.'),
      (16, 'Warning', 'Support', 'Escalation', '2024-01-04 12:00:00', 'Negative', 20.0, TRUE, 20, '{"path": ["Issues", "Frustration", "Escalation", "Warning"]}', 'Escalated support indicates serious dissatisfaction. Executive intervention recommended.'),
      (17, 'Active', 'Product', 'Dashboard Customization', '2024-01-10 09:30:00', 'Positive', 78.0, FALSE, NULL, '{"path": ["Adoption", "Customization", "Active Use"]}', 'User personalizing experience shows investment in platform.')
    `);

    console.log('Customer journeys seeded');

    // Seed Win-Back Campaigns (15+ items) - NEW FEATURE
    await appClient.query(`
      INSERT INTO winback_campaigns (customer_id, campaign_name, campaign_type, offer_type, offer_details, discount_percentage, personalization_score, predicted_success_rate, email_subject, email_body, status, sent_at, opened_at, responded_at, conversion_status) VALUES
      (9, 'We Miss You - James', 'Personalized', 'Discount', 'Exclusive 50% off for 3 months to welcome you back', 50.0, 92.0, 35.0, 'James, we have made changes you will love', 'Dear James, We noticed you left us and we have been working hard to address your feedback...', 'sent', '2024-01-06 10:00:00', '2024-01-06 14:30:00', NULL, 'pending'),
      (18, 'Stephanie Return Offer', 'Re-engagement', 'Feature Unlock', 'Free access to Enterprise features for 60 days', 0.0, 88.0, 42.0, 'Stephanie, unlock premium features - on us', 'Hi Stephanie, We would love to show you what you have been missing...', 'sent', '2024-01-05 09:00:00', '2024-01-05 11:20:00', '2024-01-07 16:00:00', 'interested'),
      (4, 'Emily Retention Special', 'Retention', 'Loyalty Discount', 'Special loyalty pricing - 30% off annual plan', 30.0, 85.0, 55.0, 'Emily, a special offer just for you', 'Dear Emily, As a valued customer, we want to ensure you continue getting value...', 'draft', NULL, NULL, NULL, NULL),
      (7, 'Robert Recovery Plan', 'Recovery', 'Support Package', 'Dedicated support manager + 20% discount', 20.0, 78.0, 48.0, 'Robert, let us make things right', 'Hi Robert, We understand your experience has not been ideal. Here is our commitment...', 'sent', '2024-01-08 08:00:00', '2024-01-08 09:45:00', NULL, 'pending'),
      (12, 'Michelle Engagement', 'Re-activation', 'Training', 'Free personalized training session + best practices guide', 0.0, 82.0, 52.0, 'Michelle, maximize your investment', 'Hi Michelle, We noticed you might not be getting the most out of our platform...', 'sent', '2024-01-07 11:00:00', NULL, NULL, 'unopened'),
      (16, 'Ashley Special Deal', 'Price Sensitive', 'Extended Trial', '60-day free trial of Professional plan', 100.0, 75.0, 38.0, 'Ashley, try Professional for free', 'Dear Ashley, We want to show you the full potential of what we offer...', 'draft', NULL, NULL, NULL, NULL),
      (9, 'James Premium Offer', 'Premium Upgrade', 'Concierge', 'White-glove onboarding + 6 months free', 0.0, 95.0, 28.0, 'James, VIP treatment awaits', 'Dear James, We are rolling out the red carpet for your return...', 'scheduled', NULL, NULL, NULL, NULL),
      (18, 'Stephanie Anniversary', 'Milestone', 'Anniversary Deal', 'Anniversary special - original pricing locked for 2 years', 25.0, 90.0, 45.0, 'Happy Anniversary, Stephanie!', 'It has been a while since we first connected. Let us celebrate with a special offer...', 'sent', '2024-01-04 10:00:00', '2024-01-04 15:30:00', '2024-01-06 09:00:00', 'converted'),
      (4, 'Emily Value Demo', 'Demonstration', 'ROI Analysis', 'Free ROI analysis + custom implementation plan', 0.0, 88.0, 60.0, 'Emily, see your potential ROI', 'Dear Emily, Let us show you exactly how much value you could be getting...', 'sent', '2024-01-09 14:00:00', '2024-01-09 16:20:00', NULL, 'pending'),
      (7, 'Robert Executive Call', 'Executive Outreach', 'Executive Meeting', 'Direct line to CEO + strategic account pricing', 35.0, 92.0, 40.0, 'Robert, our CEO wants to speak with you', 'Hi Robert, Your feedback matters so much that our CEO personally wants to discuss...', 'draft', NULL, NULL, NULL, NULL),
      (12, 'Michelle Quick Start', 'Reactivation', 'Quick Win', 'Guided 30-minute setup to achieve first success', 15.0, 80.0, 58.0, 'Michelle, 30 minutes to success', 'Hi Michelle, What if we could show you immediate value in just 30 minutes?', 'sent', '2024-01-10 09:00:00', '2024-01-10 11:30:00', NULL, 'pending'),
      (16, 'Ashley Starter Plus', 'Downgrade Prevention', 'Plan Match', 'Custom plan matching your exact needs and budget', 40.0, 72.0, 50.0, 'Ashley, a plan designed for you', 'Dear Ashley, We have created something special that fits your needs perfectly...', 'sent', '2024-01-08 13:00:00', NULL, NULL, 'unopened'),
      (9, 'James Feature Preview', 'Innovation', 'Beta Access', 'Exclusive beta access to new AI features', 0.0, 85.0, 32.0, 'James, be first to try our AI features', 'Hi James, As a former valued customer, we want to give you exclusive early access...', 'scheduled', NULL, NULL, NULL, NULL),
      (18, 'Stephanie Community', 'Community', 'Network Access', 'Free access to customer community + exclusive events', 0.0, 78.0, 48.0, 'Join our exclusive community, Stephanie', 'Hi Stephanie, Beyond the product, there is a community waiting for you...', 'sent', '2024-01-03 11:00:00', '2024-01-03 14:00:00', NULL, 'declined'),
      (4, 'Emily Success Story', 'Case Study', 'Implementation', 'Free implementation review + success roadmap', 10.0, 90.0, 62.0, 'Emily, let us plan your success', 'Dear Emily, We have helped companies just like yours achieve amazing results...', 'draft', NULL, NULL, NULL, NULL),
      (7, 'Robert Partnership', 'Strategic', 'Partnership', 'Strategic partnership pricing + co-marketing opportunity', 45.0, 95.0, 35.0, 'Robert, let us build something together', 'Hi Robert, What if we became true partners in your success?', 'scheduled', NULL, NULL, NULL, NULL)
    `);

    console.log('Win-back campaigns seeded');

    // Seed Customer Health Dashboard (15+ items) - NEW FEATURE
    await appClient.query(`
      INSERT INTO customer_health_dashboard (customer_id, health_score, engagement_index, satisfaction_index, financial_health, product_adoption, support_sentiment, risk_indicators, positive_signals, trend_direction, trend_percentage, last_activity_days, recommended_actions, ai_summary) VALUES
      (1, 94.0, 95.0, 92.0, 98.0, 88.0, 95.0, '{"items": []}', '{"items": ["High usage", "Regular payments", "Positive NPS"]}', 'up', 5.2, 1, ARRAY['Explore upsell opportunities', 'Request testimonial', 'Invite to advisory board'], 'Exceptionally healthy account with strong engagement across all metrics. Prime candidate for expansion and advocacy programs.'),
      (2, 72.0, 70.0, 75.0, 68.0, 72.0, 78.0, '{"items": ["Moderate engagement decline"]}', '{"items": ["Active support interaction", "Feature exploration"]}', 'stable', 0.5, 2, ARRAY['Schedule check-in call', 'Share advanced features', 'Monitor usage trends'], 'Stable account with room for improvement. Focus on deepening feature adoption.'),
      (3, 97.0, 98.0, 96.0, 100.0, 95.0, 94.0, '{"items": []}', '{"items": ["Enterprise champion", "Multi-department usage", "Executive sponsor"]}', 'up', 3.8, 0, ARRAY['Maintain executive relationship', 'Share roadmap previews', 'Co-develop case study'], 'Premium enterprise account showing exemplary health. Strategic partnership potential.'),
      (4, 28.0, 22.0, 30.0, 25.0, 35.0, 40.0, '{"items": ["Usage decline 60%", "Payment overdue", "Negative sentiment"]}', '{"items": []}', 'down', -15.5, 5, ARRAY['Emergency outreach required', 'Offer retention discount', 'Address payment issue'], 'Critical health alert. Multiple risk indicators suggest imminent churn without intervention.'),
      (5, 82.0, 85.0, 80.0, 88.0, 78.0, 80.0, '{"items": []}', '{"items": ["Growing integration usage", "Positive feedback"]}', 'up', 4.2, 1, ARRAY['Nurture relationship', 'Share best practices', 'Explore growth opportunities'], 'Healthy account with positive trajectory. Good candidate for expansion discussion.'),
      (6, 99.0, 100.0, 98.0, 100.0, 99.0, 98.0, '{"items": []}', '{"items": ["Power user", "Brand advocate", "Long-term contract"]}', 'stable', 0.2, 0, ARRAY['Maintain excellence', 'Leverage for referrals', 'Include in beta programs'], 'Top-tier account with near-perfect health. Focus on maintaining relationship and leveraging advocacy.'),
      (7, 35.0, 30.0, 25.0, 45.0, 40.0, 20.0, '{"items": ["Support complaints", "Feature abandonment", "Declining logins"]}', '{"items": []}', 'down', -12.8, 8, ARRAY['Escalate to success manager', 'Address support issues', 'Schedule recovery call'], 'At-risk account requiring immediate attention. Support sentiment is a major concern.'),
      (8, 96.0, 95.0, 98.0, 100.0, 94.0, 96.0, '{"items": []}', '{"items": ["Strategic account", "High satisfaction", "Team expansion"]}', 'up', 2.5, 0, ARRAY['Continue strategic engagement', 'Plan annual review', 'Explore additional use cases'], 'Excellent enterprise health with strong indicators across all dimensions.'),
      (9, 5.0, 0.0, 10.0, 0.0, 5.0, 15.0, '{"items": ["Churned", "Zero activity", "Cancelled subscription"]}', '{"items": []}', 'down', -95.0, 45, ARRAY['Initiate win-back campaign', 'Conduct exit interview', 'Document learnings'], 'Churned account. Win-back potential if root causes are addressed.'),
      (10, 78.0, 80.0, 75.0, 82.0, 75.0, 78.0, '{"items": []}', '{"items": ["Consistent usage", "On-time payments"]}', 'stable', 1.2, 2, ARRAY['Maintain engagement', 'Share feature updates', 'Schedule quarterly review'], 'Solid account with stable health. Focus on preventing stagnation.'),
      (11, 88.0, 90.0, 85.0, 92.0, 88.0, 85.0, '{"items": []}', '{"items": ["Team growth", "High adoption", "Automation usage"]}', 'up', 6.5, 1, ARRAY['Support expansion', 'Advanced training', 'Upsell discussion'], 'Growing account with excellent adoption. Ready for next-level engagement.'),
      (12, 48.0, 45.0, 52.0, 50.0, 55.0, 45.0, '{"items": ["Inconsistent usage", "Billing confusion", "Mixed feedback"]}', '{"items": ["Still exploring features"]}', 'down', -8.2, 4, ARRAY['Clarify billing', 'Offer guided tour', 'Address confusion points'], 'Mixed signals account needing attention. Proactive support could improve trajectory.'),
      (13, 65.0, 68.0, 70.0, 60.0, 55.0, 75.0, '{"items": ["New customer", "Onboarding incomplete"]}', '{"items": ["Engaged with support", "Positive attitude"]}', 'up', 8.5, 1, ARRAY['Complete onboarding', 'Schedule success planning', 'Monitor adoption closely'], 'New account in critical onboarding phase. Early indicators are promising.'),
      (14, 80.0, 82.0, 78.0, 85.0, 78.0, 80.0, '{"items": []}', '{"items": ["Approaching renewal", "Positive NPS", "Regular usage"]}', 'stable', 0.8, 2, ARRAY['Prepare renewal discussion', 'Share success metrics', 'Explore multi-year deal'], 'Healthy account approaching renewal. Good position for contract extension.'),
      (15, 95.0, 94.0, 96.0, 98.0, 92.0, 95.0, '{"items": []}', '{"items": ["Key account", "High revenue", "Executive engagement"]}', 'up', 2.2, 0, ARRAY['Strategic planning session', 'Roadmap alignment', 'Partnership discussion'], 'Strategic account with excellent health. Focus on deepening partnership.'),
      (16, 22.0, 18.0, 25.0, 15.0, 28.0, 30.0, '{"items": ["Minimal activity", "Payment issues", "Cancellation signals"]}', '{"items": []}', 'down', -18.5, 12, ARRAY['Immediate intervention', 'Value demonstration', 'Retention offer'], 'Critical alert: Account showing strong churn indicators. Urgent action needed.'),
      (17, 76.0, 78.0, 74.0, 80.0, 72.0, 75.0, '{"items": []}', '{"items": ["Balanced usage", "Regular engagement"]}', 'stable', 0.5, 2, ARRAY['Continue engagement', 'Share updates', 'Gather feedback'], 'Stable mid-tier account. Maintain consistent touchpoints.')
    `);

    console.log('Customer health dashboard seeded');

    // Seed Escalation Predictions (15+ items) - NEW FEATURE
    await appClient.query(`
      INSERT INTO escalation_predictions (customer_id, frustration_score, escalation_probability, frustration_indicators, recent_issues, communication_sentiment, response_urgency, predicted_escalation_type, recommended_preemptive_action, agent_talking_points, priority_level, status) VALUES
      (4, 82.0, 75.0, ARRAY['Multiple failed attempts', 'Negative tone in communications', 'Payment disputes'], '{"issues": [{"type": "billing", "date": "2024-01-08", "resolved": false}, {"type": "access", "date": "2024-01-05", "resolved": true}]}', 'Frustrated', 'Immediate', 'Manager Escalation', 'Proactively reach out with solution before customer requests escalation', ARRAY['Acknowledge frustration', 'Present immediate solution', 'Offer compensation'], 'Critical', 'active'),
      (7, 78.0, 70.0, ARRAY['Repeated support tickets', 'Feature complaints', 'Response time concerns'], '{"issues": [{"type": "bug", "date": "2024-01-09", "resolved": false}, {"type": "feature", "date": "2024-01-07", "resolved": false}]}', 'Angry', 'Immediate', 'Executive Escalation', 'Schedule call with senior support lead to address concerns', ARRAY['Review ticket history', 'Provide dedicated contact', 'Share resolution timeline'], 'Critical', 'active'),
      (12, 65.0, 55.0, ARRAY['Billing confusion', 'Onboarding struggles', 'Feature difficulty'], '{"issues": [{"type": "billing", "date": "2024-01-06", "resolved": false}]}', 'Confused', 'High', 'Support Escalation', 'Assign dedicated success manager for guided assistance', ARRAY['Simplify explanation', 'Offer screen share', 'Provide documentation'], 'High', 'active'),
      (16, 88.0, 85.0, ARRAY['Cancellation mention', 'Price complaints', 'Competitor comparison'], '{"issues": [{"type": "pricing", "date": "2024-01-08", "resolved": false}]}', 'Very Frustrated', 'Immediate', 'Retention Escalation', 'Engage retention specialist with authority to offer discounts', ARRAY['Acknowledge value concerns', 'Present ROI data', 'Offer custom pricing'], 'Critical', 'active'),
      (2, 35.0, 25.0, ARRAY['Minor feature request', 'Occasional delays'], '{"issues": [{"type": "feature_request", "date": "2024-01-09", "resolved": false}]}', 'Slightly Concerned', 'Medium', 'Standard Support', 'Monitor and follow up on feature request status', ARRAY['Update on request status', 'Share workaround', 'Set expectations'], 'Medium', 'monitoring'),
      (5, 20.0, 15.0, ARRAY['Question about advanced features'], '{"issues": []}', 'Curious', 'Low', 'No Escalation Expected', 'Provide proactive training resources', ARRAY['Share advanced guides', 'Offer training session', 'Highlight resources'], 'Low', 'resolved'),
      (13, 45.0, 40.0, ARRAY['Onboarding confusion', 'Multiple questions', 'Setup difficulties'], '{"issues": [{"type": "onboarding", "date": "2024-01-10", "resolved": false}]}', 'Overwhelmed', 'High', 'Onboarding Escalation', 'Fast-track onboarding with dedicated session', ARRAY['Simplify next steps', 'Provide quick wins', 'Schedule follow-up'], 'High', 'active'),
      (1, 10.0, 5.0, ARRAY['None detected'], '{"issues": []}', 'Satisfied', 'Low', 'No Escalation Expected', 'Continue regular engagement cadence', ARRAY['Express appreciation', 'Gather feedback', 'Share updates'], 'Low', 'resolved'),
      (8, 12.0, 8.0, ARRAY['Minor suggestion'], '{"issues": []}', 'Happy', 'Low', 'No Escalation Expected', 'Note suggestion for product team', ARRAY['Acknowledge suggestion', 'Explain roadmap', 'Thank for input'], 'Low', 'resolved'),
      (9, 95.0, 90.0, ARRAY['Churned customer', 'Unresolved complaints', 'Negative exit feedback'], '{"issues": [{"type": "multiple", "date": "2024-01-04", "resolved": false}]}', 'Very Negative', 'Past Due', 'Already Escalated/Churned', 'Conduct thorough exit analysis for future prevention', ARRAY['Document learnings', 'Identify root causes', 'Improve processes'], 'Critical', 'escalated'),
      (3, 8.0, 3.0, ARRAY['None detected'], '{"issues": []}', 'Very Satisfied', 'Low', 'No Escalation Expected', 'Maintain premium support experience', ARRAY['Continue excellence', 'Seek testimonial', 'Discuss expansion'], 'Low', 'resolved'),
      (6, 5.0, 2.0, ARRAY['None detected'], '{"issues": []}', 'Delighted', 'Low', 'No Escalation Expected', 'Leverage satisfaction for case study', ARRAY['Request case study', 'Discuss referrals', 'Plan innovation preview'], 'Low', 'resolved'),
      (10, 28.0, 20.0, ARRAY['Occasional question', 'Minor wait time'], '{"issues": [{"type": "question", "date": "2024-01-09", "resolved": true}]}', 'Neutral', 'Low', 'Standard Support', 'Maintain current support quality', ARRAY['Quick resolution focus', 'Proactive updates', 'Check satisfaction'], 'Low', 'monitoring'),
      (11, 15.0, 10.0, ARRAY['Feature inquiry'], '{"issues": []}', 'Interested', 'Low', 'No Escalation Expected', 'Provide detailed feature information', ARRAY['Share documentation', 'Offer demo', 'Discuss use cases'], 'Low', 'resolved'),
      (14, 22.0, 18.0, ARRAY['Pre-renewal questions'], '{"issues": [{"type": "renewal_inquiry", "date": "2024-01-08", "resolved": false}]}', 'Cautiously Optimistic', 'Medium', 'Standard Support', 'Prepare comprehensive renewal package', ARRAY['Address questions fully', 'Present value summary', 'Discuss terms'], 'Medium', 'monitoring'),
      (15, 6.0, 2.0, ARRAY['None detected'], '{"issues": []}', 'Very Satisfied', 'Low', 'No Escalation Expected', 'Continue strategic account management', ARRAY['Executive engagement', 'Strategic planning', 'Partnership discussion'], 'Low', 'resolved'),
      (17, 32.0, 25.0, ARRAY['Product feedback', 'Minor concerns'], '{"issues": [{"type": "feedback", "date": "2024-01-10", "resolved": false}]}', 'Slightly Concerned', 'Medium', 'Standard Support', 'Address feedback promptly and follow up', ARRAY['Acknowledge feedback', 'Provide timeline', 'Offer alternatives'], 'Medium', 'monitoring')
    `);

    console.log('Escalation predictions seeded');

    // Seed Service Level Predictions (15+ items) - NEW FEATURE
    await appClient.query(`
      INSERT INTO service_level_predictions (customer_id, predicted_response_time, predicted_resolution_time, sla_compliance_probability, service_tier, priority_score, queue_position, expected_first_response, expected_resolution, bottleneck_factors, optimization_suggestions, agent_workload_impact, customer_patience_index) VALUES
      (1, 5, 1, 99.0, 'VIP', 95.0, 1, 'within 5 minutes', 'within 1 hour', ARRAY['None - priority queue'], ARRAY['Dedicated account manager assigned', 'Direct escalation path available', 'Proactive monitoring enabled'], 'Low', 95.0),
      (2, 30, 4, 85.0, 'Standard', 60.0, 8, 'within 30 minutes', 'within 4 hours', ARRAY['Peak support hours', 'Complex integration issue'], ARRAY['Route to specialized team', 'Prepare documentation links', 'Schedule follow-up call'], 'Medium', 70.0),
      (3, 5, 2, 98.0, 'VIP', 92.0, 1, 'within 5 minutes', 'within 2 hours', ARRAY['None - enterprise priority'], ARRAY['Assign senior engineer', 'Enable screen sharing', 'Prepare executive summary'], 'Low', 90.0),
      (4, 45, 8, 65.0, 'Standard', 75.0, 15, 'within 45 minutes', 'within 8 hours', ARRAY['High ticket volume', 'Agent availability', 'Complex billing issue'], ARRAY['Prioritize due to churn risk', 'Assign retention specialist', 'Prepare goodwill credit'], 'High', 35.0),
      (5, 20, 3, 90.0, 'Priority', 70.0, 5, 'within 20 minutes', 'within 3 hours', ARRAY['Moderate queue depth'], ARRAY['Use automated diagnostics', 'Prepare integration guides', 'Enable chat support'], 'Medium', 75.0),
      (6, 3, 1, 99.5, 'VIP', 98.0, 1, 'within 3 minutes', 'within 1 hour', ARRAY['None - white glove service'], ARRAY['Direct CEO line available', 'Dedicated success manager', 'Instant escalation enabled'], 'Low', 98.0),
      (7, 60, 12, 55.0, 'Standard', 80.0, 20, 'within 1 hour', 'within 12 hours', ARRAY['Multiple open tickets', 'Technical complexity', 'Resource constraints'], ARRAY['Consolidate tickets', 'Assign dedicated agent', 'Schedule video call'], 'High', 25.0),
      (8, 5, 2, 98.0, 'VIP', 90.0, 2, 'within 5 minutes', 'within 2 hours', ARRAY['None - strategic account'], ARRAY['Priority routing enabled', 'Technical lead assigned', 'Executive sponsor notified'], 'Low', 92.0),
      (9, 120, 48, 20.0, 'Standard', 30.0, 45, 'within 2 hours', 'within 48 hours', ARRAY['Churned customer', 'Low priority', 'Win-back required'], ARRAY['Route to retention team', 'Prepare win-back offer', 'Document churn reasons'], 'Low', 10.0),
      (10, 25, 4, 88.0, 'Priority', 65.0, 6, 'within 25 minutes', 'within 4 hours', ARRAY['Standard queue time'], ARRAY['Use knowledge base', 'Enable self-service options', 'Schedule callback'], 'Medium', 72.0),
      (11, 15, 3, 92.0, 'Priority', 75.0, 4, 'within 15 minutes', 'within 3 hours', ARRAY['Growing account workload'], ARRAY['Assign growth specialist', 'Prepare expansion materials', 'Enable premium features'], 'Medium', 80.0),
      (12, 50, 10, 60.0, 'Standard', 70.0, 18, 'within 50 minutes', 'within 10 hours', ARRAY['Billing complexity', 'Multiple issues', 'Confused customer'], ARRAY['Simplify communication', 'Assign billing specialist', 'Prepare clear documentation'], 'High', 40.0),
      (13, 20, 2, 90.0, 'Priority', 72.0, 5, 'within 20 minutes', 'within 2 hours', ARRAY['New customer onboarding'], ARRAY['Fast-track onboarding', 'Assign success manager', 'Schedule training session'], 'Medium', 65.0),
      (14, 25, 4, 87.0, 'Priority', 68.0, 7, 'within 25 minutes', 'within 4 hours', ARRAY['Renewal period workload'], ARRAY['Prepare renewal summary', 'Highlight value delivered', 'Discuss multi-year options'], 'Medium', 75.0),
      (15, 5, 1, 99.0, 'VIP', 95.0, 1, 'within 5 minutes', 'within 1 hour', ARRAY['None - key account'], ARRAY['Executive hotline active', 'Strategic team on standby', 'Proactive monitoring'], 'Low', 95.0),
      (16, 90, 24, 40.0, 'Standard', 85.0, 30, 'within 90 minutes', 'within 24 hours', ARRAY['High churn risk', 'Payment issues', 'Limited engagement'], ARRAY['Escalate to retention', 'Prepare retention offer', 'Assign senior agent'], 'High', 20.0),
      (17, 30, 4, 85.0, 'Standard', 62.0, 9, 'within 30 minutes', 'within 4 hours', ARRAY['Normal queue depth'], ARRAY['Standard routing', 'Use templates', 'Enable self-service'], 'Medium', 70.0)
    `);

    console.log('Service level predictions seeded');

    // Seed Response Suggestions (15+ items) - NEW FEATURE
    await appClient.query(`
      INSERT INTO response_suggestions (customer_id, ticket_subject, ticket_description, suggested_response, response_tone, personalization_level, key_points, empathy_phrases, solution_steps, follow_up_actions, estimated_satisfaction, alternative_responses, knowledge_base_links) VALUES
      (1, 'API Rate Limit Question', 'Need clarification on API rate limits for our usage pattern', 'Dear John,\n\nThank you for reaching out about your API rate limits. As a valued Enterprise customer, you have access to our highest tier limits.\n\nYour current limits are:\n- 15,000 requests per minute\n- 1,000,000 requests per day\n\nBased on your usage patterns, you are currently at 60% of your daily limit. If you anticipate growth, we can discuss increasing your allocation.\n\nBest regards,\nSupport Team', 'Professional', 92.0, ARRAY['Confirm enterprise tier limits', 'Provide specific numbers', 'Offer to increase if needed', 'Reference usage patterns'], ARRAY['Thank you for reaching out', 'As a valued customer', 'We appreciate your business'], ARRAY['Check current usage in dashboard', 'Review rate limit documentation', 'Contact us for limit increase'], '{"actions": [{"action": "Monitor usage", "timeline": "Next 7 days", "owner": "Technical Support"}]}', 95.0, '[{"tone": "Technical", "brief_version": "Your Enterprise tier includes 15K req/min. Currently at 60% utilization."}]', ARRAY['API Rate Limits Guide', 'Enterprise Features Overview']),
      (2, 'Integration Not Syncing', 'Salesforce integration stopped syncing yesterday', 'Hi Sarah,\n\nI understand how frustrating sync issues can be, especially when your team relies on real-time data.\n\nI have reviewed your integration status and found that the sync paused due to an expired OAuth token. This is a common issue that is easy to fix.\n\nTo resolve this:\n1. Go to Settings > Integrations > Salesforce\n2. Click "Reconnect"\n3. Re-authorize the connection\n\nThe sync should resume within 5 minutes.\n\nLet me know if you need any help!\n\nBest,\nSupport Team', 'Empathetic', 85.0, ARRAY['Acknowledge frustration', 'Identify root cause', 'Provide clear steps', 'Offer additional help'], ARRAY['I understand how frustrating', 'Your team relies on this', 'Easy to fix'], ARRAY['Navigate to Settings', 'Click Reconnect button', 'Re-authorize OAuth', 'Wait for sync resume'], '{"actions": [{"action": "Verify sync resumed", "timeline": "24 hours", "owner": "Integration Team"}]}', 88.0, '[{"tone": "Solution-Focused", "brief_version": "OAuth token expired. Reconnect via Settings > Integrations > Salesforce."}]', ARRAY['Salesforce Integration Guide', 'OAuth Troubleshooting']),
      (3, 'Feature Request: Custom Reports', 'Would like ability to create custom report templates', 'Dear Mike,\n\nThank you for this excellent suggestion! Custom report templates is actually on our Q2 roadmap, and your feedback helps validate this priority.\n\nAs an Enterprise customer, you will have early access to this feature when it launches in April.\n\nIn the meantime, our Professional Services team can help create custom reports for your specific needs at no additional charge.\n\nWould you like me to schedule a call with our PS team?\n\nBest regards,\nProduct Team', 'Friendly', 95.0, ARRAY['Acknowledge great suggestion', 'Share roadmap timeline', 'Offer interim solution', 'Highlight enterprise benefits'], ARRAY['Excellent suggestion', 'Your feedback helps validate', 'Happy to help'], ARRAY['Review current reporting options', 'Schedule PS consultation', 'Join beta program'], '{"actions": [{"action": "Add to beta list", "timeline": "Immediate", "owner": "Product Manager"}, {"action": "Schedule PS call", "timeline": "This week", "owner": "Success Manager"}]}', 96.0, '[{"tone": "Enthusiastic", "brief_version": "Custom reports coming Q2! Would you like early beta access?"}]', ARRAY['Report Builder Guide', 'Enterprise Features']),
      (4, 'Cannot Access Dashboard', 'Getting 403 error when trying to access analytics dashboard', 'Hi Emily,\n\nI am sorry you are experiencing access issues - I know this is blocking your work and I want to help resolve this quickly.\n\nI have investigated and found the issue: your session permissions need to be refreshed due to a recent security update.\n\nPlease try these steps:\n1. Log out completely\n2. Clear your browser cache\n3. Log back in\n\nIf the issue persists, I have also reset your permissions on our end.\n\nPlease let me know if this resolves the issue.\n\nBest,\nSupport Team', 'Apologetic', 80.0, ARRAY['Apologize for inconvenience', 'Explain root cause', 'Provide immediate steps', 'Mention backend fix'], ARRAY['I am sorry you are experiencing', 'I know this is blocking', 'Want to help resolve quickly'], ARRAY['Log out completely', 'Clear browser cache', 'Log back in', 'Contact if persists'], '{"actions": [{"action": "Verify access restored", "timeline": "4 hours", "owner": "Technical Support"}, {"action": "Check for related issues", "timeline": "Today", "owner": "Engineering"}]}', 75.0, '[{"tone": "Technical", "brief_version": "Security update requires session refresh. Log out, clear cache, log back in."}]', ARRAY['Access Troubleshooting', 'Browser Requirements']),
      (5, 'Password Reset Issue', 'Password reset email not being received', 'Hi David,\n\nThank you for letting us know about this issue. Password reset emails should arrive within 2 minutes.\n\nI have checked our email logs and found that emails to innovate.co are being delayed by your mail server.\n\nHere is what I have done:\n1. Resent the reset email from our backup system\n2. Added your domain to our priority sender list\n\nPlease also check your spam/junk folder.\n\nIf you still do not receive it in 10 minutes, I can manually reset your password.\n\nBest,\nSupport Team', 'Solution-Focused', 82.0, ARRAY['Acknowledge the issue', 'Explain what was found', 'List actions taken', 'Offer alternative'], ARRAY['Thank you for letting us know', 'I have checked our logs', 'Happy to help further'], ARRAY['Check spam folder', 'Wait 10 minutes', 'Reply if not received'], '{"actions": [{"action": "Monitor email delivery", "timeline": "1 hour", "owner": "Email Team"}]}', 85.0, '[{"tone": "Brief", "brief_version": "Email resent via backup system. Check spam folder. Reply in 10 min if not received."}]', ARRAY['Password Reset Guide', 'Email Delivery FAQ']),
      (6, 'Performance Slow', 'Dashboard loading very slowly in the morning', 'Dear Jennifer,\n\nThank you for reporting this performance issue. As one of our most valued Enterprise customers, ensuring optimal performance for your team is our top priority.\n\nI have escalated this to our infrastructure team and we have identified the cause: a database query optimization needed for your data volume.\n\nWe have already deployed a fix, and you should see significant improvement.\n\nAdditionally, I have enabled our CDN acceleration for your account at no extra charge.\n\nPlease let me know if performance meets your expectations now.\n\nBest regards,\nSenior Support Engineer', 'Professional', 98.0, ARRAY['Acknowledge priority status', 'Show immediate escalation', 'Explain fix deployed', 'Add value with CDN'], ARRAY['Top priority', 'Most valued customer', 'Ensuring optimal performance'], ARRAY['Issue identified', 'Fix deployed', 'CDN enabled', 'Monitor performance'], '{"actions": [{"action": "Monitor performance metrics", "timeline": "48 hours", "owner": "Infrastructure"}, {"action": "Follow-up call", "timeline": "Tomorrow", "owner": "Account Manager"}]}', 98.0, '[{"tone": "Executive", "brief_version": "Issue resolved. Database optimized + CDN enabled for your account."}]', ARRAY['Performance Optimization', 'Enterprise SLA']),
      (7, 'Billing Discrepancy', 'Invoice amount does not match expected charges', 'Hi Robert,\n\nI sincerely apologize for any confusion with your invoice. Billing clarity is important, and I want to make sure we resolve this completely.\n\nI have reviewed your account and found the discrepancy:\n- Expected: $1,200\n- Invoiced: $1,350\n- Difference: $150 (pro-rated charge for mid-month upgrade)\n\nThis charge was for the Professional to Enterprise feature you activated on January 15th.\n\nI am applying a $150 credit to your next invoice as a goodwill gesture for the confusion.\n\nPlease let me know if you have any other questions.\n\nBest,\nBilling Team', 'Apologetic', 88.0, ARRAY['Apologize for confusion', 'Provide clear breakdown', 'Explain the charge', 'Offer goodwill credit'], ARRAY['Sincerely apologize', 'Billing clarity is important', 'Want to resolve completely'], ARRAY['Review invoice breakdown', 'Identify discrepancy source', 'Apply credit', 'Confirm resolution'], '{"actions": [{"action": "Process credit", "timeline": "24 hours", "owner": "Billing"}, {"action": "Send updated invoice", "timeline": "48 hours", "owner": "Finance"}]}', 82.0, '[{"tone": "Direct", "brief_version": "Discrepancy was pro-rated upgrade charge. $150 credit applied to your account."}]', ARRAY['Billing FAQ', 'Invoice Guide']),
      (8, 'Training Request', 'Need training session for new team members', 'Dear Lisa,\n\nExcellent news that your team is growing! We would be delighted to provide comprehensive training for your new members.\n\nAs an Enterprise customer, you have access to:\n- Unlimited live training sessions\n- Dedicated success manager (Sarah, CC''d)\n- Custom training materials\n- On-demand video library\n\nI have scheduled a 2-hour training session for next Tuesday at 2 PM EST. Sarah will reach out to customize the agenda.\n\nLooking forward to helping your new team members succeed!\n\nBest,\nCustomer Success', 'Friendly', 95.0, ARRAY['Celebrate team growth', 'List available resources', 'Confirm scheduled session', 'Introduce success manager'], ARRAY['Excellent news', 'Delighted to provide', 'Looking forward to'], ARRAY['Review training catalog', 'Schedule session', 'Prepare materials', 'Send calendar invite'], '{"actions": [{"action": "Prepare training agenda", "timeline": "Monday", "owner": "Sarah (CSM)"}, {"action": "Send pre-training materials", "timeline": "3 days before", "owner": "Training Team"}]}', 98.0, '[{"tone": "Enthusiastic", "brief_version": "Training scheduled for Tuesday 2PM EST. Sarah will customize the agenda for your team."}]', ARRAY['Training Catalog', 'Onboarding Guide', 'Video Library']),
      (9, 'Cancellation Request', 'Requesting to cancel subscription', 'Dear James,\n\nI am sorry to hear you are considering cancellation. Before we process this, I would like to understand what led to this decision so we can see if there is anything we can do to address your concerns.\n\nI noticed from your account history that you have been a customer since July 2023, and we truly value that relationship.\n\nWould you be open to a brief call to discuss:\n1. What is not working for you currently\n2. Any features you wish we had\n3. Potential solutions we could offer\n\nIf you decide to proceed with cancellation, we can do that anytime. But I would appreciate the chance to make things right.\n\nSincerely,\nRetention Team', 'Empathetic', 85.0, ARRAY['Express regret', 'Show value for relationship', 'Request feedback call', 'Keep door open'], ARRAY['Sorry to hear', 'Truly value that relationship', 'Appreciate the chance'], ARRAY['Schedule retention call', 'Review account history', 'Prepare retention offer', 'Document feedback'], '{"actions": [{"action": "Schedule retention call", "timeline": "Within 24 hours", "owner": "Retention Specialist"}, {"action": "Prepare win-back offer", "timeline": "Before call", "owner": "Manager"}]}', 45.0, '[{"tone": "Understanding", "brief_version": "I understand. Before we proceed, would you share what led to this decision? We may be able to help."}]', ARRAY['Cancellation Policy', 'Pause Options']),
      (10, 'SSO Configuration', 'Help setting up SAML SSO', 'Hi Amanda,\n\nGreat to hear you are setting up SSO - this will improve security and convenience for your team!\n\nHere is your step-by-step guide:\n\n1. Navigate to Admin > Security > SSO\n2. Select SAML 2.0\n3. Download our metadata file\n4. Configure your IdP with our details:\n   - Entity ID: https://app.churnpredict.com/saml\n   - ACS URL: https://app.churnpredict.com/saml/callback\n5. Upload your IdP metadata to our system\n6. Test with a non-admin user first\n\nI have also attached our SSO configuration guide with screenshots.\n\nWould you like to schedule a screen share session to walk through this together?\n\nBest,\nSecurity Team', 'Professional', 90.0, ARRAY['Acknowledge security benefit', 'Provide clear steps', 'Include technical details', 'Offer hands-on help'], ARRAY['Great to hear', 'Improve security', 'Happy to walk through'], ARRAY['Navigate to Admin', 'Download metadata', 'Configure IdP', 'Upload and test'], '{"actions": [{"action": "Follow up on SSO status", "timeline": "3 days", "owner": "Technical Support"}]}', 90.0, '[{"tone": "Technical", "brief_version": "SSO guide attached. Entity ID and ACS URL provided. Want to schedule a screen share?"}]', ARRAY['SSO Setup Guide', 'SAML Configuration', 'Security Best Practices']),
      (11, 'License Addition', 'Need to add 10 more user licenses', 'Dear Christopher,\n\nFantastic news about your team expansion! Adding 10 licenses is quick and easy.\n\nHere are your options:\n\nOption A - Pro-rated (Immediate):\n- 10 licenses at $280/user/month\n- Pro-rated for remaining billing cycle: $1,866.67\n- New monthly total: $5,600\n\nOption B - Annual Commitment (15% discount):\n- 10 licenses at $238/user/month\n- Annual commitment saves $5,040/year\n\nWould you like me to process either option, or would you prefer to discuss with your team first?\n\nBest regards,\nAccount Management', 'Professional', 92.0, ARRAY['Celebrate expansion', 'Provide clear pricing', 'Offer discount option', 'Make it easy to decide'], ARRAY['Fantastic news', 'Quick and easy', 'Happy to help'], ARRAY['Review license options', 'Calculate pro-rated cost', 'Process order', 'Activate licenses'], '{"actions": [{"action": "Send formal quote", "timeline": "Today", "owner": "Account Manager"}, {"action": "Prepare contract amendment", "timeline": "Upon approval", "owner": "Legal"}]}', 95.0, '[{"tone": "Sales", "brief_version": "10 licenses: $280/user/month or $238 with annual commitment (15% off)."}]', ARRAY['License Management', 'Pricing Guide']),
      (12, 'Data Export Failed', 'Large data export timing out', 'Hi Michelle,\n\nI understand how important it is to access your data, and I apologize for the export timeout you experienced.\n\nFor large exports like yours (I see you have 50,000+ records), I recommend:\n\n1. Use our async export feature:\n   - Go to Reports > Export > Async Export\n   - You will receive an email when ready (usually 10-15 min)\n\n2. Or use our API for programmatic access:\n   - Endpoint: /api/v1/export\n   - Supports pagination for large datasets\n\nI have also temporarily increased your export timeout limit.\n\nWould you like a quick walkthrough of the async export feature?\n\nBest,\nSupport Team', 'Solution-Focused', 78.0, ARRAY['Acknowledge data importance', 'Apologize for timeout', 'Provide alternatives', 'Offer walkthrough'], ARRAY['Understand how important', 'Apologize for the timeout', 'Happy to walk through'], ARRAY['Use async export', 'Check email for file', 'Alternative: use API'], '{"actions": [{"action": "Monitor export success", "timeline": "24 hours", "owner": "Technical Support"}, {"action": "Review export limits", "timeline": "This week", "owner": "Engineering"}]}', 80.0, '[{"tone": "Technical", "brief_version": "Use Reports > Export > Async Export for large datasets. Email notification when ready."}]', ARRAY['Data Export Guide', 'API Documentation']),
      (13, 'Onboarding Help', 'Need assistance completing onboarding steps', 'Hi Daniel,\n\nWelcome aboard! I am here to help you get the most out of our platform.\n\nI see you are at 65% of onboarding - great progress! Here is what is left:\n\n1. Connect your first data source (5 min)\n2. Create your first dashboard (10 min)\n3. Invite a team member (2 min)\n\nI have created a personalized checklist in your dashboard with video guides for each step.\n\nWould you prefer:\nA) Self-guided with video tutorials\nB) Live 30-minute walkthrough with me\n\nEither way, we will get you up and running quickly!\n\nBest,\nOnboarding Specialist', 'Friendly', 88.0, ARRAY['Welcome warmly', 'Acknowledge progress', 'Simplify remaining steps', 'Offer help options'], ARRAY['Welcome aboard', 'Here to help', 'Great progress'], ARRAY['Connect data source', 'Create dashboard', 'Invite team member'], '{"actions": [{"action": "Schedule onboarding call if requested", "timeline": "Within 24 hours", "owner": "Onboarding Team"}, {"action": "Check completion status", "timeline": "3 days", "owner": "Success Manager"}]}', 88.0, '[{"tone": "Encouraging", "brief_version": "65% done! Three quick steps left. Want a live walkthrough or self-guided videos?"}]', ARRAY['Getting Started Guide', 'Video Tutorials', 'Quick Start Checklist']),
      (14, 'Renewal Questions', 'Questions about upcoming contract renewal', 'Dear Jessica,\n\nThank you for reaching out about your renewal! I am happy to answer your questions and ensure a smooth process.\n\nYour current contract details:\n- Current term ends: March 15, 2024\n- Current plan: Professional ($950/month)\n- Renewal options available\n\nBased on your usage and growth, I recommend considering:\n\n1. Same plan renewal: $950/month\n2. Upgrade to Enterprise: $1,800/month (includes advanced features you have been requesting)\n3. Multi-year commitment: 15% discount on either option\n\nI would love to schedule a call to discuss your goals for 2024 and find the best fit.\n\nBest regards,\nAccount Manager', 'Professional', 90.0, ARRAY['Confirm contract details', 'Present options clearly', 'Make recommendation', 'Suggest discussion'], ARRAY['Happy to answer', 'Ensure smooth process', 'Love to discuss'], ARRAY['Review current contract', 'Evaluate options', 'Schedule renewal call', 'Process renewal'], '{"actions": [{"action": "Schedule renewal call", "timeline": "This week", "owner": "Account Manager"}, {"action": "Prepare renewal proposal", "timeline": "Before call", "owner": "Sales"}]}', 92.0, '[{"tone": "Consultative", "brief_version": "Contract ends March 15. Three options: same plan, Enterprise upgrade, or multi-year with 15% off."}]', ARRAY['Renewal FAQ', 'Plan Comparison', 'Enterprise Features']),
      (15, 'Strategic Planning', 'Quarterly strategic planning session request', 'Dear Matthew,\n\nAbsolutely! We are delighted to schedule your Q1 strategic planning session.\n\nAs one of our key strategic accounts, I am proposing a comprehensive agenda:\n\n1. Q4 2023 Success Review (20 min)\n   - ROI analysis: You have saved 450+ hours\n   - Feature adoption: 95% utilization\n\n2. 2024 Goals Alignment (30 min)\n   - Your business objectives\n   - How we can support growth\n\n3. Product Roadmap Preview (30 min)\n   - Exclusive early look at Q1-Q2 features\n   - Your input on priorities\n\n4. Strategic Partnership Discussion (20 min)\n   - Co-marketing opportunities\n   - Beta program participation\n\nProposed: Thursday, January 18th, 10 AM EST\n\nShall I send calendar invites?\n\nBest regards,\nVP of Customer Success', 'Professional', 98.0, ARRAY['Confirm VIP status', 'Propose comprehensive agenda', 'Highlight achievements', 'Discuss partnership'], ARRAY['Delighted to schedule', 'Key strategic account', 'Value your partnership'], ARRAY['Confirm date', 'Prepare materials', 'Send invites', 'Brief executive team'], '{"actions": [{"action": "Prepare QBR materials", "timeline": "Jan 16", "owner": "Success Manager"}, {"action": "Brief VP", "timeline": "Jan 17", "owner": "Account Director"}]}', 99.0, '[{"tone": "Executive", "brief_version": "Strategic QBR proposed for Jan 18. Agenda includes success review, 2024 planning, and roadmap preview."}]', ARRAY['QBR Template', 'Strategic Account Program']),
      (16, 'Account Downgrade', 'Considering downgrading to starter plan', 'Dear Ashley,\n\nI appreciate you reaching out before making this decision. I want to make sure downgrading is truly the best option for your needs.\n\nIf you downgrade to Starter, you would lose:\n- Advanced analytics (which you use 15x/month)\n- API access (12 active integrations)\n- Priority support\n\nBefore deciding, would you consider:\n\n1. Temporary pause: Keep features, pause billing for 30 days\n2. Usage-based plan: Pay only for what you use\n3. Discounted Professional: 40% off for 6 months ($420/month)\n\nI would really like to understand what is driving this decision so we can find the right solution.\n\nCan we schedule a quick call?\n\nSincerely,\nRetention Team', 'Empathetic', 82.0, ARRAY['Appreciate communication', 'Highlight what would be lost', 'Offer alternatives', 'Request conversation'], ARRAY['Appreciate you reaching out', 'Want to make sure', 'Find the right solution'], ARRAY['Review current usage', 'Evaluate alternatives', 'Schedule discussion', 'Make decision together'], '{"actions": [{"action": "Schedule retention call", "timeline": "24 hours", "owner": "Retention Specialist"}, {"action": "Prepare retention offer", "timeline": "Before call", "owner": "Manager"}]}', 55.0, '[{"tone": "Understanding", "brief_version": "Before downgrading, consider: 30-day pause, usage-based pricing, or 40% discount. Can we discuss?"}]', ARRAY['Plan Comparison', 'Pause Options', 'Usage-Based Pricing']),
      (17, 'Feature Feedback', 'Feedback on recent feature release', 'Hi Andrew,\n\nThank you so much for taking the time to share your feedback on our new automation features! Customer input like yours is invaluable.\n\nI have shared your specific points with our product team:\n\n1. Workflow builder UI - Noted for improvement\n2. Template library - Great suggestion, adding to roadmap\n3. Error messaging - Bug report filed, fix in next release\n\nAs a thank you, I would like to invite you to our Customer Advisory Board. You would get:\n- Early access to new features\n- Direct line to product team\n- Quarterly strategy sessions\n\nInterested?\n\nBest,\nProduct Team', 'Friendly', 88.0, ARRAY['Thank for feedback', 'Confirm action taken', 'Offer advisory board', 'Show appreciation'], ARRAY['Thank you so much', 'Invaluable input', 'As a thank you'], ARRAY['Document feedback', 'Share with product', 'Track resolution', 'Follow up on fixes'], '{"actions": [{"action": "Follow up on bug fix", "timeline": "Next release", "owner": "Product"}, {"action": "Send advisory board invite", "timeline": "This week", "owner": "Success Manager"}]}', 90.0, '[{"tone": "Grateful", "brief_version": "Feedback shared with product team. Bug fix coming next release. Would you join our Advisory Board?"}]', ARRAY['Product Roadmap', 'Advisory Board Info', 'Feature Request Portal'])
    `);

    console.log('Response suggestions seeded');

    console.log('\n✅ Database seeding completed successfully!');
    console.log('Demo login users provisioned from the local environment.');
    console.log('\n🆕 NEW FEATURES ADDED:');
    console.log('  - AI Service Level Predictor (Customer Service)');
    console.log('  - AI Response Suggester (Customer Service)');

    await appClient.release();
    await appPool.end();

  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

seed().catch(console.error);

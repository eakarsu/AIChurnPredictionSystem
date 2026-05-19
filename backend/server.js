const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { body, query, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const PDFDocument = require('pdfkit');
const pool = require('./db');
require('dotenv').config({ path: '../.env' });

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// ============ DB-BACKED TOKEN BLACKLIST SETUP ============
// Initializes the token_blacklist table if it doesn't exist.
// Falls back to an in-memory Set if the DB is unavailable at startup.
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS token_blacklist (
        token TEXT PRIMARY KEY,
        expires_at TIMESTAMPTZ NOT NULL
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON token_blacklist (expires_at)`);
    console.log('Token blacklist table ready');
  } catch (err) {
    console.error('Could not create token_blacklist table:', err.message);
  }
})();

// Periodically purge expired tokens from the DB blacklist (every 30 minutes)
setInterval(async () => {
  try {
    const result = await pool.query('DELETE FROM token_blacklist WHERE expires_at < NOW()');
    if (result.rowCount > 0) {
      console.log(`Purged ${result.rowCount} expired tokens from blacklist`);
    }
  } catch (err) {
    console.error('Token blacklist purge error:', err.message);
  }
}, 30 * 60 * 1000);

// ============ SECURITY MIDDLEWARE ============

// Helmet security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false
}));

// CORS
app.use(cors());

// Body parser
app.use(express.json({ limit: '10mb' }));

// Rate limiting - general
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
});
app.use('/api/', generalLimiter);

// Rate limiting - auth (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later' }
});

// Rate limiting - AI endpoints (10 req/15min per IP to prevent abuse and runaway costs)
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  message: { error: 'AI rate limit exceeded. Maximum 10 AI requests per 15 minutes per IP.' }
});

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    const sanitized = Array.isArray(obj) ? [] : {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = value.replace(/<script[^>]*>.*?<\/script>/gi, '')
          .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
          .replace(/javascript:/gi, '')
          .trim();
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitize(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  };
  if (req.body) req.body = sanitize(req.body);
  if (req.query) req.query = sanitize(req.query);
  next();
};
app.use(sanitizeInput);

// Global error handler middleware
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }
  next();
};

// Password strength validator
const validatePasswordStrength = (password) => {
  const errors = [];
  if (password.length < 8) errors.push('Password must be at least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('Password must contain at least one number');
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push('Password must contain at least one special character');
  return errors;
};

// JWT Authentication Middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // Check DB-backed token blacklist (logout)
  try {
    const blacklisted = await pool.query(
      'SELECT 1 FROM token_blacklist WHERE token = $1 AND expires_at > NOW()',
      [token]
    );
    if (blacklisted.rows.length > 0) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }
  } catch (err) {
    console.error('Token blacklist check error:', err.message);
    // On DB error, fall through and let JWT verification decide
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    req.token = token;
    next();
  });
};

// RBAC Authorization Middleware
const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ error: 'Access denied: No role assigned' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: `Access denied: Requires ${allowedRoles.join(' or ')} role` });
    }
    next();
  };
};

// Pagination/Search/Sort/Filter helper
const buildListQuery = (baseTable, baseQuery, req, searchableColumns = []) => {
  const { page = 1, limit = 50, search, sort, order = 'asc', ...filterParams } = req.query;
  let conditions = [];
  let params = [];
  let paramIndex = 1;

  // Search across searchable columns
  if (search && searchableColumns.length > 0) {
    const searchConditions = searchableColumns.map(col => {
      params.push(`%${search}%`);
      return `CAST(${col} AS TEXT) ILIKE $${paramIndex++}`;
    });
    conditions.push(`(${searchConditions.join(' OR ')})`);
  }

  // Dynamic filters
  const reservedParams = ['page', 'limit', 'search', 'sort', 'order'];
  Object.entries(filterParams).forEach(([key, value]) => {
    if (value && !reservedParams.includes(key)) {
      const safeKey = key.replace(/[^a-zA-Z0-9_.]/g, '');
      params.push(value);
      conditions.push(`${safeKey} = $${paramIndex++}`);
    }
  });

  let query = baseQuery;
  if (conditions.length > 0) {
    const hasWhere = baseQuery.toUpperCase().includes('WHERE');
    query += (hasWhere ? ' AND ' : ' WHERE ') + conditions.join(' AND ');
  }

  // Sort
  if (sort) {
    const safeSort = sort.replace(/[^a-zA-Z0-9_.]/g, '');
    const safeOrder = order === 'desc' ? 'DESC' : 'ASC';
    query += ` ORDER BY ${safeSort} ${safeOrder}`;
  }

  // Count query
  const countQuery = `SELECT COUNT(*) FROM (${query}) AS count_query`;

  // Pagination
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;
  params.push(limitNum);
  query += ` LIMIT $${paramIndex++}`;
  params.push(offset);
  query += ` OFFSET $${paramIndex++}`;

  return { query, countQuery, params, countParams: params.slice(0, -2), pageNum, limitNum };
};

// ============ AUTH ROUTES ============
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, role, email_verified, avatar, phone, department, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ REGISTRATION ============
app.post('/api/auth/register', authLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters')
], handleValidationErrors, async (req, res) => {
  try {
    const { email, password, name, phone, department } = req.body;

    // Password strength check
    const strengthErrors = validatePasswordStrength(password);
    if (strengthErrors.length > 0) {
      return res.status(400).json({ error: 'Weak password', details: strengthErrors });
    }

    // Check if email exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const verificationToken = uuidv4();

    const result = await pool.query(
      `INSERT INTO users (email, password, name, role, email_verified, verification_token, phone, department)
       VALUES ($1, $2, $3, 'user', FALSE, $4, $5, $6) RETURNING id, email, name, role, email_verified`,
      [email, hashedPassword, name, verificationToken, phone || null, department || null]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      token,
      user,
      message: 'Registration successful. Please verify your email.',
      verification_token: verificationToken
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ EMAIL VERIFICATION ============
app.post('/api/auth/verify-email', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Verification token required' });

    const result = await pool.query(
      'UPDATE users SET email_verified = TRUE, verification_token = NULL WHERE verification_token = $1 RETURNING id, email, name, email_verified',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    res.json({ message: 'Email verified successfully', user: result.rows[0] });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ LOGOUT ============
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  try {
    // Decode token to get expiry so we can set expires_at in the blacklist
    const decoded = jwt.decode(req.token);
    const expiresAt = decoded && decoded.exp
      ? new Date(decoded.exp * 1000)
      : new Date(Date.now() + 24 * 60 * 60 * 1000); // fallback: 24h from now

    await pool.query(
      'INSERT INTO token_blacklist (token, expires_at) VALUES ($1, $2) ON CONFLICT (token) DO NOTHING',
      [req.token, expiresAt]
    );
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout DB error:', err.message);
    // Even on DB error, return success — the JWT will naturally expire
    res.json({ message: 'Logged out successfully' });
  }
});

// ============ FORGOT PASSWORD ============
app.post('/api/auth/forgot-password', authLimiter, [
  body('email').isEmail().normalizeEmail()
], handleValidationErrors, async (req, res) => {
  try {
    const { email } = req.body;
    const resetToken = uuidv4();
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour

    const result = await pool.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE email = $3 RETURNING id',
      [resetToken, resetExpires, email]
    );

    // Always return success to prevent email enumeration
    res.json({
      message: 'If an account exists with that email, a password reset link has been sent.',
      reset_token: result.rows.length > 0 ? resetToken : undefined
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ RESET PASSWORD ============
app.post('/api/auth/reset-password', authLimiter, [
  body('token').notEmpty().withMessage('Reset token required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
], handleValidationErrors, async (req, res) => {
  try {
    const { token, password } = req.body;

    const strengthErrors = validatePasswordStrength(password);
    if (strengthErrors.length > 0) {
      return res.status(400).json({ error: 'Weak password', details: strengthErrors });
    }

    const user = await pool.query(
      'SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
      [token]
    );

    if (user.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    await pool.query(
      'UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [hashedPassword, user.rows[0].id]
    );

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ CHANGE PASSWORD ============
app.put('/api/auth/change-password', authenticateToken, [
  body('currentPassword').notEmpty().withMessage('Current password required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
], handleValidationErrors, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const strengthErrors = validatePasswordStrength(newPassword);
    if (strengthErrors.length > 0) {
      return res.status(400).json({ error: 'Weak password', details: strengthErrors });
    }

    const result = await pool.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
    const validPassword = await bcrypt.compare(currentPassword, result.rows[0].password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, req.user.id]);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ USER PROFILE ============
app.get('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, role, email_verified, avatar, phone, department, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/auth/profile', authenticateToken, [
  body('name').optional().trim().isLength({ min: 2 }),
  body('phone').optional().trim(),
  body('department').optional().trim()
], handleValidationErrors, async (req, res) => {
  try {
    const { name, phone, department, avatar } = req.body;
    const result = await pool.query(
      `UPDATE users SET
        name = COALESCE($1, name),
        phone = COALESCE($2, phone),
        department = COALESCE($3, department),
        avatar = COALESCE($4, avatar)
       WHERE id = $5
       RETURNING id, email, name, role, email_verified, avatar, phone, department, created_at`,
      [name, phone, department, avatar, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ CUSTOMERS ROUTES ============
app.get('/api/customers', authenticateToken, async (req, res) => {
  try {
    if (req.query.page) {
      const { query: q, countQuery, params, countParams, pageNum, limitNum } = buildListQuery(
        'customers', 'SELECT * FROM customers', req,
        ['name', 'email', 'company', 'plan', 'status']
      );
      const [dataResult, countResult] = await Promise.all([
        pool.query(q, params),
        pool.query(countQuery, countParams)
      ]);
      return res.json({
        data: dataResult.rows,
        pagination: { page: pageNum, limit: limitNum, total: parseInt(countResult.rows[0].count), totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limitNum) }
      });
    }
    const result = await pool.query('SELECT * FROM customers ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/customers/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/customers', authenticateToken, async (req, res) => {
  try {
    const { name, email, company, plan, monthly_revenue, signup_date, status } = req.body;
    const result = await pool.query(
      `INSERT INTO customers (name, email, company, plan, monthly_revenue, signup_date, last_activity, status)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, $7) RETURNING *`,
      [name, email, company, plan, monthly_revenue, signup_date, status || 'active']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/customers/:id', authenticateToken, async (req, res) => {
  try {
    const { name, email, company, plan, monthly_revenue, status } = req.body;
    const result = await pool.query(
      `UPDATE customers SET name = $1, email = $2, company = $3, plan = $4,
       monthly_revenue = $5, status = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 RETURNING *`,
      [name, email, company, plan, monthly_revenue, status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/customers/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM customers WHERE id = $1', [req.params.id]);
    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Bulk delete customers
app.delete('/api/customers/bulk', authenticateToken, authorizeRole('admin', 'manager', 'user', 'analyst'), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'Array of ids required' });
    await pool.query('DELETE FROM customers WHERE id = ANY($1::int[])', [ids]);
    res.json({ message: `${ids.length} customers deleted`, deleted: ids.length });
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

// Bulk update customers
app.put('/api/customers/bulk', authenticateToken, async (req, res) => {
  try {
    const { ids, updates } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'Array of ids required' });
    if (!updates || Object.keys(updates).length === 0) return res.status(400).json({ error: 'Updates object required' });
    const allowedFields = ['status', 'plan', 'company'];
    const setClauses = []; const params = []; let paramIdx = 1;
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) { setClauses.push(`${key} = $${paramIdx++}`); params.push(value); }
    }
    if (setClauses.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
    params.push(ids);
    await pool.query(`UPDATE customers SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($${paramIdx}::int[])`, params);
    res.json({ message: `${ids.length} customers updated`, updated: ids.length });
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

// ============ CHURN PREDICTIONS ROUTES ============
app.get('/api/predictions', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cp.*, c.name as customer_name, c.company, c.email as customer_email
      FROM churn_predictions cp
      JOIN customers c ON cp.customer_id = c.id
      ORDER BY cp.prediction_score DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/predictions/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cp.*, c.name as customer_name, c.company, c.email as customer_email
      FROM churn_predictions cp
      JOIN customers c ON cp.customer_id = c.id
      WHERE cp.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prediction not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/predictions', authenticateToken, async (req, res) => {
  try {
    const { customer_id, prediction_score, confidence_level, factors, status, ai_analysis, ai_response, ai_response_time_ms } = req.body;
    const result = await pool.query(
      `INSERT INTO churn_predictions (customer_id, prediction_score, prediction_date, confidence_level, factors, status, ai_analysis, ai_response, ai_response_time_ms)
       VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [customer_id, prediction_score, confidence_level, factors, status, ai_analysis, ai_response ? JSON.stringify(ai_response) : null, ai_response_time_ms]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create prediction error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/predictions/:id', authenticateToken, async (req, res) => {
  try {
    const { prediction_score, confidence_level, factors, status, ai_analysis } = req.body;
    const result = await pool.query(
      `UPDATE churn_predictions SET prediction_score = $1, confidence_level = $2,
       factors = $3, status = $4, ai_analysis = $5 WHERE id = $6 RETURNING *`,
      [prediction_score, confidence_level, factors, status, ai_analysis, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/predictions/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM churn_predictions WHERE id = $1', [req.params.id]);
    res.json({ message: 'Prediction deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ RISK SCORES ROUTES ============
app.get('/api/risk-scores', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT rs.*, c.name as customer_name, c.company
      FROM risk_scores rs
      JOIN customers c ON rs.customer_id = c.id
      ORDER BY rs.score DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/risk-scores/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT rs.*, c.name as customer_name, c.company
      FROM risk_scores rs
      JOIN customers c ON rs.customer_id = c.id
      WHERE rs.id = $1
    `, [req.params.id]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/risk-scores', authenticateToken, async (req, res) => {
  try {
    const { customer_id, risk_level, score, category, contributing_factors, recommended_actions, ai_response, ai_response_time_ms } = req.body;
    const result = await pool.query(
      `INSERT INTO risk_scores (customer_id, risk_level, score, category, contributing_factors, recommended_actions, ai_response, ai_response_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [customer_id, risk_level, score, category, contributing_factors, recommended_actions, ai_response ? JSON.stringify(ai_response) : null, ai_response_time_ms]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/risk-scores/:id', authenticateToken, async (req, res) => {
  try {
    const { risk_level, score, category, contributing_factors, recommended_actions } = req.body;
    const result = await pool.query(
      `UPDATE risk_scores SET risk_level = $1, score = $2, category = $3,
       contributing_factors = $4, recommended_actions = $5 WHERE id = $6 RETURNING *`,
      [risk_level, score, category, contributing_factors, recommended_actions, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/risk-scores/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM risk_scores WHERE id = $1', [req.params.id]);
    res.json({ message: 'Risk score deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ CUSTOMER SEGMENTS ROUTES ============
app.get('/api/segments', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM customer_segments ORDER BY customer_count DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/segments/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM customer_segments WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/segments', authenticateToken, async (req, res) => {
  try {
    const { name, description, criteria, customer_count, avg_revenue, churn_rate, ai_response, ai_response_time_ms } = req.body;
    const result = await pool.query(
      `INSERT INTO customer_segments (name, description, criteria, customer_count, avg_revenue, churn_rate, ai_response, ai_response_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, description, criteria, customer_count, avg_revenue, churn_rate, ai_response, ai_response_time_ms]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/segments/:id', authenticateToken, async (req, res) => {
  try {
    const { name, description, criteria, customer_count, avg_revenue, churn_rate } = req.body;
    const result = await pool.query(
      `UPDATE customer_segments SET name = $1, description = $2, criteria = $3,
       customer_count = $4, avg_revenue = $5, churn_rate = $6 WHERE id = $7 RETURNING *`,
      [name, description, criteria, customer_count, avg_revenue, churn_rate, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/segments/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM customer_segments WHERE id = $1', [req.params.id]);
    res.json({ message: 'Segment deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ INTERVENTIONS ROUTES ============
app.get('/api/interventions', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT i.*, c.name as customer_name, c.company
      FROM interventions i
      JOIN customers c ON i.customer_id = c.id
      ORDER BY i.due_date ASC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/interventions/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT i.*, c.name as customer_name, c.company
      FROM interventions i
      JOIN customers c ON i.customer_id = c.id
      WHERE i.id = $1
    `, [req.params.id]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/interventions', authenticateToken, async (req, res) => {
  try {
    const { customer_id, type, description, priority, status, suggested_by, effectiveness_score, due_date, ai_suggestions, ai_response_time_ms } = req.body;
    console.log('Creating intervention with AI suggestions:', {
      has_ai_suggestions: !!ai_suggestions,
      ai_suggestions_count: ai_suggestions?.length,
      ai_response_time_ms
    });
    const result = await pool.query(
      `INSERT INTO interventions (customer_id, type, description, priority, status, suggested_by, effectiveness_score, due_date, ai_suggestions, ai_response_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [customer_id, type, description, priority, status || 'pending', suggested_by || 'Manual', effectiveness_score, due_date, ai_suggestions ? JSON.stringify(ai_suggestions) : null, ai_response_time_ms]
    );
    console.log('Intervention created with id:', result.rows[0].id);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create intervention error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

app.put('/api/interventions/:id', authenticateToken, async (req, res) => {
  try {
    const { type, description, priority, status, effectiveness_score, due_date, ai_suggestions, ai_response_time_ms } = req.body;
    const result = await pool.query(
      `UPDATE interventions SET type = $1, description = $2, priority = $3, status = $4,
       effectiveness_score = $5, due_date = $6, completed_at = ${status === 'completed' ? 'CURRENT_TIMESTAMP' : 'NULL'},
       ai_suggestions = COALESCE($8, ai_suggestions), ai_response_time_ms = COALESCE($9, ai_response_time_ms)
       WHERE id = $7 RETURNING *`,
      [type, description, priority, status, effectiveness_score, due_date, req.params.id, ai_suggestions ? JSON.stringify(ai_suggestions) : null, ai_response_time_ms]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/interventions/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM interventions WHERE id = $1', [req.params.id]);
    res.json({ message: 'Intervention deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ BEHAVIOR ANALYTICS ROUTES ============
app.get('/api/behavior', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ba.*, c.name as customer_name, c.company
      FROM behavior_analytics ba
      JOIN customers c ON ba.customer_id = c.id
      ORDER BY ba.timestamp DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/behavior/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ba.*, c.name as customer_name, c.company
      FROM behavior_analytics ba
      JOIN customers c ON ba.customer_id = c.id
      WHERE ba.id = $1
    `, [req.params.id]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/behavior', authenticateToken, async (req, res) => {
  try {
    const { customer_id, event_type, event_data, session_id, page_visited, action_taken, ai_response, ai_response_time_ms } = req.body;
    const result = await pool.query(
      `INSERT INTO behavior_analytics (customer_id, event_type, event_data, session_id, page_visited, action_taken, ai_response, ai_response_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [customer_id, event_type, event_data, session_id, page_visited, action_taken, ai_response, ai_response_time_ms]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/behavior/:id', authenticateToken, async (req, res) => {
  try {
    const { event_type, event_data, page_visited, action_taken } = req.body;
    const result = await pool.query(
      `UPDATE behavior_analytics SET event_type = $1, event_data = $2,
       page_visited = $3, action_taken = $4 WHERE id = $5 RETURNING *`,
      [event_type, event_data, page_visited, action_taken, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/behavior/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM behavior_analytics WHERE id = $1', [req.params.id]);
    res.json({ message: 'Behavior record deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ USAGE METRICS ROUTES ============
app.get('/api/metrics', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT um.*, c.name as customer_name, c.company
      FROM usage_metrics um
      JOIN customers c ON um.customer_id = c.id
      ORDER BY um.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/metrics/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT um.*, c.name as customer_name, c.company
      FROM usage_metrics um
      JOIN customers c ON um.customer_id = c.id
      WHERE um.id = $1
    `, [req.params.id]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/metrics', authenticateToken, async (req, res) => {
  try {
    const { customer_id, metric_name, metric_value, period_start, period_end, trend, comparison_value, ai_response, ai_response_time_ms } = req.body;
    const result = await pool.query(
      `INSERT INTO usage_metrics (customer_id, metric_name, metric_value, period_start, period_end, trend, comparison_value, ai_response, ai_response_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [customer_id, metric_name, metric_value, period_start, period_end, trend, comparison_value, ai_response, ai_response_time_ms]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/metrics/:id', authenticateToken, async (req, res) => {
  try {
    const { metric_name, metric_value, period_start, period_end, trend, comparison_value } = req.body;
    const result = await pool.query(
      `UPDATE usage_metrics SET metric_name = $1, metric_value = $2, period_start = $3,
       period_end = $4, trend = $5, comparison_value = $6 WHERE id = $7 RETURNING *`,
      [metric_name, metric_value, period_start, period_end, trend, comparison_value, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/metrics/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM usage_metrics WHERE id = $1', [req.params.id]);
    res.json({ message: 'Metric deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ ENGAGEMENT SCORES ROUTES ============
app.get('/api/engagement', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT es.*, c.name as customer_name, c.company
      FROM engagement_scores es
      JOIN customers c ON es.customer_id = c.id
      ORDER BY es.overall_score DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/engagement/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT es.*, c.name as customer_name, c.company
      FROM engagement_scores es
      JOIN customers c ON es.customer_id = c.id
      WHERE es.id = $1
    `, [req.params.id]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/engagement', authenticateToken, async (req, res) => {
  try {
    const { customer_id, overall_score, login_frequency, feature_adoption, support_interaction, feedback_score, ai_response, ai_response_time_ms } = req.body;
    const result = await pool.query(
      `INSERT INTO engagement_scores (customer_id, overall_score, login_frequency, feature_adoption, support_interaction, feedback_score, ai_response, ai_response_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [customer_id, overall_score, login_frequency, feature_adoption, support_interaction, feedback_score, ai_response ? JSON.stringify(ai_response) : null, ai_response_time_ms]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/engagement/:id', authenticateToken, async (req, res) => {
  try {
    const { overall_score, login_frequency, feature_adoption, support_interaction, feedback_score } = req.body;
    const result = await pool.query(
      `UPDATE engagement_scores SET overall_score = $1, login_frequency = $2, feature_adoption = $3,
       support_interaction = $4, feedback_score = $5 WHERE id = $6 RETURNING *`,
      [overall_score, login_frequency, feature_adoption, support_interaction, feedback_score, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/engagement/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM engagement_scores WHERE id = $1', [req.params.id]);
    res.json({ message: 'Engagement score deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ SUPPORT TICKETS ROUTES ============
app.get('/api/tickets', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT st.*, c.name as customer_name, c.company
      FROM support_tickets st
      JOIN customers c ON st.customer_id = c.id
      ORDER BY st.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/tickets/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT st.*, c.name as customer_name, c.company
      FROM support_tickets st
      JOIN customers c ON st.customer_id = c.id
      WHERE st.id = $1
    `, [req.params.id]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/tickets', authenticateToken, async (req, res) => {
  try {
    const { customer_id, subject, description, priority, status, category, assigned_to, ai_response, ai_response_time_ms } = req.body;
    const result = await pool.query(
      `INSERT INTO support_tickets (customer_id, subject, description, priority, status, category, assigned_to, ai_response, ai_response_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [customer_id, subject, description, priority, status || 'open', category, assigned_to, ai_response ? JSON.stringify(ai_response) : null, ai_response_time_ms]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/tickets/:id', authenticateToken, async (req, res) => {
  try {
    const { subject, description, priority, status, category, assigned_to, resolution } = req.body;
    const result = await pool.query(
      `UPDATE support_tickets SET subject = $1, description = $2, priority = $3, status = $4,
       category = $5, assigned_to = $6, resolution = $7,
       resolved_at = ${status === 'resolved' ? 'CURRENT_TIMESTAMP' : 'NULL'}
       WHERE id = $8 RETURNING *`,
      [subject, description, priority, status, category, assigned_to, resolution, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/tickets/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM support_tickets WHERE id = $1', [req.params.id]);
    res.json({ message: 'Ticket deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ BILLING HISTORY ROUTES ============
app.get('/api/billing', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT bh.*, c.name as customer_name, c.company
      FROM billing_history bh
      JOIN customers c ON bh.customer_id = c.id
      ORDER BY bh.billing_date DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/billing/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT bh.*, c.name as customer_name, c.company
      FROM billing_history bh
      JOIN customers c ON bh.customer_id = c.id
      WHERE bh.id = $1
    `, [req.params.id]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/billing', authenticateToken, async (req, res) => {
  try {
    const { customer_id, invoice_number, amount, currency, status, payment_method, billing_date, due_date, ai_response, ai_response_time_ms } = req.body;
    const result = await pool.query(
      `INSERT INTO billing_history (customer_id, invoice_number, amount, currency, status, payment_method, billing_date, due_date, ai_response, ai_response_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [customer_id, invoice_number, amount, currency || 'USD', status, payment_method, billing_date, due_date, ai_response, ai_response_time_ms]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/billing/:id', authenticateToken, async (req, res) => {
  try {
    const { invoice_number, amount, status, payment_method, due_date } = req.body;
    const result = await pool.query(
      `UPDATE billing_history SET invoice_number = $1, amount = $2, status = $3,
       payment_method = $4, due_date = $5, paid_at = ${status === 'paid' ? 'CURRENT_TIMESTAMP' : 'NULL'}
       WHERE id = $6 RETURNING *`,
      [invoice_number, amount, status, payment_method, due_date, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/billing/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM billing_history WHERE id = $1', [req.params.id]);
    res.json({ message: 'Billing record deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ FEATURE USAGE ROUTES ============
app.get('/api/features', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT fu.*, c.name as customer_name, c.company
      FROM feature_usage fu
      JOIN customers c ON fu.customer_id = c.id
      ORDER BY fu.usage_count DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/features/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT fu.*, c.name as customer_name, c.company
      FROM feature_usage fu
      JOIN customers c ON fu.customer_id = c.id
      WHERE fu.id = $1
    `, [req.params.id]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/features', authenticateToken, async (req, res) => {
  try {
    const { customer_id, feature_name, usage_count, adoption_rate, time_spent_minutes, period, ai_response, ai_response_time_ms } = req.body;
    const result = await pool.query(
      `INSERT INTO feature_usage (customer_id, feature_name, usage_count, last_used, adoption_rate, time_spent_minutes, period, ai_response, ai_response_time_ms)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5, $6, $7, $8) RETURNING *`,
      [customer_id, feature_name, usage_count, adoption_rate, time_spent_minutes, period, ai_response, ai_response_time_ms]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/features/:id', authenticateToken, async (req, res) => {
  try {
    const { feature_name, usage_count, adoption_rate, time_spent_minutes, period } = req.body;
    const result = await pool.query(
      `UPDATE feature_usage SET feature_name = $1, usage_count = $2, adoption_rate = $3,
       time_spent_minutes = $4, period = $5 WHERE id = $6 RETURNING *`,
      [feature_name, usage_count, adoption_rate, time_spent_minutes, period, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/features/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM feature_usage WHERE id = $1', [req.params.id]);
    res.json({ message: 'Feature usage record deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ USER SESSIONS ROUTES ============
app.get('/api/sessions', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT us.*, c.name as customer_name, c.company
      FROM user_sessions us
      JOIN customers c ON us.customer_id = c.id
      ORDER BY us.session_start DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/sessions/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT us.*, c.name as customer_name, c.company
      FROM user_sessions us
      JOIN customers c ON us.customer_id = c.id
      WHERE us.id = $1
    `, [req.params.id]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/sessions', authenticateToken, async (req, res) => {
  try {
    const { customer_id, session_start, session_end, duration_minutes, pages_viewed, actions_taken, device_type, browser, ip_address, ai_response, ai_response_time_ms } = req.body;
    const result = await pool.query(
      `INSERT INTO user_sessions (customer_id, session_start, session_end, duration_minutes, pages_viewed, actions_taken, device_type, browser, ip_address, ai_response, ai_response_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [customer_id, session_start, session_end, duration_minutes, pages_viewed, actions_taken, device_type, browser, ip_address, ai_response, ai_response_time_ms]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/sessions/:id', authenticateToken, async (req, res) => {
  try {
    const { session_end, duration_minutes, pages_viewed, actions_taken, device_type, browser } = req.body;
    const result = await pool.query(
      `UPDATE user_sessions SET session_end = $1, duration_minutes = $2, pages_viewed = $3,
       actions_taken = $4, device_type = $5, browser = $6 WHERE id = $7 RETURNING *`,
      [session_end, duration_minutes, pages_viewed, actions_taken, device_type, browser, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/sessions/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM user_sessions WHERE id = $1', [req.params.id]);
    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ NPS SCORES ROUTES ============
app.get('/api/nps', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT nps.*, c.name as customer_name, c.company
      FROM nps_scores nps
      JOIN customers c ON nps.customer_id = c.id
      ORDER BY nps.survey_date DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/nps/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT nps.*, c.name as customer_name, c.company
      FROM nps_scores nps
      JOIN customers c ON nps.customer_id = c.id
      WHERE nps.id = $1
    `, [req.params.id]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/nps', authenticateToken, async (req, res) => {
  try {
    const { customer_id, score, feedback, category, survey_date, follow_up_required, ai_response, ai_response_time_ms } = req.body;
    const result = await pool.query(
      `INSERT INTO nps_scores (customer_id, score, feedback, category, survey_date, follow_up_required, ai_response, ai_response_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [customer_id, score, feedback, category, survey_date, follow_up_required, ai_response, ai_response_time_ms]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/nps/:id', authenticateToken, async (req, res) => {
  try {
    const { score, feedback, category, follow_up_required } = req.body;
    const result = await pool.query(
      `UPDATE nps_scores SET score = $1, feedback = $2, category = $3,
       follow_up_required = $4 WHERE id = $5 RETURNING *`,
      [score, feedback, category, follow_up_required, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/nps/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM nps_scores WHERE id = $1', [req.params.id]);
    res.json({ message: 'NPS score deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ HEALTH SCORES ROUTES ============
app.get('/api/health', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT hs.*, c.name as customer_name, c.company
      FROM health_scores hs
      JOIN customers c ON hs.customer_id = c.id
      ORDER BY hs.overall_health DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/health/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT hs.*, c.name as customer_name, c.company
      FROM health_scores hs
      JOIN customers c ON hs.customer_id = c.id
      WHERE hs.id = $1
    `, [req.params.id]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/health', authenticateToken, async (req, res) => {
  try {
    const { customer_id, overall_health, product_usage, customer_satisfaction, growth_potential, support_health, financial_health, trend, ai_response, ai_response_time_ms } = req.body;
    const result = await pool.query(
      `INSERT INTO health_scores (customer_id, overall_health, product_usage, customer_satisfaction, growth_potential, support_health, financial_health, trend, ai_response, ai_response_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [customer_id, overall_health, product_usage, customer_satisfaction, growth_potential, support_health, financial_health, trend, ai_response ? JSON.stringify(ai_response) : null, ai_response_time_ms]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/health/:id', authenticateToken, async (req, res) => {
  try {
    const { overall_health, product_usage, customer_satisfaction, growth_potential, support_health, financial_health, trend } = req.body;
    const result = await pool.query(
      `UPDATE health_scores SET overall_health = $1, product_usage = $2, customer_satisfaction = $3,
       growth_potential = $4, support_health = $5, financial_health = $6, trend = $7 WHERE id = $8 RETURNING *`,
      [overall_health, product_usage, customer_satisfaction, growth_potential, support_health, financial_health, trend, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/health/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM health_scores WHERE id = $1', [req.params.id]);
    res.json({ message: 'Health score deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ ALERTS ROUTES ============
app.get('/api/alerts', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, c.name as customer_name, c.company
      FROM alerts a
      JOIN customers c ON a.customer_id = c.id
      ORDER BY a.triggered_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/alerts/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, c.name as customer_name, c.company
      FROM alerts a
      JOIN customers c ON a.customer_id = c.id
      WHERE a.id = $1
    `, [req.params.id]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/alerts', authenticateToken, async (req, res) => {
  try {
    const { customer_id, alert_type, severity, message, ai_response, ai_response_time_ms } = req.body;
    const result = await pool.query(
      `INSERT INTO alerts (customer_id, alert_type, severity, message, ai_response, ai_response_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [customer_id, alert_type, severity, message, ai_response ? JSON.stringify(ai_response) : null, ai_response_time_ms]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/alerts/:id', authenticateToken, async (req, res) => {
  try {
    const { alert_type, severity, message, is_read, is_resolved } = req.body;
    const result = await pool.query(
      `UPDATE alerts SET alert_type = $1, severity = $2, message = $3, is_read = $4, is_resolved = $5,
       resolved_at = ${is_resolved ? 'CURRENT_TIMESTAMP' : 'NULL'}
       WHERE id = $6 RETURNING *`,
      [alert_type, severity, message, is_read, is_resolved, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/alerts/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM alerts WHERE id = $1', [req.params.id]);
    res.json({ message: 'Alert deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ BULK OPERATIONS FOR ALL ENTITIES ============

// Generic bulk delete handler
const createBulkDelete = (table) => async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'Array of ids required' });
    await pool.query(`DELETE FROM ${table} WHERE id = ANY($1::int[])`, [ids]);
    res.json({ message: `${ids.length} items deleted`, deleted: ids.length });
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

// Generic bulk update handler
const createBulkUpdate = (table, allowedFields) => async (req, res) => {
  try {
    const { ids, updates } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'Array of ids required' });
    if (!updates || Object.keys(updates).length === 0) return res.status(400).json({ error: 'Updates object required' });
    const setClauses = []; const params = []; let paramIdx = 1;
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) { setClauses.push(`${key} = $${paramIdx++}`); params.push(value); }
    }
    if (setClauses.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
    params.push(ids);
    await pool.query(`UPDATE ${table} SET ${setClauses.join(', ')} WHERE id = ANY($${paramIdx}::int[])`, params);
    res.json({ message: `${ids.length} items updated`, updated: ids.length });
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

// Predictions bulk
app.delete('/api/predictions/bulk', authenticateToken, createBulkDelete('churn_predictions'));
app.put('/api/predictions/bulk', authenticateToken, createBulkUpdate('churn_predictions', ['status', 'prediction_score']));

// Risk scores bulk
app.delete('/api/risk-scores/bulk', authenticateToken, createBulkDelete('risk_scores'));
app.put('/api/risk-scores/bulk', authenticateToken, createBulkUpdate('risk_scores', ['risk_level', 'category']));

// Segments bulk
app.delete('/api/segments/bulk', authenticateToken, createBulkDelete('customer_segments'));
app.put('/api/segments/bulk', authenticateToken, createBulkUpdate('customer_segments', ['name', 'churn_rate']));

// Interventions bulk
app.delete('/api/interventions/bulk', authenticateToken, createBulkDelete('interventions'));
app.put('/api/interventions/bulk', authenticateToken, createBulkUpdate('interventions', ['status', 'priority']));

// Behavior bulk
app.delete('/api/behavior/bulk', authenticateToken, createBulkDelete('behavior_analytics'));
app.put('/api/behavior/bulk', authenticateToken, createBulkUpdate('behavior_analytics', ['event_type']));

// Metrics bulk
app.delete('/api/metrics/bulk', authenticateToken, createBulkDelete('usage_metrics'));
app.put('/api/metrics/bulk', authenticateToken, createBulkUpdate('usage_metrics', ['trend', 'metric_name']));

// Engagement bulk
app.delete('/api/engagement/bulk', authenticateToken, createBulkDelete('engagement_scores'));
app.put('/api/engagement/bulk', authenticateToken, createBulkUpdate('engagement_scores', ['overall_score']));

// Tickets bulk
app.delete('/api/tickets/bulk', authenticateToken, createBulkDelete('support_tickets'));
app.put('/api/tickets/bulk', authenticateToken, createBulkUpdate('support_tickets', ['status', 'priority', 'category']));

// Billing bulk
app.delete('/api/billing/bulk', authenticateToken, createBulkDelete('billing_history'));
app.put('/api/billing/bulk', authenticateToken, createBulkUpdate('billing_history', ['status', 'payment_method']));

// Features bulk
app.delete('/api/features/bulk', authenticateToken, createBulkDelete('feature_usage'));
app.put('/api/features/bulk', authenticateToken, createBulkUpdate('feature_usage', ['period']));

// Sessions bulk
app.delete('/api/sessions/bulk', authenticateToken, createBulkDelete('user_sessions'));
app.put('/api/sessions/bulk', authenticateToken, createBulkUpdate('user_sessions', ['device_type']));

// NPS bulk
app.delete('/api/nps/bulk', authenticateToken, createBulkDelete('nps_scores'));
app.put('/api/nps/bulk', authenticateToken, createBulkUpdate('nps_scores', ['category', 'follow_up_required']));

// Health bulk
app.delete('/api/health/bulk', authenticateToken, createBulkDelete('health_scores'));
app.put('/api/health/bulk', authenticateToken, createBulkUpdate('health_scores', ['trend']));

// Alerts bulk
app.delete('/api/alerts/bulk', authenticateToken, createBulkDelete('alerts'));
app.put('/api/alerts/bulk', authenticateToken, createBulkUpdate('alerts', ['severity', 'is_read', 'is_resolved']));

// Sentiment bulk
app.delete('/api/sentiment/bulk', authenticateToken, createBulkDelete('sentiment_analysis'));
app.put('/api/sentiment/bulk', authenticateToken, createBulkUpdate('sentiment_analysis', ['sentiment_label', 'urgency_level']));

// Journeys bulk
app.delete('/api/journeys/bulk', authenticateToken, createBulkDelete('customer_journeys'));
app.put('/api/journeys/bulk', authenticateToken, createBulkUpdate('customer_journeys', ['journey_stage']));

// Winback bulk
app.delete('/api/winback/bulk', authenticateToken, createBulkDelete('winback_campaigns'));
app.put('/api/winback/bulk', authenticateToken, createBulkUpdate('winback_campaigns', ['status', 'campaign_type']));

// Health dashboard bulk
app.delete('/api/health-dashboard/bulk', authenticateToken, createBulkDelete('customer_health_dashboard'));
app.put('/api/health-dashboard/bulk', authenticateToken, createBulkUpdate('customer_health_dashboard', ['trend_direction']));

// Escalations bulk
app.delete('/api/escalations/bulk', authenticateToken, createBulkDelete('escalation_predictions'));
app.put('/api/escalations/bulk', authenticateToken, createBulkUpdate('escalation_predictions', ['status', 'priority_level']));

// Service levels bulk
app.delete('/api/service-levels/bulk', authenticateToken, createBulkDelete('service_level_predictions'));
app.put('/api/service-levels/bulk', authenticateToken, createBulkUpdate('service_level_predictions', ['service_tier']));

// Response suggestions bulk
app.delete('/api/response-suggestions/bulk', authenticateToken, createBulkDelete('response_suggestions'));
app.put('/api/response-suggestions/bulk', authenticateToken, createBulkUpdate('response_suggestions', ['response_tone']));

// ============ PDF EXPORT ============
app.get('/api/export/pdf/:entity', authenticateToken, async (req, res) => {
  try {
    const { entity } = req.params;
    const tableMap = {
      customers: { table: 'customers', title: 'Customers Report', columns: ['id', 'name', 'email', 'company', 'plan', 'monthly_revenue', 'status'] },
      predictions: { table: 'churn_predictions', title: 'Churn Predictions Report', columns: ['id', 'customer_id', 'prediction_score', 'confidence_level', 'status'] },
      'risk-scores': { table: 'risk_scores', title: 'Risk Scores Report', columns: ['id', 'customer_id', 'risk_level', 'score', 'category'] },
      segments: { table: 'customer_segments', title: 'Customer Segments Report', columns: ['id', 'name', 'customer_count', 'avg_revenue', 'churn_rate'] },
      interventions: { table: 'interventions', title: 'Interventions Report', columns: ['id', 'customer_id', 'type', 'priority', 'status'] },
      tickets: { table: 'support_tickets', title: 'Support Tickets Report', columns: ['id', 'customer_id', 'subject', 'priority', 'status', 'category'] },
      billing: { table: 'billing_history', title: 'Billing History Report', columns: ['id', 'customer_id', 'invoice_number', 'amount', 'status'] },
      alerts: { table: 'alerts', title: 'Alerts Report', columns: ['id', 'customer_id', 'alert_type', 'severity', 'message'] },
    };

    const config = tableMap[entity];
    if (!config) return res.status(400).json({ error: `Unknown entity: ${entity}` });

    const result = await pool.query(`SELECT ${config.columns.join(', ')} FROM ${config.table} ORDER BY id`);

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${entity}_report.pdf`);
    doc.pipe(res);

    doc.fontSize(20).text(config.title, { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()} | Total Records: ${result.rows.length}`, { align: 'center' });
    doc.moveDown(2);

    // Table header
    const colWidth = 480 / config.columns.length;
    let y = doc.y;
    doc.fontSize(8).font('Helvetica-Bold');
    config.columns.forEach((col, i) => {
      doc.text(col.toUpperCase(), 50 + i * colWidth, y, { width: colWidth, align: 'left' });
    });
    doc.moveDown();

    // Table rows
    doc.font('Helvetica').fontSize(7);
    result.rows.forEach((row) => {
      if (doc.y > 700) { doc.addPage(); }
      y = doc.y;
      config.columns.forEach((col, i) => {
        const val = row[col] !== null && row[col] !== undefined ? String(row[col]).substring(0, 30) : '';
        doc.text(val, 50 + i * colWidth, y, { width: colWidth, align: 'left' });
      });
      doc.moveDown(0.5);
    });

    doc.end();
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ error: 'PDF export failed' });
  }
});

// ============ AI HELPER: GRACEFUL DEGRADATION WRAPPER ============
/**
 * Calls the OpenRouter API with automatic graceful degradation.
 * On any network/API error returns { fallback: true, ...fallbackData }.
 * @param {string[]} messages  - Array of {role, content} message objects
 * @param {object}  fallbackData - Structured fallback to return when AI is unavailable
 * @returns {{ data: object|null, elapsed: number, fallback: boolean, rawContent: string|null }}
 */
const callOpenRouterAI = async (messages, fallbackData = {}) => {
  const startTime = Date.now();
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Churn Prediction System'
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL,
        messages
      })
    });

    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      console.error(`OpenRouter HTTP error: ${response.status} ${response.statusText}`);
      return { data: null, elapsed, fallback: true, rawContent: null, fallbackData };
    }

    const aiResult = await response.json();

    if (aiResult.error) {
      console.error('OpenRouter API error:', aiResult.error);
      return { data: null, elapsed, fallback: true, rawContent: null, fallbackData };
    }

    const rawContent = aiResult.choices?.[0]?.message?.content || null;
    if (!rawContent) {
      console.error('OpenRouter returned empty content');
      return { data: null, elapsed, fallback: true, rawContent: null, fallbackData };
    }

    // Strip markdown code fences if present
    let cleaned = rawContent.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.trim();

    try {
      const parsed = JSON.parse(cleaned);
      return { data: parsed, elapsed, fallback: false, rawContent };
    } catch (parseErr) {
      console.error('OpenRouter JSON parse error:', parseErr.message, '| raw:', rawContent.substring(0, 200));
      return { data: null, elapsed, fallback: true, rawContent, fallbackData };
    }
  } catch (networkErr) {
    const elapsed = Date.now() - startTime;
    console.error('OpenRouter network error:', networkErr.message);
    return { data: null, elapsed, fallback: true, rawContent: null, fallbackData };
  }
};

// ============ AI ROUTES (OpenRouter) ============
// Apply AI-specific rate limiter to all /api/ai/* routes
app.use('/api/ai/', aiLimiter);

app.post('/api/ai/analyze-churn', authenticateToken, async (req, res) => {
  try {
    const { customer_id } = req.body;

    console.log('AI Analysis requested for customer:', customer_id);
    console.log('Using OpenRouter API Key:', process.env.OPENROUTER_API_KEY ? 'Key exists (length: ' + process.env.OPENROUTER_API_KEY.length + ')' : 'NO KEY FOUND');
    console.log('Using Model:', process.env.OPENROUTER_MODEL);

    // Get customer data
    const customerResult = await pool.query('SELECT * FROM customers WHERE id = $1', [customer_id]);
    const customer = customerResult.rows[0];

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Get related data
    const [engagement, health, metrics, tickets] = await Promise.all([
      pool.query('SELECT * FROM engagement_scores WHERE customer_id = $1 ORDER BY calculated_at DESC LIMIT 1', [customer_id]),
      pool.query('SELECT * FROM health_scores WHERE customer_id = $1 ORDER BY calculated_at DESC LIMIT 1', [customer_id]),
      pool.query('SELECT * FROM usage_metrics WHERE customer_id = $1', [customer_id]),
      pool.query('SELECT COUNT(*) as open_tickets FROM support_tickets WHERE customer_id = $1 AND status = $2', [customer_id, 'open'])
    ]);

    const prompt = `Analyze churn risk for customer:
Customer: ${customer.name} (${customer.company})
Plan: ${customer.plan}
Monthly Revenue: $${customer.monthly_revenue}
Status: ${customer.status}
Last Activity: ${customer.last_activity}

Engagement Score: ${engagement.rows[0]?.overall_score || 'N/A'}
Health Score: ${health.rows[0]?.overall_health || 'N/A'}
Open Support Tickets: ${tickets.rows[0]?.open_tickets || 0}

Provide:
1. Churn risk percentage (0-100)
2. Key risk factors (list 3-5)
3. Recommended interventions (list 2-3)
4. Confidence level (0-100)

Format as JSON with keys: risk_score, factors, interventions, confidence`;

    console.log('Calling OpenRouter API...');

    const { data: parsedAnalysis, elapsed, fallback, rawContent } = await callOpenRouterAI(
      [
        { role: 'system', content: 'You are an AI analyst specializing in customer churn prediction. Respond only with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      {
        risk_score: 50,
        factors: ['AI temporarily unavailable — manual review recommended'],
        interventions: ['Contact customer directly for assessment'],
        confidence: 0
      }
    );

    console.log(`OpenRouter response received in ${elapsed}ms, fallback=${fallback}`);

    if (fallback || !parsedAnalysis) {
      return res.json({
        customer_id,
        customer_name: customer.name,
        risk_score: 50,
        factors: ['AI temporarily unavailable — manual review recommended'],
        interventions: ['Contact customer directly for assessment'],
        confidence: 0,
        ai_unavailable: true,
        response_time_ms: elapsed
      });
    }

    res.json({
      customer_id,
      customer_name: customer.name,
      ...parsedAnalysis,
      raw_analysis: rawContent,
      model_used: process.env.OPENROUTER_MODEL,
      response_time_ms: elapsed
    });
  } catch (error) {
    console.error('AI analysis error:', error);
    res.status(500).json({ error: 'AI analysis failed', details: error.message });
  }
});

app.post('/api/ai/suggest-intervention', authenticateToken, async (req, res) => {
  try {
    const { customer_id, context } = req.body;
    console.log('AI Intervention suggestion requested for customer:', customer_id);

    const customerResult = await pool.query('SELECT * FROM customers WHERE id = $1', [customer_id]);
    const customer = customerResult.rows[0];

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const prompt = `Suggest interventions for at-risk customer:
Customer: ${customer.name} (${customer.company})
Plan: ${customer.plan}
Revenue: $${customer.monthly_revenue}/month
Status: ${customer.status}
Context: ${context || 'General churn risk'}

Provide 3 specific, actionable interventions with:
1. Type (e.g., Outreach Call, Training, Discount)
2. Description (detailed action)
3. Priority (High/Medium/Low)
4. Expected effectiveness (0-100)

Format as JSON array with keys: type, description, priority, effectiveness`;

    console.log('Calling OpenRouter for intervention suggestions...');

    const fallbackSuggestions = [
      { type: 'Outreach Call', description: 'Schedule a check-in call to understand current challenges', priority: 'High', effectiveness: 70 }
    ];

    const { data: parsedSuggestions, elapsed, fallback } = await callOpenRouterAI(
      [
        { role: 'system', content: 'You are a customer success expert. Respond only with valid JSON array.' },
        { role: 'user', content: prompt }
      ],
      fallbackSuggestions
    );

    console.log(`OpenRouter response in ${elapsed}ms, fallback=${fallback}`);

    res.json({
      customer_id,
      customer_name: customer.name,
      suggestions: (fallback || !parsedSuggestions) ? fallbackSuggestions : parsedSuggestions,
      ai_unavailable: fallback || !parsedSuggestions,
      response_time_ms: elapsed
    });
  } catch (error) {
    console.error('AI suggestion error:', error);
    res.status(500).json({ error: 'AI suggestion failed', details: error.message });
  }
});

app.post('/api/ai/segment-analysis', authenticateToken, async (req, res) => {
  try {
    const { segment_id } = req.body;

    const segmentResult = await pool.query('SELECT * FROM customer_segments WHERE id = $1', [segment_id]);
    const segment = segmentResult.rows[0];

    const prompt = `Analyze customer segment:
Segment: ${segment.name}
Description: ${segment.description}
Customer Count: ${segment.customer_count}
Average Revenue: $${segment.avg_revenue}
Churn Rate: ${segment.churn_rate}%

Provide:
1. Segment health assessment
2. Key characteristics
3. Recommended strategies
4. Risk factors
5. Growth opportunities

Format as JSON with keys: health_assessment, characteristics, strategies, risks, opportunities`;

    const { data: parsedAnalysis, elapsed: segElapsed, fallback: segFallback } = await callOpenRouterAI(
      [
        { role: 'system', content: 'You are a market analyst specializing in customer segmentation. Respond only with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      { health_assessment: 'AI temporarily unavailable', characteristics: [], strategies: [], risks: [], opportunities: [] }
    );

    const analysis = parsedAnalysis || { health_assessment: 'AI temporarily unavailable', characteristics: [], strategies: [], risks: [], opportunities: [] };

    res.json({
      segment_id,
      segment_name: segment.name,
      ...analysis,
      ai_unavailable: segFallback || !parsedAnalysis,
      response_time_ms: segElapsed
    });
  } catch (error) {
    console.error('AI segment analysis error:', error);
    res.status(500).json({ error: 'AI segment analysis failed', details: error.message });
  }
});

app.post('/api/ai/predict-revenue-impact', authenticateToken, async (req, res) => {
  try {
    const customersResult = await pool.query(`
      SELECT c.*, cp.prediction_score
      FROM customers c
      LEFT JOIN churn_predictions cp ON c.id = cp.customer_id
      WHERE c.status != 'churned'
    `);

    const customers = customersResult.rows;
    const totalRevenue = customers.reduce((sum, c) => sum + parseFloat(c.monthly_revenue || 0), 0);
    const atRiskRevenue = customers
      .filter(c => parseFloat(c.prediction_score || 0) > 50)
      .reduce((sum, c) => sum + parseFloat(c.monthly_revenue || 0), 0);

    const prompt = `Analyze revenue impact from churn:
Total Monthly Revenue: $${totalRevenue}
At-Risk Revenue: $${atRiskRevenue}
At-Risk Customers: ${customers.filter(c => parseFloat(c.prediction_score || 0) > 50).length}
Total Active Customers: ${customers.length}

Provide:
1. Projected revenue loss (3, 6, 12 months)
2. Impact severity assessment
3. Priority actions to prevent loss
4. Confidence level

Format as JSON with keys: projected_loss_3mo, projected_loss_6mo, projected_loss_12mo, severity, priority_actions, confidence`;

    const revenueFallback = {
      projected_loss_3mo: atRiskRevenue * 0.3,
      projected_loss_6mo: atRiskRevenue * 0.5,
      projected_loss_12mo: atRiskRevenue * 0.7,
      severity: 'AI unavailable — estimated from data',
      priority_actions: ['Manual review required'],
      confidence: 0
    };

    const { data: parsedAnalysis, elapsed: revElapsed, fallback: revFallback } = await callOpenRouterAI(
      [
        { role: 'system', content: 'You are a financial analyst specializing in SaaS revenue forecasting. Respond only with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      revenueFallback
    );

    res.json({
      total_revenue: totalRevenue,
      at_risk_revenue: atRiskRevenue,
      at_risk_customers: customers.filter(c => parseFloat(c.prediction_score || 0) > 50).length,
      ...(parsedAnalysis || revenueFallback),
      ai_unavailable: revFallback || !parsedAnalysis,
      response_time_ms: revElapsed
    });
  } catch (error) {
    console.error('AI revenue prediction error:', error);
    res.status(500).json({ error: 'AI revenue prediction failed', details: error.message });
  }
});

app.post('/api/ai/generate-report', authenticateToken, async (req, res) => {
  try {
    const { report_type } = req.body;

    // Gather data based on report type
    const [customers, predictions, interventions, alerts] = await Promise.all([
      pool.query('SELECT COUNT(*) as total, status FROM customers GROUP BY status'),
      pool.query('SELECT AVG(prediction_score) as avg_score FROM churn_predictions'),
      pool.query('SELECT COUNT(*) as total, status FROM interventions GROUP BY status'),
      pool.query('SELECT COUNT(*) as total, severity FROM alerts WHERE is_resolved = false GROUP BY severity')
    ]);

    const prompt = `Generate a ${report_type || 'executive summary'} report:

Customer Distribution: ${JSON.stringify(customers.rows)}
Average Churn Score: ${predictions.rows[0]?.avg_score || 'N/A'}
Interventions Status: ${JSON.stringify(interventions.rows)}
Active Alerts: ${JSON.stringify(alerts.rows)}

Create a comprehensive report with:
1. Executive Summary
2. Key Metrics
3. Risk Assessment
4. Recommendations
5. Action Items

Format as JSON with keys: summary, metrics, risk_assessment, recommendations, action_items`;

    const reportFallback = { summary: 'AI temporarily unavailable — report generation skipped', metrics: {}, risk_assessment: '', recommendations: [], action_items: [] };

    const { data: parsedReport, elapsed: rptElapsed, fallback: rptFallback } = await callOpenRouterAI(
      [
        { role: 'system', content: 'You are a business intelligence analyst. Generate professional reports. Respond only with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      reportFallback
    );

    res.json({
      report_type,
      generated_at: new Date().toISOString(),
      ...(parsedReport || reportFallback),
      ai_unavailable: rptFallback || !parsedReport,
      response_time_ms: rptElapsed
    });
  } catch (error) {
    console.error('AI report generation error:', error);
    res.status(500).json({ error: 'AI report generation failed', details: error.message });
  }
});

// ============ DASHBOARD STATS ============
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const [
      customerStats,
      revenueStats,
      churnStats,
      alertStats,
      interventionStats
    ] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'active') as active,
          COUNT(*) FILTER (WHERE status = 'at-risk') as at_risk,
          COUNT(*) FILTER (WHERE status = 'churned') as churned
        FROM customers
      `),
      pool.query(`
        SELECT
          SUM(monthly_revenue) as total_mrr,
          AVG(monthly_revenue) as avg_revenue
        FROM customers WHERE status = 'active'
      `),
      pool.query(`
        SELECT
          AVG(prediction_score) as avg_churn_score,
          COUNT(*) FILTER (WHERE prediction_score > 70) as high_risk_count
        FROM churn_predictions
      `),
      pool.query(`
        SELECT
          COUNT(*) as total_alerts,
          COUNT(*) FILTER (WHERE is_resolved = false) as unresolved
        FROM alerts
      `),
      pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'completed') as completed
        FROM interventions
      `)
    ]);

    res.json({
      customers: customerStats.rows[0],
      revenue: revenueStats.rows[0],
      churn: churnStats.rows[0],
      alerts: alertStats.rows[0],
      interventions: interventionStats.rows[0]
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ AI ANALYZE RISK SCORE ============
app.post('/api/ai/analyze-risk', authenticateToken, async (req, res) => {
  try {
    const { customer_id } = req.body;
    const customerResult = await pool.query('SELECT * FROM customers WHERE id = $1', [customer_id]);
    const customer = customerResult.rows[0];
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const prompt = `Analyze risk for customer:
Customer: ${customer.name} (${customer.company})
Plan: ${customer.plan}, Revenue: $${customer.monthly_revenue}/month, Status: ${customer.status}

Provide risk assessment as JSON with:
- risk_level: "Low", "Medium", "High", or "Critical"
- score: number 0-100
- category: main risk category (e.g., "Engagement", "Financial", "Support", "Usage")
- contributing_factors: array of 3-5 specific factors
- recommended_actions: array of 3-5 specific actions`;

    const { data: parsed, elapsed, fallback } = await callOpenRouterAI(
      [
        { role: 'system', content: 'You are a risk assessment expert. Respond only with valid JSON object.' },
        { role: 'user', content: prompt }
      ],
      { risk_level: 'Unknown', score: 50, category: 'Unavailable', contributing_factors: ['AI temporarily unavailable'], recommended_actions: ['Manual risk review required'] }
    );

    if (fallback || !parsed) {
      return res.json({ risk_level: 'Unknown', score: 50, category: 'Unavailable', contributing_factors: ['AI temporarily unavailable'], recommended_actions: ['Manual risk review required'], customer_name: customer.name, ai_unavailable: true, response_time_ms: elapsed });
    }

    res.json({ ...parsed, customer_name: customer.name, response_time_ms: elapsed });
  } catch (error) {
    console.error('AI risk analysis error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ AI ANALYZE HEALTH SCORE ============
app.post('/api/ai/analyze-health', authenticateToken, async (req, res) => {
  try {
    const { customer_id } = req.body;
    const customerResult = await pool.query('SELECT * FROM customers WHERE id = $1', [customer_id]);
    const customer = customerResult.rows[0];
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const prompt = `Perform comprehensive health analysis for customer:
Customer: ${customer.name} (${customer.company})
Plan: ${customer.plan}
Revenue: $${customer.monthly_revenue}/month
Status: ${customer.status}

Analyze their overall health and provide detailed scores as JSON (0-100 scale):
- overall_health: weighted average health score considering all factors
- product_usage: how actively and effectively they use the product (based on plan tier)
- customer_satisfaction: estimated satisfaction based on their engagement level
- growth_potential: likelihood of account expansion or upsell (higher for active Professional/Enterprise)
- support_health: quality of support relationship (fewer tickets = better health)
- financial_health: payment reliability and billing health
- trend: overall trend direction ("up", "down", or "stable") with brief reasoning

Enterprise customers typically show higher scores. Consider revenue level when scoring.`;

    const { data: parsed, elapsed, fallback } = await callOpenRouterAI(
      [
        { role: 'system', content: 'You are a customer health analyst. Respond only with valid JSON object.' },
        { role: 'user', content: prompt }
      ],
      {}
    );

    const result = {
      overall_health: parsed?.overall_health || parsed?.overallHealth || parsed?.health_score || 75,
      product_usage: parsed?.product_usage || parsed?.productUsage || 70,
      customer_satisfaction: parsed?.customer_satisfaction || parsed?.customerSatisfaction || 72,
      growth_potential: parsed?.growth_potential || parsed?.growthPotential || 65,
      support_health: parsed?.support_health || parsed?.supportHealth || 80,
      financial_health: parsed?.financial_health || parsed?.financialHealth || 85,
      trend: parsed?.trend || 'stable',
      ai_unavailable: fallback || !parsed,
      customer_name: customer.name,
      response_time_ms: elapsed
    };
    res.json(result);
  } catch (error) {
    console.error('AI health analysis error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ AI ANALYZE ENGAGEMENT ============
app.post('/api/ai/analyze-engagement', authenticateToken, async (req, res) => {
  try {
    const { customer_id } = req.body;
    const customerResult = await pool.query('SELECT * FROM customers WHERE id = $1', [customer_id]);
    const customer = customerResult.rows[0];
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const prompt = `Perform detailed engagement analysis for customer:
Customer: ${customer.name} (${customer.company})
Plan: ${customer.plan}
Revenue: $${customer.monthly_revenue}/month
Status: ${customer.status}

Analyze their engagement patterns and provide detailed scores as JSON (0-100 scale):
- overall_score: weighted engagement score based on all metrics
- login_frequency: how often they log in (daily users = 90+, weekly = 60-80, monthly = 30-50)
- feature_adoption: percentage of available features they actively use
- support_interaction: engagement with support (healthy = moderate interaction, not too high or low)
- feedback_score: likelihood to provide feedback and participate in surveys

Higher tier plans should show higher engagement. Consider their revenue when scoring - high-paying customers are typically more engaged.`;

    const { data: parsed, elapsed, fallback } = await callOpenRouterAI(
      [
        { role: 'system', content: 'You are an engagement analyst. Respond only with valid JSON object.' },
        { role: 'user', content: prompt }
      ],
      {}
    );

    const result = {
      overall_score: parsed?.overall_score || parsed?.overallScore || parsed?.score || 75,
      login_frequency: parsed?.login_frequency || parsed?.loginFrequency || 60,
      feature_adoption: parsed?.feature_adoption || parsed?.featureAdoption || 50,
      support_interaction: parsed?.support_interaction || parsed?.supportInteraction || 40,
      feedback_score: parsed?.feedback_score || parsed?.feedbackScore || 55,
      ai_unavailable: fallback || !parsed,
      customer_name: customer.name,
      response_time_ms: elapsed
    };
    res.json(result);
  } catch (error) {
    console.error('AI engagement analysis error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ AI SUGGEST TICKET ============
app.post('/api/ai/suggest-ticket', authenticateToken, async (req, res) => {
  try {
    console.log('AI Ticket Analysis request:', req.body);
    const { customer_id, subject, description } = req.body;
    const customerResult = await pool.query('SELECT * FROM customers WHERE id = $1', [customer_id]);
    const customer = customerResult.rows[0];
    if (!customer) {
      console.log('Customer not found:', customer_id);
      return res.status(404).json({ error: 'Customer not found' });
    }

    const prompt = `Generate support ticket suggestion for:
Customer: ${customer.name} (${customer.company}), Plan: ${customer.plan}, Status: ${customer.status}
${subject ? `Current Subject: ${subject}` : ''}
${description ? `Current Description: ${description}` : ''}

Provide ticket details as JSON:
- subject: suggested ticket subject (brief, descriptive title for the support issue)
- description: detailed description of the issue or request (2-3 sentences)
- priority: "Low", "Medium", or "High"
- category: ticket category (e.g., "Technical", "Billing", "Feature Request", "Bug Report")
- suggested_resolution: brief suggested resolution
- estimated_impact: "Low", "Medium", or "High" churn impact
- assigned_to: suggested team (e.g., "Technical Support", "Billing Team", "Product Team")`;

    console.log('Calling OpenRouter for ticket analysis...');

    const ticketFallback = { subject: subject || 'Support Request', description: description || 'Customer support request', priority: 'Medium', category: 'General', suggested_resolution: 'Manual review required', estimated_impact: 'Medium', assigned_to: 'Support Team' };

    const { data: parsed, elapsed, fallback: ticketFallback2 } = await callOpenRouterAI(
      [
        { role: 'system', content: 'You are a support ticket analyst. Respond only with valid JSON object.' },
        { role: 'user', content: prompt }
      ],
      ticketFallback
    );

    console.log('AI Ticket Response received:', elapsed, 'ms');

    res.json({ ...(parsed || ticketFallback), ai_unavailable: ticketFallback2 || !parsed, customer_name: customer.name, response_time_ms: elapsed });
  } catch (error) {
    console.error('AI ticket analysis error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// ============ AI SUGGEST ALERT ============
app.post('/api/ai/suggest-alert', authenticateToken, async (req, res) => {
  try {
    const { customer_id } = req.body;
    const customerResult = await pool.query('SELECT * FROM customers WHERE id = $1', [customer_id]);
    const customer = customerResult.rows[0];
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const prompt = `Generate proactive alert for:
Customer: ${customer.name} (${customer.company})
Plan: ${customer.plan}, Revenue: $${customer.monthly_revenue}/month, Status: ${customer.status}

Provide alert as JSON:
- alert_type: type of alert (e.g., "Churn Risk", "Engagement Drop", "Payment Issue", "Usage Decline")
- severity: "low", "medium", "high", or "critical"
- message: detailed alert message (2-3 sentences)
- recommended_action: what to do about it`;

    const alertFallback = { alert_type: 'General Risk', severity: 'medium', message: 'AI alert generation temporarily unavailable. Manual review recommended.', recommended_action: 'Review customer account manually' };

    const { data: parsed, elapsed, fallback: alertFb } = await callOpenRouterAI(
      [
        { role: 'system', content: 'You are a customer alert system. Respond only with valid JSON object.' },
        { role: 'user', content: prompt }
      ],
      alertFallback
    );

    res.json({ ...(parsed || alertFallback), ai_unavailable: alertFb || !parsed, customer_name: customer.name, response_time_ms: elapsed });
  } catch (error) {
    console.error('AI alert suggestion error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ AI ANALYZE CUSTOMER ============
app.post('/api/ai/analyze-customer', authenticateToken, async (req, res) => {
  try {
    const { name, company, email } = req.body;
    const prompt = `Analyze this new customer and provide detailed recommendations:
Customer Name: ${name || 'New Customer'}
Company: ${company || 'Unknown'}
Email: ${email || 'Unknown'}

Based on the company name and email domain, provide comprehensive recommendations as JSON with:
- name: customer contact name (use provided or suggest a realistic one)
- email: professional email (use provided or suggest based on company)
- company: full company name
- plan: recommended plan with reasoning ("Starter" for small teams, "Professional" for growing companies, "Enterprise" for large organizations)
- monthly_revenue: realistic monthly revenue based on company size and plan (Starter: $50-200, Professional: $200-1000, Enterprise: $1000-10000)
- signup_date: today's date
- status: "active"
- risk_assessment: 2-3 sentence assessment of initial churn risk based on company profile

Be specific and realistic based on the company name and domain.`;

    const { data: parsed, elapsed, fallback: custFb } = await callOpenRouterAI(
      [{ role: 'system', content: 'You are a customer success expert. Respond only with valid JSON.' }, { role: 'user', content: prompt }],
      {}
    );

    const signupDate = new Date().toISOString().split('T')[0];
    const result = {
      name: parsed?.name || name || 'New Customer',
      email: parsed?.email || email || '',
      company: parsed?.company || company || '',
      plan: parsed?.plan || 'Professional',
      monthly_revenue: parsed?.monthly_revenue || parsed?.monthlyRevenue || 500,
      signup_date: parsed?.signup_date || parsed?.signupDate || signupDate,
      status: parsed?.status || 'active',
      risk_assessment: parsed?.risk_assessment || parsed?.riskAssessment || (custFb ? 'AI temporarily unavailable — manual assessment required' : ''),
      ai_unavailable: custFb || !parsed,
      response_time_ms: elapsed
    };
    res.json(result);
  } catch (error) { console.error('AI customer analysis error:', error); res.status(500).json({ error: 'Server error' }); }
});

// ============ AI ANALYZE NPS ============
app.post('/api/ai/analyze-nps', authenticateToken, async (req, res) => {
  try {
    const { customer_id, feedback } = req.body;
    const customerResult = await pool.query('SELECT * FROM customers WHERE id = $1', [customer_id]);
    const customer = customerResult.rows[0];
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const prompt = `Analyze NPS feedback and generate detailed survey response for customer:
Customer: ${customer.name} (${customer.company})
Plan: ${customer.plan}
Revenue: $${customer.monthly_revenue}/month
Feedback provided: ${feedback || 'No specific feedback provided'}

Generate a comprehensive NPS analysis as JSON with:
- score: NPS score 0-10 based on customer profile and feedback sentiment
- category: "Promoter" (9-10), "Passive" (7-8), or "Detractor" (0-6)
- feedback: detailed customer feedback text (2-3 sentences of realistic feedback based on their profile)
- survey_date: date of the survey
- follow_up_required: true/false based on score and feedback
- sentiment_analysis: detailed analysis of the feedback (2-3 sentences)

Consider their plan level and revenue when determining satisfaction.`;

    const { data: parsed, elapsed, fallback: npsFb } = await callOpenRouterAI(
      [{ role: 'system', content: 'You are an NPS analyst. Respond only with valid JSON.' }, { role: 'user', content: prompt }],
      {}
    );

    const surveyDate = new Date().toISOString().split('T')[0];

    const result = {
      score: parsed?.score || parsed?.nps_score || parsed?.npsScore || 7,
      category: parsed?.category || 'Passive',
      feedback: parsed?.feedback || parsed?.suggested_feedback || feedback || 'Customer feedback collected via survey',
      survey_date: parsed?.survey_date || parsed?.surveyDate || surveyDate,
      follow_up_required: parsed?.follow_up_required || parsed?.followUpRequired || false,
      ai_unavailable: npsFb || !parsed,
      customer_name: customer.name,
      response_time_ms: elapsed
    };
    res.json(result);
  } catch (error) { console.error('AI NPS analysis error:', error); res.status(500).json({ error: 'Server error' }); }
});

// ============ AI ANALYZE BEHAVIOR ============
app.post('/api/ai/analyze-behavior', authenticateToken, async (req, res) => {
  try {
    console.log('AI Behavior request:', req.body);
    const { customer_id } = req.body;
    const customerResult = await pool.query('SELECT * FROM customers WHERE id = $1', [customer_id]);
    const customer = customerResult.rows[0];
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const prompt = `Analyze and suggest detailed behavior tracking for customer:
Customer: ${customer.name} (${customer.company})
Plan: ${customer.plan}
Status: ${customer.status}

Based on this customer's profile, provide a realistic behavior event as JSON with:
- event_type: specific event type (e.g., "page_view", "feature_use", "login", "export", "api_call", "report_generation")
- page_visited: the exact page path they would visit (e.g., "/dashboard", "/settings/billing", "/reports/churn-analysis", "/customers/list")
- action_taken: detailed description of what the user did (2-3 sentences explaining the specific action and context)
- session_id: a realistic session identifier

Be specific and creative based on the customer's plan level and company type.`;

    console.log('Calling AI for behavior...');

    const { data: parsed, elapsed, fallback: behavFb } = await callOpenRouterAI(
      [{ role: 'system', content: 'You are a behavior analyst. Respond only with valid JSON object.' }, { role: 'user', content: prompt }],
      {}
    );

    const sessionId = `SES-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const result = {
      event_type: parsed?.event_type || parsed?.eventType || parsed?.type || 'page_view',
      page_visited: parsed?.page_visited || parsed?.pageVisited || parsed?.page || '/dashboard',
      action_taken: parsed?.action_taken || parsed?.actionTaken || parsed?.action || 'viewed page',
      session_id: parsed?.session_id || parsed?.sessionId || sessionId,
      ai_unavailable: behavFb || !parsed,
      customer_name: customer.name,
      response_time_ms: elapsed
    };
    console.log('AI Behavior final result:', result);
    res.json(result);
  } catch (error) { console.error('AI behavior analysis error:', error); res.status(500).json({ error: 'Server error' }); }
});

// ============ AI ANALYZE METRICS ============
app.post('/api/ai/analyze-metrics', authenticateToken, async (req, res) => {
  try {
    const { customer_id } = req.body;
    const customerResult = await pool.query('SELECT * FROM customers WHERE id = $1', [customer_id]);
    const customer = customerResult.rows[0];
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const prompt = `Analyze and suggest detailed usage metrics for customer:
Customer: ${customer.name} (${customer.company})
Plan: ${customer.plan}
Revenue: $${customer.monthly_revenue}/month
Status: ${customer.status}

Based on this customer's profile and plan level, provide a realistic usage metric as JSON with:
- metric_name: specific metric name (e.g., "Daily Active Users", "API Calls per Day", "Reports Generated", "Storage Used GB", "Feature Adoption Rate")
- metric_value: realistic numeric value based on their plan level
- trend: "up", "down", or "stable" with reasoning
- comparison_value: industry benchmark or previous period value for comparison
- period_start: start date of measurement period
- period_end: end date of measurement period

Be specific and provide realistic values based on the customer's revenue and plan tier.`;

    const { data: parsed, elapsed, fallback: metFb } = await callOpenRouterAI(
      [{ role: 'system', content: 'You are a metrics analyst. Respond only with valid JSON.' }, { role: 'user', content: prompt }],
      {}
    );

    const periodEnd = new Date().toISOString().split('T')[0];
    const periodStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const result = {
      metric_name: parsed?.metric_name || parsed?.metricName || parsed?.name || 'Monthly Active Users',
      metric_value: parsed?.metric_value || parsed?.metricValue || parsed?.value || 100,
      period_start: parsed?.period_start || parsed?.periodStart || periodStart,
      period_end: parsed?.period_end || parsed?.periodEnd || periodEnd,
      trend: parsed?.trend || 'stable',
      comparison_value: parsed?.comparison_value || parsed?.comparisonValue || parsed?.benchmark || 80,
      ai_unavailable: metFb || !parsed,
      customer_name: customer.name,
      response_time_ms: elapsed
    };
    res.json(result);
  } catch (error) { console.error('AI metrics analysis error:', error); res.status(500).json({ error: 'Server error' }); }
});

// ============ AI ANALYZE BILLING ============
app.post('/api/ai/analyze-billing', authenticateToken, async (req, res) => {
  try {
    const { customer_id } = req.body;
    const customerResult = await pool.query('SELECT * FROM customers WHERE id = $1', [customer_id]);
    const customer = customerResult.rows[0];
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const prompt = `Generate a detailed billing entry for customer:
Customer: ${customer.name} (${customer.company})
Plan: ${customer.plan}
Monthly Revenue: $${customer.monthly_revenue}
Status: ${customer.status}

Create a realistic billing record as JSON with:
- invoice_number: professional invoice number (e.g., "INV-2024-00123" or "INV-${customer.company.substring(0,3).toUpperCase()}-001")
- amount: realistic amount based on their plan (Starter: $50-200, Professional: $200-1000, Enterprise: $1000-5000)
- currency: "USD"
- status: billing status ("pending", "paid", or "overdue")
- payment_method: realistic payment method ("Credit Card", "ACH Transfer", "Wire Transfer", "PayPal")
- billing_date: current billing date
- due_date: due date (typically 30 days from billing)

Base the amount on their monthly revenue and plan level.`;

    const { data: parsed, elapsed, fallback: billFb } = await callOpenRouterAI(
      [{ role: 'system', content: 'You are a billing analyst. Respond only with valid JSON.' }, { role: 'user', content: prompt }],
      {}
    );

    const today = new Date();
    const billingDate = today.toISOString().split('T')[0];
    const dueDate = new Date(today.setDate(today.getDate() + 30)).toISOString().split('T')[0];

    const result = {
      invoice_number: parsed?.invoice_number || parsed?.invoiceNumber || `INV-${Date.now()}`,
      amount: parsed?.amount || customer.monthly_revenue || 100,
      currency: parsed?.currency || 'USD',
      status: parsed?.status || 'pending',
      payment_method: parsed?.payment_method || parsed?.paymentMethod || 'Credit Card',
      billing_date: parsed?.billing_date || parsed?.billingDate || billingDate,
      due_date: parsed?.due_date || parsed?.dueDate || dueDate,
      ai_unavailable: billFb || !parsed,
      customer_name: customer.name,
      response_time_ms: elapsed
    };
    res.json(result);
  } catch (error) { console.error('AI billing analysis error:', error); res.status(500).json({ error: 'Server error' }); }
});

// ============ AI ANALYZE FEATURE USAGE ============
app.post('/api/ai/analyze-feature', authenticateToken, async (req, res) => {
  try {
    const { customer_id } = req.body;
    const customerResult = await pool.query('SELECT * FROM customers WHERE id = $1', [customer_id]);
    const customer = customerResult.rows[0];
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const prompt = `Analyze and suggest detailed feature usage for customer:
Customer: ${customer.name} (${customer.company})
Plan: ${customer.plan}
Revenue: $${customer.monthly_revenue}/month
Status: ${customer.status}

Based on their plan level, suggest a realistic feature usage record as JSON with:
- feature_name: specific feature name (e.g., "Advanced Analytics Dashboard", "Custom Report Builder", "API Integration", "Team Collaboration", "Automated Alerts", "Data Export")
- usage_count: realistic usage count based on plan (Starter: 10-50, Professional: 50-200, Enterprise: 200-1000)
- adoption_rate: percentage 0-100 showing how much of the feature they use
- time_spent_minutes: realistic time spent using the feature
- last_used: when they last used this feature
- period: measurement period ("daily", "weekly", or "monthly")

Higher tier plans should show more advanced feature usage.`;

    const { data: parsed, elapsed, fallback: featFb } = await callOpenRouterAI(
      [{ role: 'system', content: 'You are a feature analyst. Respond only with valid JSON.' }, { role: 'user', content: prompt }],
      {}
    );
    const lastUsed = new Date().toISOString().slice(0, 16);
    const result = {
      feature_name: parsed?.feature_name || parsed?.featureName || parsed?.name || 'Dashboard',
      usage_count: parsed?.usage_count || parsed?.usageCount || 50,
      adoption_rate: parsed?.adoption_rate || parsed?.adoptionRate || 75,
      time_spent_minutes: parsed?.time_spent_minutes || parsed?.timeSpentMinutes || 30,
      last_used: parsed?.last_used || parsed?.lastUsed || lastUsed,
      period: parsed?.period || 'monthly',
      ai_unavailable: featFb || !parsed,
      customer_name: customer.name,
      response_time_ms: elapsed
    };
    res.json(result);
  } catch (error) { console.error('AI feature analysis error:', error); res.status(500).json({ error: 'Server error' }); }
});

// ============ AI ANALYZE SESSION ============
app.post('/api/ai/analyze-session', authenticateToken, async (req, res) => {
  try {
    const { customer_id } = req.body;
    const customerResult = await pool.query('SELECT * FROM customers WHERE id = $1', [customer_id]);
    const customer = customerResult.rows[0];
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const prompt = `Generate detailed user session data for customer:
Customer: ${customer.name} (${customer.company})
Plan: ${customer.plan}
Revenue: $${customer.monthly_revenue}/month
Status: ${customer.status}

Create a realistic session record as JSON with:
- session_start: session start timestamp
- session_end: session end timestamp
- duration_minutes: realistic session length (power users: 30-60min, casual: 5-15min)
- pages_viewed: number of pages visited during session
- actions_taken: number of actions/clicks performed
- device_type: device used ("Desktop", "Mobile", "Tablet")
- browser: browser used ("Chrome", "Firefox", "Safari", "Edge")

Enterprise customers typically have longer, more engaged sessions.`;

    const { data: parsed, elapsed, fallback: sessFb } = await callOpenRouterAI(
      [{ role: 'system', content: 'You are a session analyst. Respond only with valid JSON.' }, { role: 'user', content: prompt }],
      {}
    );
    const now = new Date();
    const sessionStart = now.toISOString().slice(0, 16);
    const durationMins = parsed?.duration_minutes || parsed?.durationMinutes || 25;
    const sessionEnd = new Date(now.getTime() + durationMins * 60000).toISOString().slice(0, 16);

    const result = {
      session_start: parsed?.session_start || parsed?.sessionStart || sessionStart,
      session_end: parsed?.session_end || parsed?.sessionEnd || sessionEnd,
      duration_minutes: durationMins,
      pages_viewed: parsed?.pages_viewed || parsed?.pagesViewed || 8,
      actions_taken: parsed?.actions_taken || parsed?.actionsTaken || 15,
      device_type: parsed?.device_type || parsed?.deviceType || 'Desktop',
      browser: parsed?.browser || 'Chrome',
      ai_unavailable: sessFb || !parsed,
      customer_name: customer.name,
      response_time_ms: elapsed
    };
    res.json(result);
  } catch (error) { console.error('AI session analysis error:', error); res.status(500).json({ error: 'Server error' }); }
});

// ============ AI ANALYZE SEGMENT ============
app.post('/api/ai/analyze-segment', authenticateToken, async (req, res) => {
  try {
    const { name, description } = req.body;
    const prompt = `Create a detailed customer segment configuration:
Segment Name: ${name || 'New Segment'}
Initial Description: ${description || 'Not provided'}

Generate a comprehensive segment definition as JSON with:
- description: detailed 2-3 sentence description explaining who these customers are, their characteristics, and why they're grouped together
- criteria: JSON object with specific segment criteria (e.g., {"plan": "Enterprise", "status": "active", "monthly_revenue_min": 1000})
- customer_count: realistic estimated customer count in this segment
- avg_revenue: average monthly revenue for customers in this segment
- churn_rate: estimated churn rate percentage for this segment (high-value segments typically have lower churn)

Make the description actionable and the criteria specific.`;

    const { data: parsed, elapsed, fallback: segFb } = await callOpenRouterAI(
      [{ role: 'system', content: 'You are a segmentation expert. Respond only with valid JSON.' }, { role: 'user', content: prompt }],
      {}
    );
    const result = {
      description: parsed?.description || `${name || 'Customer'} segment based on specified criteria`,
      criteria: parsed?.criteria || { plan: 'Enterprise' },
      customer_count: parsed?.customer_count || parsed?.customerCount || 50,
      avg_revenue: parsed?.avg_revenue || parsed?.avgRevenue || 5000,
      churn_rate: parsed?.churn_rate || parsed?.churnRate || 5.5,
      ai_unavailable: segFb || !parsed,
      response_time_ms: elapsed
    };
    res.json(result);
  } catch (error) { console.error('AI segment analysis error:', error); res.status(500).json({ error: 'Server error' }); }
});

// ============ SENTIMENT ANALYSIS ROUTES ============
app.get('/api/sentiment', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT sa.*, c.name as customer_name, c.company
      FROM sentiment_analysis sa
      JOIN customers c ON sa.customer_id = c.id
      ORDER BY sa.analyzed_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/sentiment/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT sa.*, c.name as customer_name, c.company
      FROM sentiment_analysis sa
      JOIN customers c ON sa.customer_id = c.id
      WHERE sa.id = $1
    `, [req.params.id]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/sentiment', authenticateToken, async (req, res) => {
  try {
    const { customer_id, feedback_source, feedback_text, sentiment_score, sentiment_label, churn_signal_strength, key_phrases, emotions, urgency_level, recommended_action, ai_response, ai_response_time_ms } = req.body;
    const result = await pool.query(
      `INSERT INTO sentiment_analysis (customer_id, feedback_source, feedback_text, sentiment_score, sentiment_label, churn_signal_strength, key_phrases, emotions, urgency_level, recommended_action, ai_response, ai_response_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [customer_id, feedback_source, feedback_text, sentiment_score || null, sentiment_label || null, churn_signal_strength || null, key_phrases || null, emotions ? JSON.stringify(emotions) : null, urgency_level || null, recommended_action || null, ai_response ? JSON.stringify(ai_response) : null, ai_response_time_ms || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create sentiment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/sentiment/:id', authenticateToken, async (req, res) => {
  try {
    const { feedback_source, feedback_text, sentiment_score, sentiment_label, churn_signal_strength, key_phrases, emotions, urgency_level, recommended_action } = req.body;
    const result = await pool.query(
      `UPDATE sentiment_analysis SET feedback_source = $1, feedback_text = $2, sentiment_score = $3, sentiment_label = $4, churn_signal_strength = $5, key_phrases = $6, emotions = $7, urgency_level = $8, recommended_action = $9
       WHERE id = $10 RETURNING *`,
      [feedback_source, feedback_text, sentiment_score, sentiment_label, churn_signal_strength, key_phrases, emotions ? JSON.stringify(emotions) : null, urgency_level, recommended_action, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/sentiment/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM sentiment_analysis WHERE id = $1', [req.params.id]);
    res.json({ message: 'Sentiment analysis deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ AI ANALYZE SENTIMENT ============
app.post('/api/ai/analyze-sentiment', authenticateToken, async (req, res) => {
  try {
    const { customer_id, feedback_text, feedback_source } = req.body;
    const customerResult = await pool.query('SELECT * FROM customers WHERE id = $1', [customer_id]);
    const customer = customerResult.rows[0];
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const prompt = `Analyze this customer feedback for churn signals and sentiment:

Customer: ${customer.name} (${customer.company})
Plan: ${customer.plan}, Status: ${customer.status}, Revenue: $${customer.monthly_revenue}/month
Feedback Source: ${feedback_source || 'General'}
Feedback Text: "${feedback_text || 'No specific feedback provided'}"

Provide comprehensive sentiment analysis as JSON with:
- sentiment_score: 0-100 (0=very negative, 50=neutral, 100=very positive)
- sentiment_label: "Very Negative", "Negative", "Neutral", "Positive", or "Very Positive"
- churn_signal_strength: 0-100 (how strongly this indicates churn risk)
- key_phrases: array of important phrases from the feedback
- emotions: object with emotion scores (e.g., {"joy": 0.8, "frustration": 0.2, "trust": 0.7})
- urgency_level: "Low", "Medium", "High", or "Critical"
- recommended_action: specific action to take based on this feedback
- feedback_summary: 1-2 sentence summary of the key sentiment

Be thorough and identify subtle churn indicators.`;

    const { data: parsed, elapsed, fallback: sentFb } = await callOpenRouterAI(
      [{ role: 'system', content: 'You are a sentiment analysis expert specializing in customer churn prediction. Respond only with valid JSON.' }, { role: 'user', content: prompt }],
      {}
    );

    const result = {
      sentiment_score: parsed?.sentiment_score || 50,
      sentiment_label: parsed?.sentiment_label || 'Neutral',
      churn_signal_strength: parsed?.churn_signal_strength || 30,
      key_phrases: parsed?.key_phrases || [],
      emotions: parsed?.emotions || {},
      urgency_level: parsed?.urgency_level || 'Medium',
      recommended_action: parsed?.recommended_action || 'Monitor customer engagement',
      feedback_summary: parsed?.feedback_summary || (sentFb ? 'AI temporarily unavailable' : ''),
      ai_unavailable: sentFb || !parsed,
      customer_name: customer.name,
      model_used: process.env.OPENROUTER_MODEL,
      response_time_ms: elapsed
    };
    res.json(result);
  } catch (error) {
    console.error('AI sentiment analysis error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ CUSTOMER JOURNEYS ROUTES ============
app.get('/api/journeys', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cj.*, c.name as customer_name, c.company
      FROM customer_journeys cj
      JOIN customers c ON cj.customer_id = c.id
      ORDER BY cj.touchpoint_date DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/journeys/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cj.*, c.name as customer_name, c.company
      FROM customer_journeys cj
      JOIN customers c ON cj.customer_id = c.id
      WHERE cj.id = $1
    `, [req.params.id]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/journeys', authenticateToken, async (req, res) => {
  try {
    const { customer_id, journey_stage, touchpoint_type, touchpoint_name, touchpoint_date, sentiment_at_touchpoint, engagement_level, is_churn_indicator, days_before_churn, journey_path, ai_insights, ai_response, ai_response_time_ms } = req.body;
    const result = await pool.query(
      `INSERT INTO customer_journeys (customer_id, journey_stage, touchpoint_type, touchpoint_name, touchpoint_date, sentiment_at_touchpoint, engagement_level, is_churn_indicator, days_before_churn, journey_path, ai_insights, ai_response, ai_response_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [customer_id, journey_stage, touchpoint_type, touchpoint_name, touchpoint_date || new Date(), sentiment_at_touchpoint, engagement_level || null, is_churn_indicator || false, days_before_churn || null, journey_path ? JSON.stringify(journey_path) : null, ai_insights || null, ai_response ? JSON.stringify(ai_response) : null, ai_response_time_ms || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create journey error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/journeys/:id', authenticateToken, async (req, res) => {
  try {
    const { journey_stage, touchpoint_type, touchpoint_name, touchpoint_date, sentiment_at_touchpoint, engagement_level, is_churn_indicator, days_before_churn, journey_path, ai_insights } = req.body;
    const result = await pool.query(
      `UPDATE customer_journeys SET journey_stage = $1, touchpoint_type = $2, touchpoint_name = $3, touchpoint_date = $4, sentiment_at_touchpoint = $5, engagement_level = $6, is_churn_indicator = $7, days_before_churn = $8, journey_path = $9, ai_insights = $10
       WHERE id = $11 RETURNING *`,
      [journey_stage, touchpoint_type, touchpoint_name, touchpoint_date, sentiment_at_touchpoint, engagement_level || null, is_churn_indicator, days_before_churn || null, journey_path ? JSON.stringify(journey_path) : null, ai_insights || null, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/journeys/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM customer_journeys WHERE id = $1', [req.params.id]);
    res.json({ message: 'Journey deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ AI MAP CUSTOMER JOURNEY ============
app.post('/api/ai/map-journey', authenticateToken, async (req, res) => {
  try {
    const { customer_id } = req.body;
    const customerResult = await pool.query('SELECT * FROM customers WHERE id = $1', [customer_id]);
    const customer = customerResult.rows[0];
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    // Get existing touchpoints for context
    const journeyResult = await pool.query('SELECT * FROM customer_journeys WHERE customer_id = $1 ORDER BY touchpoint_date DESC LIMIT 5', [customer_id]);
    const recentJourneys = journeyResult.rows;

    const prompt = `Map the customer journey and identify churn indicators for:

Customer: ${customer.name} (${customer.company})
Plan: ${customer.plan}, Status: ${customer.status}, Revenue: $${customer.monthly_revenue}/month
Signup Date: ${customer.signup_date}
Recent Touchpoints: ${recentJourneys.length > 0 ? recentJourneys.map(j => j.touchpoint_name).join(', ') : 'No recent touchpoints'}

Generate a new journey touchpoint analysis as JSON with:
- journey_stage: current stage ("Onboarding", "Active", "Growth", "Expansion", "At-Risk", "Declining", "Churned", "Advocacy")
- touchpoint_type: type of interaction ("Product", "Support", "Sales", "Marketing", "Billing", "Success", "Training")
- touchpoint_name: specific touchpoint name (e.g., "Feature Adoption Milestone", "Support Escalation", "Renewal Discussion")
- sentiment_at_touchpoint: "Very Positive", "Positive", "Neutral", "Negative", or "Very Negative"
- engagement_level: 0-100 engagement score at this point
- is_churn_indicator: true/false if this touchpoint indicates churn risk
- days_before_churn: if is_churn_indicator is true, estimated days before potential churn
- journey_path: object with "path" array showing journey stages traversed
- ai_insights: 2-3 sentences analyzing what this touchpoint means for retention

Be realistic based on the customer's current status and history.`;

    const { data: parsed, elapsed, fallback: journeyFb } = await callOpenRouterAI(
      [{ role: 'system', content: 'You are a customer journey mapping expert. Respond only with valid JSON.' }, { role: 'user', content: prompt }],
      {}
    );

    const result = {
      journey_stage: parsed?.journey_stage || 'Active',
      touchpoint_type: parsed?.touchpoint_type || 'Product',
      touchpoint_name: parsed?.touchpoint_name || 'Regular Usage',
      touchpoint_date: new Date().toISOString(),
      sentiment_at_touchpoint: parsed?.sentiment_at_touchpoint || 'Neutral',
      engagement_level: parsed?.engagement_level || 50,
      is_churn_indicator: parsed?.is_churn_indicator || false,
      days_before_churn: parsed?.days_before_churn || null,
      journey_path: parsed?.journey_path || { path: ['Active'] },
      ai_insights: parsed?.ai_insights || (journeyFb ? 'AI temporarily unavailable.' : 'Standard customer engagement observed.'),
      ai_unavailable: journeyFb || !parsed,
      customer_name: customer.name,
      model_used: process.env.OPENROUTER_MODEL,
      response_time_ms: elapsed
    };
    res.json(result);
  } catch (error) {
    console.error('AI journey mapping error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ WIN-BACK CAMPAIGNS ROUTES ============
app.get('/api/winback', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT wb.*, c.name as customer_name, c.company
      FROM winback_campaigns wb
      JOIN customers c ON wb.customer_id = c.id
      ORDER BY wb.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/winback/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT wb.*, c.name as customer_name, c.company
      FROM winback_campaigns wb
      JOIN customers c ON wb.customer_id = c.id
      WHERE wb.id = $1
    `, [req.params.id]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/winback', authenticateToken, async (req, res) => {
  try {
    const { customer_id, campaign_name, campaign_type, offer_type, offer_details, discount_percentage, personalization_score, predicted_success_rate, email_subject, email_body, status, ai_response, ai_response_time_ms } = req.body;
    const result = await pool.query(
      `INSERT INTO winback_campaigns (customer_id, campaign_name, campaign_type, offer_type, offer_details, discount_percentage, personalization_score, predicted_success_rate, email_subject, email_body, status, ai_response, ai_response_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [customer_id, campaign_name || null, campaign_type, offer_type, offer_details || null, discount_percentage || null, personalization_score || null, predicted_success_rate || null, email_subject || null, email_body || null, status || 'draft', ai_response ? JSON.stringify(ai_response) : null, ai_response_time_ms || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create winback error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/winback/:id', authenticateToken, async (req, res) => {
  try {
    const { campaign_name, campaign_type, offer_type, offer_details, discount_percentage, personalization_score, predicted_success_rate, email_subject, email_body, status, sent_at, opened_at, responded_at, conversion_status } = req.body;
    const result = await pool.query(
      `UPDATE winback_campaigns SET campaign_name = $1, campaign_type = $2, offer_type = $3, offer_details = $4, discount_percentage = $5, personalization_score = $6, predicted_success_rate = $7, email_subject = $8, email_body = $9, status = $10, sent_at = $11, opened_at = $12, responded_at = $13, conversion_status = $14
       WHERE id = $15 RETURNING *`,
      [campaign_name, campaign_type, offer_type, offer_details, discount_percentage, personalization_score, predicted_success_rate, email_subject, email_body, status, sent_at, opened_at, responded_at, conversion_status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/winback/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM winback_campaigns WHERE id = $1', [req.params.id]);
    res.json({ message: 'Win-back campaign deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ AI GENERATE WIN-BACK CAMPAIGN ============
app.post('/api/ai/generate-winback', authenticateToken, async (req, res) => {
  try {
    const { customer_id, campaign_type } = req.body;
    const customerResult = await pool.query('SELECT * FROM customers WHERE id = $1', [customer_id]);
    const customer = customerResult.rows[0];
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    // Get churn prediction and NPS for context
    const predResult = await pool.query('SELECT * FROM churn_predictions WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 1', [customer_id]);
    const npsResult = await pool.query('SELECT * FROM nps_scores WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 1', [customer_id]);

    const prompt = `Create a personalized win-back campaign for this at-risk/churned customer:

Customer: ${customer.name} (${customer.company})
Plan: ${customer.plan}, Status: ${customer.status}, Previous Revenue: $${customer.monthly_revenue}/month
Campaign Type Requested: ${campaign_type || 'Personalized'}
Churn Score: ${predResult.rows[0]?.prediction_score || 'Unknown'}
Last NPS: ${npsResult.rows[0]?.score || 'Unknown'} - ${npsResult.rows[0]?.feedback || 'No feedback'}

Generate a compelling win-back campaign as JSON with:
- campaign_name: creative campaign name personalized to this customer
- campaign_type: type of campaign (e.g., "Personalized", "Re-engagement", "Price Sensitive", "Feature Preview")
- offer_type: type of offer (e.g., "Discount", "Feature Unlock", "Extended Trial", "Concierge Service")
- offer_details: detailed description of the offer (2-3 sentences)
- discount_percentage: discount offered (0-100, 0 if not a discount offer)
- personalization_score: 0-100 how personalized this campaign is
- predicted_success_rate: 0-100 likelihood of winning back this customer
- email_subject: compelling email subject line (under 60 characters)
- email_body: full email body (professional, personalized, 150-200 words)
- key_selling_points: array of 3-4 key points to highlight

Make it highly personalized based on their history and plan level.`;

    const { data: parsed, elapsed, fallback: winbackFb } = await callOpenRouterAI(
      [{ role: 'system', content: 'You are a customer retention marketing expert. Create compelling, personalized win-back campaigns. Respond only with valid JSON.' }, { role: 'user', content: prompt }],
      {}
    );

    const result = {
      campaign_name: parsed?.campaign_name || `Win-Back ${customer.name}`,
      campaign_type: parsed?.campaign_type || 'Personalized',
      offer_type: parsed?.offer_type || 'Discount',
      offer_details: parsed?.offer_details || 'Special return offer',
      discount_percentage: parsed?.discount_percentage || 20,
      personalization_score: parsed?.personalization_score || 75,
      predicted_success_rate: parsed?.predicted_success_rate || 40,
      email_subject: parsed?.email_subject || `${customer.name}, we want you back`,
      email_body: parsed?.email_body || (winbackFb ? 'AI temporarily unavailable. Please compose a personalized message manually.' : 'We miss having you as a customer...'),
      key_selling_points: parsed?.key_selling_points || [],
      ai_unavailable: winbackFb || !parsed,
      customer_name: customer.name,
      model_used: process.env.OPENROUTER_MODEL,
      response_time_ms: elapsed
    };
    res.json(result);
  } catch (error) {
    console.error('AI win-back generation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ CUSTOMER HEALTH DASHBOARD ROUTES ============
app.get('/api/health-dashboard', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT chd.*, c.name as customer_name, c.company
      FROM customer_health_dashboard chd
      JOIN customers c ON chd.customer_id = c.id
      ORDER BY chd.health_score DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/health-dashboard/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT chd.*, c.name as customer_name, c.company
      FROM customer_health_dashboard chd
      JOIN customers c ON chd.customer_id = c.id
      WHERE chd.id = $1
    `, [req.params.id]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/health-dashboard', authenticateToken, async (req, res) => {
  try {
    const { customer_id, health_score, engagement_index, satisfaction_index, financial_health, product_adoption, support_sentiment, risk_indicators, positive_signals, trend_direction, trend_percentage, last_activity_days, recommended_actions, ai_summary, ai_response, ai_response_time_ms } = req.body;
    const result = await pool.query(
      `INSERT INTO customer_health_dashboard (customer_id, health_score, engagement_index, satisfaction_index, financial_health, product_adoption, support_sentiment, risk_indicators, positive_signals, trend_direction, trend_percentage, last_activity_days, recommended_actions, ai_summary, ai_response, ai_response_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
      [customer_id, health_score || null, engagement_index || null, satisfaction_index || null, financial_health || null, product_adoption || null, support_sentiment || null, risk_indicators ? JSON.stringify(risk_indicators) : null, positive_signals ? JSON.stringify(positive_signals) : null, trend_direction || null, trend_percentage || null, last_activity_days || null, recommended_actions || null, ai_summary || null, ai_response ? JSON.stringify(ai_response) : null, ai_response_time_ms || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create health dashboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/health-dashboard/:id', authenticateToken, async (req, res) => {
  try {
    const { health_score, engagement_index, satisfaction_index, financial_health, product_adoption, support_sentiment, risk_indicators, positive_signals, trend_direction, trend_percentage, last_activity_days, recommended_actions, ai_summary } = req.body;
    const result = await pool.query(
      `UPDATE customer_health_dashboard SET health_score = $1, engagement_index = $2, satisfaction_index = $3, financial_health = $4, product_adoption = $5, support_sentiment = $6, risk_indicators = $7, positive_signals = $8, trend_direction = $9, trend_percentage = $10, last_activity_days = $11, recommended_actions = $12, ai_summary = $13, calculated_at = CURRENT_TIMESTAMP
       WHERE id = $14 RETURNING *`,
      [health_score, engagement_index, satisfaction_index, financial_health, product_adoption, support_sentiment, risk_indicators ? JSON.stringify(risk_indicators) : null, positive_signals ? JSON.stringify(positive_signals) : null, trend_direction, trend_percentage, last_activity_days, recommended_actions, ai_summary, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/health-dashboard/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM customer_health_dashboard WHERE id = $1', [req.params.id]);
    res.json({ message: 'Health dashboard entry deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ AI CALCULATE HEALTH SCORE ============
app.post('/api/ai/calculate-health', authenticateToken, async (req, res) => {
  try {
    const { customer_id } = req.body;
    const customerResult = await pool.query('SELECT * FROM customers WHERE id = $1', [customer_id]);
    const customer = customerResult.rows[0];
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    // Gather all relevant data for comprehensive health analysis
    const [engagementRes, npsRes, ticketsRes, billingRes, usageRes] = await Promise.all([
      pool.query('SELECT * FROM engagement_scores WHERE customer_id = $1 ORDER BY calculated_at DESC LIMIT 1', [customer_id]),
      pool.query('SELECT * FROM nps_scores WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 1', [customer_id]),
      pool.query('SELECT COUNT(*) as count, COUNT(CASE WHEN status = \'open\' THEN 1 END) as open_count FROM support_tickets WHERE customer_id = $1', [customer_id]),
      pool.query('SELECT * FROM billing_history WHERE customer_id = $1 ORDER BY billing_date DESC LIMIT 3', [customer_id]),
      pool.query('SELECT * FROM usage_metrics WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 5', [customer_id])
    ]);

    const prompt = `Calculate comprehensive customer health score for:

Customer: ${customer.name} (${customer.company})
Plan: ${customer.plan}, Status: ${customer.status}, Revenue: $${customer.monthly_revenue}/month
Signup: ${customer.signup_date}, Last Activity: ${customer.last_activity}

Engagement Score: ${engagementRes.rows[0]?.overall_score || 'Unknown'}
NPS Score: ${npsRes.rows[0]?.score || 'Unknown'} (${npsRes.rows[0]?.category || 'Unknown'})
Support Tickets: ${ticketsRes.rows[0]?.count || 0} total, ${ticketsRes.rows[0]?.open_count || 0} open
Recent Billing: ${billingRes.rows.map(b => b.status).join(', ') || 'No history'}

Provide comprehensive health analysis as JSON with:
- health_score: overall health 0-100
- engagement_index: engagement health 0-100
- satisfaction_index: satisfaction 0-100
- financial_health: payment/billing health 0-100
- product_adoption: feature adoption 0-100
- support_sentiment: support experience sentiment 0-100
- risk_indicators: object with "items" array of risk factors
- positive_signals: object with "items" array of positive factors
- trend_direction: "up", "down", or "stable"
- trend_percentage: percentage change (positive or negative)
- last_activity_days: days since last activity
- recommended_actions: array of 3-4 specific recommended actions
- ai_summary: 3-4 sentence executive summary of account health

Be specific and actionable in your recommendations.`;

    const { data: parsed, elapsed, fallback: healthDashFb } = await callOpenRouterAI(
      [{ role: 'system', content: 'You are a customer health analytics expert. Provide comprehensive, data-driven health assessments. Respond only with valid JSON.' }, { role: 'user', content: prompt }],
      {}
    );

    const result = {
      health_score: parsed?.health_score || 50,
      engagement_index: parsed?.engagement_index || 50,
      satisfaction_index: parsed?.satisfaction_index || 50,
      financial_health: parsed?.financial_health || 50,
      product_adoption: parsed?.product_adoption || 50,
      support_sentiment: parsed?.support_sentiment || 50,
      risk_indicators: parsed?.risk_indicators || { items: [] },
      positive_signals: parsed?.positive_signals || { items: [] },
      trend_direction: parsed?.trend_direction || 'stable',
      trend_percentage: parsed?.trend_percentage || 0,
      last_activity_days: parsed?.last_activity_days || 0,
      recommended_actions: parsed?.recommended_actions || [],
      ai_summary: parsed?.ai_summary || (healthDashFb ? 'AI temporarily unavailable. Manual health review recommended.' : 'Health analysis completed.'),
      ai_unavailable: healthDashFb || !parsed,
      customer_name: customer.name,
      model_used: process.env.OPENROUTER_MODEL,
      response_time_ms: elapsed
    };
    res.json(result);
  } catch (error) {
    console.error('AI health calculation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ ESCALATION PREDICTIONS ROUTES ============
app.get('/api/escalations', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ep.*, c.name as customer_name, c.company
      FROM escalation_predictions ep
      JOIN customers c ON ep.customer_id = c.id
      ORDER BY ep.escalation_probability DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/escalations/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ep.*, c.name as customer_name, c.company
      FROM escalation_predictions ep
      JOIN customers c ON ep.customer_id = c.id
      WHERE ep.id = $1
    `, [req.params.id]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/escalations', authenticateToken, async (req, res) => {
  try {
    const { customer_id, frustration_score, escalation_probability, frustration_indicators, recent_issues, communication_sentiment, response_urgency, predicted_escalation_type, recommended_preemptive_action, agent_talking_points, priority_level, status, ai_response, ai_response_time_ms } = req.body;
    const result = await pool.query(
      `INSERT INTO escalation_predictions (customer_id, frustration_score, escalation_probability, frustration_indicators, recent_issues, communication_sentiment, response_urgency, predicted_escalation_type, recommended_preemptive_action, agent_talking_points, priority_level, status, ai_response, ai_response_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [customer_id, frustration_score || null, escalation_probability || null, frustration_indicators || null, recent_issues ? JSON.stringify(recent_issues) : null, communication_sentiment || null, response_urgency || null, predicted_escalation_type || null, recommended_preemptive_action || null, agent_talking_points || null, priority_level || null, status || 'active', ai_response ? JSON.stringify(ai_response) : null, ai_response_time_ms || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create escalation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/escalations/:id', authenticateToken, async (req, res) => {
  try {
    const { frustration_score, escalation_probability, frustration_indicators, recent_issues, communication_sentiment, response_urgency, predicted_escalation_type, recommended_preemptive_action, agent_talking_points, priority_level, status, escalated_at, resolved_at } = req.body;
    const result = await pool.query(
      `UPDATE escalation_predictions SET frustration_score = $1, escalation_probability = $2, frustration_indicators = $3, recent_issues = $4, communication_sentiment = $5, response_urgency = $6, predicted_escalation_type = $7, recommended_preemptive_action = $8, agent_talking_points = $9, priority_level = $10, status = $11, escalated_at = $12, resolved_at = $13
       WHERE id = $14 RETURNING *`,
      [frustration_score, escalation_probability, frustration_indicators, recent_issues ? JSON.stringify(recent_issues) : null, communication_sentiment, response_urgency, predicted_escalation_type, recommended_preemptive_action, agent_talking_points, priority_level, status, escalated_at, resolved_at, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/escalations/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM escalation_predictions WHERE id = $1', [req.params.id]);
    res.json({ message: 'Escalation prediction deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ AI PREDICT ESCALATION ============
app.post('/api/ai/predict-escalation', authenticateToken, async (req, res) => {
  try {
    const { customer_id } = req.body;
    const customerResult = await pool.query('SELECT * FROM customers WHERE id = $1', [customer_id]);
    const customer = customerResult.rows[0];
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    // Get support tickets and sentiment data
    const [ticketsRes, sentimentRes, npsRes] = await Promise.all([
      pool.query('SELECT * FROM support_tickets WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 5', [customer_id]),
      pool.query('SELECT * FROM sentiment_analysis WHERE customer_id = $1 ORDER BY analyzed_at DESC LIMIT 3', [customer_id]),
      pool.query('SELECT * FROM nps_scores WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 1', [customer_id])
    ]);

    const prompt = `Predict escalation risk for frustrated customer:

Customer: ${customer.name} (${customer.company})
Plan: ${customer.plan}, Status: ${customer.status}, Revenue: $${customer.monthly_revenue}/month

Recent Support Tickets: ${ticketsRes.rows.map(t => `${t.subject} (${t.status}, ${t.priority})`).join('; ') || 'None'}
Recent Sentiment: ${sentimentRes.rows.map(s => `${s.sentiment_label}: "${s.feedback_text?.substring(0, 50)}..."`).join('; ') || 'None'}
NPS Score: ${npsRes.rows[0]?.score || 'Unknown'} - "${npsRes.rows[0]?.feedback?.substring(0, 100) || 'No feedback'}"

Predict escalation risk as JSON with:
- frustration_score: 0-100 current frustration level
- escalation_probability: 0-100 likelihood of escalation
- frustration_indicators: array of specific frustration signals detected
- recent_issues: object with "issues" array, each having type, date, resolved status
- communication_sentiment: current sentiment ("Delighted", "Satisfied", "Neutral", "Frustrated", "Angry", "Very Frustrated")
- response_urgency: "Low", "Medium", "High", or "Immediate"
- predicted_escalation_type: type of escalation expected (e.g., "Manager Escalation", "Executive Escalation", "Social Media", "Cancellation")
- recommended_preemptive_action: specific action to prevent escalation (2-3 sentences)
- agent_talking_points: array of 3-4 specific talking points for support agents
- priority_level: "Low", "Medium", "High", or "Critical"

Be proactive in identifying subtle frustration signals.`;

    const { data: parsed, elapsed, fallback: escalFb } = await callOpenRouterAI(
      [{ role: 'system', content: 'You are a customer experience expert specializing in de-escalation and frustration detection. Respond only with valid JSON.' }, { role: 'user', content: prompt }],
      {}
    );

    const result = {
      frustration_score: parsed?.frustration_score || 30,
      escalation_probability: parsed?.escalation_probability || 20,
      frustration_indicators: parsed?.frustration_indicators || [],
      recent_issues: parsed?.recent_issues || { issues: [] },
      communication_sentiment: parsed?.communication_sentiment || 'Neutral',
      response_urgency: parsed?.response_urgency || 'Medium',
      predicted_escalation_type: parsed?.predicted_escalation_type || 'Standard Support',
      recommended_preemptive_action: parsed?.recommended_preemptive_action || (escalFb ? 'AI temporarily unavailable. Manual review recommended.' : 'Monitor engagement and follow standard procedures.'),
      agent_talking_points: parsed?.agent_talking_points || [],
      priority_level: parsed?.priority_level || 'Medium',
      ai_unavailable: escalFb || !parsed,
      customer_name: customer.name,
      model_used: process.env.OPENROUTER_MODEL,
      response_time_ms: elapsed
    };
    res.json(result);
  } catch (error) {
    console.error('AI escalation prediction error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ SERVICE LEVEL PREDICTIONS ROUTES ============
app.get('/api/service-levels', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT slp.*, c.name as customer_name, c.company
      FROM service_level_predictions slp
      JOIN customers c ON slp.customer_id = c.id
      ORDER BY slp.predicted_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/service-levels/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT slp.*, c.name as customer_name, c.company
      FROM service_level_predictions slp
      JOIN customers c ON slp.customer_id = c.id
      WHERE slp.id = $1
    `, [req.params.id]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/service-levels', authenticateToken, async (req, res) => {
  try {
    const { customer_id, predicted_response_time, predicted_resolution_time, sla_compliance_probability, service_tier, priority_score, queue_position, expected_first_response, expected_resolution, bottleneck_factors, optimization_suggestions, agent_workload_impact, customer_patience_index, ai_response, ai_response_time_ms } = req.body;
    const result = await pool.query(
      `INSERT INTO service_level_predictions (customer_id, predicted_response_time, predicted_resolution_time, sla_compliance_probability, service_tier, priority_score, queue_position, expected_first_response, expected_resolution, bottleneck_factors, optimization_suggestions, agent_workload_impact, customer_patience_index, ai_response, ai_response_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [customer_id, predicted_response_time, predicted_resolution_time, sla_compliance_probability, service_tier, priority_score, queue_position, expected_first_response, expected_resolution, bottleneck_factors, optimization_suggestions, agent_workload_impact, customer_patience_index, ai_response ? JSON.stringify(ai_response) : null, ai_response_time_ms]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create service level error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/service-levels/:id', authenticateToken, async (req, res) => {
  try {
    const { predicted_response_time, predicted_resolution_time, sla_compliance_probability, service_tier, priority_score, queue_position, expected_first_response, expected_resolution, bottleneck_factors, optimization_suggestions, agent_workload_impact, customer_patience_index } = req.body;
    const result = await pool.query(
      `UPDATE service_level_predictions SET predicted_response_time = $1, predicted_resolution_time = $2, sla_compliance_probability = $3, service_tier = $4, priority_score = $5, queue_position = $6, expected_first_response = $7, expected_resolution = $8, bottleneck_factors = $9, optimization_suggestions = $10, agent_workload_impact = $11, customer_patience_index = $12
       WHERE id = $13 RETURNING *`,
      [predicted_response_time, predicted_resolution_time, sla_compliance_probability, service_tier, priority_score, queue_position, expected_first_response, expected_resolution, bottleneck_factors, optimization_suggestions, agent_workload_impact, customer_patience_index, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/service-levels/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM service_level_predictions WHERE id = $1', [req.params.id]);
    res.json({ message: 'Service level prediction deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ AI PREDICT SERVICE LEVEL ============
app.post('/api/ai/predict-service-level', authenticateToken, async (req, res) => {
  try {
    const { customer_id, issue_type, issue_description } = req.body;
    const customerResult = await pool.query('SELECT * FROM customers WHERE id = $1', [customer_id]);
    const customer = customerResult.rows[0];
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const [ticketsRes, healthRes] = await Promise.all([
      pool.query('SELECT * FROM support_tickets WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 10', [customer_id]),
      pool.query('SELECT * FROM customer_health_dashboard WHERE customer_id = $1 ORDER BY calculated_at DESC LIMIT 1', [customer_id])
    ]);

    const prompt = `Predict service level metrics for customer support request:

Customer: ${customer.name} (${customer.company})
Plan: ${customer.plan}, Status: ${customer.status}, Revenue: $${customer.monthly_revenue}/month
Issue Type: ${issue_type || 'General Support'}
Issue Description: ${issue_description || 'General inquiry'}
Historical Tickets: ${ticketsRes.rows.length} recent tickets
Customer Health Score: ${healthRes.rows[0]?.health_score || 'Unknown'}

Predict service metrics as JSON with:
- predicted_response_time: expected first response in minutes (e.g., 15, 30, 60)
- predicted_resolution_time: expected resolution in hours (e.g., 2, 4, 24)
- sla_compliance_probability: 0-100 likelihood of meeting SLA
- service_tier: "Standard", "Priority", "Premium", or "VIP" based on customer value
- priority_score: 0-100 urgency priority
- queue_position: estimated position in queue (1-50)
- expected_first_response: relative time for first response
- expected_resolution: relative time for resolution
- bottleneck_factors: array of factors that might delay resolution
- optimization_suggestions: array of 3-4 ways to improve service
- agent_workload_impact: "Low", "Medium", or "High"
- customer_patience_index: 0-100 estimated patience level

Enterprise/high-revenue customers should get faster service predictions.`;

    const { data: parsed, elapsed, fallback: slaFb } = await callOpenRouterAI(
      [{ role: 'system', content: 'You are a customer service operations expert specializing in SLA prediction. Respond only with valid JSON.' }, { role: 'user', content: prompt }],
      {}
    );

    res.json({
      predicted_response_time: parsed?.predicted_response_time || 30,
      predicted_resolution_time: parsed?.predicted_resolution_time || 4,
      sla_compliance_probability: parsed?.sla_compliance_probability || 85,
      service_tier: parsed?.service_tier || 'Standard',
      priority_score: parsed?.priority_score || 50,
      queue_position: parsed?.queue_position || 10,
      expected_first_response: parsed?.expected_first_response || 'within 30 minutes',
      expected_resolution: parsed?.expected_resolution || 'within 4 hours',
      bottleneck_factors: parsed?.bottleneck_factors || [],
      optimization_suggestions: parsed?.optimization_suggestions || [],
      agent_workload_impact: parsed?.agent_workload_impact || 'Medium',
      customer_patience_index: parsed?.customer_patience_index || 70,
      ai_unavailable: slaFb || !parsed,
      customer_name: customer.name,
      model_used: process.env.OPENROUTER_MODEL,
      response_time_ms: elapsed
    });
  } catch (error) {
    console.error('AI service level prediction error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ RESPONSE SUGGESTIONS ROUTES ============
app.get('/api/response-suggestions', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT rs.*, c.name as customer_name, c.company
      FROM response_suggestions rs
      JOIN customers c ON rs.customer_id = c.id
      ORDER BY rs.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/response-suggestions/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT rs.*, c.name as customer_name, c.company
      FROM response_suggestions rs
      JOIN customers c ON rs.customer_id = c.id
      WHERE rs.id = $1
    `, [req.params.id]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/response-suggestions', authenticateToken, async (req, res) => {
  try {
    const { customer_id, ticket_subject, ticket_description, suggested_response, response_tone, personalization_level, key_points, empathy_phrases, solution_steps, follow_up_actions, estimated_satisfaction, alternative_responses, knowledge_base_links, ai_response, ai_response_time_ms } = req.body;
    const result = await pool.query(
      `INSERT INTO response_suggestions (customer_id, ticket_subject, ticket_description, suggested_response, response_tone, personalization_level, key_points, empathy_phrases, solution_steps, follow_up_actions, estimated_satisfaction, alternative_responses, knowledge_base_links, ai_response, ai_response_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [customer_id, ticket_subject, ticket_description, suggested_response, response_tone, personalization_level, key_points, empathy_phrases, solution_steps, follow_up_actions ? JSON.stringify(follow_up_actions) : null, estimated_satisfaction, alternative_responses ? JSON.stringify(alternative_responses) : null, knowledge_base_links, ai_response ? JSON.stringify(ai_response) : null, ai_response_time_ms]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create response suggestion error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/response-suggestions/:id', authenticateToken, async (req, res) => {
  try {
    const { ticket_subject, ticket_description, suggested_response, response_tone, personalization_level, key_points, empathy_phrases, solution_steps, follow_up_actions, estimated_satisfaction, alternative_responses, knowledge_base_links } = req.body;
    const result = await pool.query(
      `UPDATE response_suggestions SET ticket_subject = $1, ticket_description = $2, suggested_response = $3, response_tone = $4, personalization_level = $5, key_points = $6, empathy_phrases = $7, solution_steps = $8, follow_up_actions = $9, estimated_satisfaction = $10, alternative_responses = $11, knowledge_base_links = $12
       WHERE id = $13 RETURNING *`,
      [ticket_subject, ticket_description, suggested_response, response_tone, personalization_level, key_points, empathy_phrases, solution_steps, follow_up_actions ? JSON.stringify(follow_up_actions) : null, estimated_satisfaction, alternative_responses ? JSON.stringify(alternative_responses) : null, knowledge_base_links, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/response-suggestions/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM response_suggestions WHERE id = $1', [req.params.id]);
    res.json({ message: 'Response suggestion deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ AI SUGGEST RESPONSE ============
app.post('/api/ai/suggest-response', authenticateToken, async (req, res) => {
  try {
    const { customer_id, ticket_subject, ticket_description } = req.body;
    const customerResult = await pool.query('SELECT * FROM customers WHERE id = $1', [customer_id]);
    const customer = customerResult.rows[0];
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const [sentimentRes, npsRes, healthRes] = await Promise.all([
      pool.query('SELECT * FROM sentiment_analysis WHERE customer_id = $1 ORDER BY analyzed_at DESC LIMIT 1', [customer_id]),
      pool.query('SELECT * FROM nps_scores WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 1', [customer_id]),
      pool.query('SELECT * FROM customer_health_dashboard WHERE customer_id = $1 ORDER BY calculated_at DESC LIMIT 1', [customer_id])
    ]);

    const prompt = `Generate a personalized customer service response:

Customer: ${customer.name} (${customer.company})
Plan: ${customer.plan}, Status: ${customer.status}, Revenue: $${customer.monthly_revenue}/month
Ticket Subject: ${ticket_subject || 'General Inquiry'}
Ticket Description: ${ticket_description || 'Customer reaching out for assistance'}
Recent Sentiment: ${sentimentRes.rows[0]?.sentiment_label || 'Unknown'}
NPS Score: ${npsRes.rows[0]?.score || 'Unknown'}
Health Score: ${healthRes.rows[0]?.health_score || 'Unknown'}

Generate response as JSON with:
- suggested_response: full professional response (3-5 paragraphs, use customer name)
- response_tone: "Empathetic", "Professional", "Friendly", "Apologetic", or "Solution-Focused"
- personalization_level: 0-100
- key_points: array of 3-5 key points
- empathy_phrases: array of 2-3 empathy phrases
- solution_steps: array of step-by-step solution
- follow_up_actions: object with "actions" array
- estimated_satisfaction: 0-100
- alternative_responses: array of 2 alternatives with tone and brief_version
- knowledge_base_links: array of relevant help articles

Enterprise/VIP customers get more detailed responses.`;

    const { data: parsed, elapsed, fallback: responseFb } = await callOpenRouterAI(
      [{ role: 'system', content: 'You are an expert customer service representative. Respond only with valid JSON.' }, { role: 'user', content: prompt }],
      {}
    );

    res.json({
      suggested_response: parsed?.suggested_response || (responseFb ? 'AI temporarily unavailable. Please compose a response manually for this customer.' : 'Thank you for reaching out. We will review your request shortly.'),
      response_tone: parsed?.response_tone || 'Professional',
      personalization_level: parsed?.personalization_level || 50,
      key_points: parsed?.key_points || [],
      empathy_phrases: parsed?.empathy_phrases || [],
      solution_steps: parsed?.solution_steps || [],
      follow_up_actions: parsed?.follow_up_actions || { actions: [] },
      estimated_satisfaction: parsed?.estimated_satisfaction || 75,
      alternative_responses: parsed?.alternative_responses || [],
      knowledge_base_links: parsed?.knowledge_base_links || [],
      ai_unavailable: responseFb || !parsed,
      customer_name: customer.name,
      model_used: process.env.OPENROUTER_MODEL,
      response_time_ms: elapsed
    });
  } catch (error) {
    console.error('AI response suggestion error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ TRANSACTIONAL COMPOSITE ENDPOINTS ============

/**
 * POST /api/customers/:id/flag-at-risk
 * Atomically:
 *   1. Updates the customer status to 'at-risk'
 *   2. Creates an alert for the customer
 *   3. Creates a pending intervention for the customer
 * All three writes succeed or none do (ROLLBACK on any failure).
 */
app.post('/api/customers/:id/flag-at-risk', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { reason, intervention_type, alert_message } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Update customer status to at-risk
    const customerUpdate = await client.query(
      `UPDATE customers SET status = 'at-risk', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status != 'churned'
       RETURNING id, name, company, status`,
      [id]
    );

    if (customerUpdate.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Customer not found or already churned' });
    }

    const customer = customerUpdate.rows[0];

    // 2. Create an alert for the at-risk flag
    const alertResult = await client.query(
      `INSERT INTO alerts (customer_id, alert_type, severity, message)
       VALUES ($1, 'Churn Risk', 'high', $2)
       RETURNING id`,
      [id, alert_message || `Customer ${customer.name} flagged as at-risk. Reason: ${reason || 'Manual review'}`]
    );

    // 3. Create a pending intervention
    const interventionResult = await client.query(
      `INSERT INTO interventions (customer_id, type, description, priority, status, suggested_by)
       VALUES ($1, $2, $3, 'High', 'pending', 'System')
       RETURNING id`,
      [id, intervention_type || 'Outreach Call', reason || 'Customer flagged as at-risk — immediate follow-up required']
    );

    await client.query('COMMIT');

    res.json({
      message: 'Customer flagged as at-risk with alert and intervention created',
      customer: customer,
      alert_id: alertResult.rows[0].id,
      intervention_id: interventionResult.rows[0].id
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Flag at-risk transaction error:', err.message);
    res.status(500).json({ error: 'Transaction failed — no changes were saved', details: err.message });
  } finally {
    client.release();
  }
});

/**
 * POST /api/predictions/with-risk-score
 * Atomically:
 *   1. Creates a churn prediction record
 *   2. Creates a corresponding risk score record
 *   3. Updates the customer status if prediction score is high (>70)
 * All three writes succeed or none do (ROLLBACK on any failure).
 */
app.post('/api/predictions/with-risk-score', authenticateToken, async (req, res) => {
  const {
    customer_id, prediction_score, confidence_level, factors, status, ai_analysis,
    risk_level, risk_category, contributing_factors, recommended_actions
  } = req.body;

  if (!customer_id || prediction_score === undefined) {
    return res.status(400).json({ error: 'customer_id and prediction_score are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verify customer exists
    const customerCheck = await client.query('SELECT id, name, status FROM customers WHERE id = $1', [customer_id]);
    if (customerCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Customer not found' });
    }

    // 2. Insert churn prediction
    const predictionResult = await client.query(
      `INSERT INTO churn_predictions
         (customer_id, prediction_score, prediction_date, confidence_level, factors, status, ai_analysis)
       VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6)
       RETURNING *`,
      [customer_id, prediction_score, confidence_level || null, factors || null, status || 'active', ai_analysis || null]
    );

    // 3. Insert corresponding risk score
    const derivedRiskLevel = risk_level || (prediction_score >= 75 ? 'High' : prediction_score >= 50 ? 'Medium' : 'Low');
    const riskScoreResult = await client.query(
      `INSERT INTO risk_scores
         (customer_id, risk_level, score, category, contributing_factors, recommended_actions)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        customer_id,
        derivedRiskLevel,
        prediction_score,
        risk_category || 'Churn Risk',
        contributing_factors || factors || null,
        recommended_actions || null
      ]
    );

    // 4. Auto-update customer status to 'at-risk' if prediction score > 70
    let customerStatusUpdated = false;
    if (parseFloat(prediction_score) > 70 && customerCheck.rows[0].status === 'active') {
      await client.query(
        `UPDATE customers SET status = 'at-risk', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [customer_id]
      );
      customerStatusUpdated = true;
    }

    await client.query('COMMIT');

    res.status(201).json({
      prediction: predictionResult.rows[0],
      risk_score_id: riskScoreResult.rows[0].id,
      customer_status_updated_to_at_risk: customerStatusUpdated,
      message: 'Prediction and risk score created atomically'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Prediction+risk score transaction error:', err.message);
    res.status(500).json({ error: 'Transaction failed — no changes were saved', details: err.message });
  } finally {
    client.release();
  }
});

// ============ COHORT SURVIVAL ANALYSIS ============

/**
 * GET /api/analytics/cohort-survival
 * Groups customers by signup_month cohort and calculates what percentage
 * of each cohort is still active at 1, 3, 6, and 12 months.
 * Returns a cohort matrix ready for frontend charting.
 *
 * No AI call — pure SQL analytics.
 */
app.get('/api/analytics/cohort-survival', authenticateToken, async (req, res) => {
  try {
    // Build cohort data: for each signup month, count total customers
    // and count those still active at 1/3/6/12 months post-signup.
    // We infer "still active at N months" as: status != 'churned' OR
    // last_activity >= (signup_date + N months interval).
    const cohortQuery = `
      WITH cohorts AS (
        SELECT
          TO_CHAR(DATE_TRUNC('month', signup_date), 'YYYY-MM') AS cohort_month,
          id AS customer_id,
          signup_date,
          status,
          last_activity
        FROM customers
        WHERE signup_date IS NOT NULL
      ),
      cohort_stats AS (
        SELECT
          cohort_month,
          COUNT(*)                                                                              AS total_customers,
          COUNT(*) FILTER (WHERE status != 'churned'
            OR last_activity >= (signup_date + INTERVAL '1 month'))                            AS active_at_1mo,
          COUNT(*) FILTER (WHERE status != 'churned'
            OR last_activity >= (signup_date + INTERVAL '3 months'))                           AS active_at_3mo,
          COUNT(*) FILTER (WHERE status != 'churned'
            OR last_activity >= (signup_date + INTERVAL '6 months'))                           AS active_at_6mo,
          COUNT(*) FILTER (WHERE status != 'churned'
            OR last_activity >= (signup_date + INTERVAL '12 months'))                          AS active_at_12mo
        FROM cohorts
        GROUP BY cohort_month
      )
      SELECT
        cohort_month,
        total_customers,
        active_at_1mo,
        active_at_3mo,
        active_at_6mo,
        active_at_12mo,
        ROUND(100.0 * active_at_1mo  / NULLIF(total_customers, 0), 1) AS survival_pct_1mo,
        ROUND(100.0 * active_at_3mo  / NULLIF(total_customers, 0), 1) AS survival_pct_3mo,
        ROUND(100.0 * active_at_6mo  / NULLIF(total_customers, 0), 1) AS survival_pct_6mo,
        ROUND(100.0 * active_at_12mo / NULLIF(total_customers, 0), 1) AS survival_pct_12mo
      FROM cohort_stats
      ORDER BY cohort_month ASC
    `;

    const result = await pool.query(cohortQuery);

    // Build summary statistics across all cohorts
    const rows = result.rows;
    const totalCustomers = rows.reduce((sum, r) => sum + parseInt(r.total_customers), 0);
    const avgSurvival1mo  = rows.length ? (rows.reduce((sum, r) => sum + parseFloat(r.survival_pct_1mo  || 0), 0) / rows.length).toFixed(1) : null;
    const avgSurvival3mo  = rows.length ? (rows.reduce((sum, r) => sum + parseFloat(r.survival_pct_3mo  || 0), 0) / rows.length).toFixed(1) : null;
    const avgSurvival6mo  = rows.length ? (rows.reduce((sum, r) => sum + parseFloat(r.survival_pct_6mo  || 0), 0) / rows.length).toFixed(1) : null;
    const avgSurvival12mo = rows.length ? (rows.reduce((sum, r) => sum + parseFloat(r.survival_pct_12mo || 0), 0) / rows.length).toFixed(1) : null;

    res.json({
      cohorts: rows,
      summary: {
        total_cohorts: rows.length,
        total_customers: totalCustomers,
        avg_survival_pct_1mo: parseFloat(avgSurvival1mo),
        avg_survival_pct_3mo: parseFloat(avgSurvival3mo),
        avg_survival_pct_6mo: parseFloat(avgSurvival6mo),
        avg_survival_pct_12mo: parseFloat(avgSurvival12mo)
      },
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cohort survival analysis error:', error);
    res.status(500).json({ error: 'Cohort survival analysis failed', details: error.message });
  }
});

// ============ NEW AI ENDPOINTS ============

/**
 * POST /api/ai/cohort-analysis
 * Groups customers by signup month, calculates churn rate per cohort,
 * and uses AI to identify high-risk cohorts and provide strategic insights.
 */
app.post('/api/ai/cohort-analysis', authenticateToken, aiLimiter, async (req, res) => {
  try {
    // Build cohort data from DB
    const cohortResult = await pool.query(`
      WITH cohorts AS (
        SELECT
          TO_CHAR(DATE_TRUNC('month', signup_date), 'YYYY-MM') AS cohort_month,
          COUNT(*) AS total_customers,
          COUNT(*) FILTER (WHERE status = 'churned') AS churned_customers,
          COUNT(*) FILTER (WHERE status = 'active') AS active_customers,
          COUNT(*) FILTER (WHERE status = 'at-risk') AS at_risk_customers,
          ROUND(AVG(monthly_revenue)::numeric, 2) AS avg_revenue
        FROM customers
        WHERE signup_date IS NOT NULL
        GROUP BY DATE_TRUNC('month', signup_date)
      )
      SELECT
        cohort_month,
        total_customers,
        churned_customers,
        active_customers,
        at_risk_customers,
        avg_revenue,
        ROUND(100.0 * churned_customers / NULLIF(total_customers, 0), 1) AS churn_rate_pct
      FROM cohorts
      ORDER BY cohort_month ASC
    `);

    const cohorts = cohortResult.rows;

    if (cohorts.length === 0) {
      return res.status(404).json({ error: 'No cohort data available' });
    }

    const systemPrompt = 'You are an expert customer success AI specializing in SaaS churn prediction and retention strategy. Provide data-driven, actionable insights.';
    const prompt = `Analyze the following customer cohort data and identify high-risk cohorts with strategic recommendations.

Cohort Data (by signup month):
${JSON.stringify(cohorts, null, 2)}

Respond with a JSON object containing:
- high_risk_cohorts: array of cohort months with churn_rate > 20% or significant at-risk customers, each with "cohort_month", "risk_level" ("Low"/"Medium"/"High"/"Critical"), and "risk_reason"
- overall_health_assessment: summary of cohort health across all months
- churn_patterns: identified patterns in when/why customers churn (e.g., early churn, seasonal patterns)
- retention_recommendations: array of 3-5 targeted recommendations for specific cohorts or across all cohorts (each with "target_cohort", "strategy", and "expected_impact")
- cohort_insights: array of 3 key observations about cohort performance
- best_performing_cohort: the cohort with lowest churn rate and why it might be succeeding`;

    const { data: parsed, elapsed, fallback } = await callOpenRouterAI(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      {
        high_risk_cohorts: cohorts.filter(c => parseFloat(c.churn_rate_pct) > 20).map(c => ({ cohort_month: c.cohort_month, risk_level: 'High', risk_reason: 'AI temporarily unavailable' })),
        overall_health_assessment: 'AI temporarily unavailable — manual review required',
        churn_patterns: [],
        retention_recommendations: [{ target_cohort: 'All', strategy: 'Manual review required', expected_impact: 'Unknown' }],
        cohort_insights: [],
        best_performing_cohort: null
      }
    );

    res.json({
      cohorts,
      analysis: parsed || {},
      ai_unavailable: fallback || !parsed,
      response_time_ms: elapsed,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI cohort analysis error:', error);
    res.status(500).json({ error: 'Cohort analysis failed', details: error.message });
  }
});

/**
 * POST /api/ai/revenue-impact
 * Body: { churn_predictions }
 * Calculates MRR at risk, revenue impact by segment, expansion vs contraction revenue.
 */
app.post('/api/ai/revenue-impact', authenticateToken, aiLimiter, async (req, res) => {
  try {
    const { churn_predictions } = req.body;

    // If churn_predictions provided use them; otherwise query the DB
    let predictions;
    if (Array.isArray(churn_predictions) && churn_predictions.length > 0) {
      predictions = churn_predictions;
    } else {
      const result = await pool.query(`
        SELECT cp.customer_id, cp.prediction_score, cp.confidence_level, cp.factors,
               c.name, c.company, c.plan, c.monthly_revenue, c.status
        FROM churn_predictions cp
        JOIN customers c ON cp.customer_id = c.id
        ORDER BY cp.prediction_score DESC
      `);
      predictions = result.rows;
    }

    // Calculate revenue at risk tiers
    const highRisk = predictions.filter(p => parseFloat(p.prediction_score) >= 70);
    const mediumRisk = predictions.filter(p => parseFloat(p.prediction_score) >= 40 && parseFloat(p.prediction_score) < 70);
    const lowRisk = predictions.filter(p => parseFloat(p.prediction_score) < 40);

    const mrrHighRisk = highRisk.reduce((sum, p) => sum + parseFloat(p.monthly_revenue || 0), 0);
    const mrrMediumRisk = mediumRisk.reduce((sum, p) => sum + parseFloat(p.monthly_revenue || 0), 0);
    const mrrLowRisk = lowRisk.reduce((sum, p) => sum + parseFloat(p.monthly_revenue || 0), 0);
    const totalMrr = mrrHighRisk + mrrMediumRisk + mrrLowRisk;

    // Plan-level breakdown
    const planBreakdown = predictions.reduce((acc, p) => {
      const plan = p.plan || 'Unknown';
      if (!acc[plan]) acc[plan] = { count: 0, mrr: 0, avg_risk: 0 };
      acc[plan].count++;
      acc[plan].mrr += parseFloat(p.monthly_revenue || 0);
      acc[plan].avg_risk += parseFloat(p.prediction_score || 0);
      return acc;
    }, {});
    Object.keys(planBreakdown).forEach(plan => {
      planBreakdown[plan].avg_risk = Math.round(planBreakdown[plan].avg_risk / planBreakdown[plan].count);
    });

    const systemPrompt = 'You are an expert customer success AI specializing in SaaS churn prediction and retention strategy. Provide data-driven, actionable insights.';
    const prompt = `Analyze the revenue impact of predicted churn and provide strategic financial insights.

Revenue at Risk Summary:
- Total MRR Analyzed: $${totalMrr.toFixed(2)}
- High Risk (score >= 70): ${highRisk.length} customers, $${mrrHighRisk.toFixed(2)} MRR at risk
- Medium Risk (score 40-69): ${mediumRisk.length} customers, $${mrrMediumRisk.toFixed(2)} MRR at risk
- Low Risk (score < 40): ${lowRisk.length} customers, $${mrrLowRisk.toFixed(2)} MRR at risk

Plan-Level Breakdown:
${JSON.stringify(planBreakdown, null, 2)}

Top 5 Highest-Risk by Revenue:
${JSON.stringify(highRisk.sort((a, b) => parseFloat(b.monthly_revenue || 0) - parseFloat(a.monthly_revenue || 0)).slice(0, 5).map(p => ({ name: p.name, plan: p.plan, mrr: p.monthly_revenue, risk_score: p.prediction_score })), null, 2)}

Respond with a JSON object containing:
- mrr_at_risk_summary: object with "high_risk_mrr", "medium_risk_mrr", "low_risk_mrr", "total_mrr_analyzed", "percentage_at_high_risk"
- revenue_impact_by_segment: analysis by plan tier with "segment", "mrr_at_risk", "recommended_action"
- expansion_vs_contraction: assessment of net revenue impact ("expansion_opportunities", "contraction_risk", "net_impact_assessment")
- priority_accounts: top 5 accounts to focus on immediately with "account", "reason", "recommended_action"
- financial_projections: projected revenue loss at 30, 60, 90 days if no intervention
- intervention_roi: estimated ROI of intervention programs to retain at-risk revenue`;

    const { data: parsed, elapsed, fallback } = await callOpenRouterAI(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      {
        mrr_at_risk_summary: { high_risk_mrr: mrrHighRisk, medium_risk_mrr: mrrMediumRisk, low_risk_mrr: mrrLowRisk, total_mrr_analyzed: totalMrr, percentage_at_high_risk: totalMrr > 0 ? ((mrrHighRisk / totalMrr) * 100).toFixed(1) : 0 },
        revenue_impact_by_segment: [],
        expansion_vs_contraction: { expansion_opportunities: 'AI unavailable', contraction_risk: 'AI unavailable', net_impact_assessment: 'Manual review required' },
        priority_accounts: [],
        financial_projections: { day_30: mrrHighRisk * 0.3, day_60: mrrHighRisk * 0.5, day_90: mrrHighRisk * 0.7 },
        intervention_roi: 'AI unavailable'
      }
    );

    res.json({
      input_predictions_count: predictions.length,
      raw_metrics: {
        total_mrr: totalMrr,
        mrr_high_risk: mrrHighRisk,
        mrr_medium_risk: mrrMediumRisk,
        mrr_low_risk: mrrLowRisk,
        plan_breakdown: planBreakdown
      },
      analysis: parsed || {},
      ai_unavailable: fallback || !parsed,
      response_time_ms: elapsed,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI revenue impact error:', error);
    res.status(500).json({ error: 'Revenue impact analysis failed', details: error.message });
  }
});

/**
 * POST /api/ai/winback-campaign
 * Body: { churned_customers[], time_since_churn }
 * Returns personalized win-back message templates, optimal contact timing, incentive recommendations.
 */
app.post('/api/ai/winback-campaign', authenticateToken, aiLimiter, async (req, res) => {
  try {
    const { churned_customers, time_since_churn } = req.body;

    let customers;
    if (Array.isArray(churned_customers) && churned_customers.length > 0) {
      customers = churned_customers;
    } else {
      const result = await pool.query(`
        SELECT c.*, cp.prediction_score, cp.factors as churn_factors
        FROM customers c
        LEFT JOIN churn_predictions cp ON c.id = cp.customer_id
        WHERE c.status = 'churned'
        ORDER BY c.updated_at DESC
        LIMIT 50
      `);
      customers = result.rows;
    }

    if (customers.length === 0) {
      return res.status(404).json({ error: 'No churned customers found' });
    }

    const timeSinceChurn = time_since_churn || 'various';

    // Group by plan for segment-level templates
    const byPlan = customers.reduce((acc, c) => {
      const plan = c.plan || 'Unknown';
      if (!acc[plan]) acc[plan] = [];
      acc[plan].push(c);
      return acc;
    }, {});

    const systemPrompt = 'You are an expert customer success AI specializing in SaaS churn prediction and retention strategy. Provide data-driven, actionable insights.';
    const prompt = `Create personalized win-back campaign materials for churned SaaS customers.

Time Since Churn: ${timeSinceChurn}
Total Churned Customers: ${customers.length}
Plan Distribution: ${JSON.stringify(Object.entries(byPlan).map(([plan, custs]) => ({ plan, count: custs.length, avg_mrr: (custs.reduce((s, c) => s + parseFloat(c.monthly_revenue || 0), 0) / custs.length).toFixed(2) })), null, 2)}

Sample Churned Customer Profiles (first 10):
${JSON.stringify(customers.slice(0, 10).map(c => ({ name: c.name, company: c.company, plan: c.plan, mrr: c.monthly_revenue, churn_factors: c.churn_factors })), null, 2)}

Respond with a JSON object containing:
- message_templates: array of 3-4 win-back email templates, each with "name" (e.g., "30-Day Winback"), "subject_line", "email_body" (2-3 paragraphs), "tone", and "best_for" (which customer type)
- optimal_contact_timing: object with "day_ranges" (recommended days since churn to reach out), "best_time_of_day", "frequency" (how often to follow up), and "channel_priority" (email, phone, etc.)
- incentive_recommendations: array of 4-5 incentive ideas (each with "incentive_type", "description", "discount_percentage" if applicable, "target_segment", and "expected_success_rate")
- segmentation_strategy: how to group churned customers for different win-back approaches
- success_metrics: KPIs to track win-back campaign effectiveness`;

    const { data: parsed, elapsed, fallback } = await callOpenRouterAI(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      {
        message_templates: [{ name: 'Generic Winback', subject_line: "We'd love to have you back", email_body: 'AI temporarily unavailable — please create template manually.', tone: 'Friendly', best_for: 'All churned customers' }],
        optimal_contact_timing: { day_ranges: '7-30 days', best_time_of_day: 'Tuesday-Thursday, 10am-2pm', frequency: 'Weekly for 4 weeks', channel_priority: ['Email', 'Phone'] },
        incentive_recommendations: [{ incentive_type: 'Discount', description: 'AI unavailable — manual review required', discount_percentage: 20, target_segment: 'All', expected_success_rate: 'Unknown' }],
        segmentation_strategy: 'AI unavailable',
        success_metrics: ['Reactivation rate', 'Time to reactivation', 'MRR recovered']
      }
    );

    res.json({
      churned_customers_analyzed: customers.length,
      time_since_churn: timeSinceChurn,
      plan_distribution: byPlan,
      campaign: parsed || {},
      ai_unavailable: fallback || !parsed,
      response_time_ms: elapsed,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI winback campaign error:', error);
    res.status(500).json({ error: 'Win-back campaign generation failed', details: error.message });
  }
});

// ============ HEALTH SCORE TREND TRACKING ============

/**
 * POST /api/health-scores/snapshot
 * Saves current health scores for all customers to a snapshots table for trend tracking.
 * Creates the table if it doesn't exist.
 */
app.post('/api/health-scores/snapshot', authenticateToken, async (req, res) => {
  try {
    // Ensure snapshots table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS health_score_snapshots (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        overall_health NUMERIC(5,2),
        product_usage NUMERIC(5,2),
        customer_satisfaction NUMERIC(5,2),
        growth_potential NUMERIC(5,2),
        support_health NUMERIC(5,2),
        financial_health NUMERIC(5,2),
        trend VARCHAR(20),
        snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_hss_customer_date
        ON health_score_snapshots (customer_id, snapshot_date DESC)
    `);

    // Copy current health_scores into the snapshot table
    const result = await pool.query(`
      INSERT INTO health_score_snapshots
        (customer_id, overall_health, product_usage, customer_satisfaction,
         growth_potential, support_health, financial_health, trend, snapshot_date)
      SELECT
        customer_id, overall_health, product_usage, customer_satisfaction,
        growth_potential, support_health, financial_health, trend, CURRENT_DATE
      FROM health_scores
      ON CONFLICT DO NOTHING
      RETURNING id
    `);

    res.json({
      message: 'Health score snapshot created successfully',
      snapshot_date: new Date().toISOString().split('T')[0],
      customers_snapshotted: result.rowCount
    });
  } catch (error) {
    console.error('Health score snapshot error:', error);
    res.status(500).json({ error: 'Health score snapshot failed', details: error.message });
  }
});

/**
 * GET /api/health-scores/:customer_id/trend
 * Returns last 90 days of health score history for a given customer.
 */
app.get('/api/health-scores/:customer_id/trend', authenticateToken, async (req, res) => {
  try {
    const { customer_id } = req.params;

    // Ensure table exists before querying
    await pool.query(`
      CREATE TABLE IF NOT EXISTS health_score_snapshots (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        overall_health NUMERIC(5,2),
        product_usage NUMERIC(5,2),
        customer_satisfaction NUMERIC(5,2),
        growth_potential NUMERIC(5,2),
        support_health NUMERIC(5,2),
        financial_health NUMERIC(5,2),
        trend VARCHAR(20),
        snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const customerCheck = await pool.query('SELECT id, name, company FROM customers WHERE id = $1', [customer_id]);
    if (customerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const result = await pool.query(`
      SELECT
        snapshot_date,
        overall_health,
        product_usage,
        customer_satisfaction,
        growth_potential,
        support_health,
        financial_health,
        trend
      FROM health_score_snapshots
      WHERE customer_id = $1
        AND snapshot_date >= CURRENT_DATE - INTERVAL '90 days'
      ORDER BY snapshot_date ASC
    `, [customer_id]);

    const snapshots = result.rows;

    // Compute simple trend direction from first to last
    let trendDirection = 'stable';
    if (snapshots.length >= 2) {
      const first = parseFloat(snapshots[0].overall_health || 0);
      const last = parseFloat(snapshots[snapshots.length - 1].overall_health || 0);
      const diff = last - first;
      if (diff > 5) trendDirection = 'improving';
      else if (diff < -5) trendDirection = 'declining';
    }

    res.json({
      customer_id: parseInt(customer_id),
      customer_name: customerCheck.rows[0].name,
      company: customerCheck.rows[0].company,
      period: '90 days',
      snapshots_count: snapshots.length,
      trend_direction: trendDirection,
      snapshots
    });
  } catch (error) {
    console.error('Health score trend error:', error);
    res.status(500).json({ error: 'Health score trend fetch failed', details: error.message });
  }
});

// ============ BULK RISK SCORING ============

// In-memory job store for async bulk risk scoring
const bulkRiskJobs = new Map();

/**
 * POST /api/customers/bulk-risk-score
 * Queues an async AI risk scoring job for all customers.
 * Returns a job_id immediately; processing runs in background.
 */
app.post('/api/customers/bulk-risk-score', authenticateToken, async (req, res) => {
  try {
    const jobId = `bulk_risk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    bulkRiskJobs.set(jobId, {
      status: 'queued',
      started_at: new Date().toISOString(),
      completed_at: null,
      total_customers: 0,
      processed: 0,
      errors: 0,
      results: []
    });

    // Return job ID immediately before processing starts
    res.json({
      job_id: jobId,
      status: 'queued',
      message: 'Bulk risk scoring job queued. Use GET /api/customers/bulk-risk-score/:job_id to check status.',
      poll_url: `/api/customers/bulk-risk-score/${jobId}`
    });

    // Process asynchronously without blocking the response
    setImmediate(async () => {
      const job = bulkRiskJobs.get(jobId);
      job.status = 'processing';

      try {
        const customersResult = await pool.query(`
          SELECT c.id, c.name, c.company, c.plan, c.monthly_revenue, c.status, c.last_activity,
                 es.overall_score as engagement_score,
                 hs.overall_health as health_score,
                 COUNT(st.id) FILTER (WHERE st.status = 'open') as open_tickets
          FROM customers c
          LEFT JOIN engagement_scores es ON c.id = es.customer_id
          LEFT JOIN health_scores hs ON c.id = hs.customer_id
          LEFT JOIN support_tickets st ON c.id = st.customer_id
          WHERE c.status != 'churned'
          GROUP BY c.id, es.overall_score, hs.overall_health
          ORDER BY c.id
        `);

        const customers = customersResult.rows;
        job.total_customers = customers.length;

        // Process in batches of 5 to avoid overwhelming the AI API
        const batchSize = 5;
        for (let i = 0; i < customers.length; i += batchSize) {
          const batch = customers.slice(i, i + batchSize);

          await Promise.allSettled(batch.map(async (customer) => {
            try {
              const prompt = `Quick risk assessment for SaaS customer:
Customer: ${customer.name} (${customer.company})
Plan: ${customer.plan}, MRR: $${customer.monthly_revenue}, Status: ${customer.status}
Engagement Score: ${customer.engagement_score || 'N/A'}
Health Score: ${customer.health_score || 'N/A'}
Open Tickets: ${customer.open_tickets || 0}

Respond only with JSON: { "risk_level": "Low|Medium|High|Critical", "score": 0-100, "category": "main risk category", "top_factors": ["factor1", "factor2"] }`;

              const { data: parsed, elapsed, fallback } = await callOpenRouterAI(
                [
                  { role: 'system', content: 'You are a risk assessment expert. Respond only with valid JSON.' },
                  { role: 'user', content: prompt }
                ],
                { risk_level: 'Unknown', score: 50, category: 'AI Unavailable', top_factors: ['Manual review required'] }
              );

              const riskData = parsed || { risk_level: 'Unknown', score: 50, category: 'AI Unavailable', top_factors: ['Manual review required'] };

              // Store result in DB
              await pool.query(`
                INSERT INTO risk_scores (customer_id, risk_level, score, category, contributing_factors, recommended_actions)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT DO NOTHING
              `, [
                customer.id,
                riskData.risk_level,
                riskData.score,
                riskData.category,
                riskData.top_factors ? JSON.stringify(riskData.top_factors) : null,
                null
              ]);

              job.results.push({
                customer_id: customer.id,
                customer_name: customer.name,
                risk_level: riskData.risk_level,
                score: riskData.score,
                category: riskData.category,
                ai_unavailable: fallback || !parsed,
                response_time_ms: elapsed
              });
              job.processed++;
            } catch (customerErr) {
              console.error(`Bulk risk score error for customer ${customer.id}:`, customerErr.message);
              job.errors++;
              job.processed++;
            }
          }));
        }

        job.status = 'completed';
        job.completed_at = new Date().toISOString();
      } catch (jobErr) {
        console.error('Bulk risk scoring job error:', jobErr.message);
        job.status = 'failed';
        job.error = jobErr.message;
        job.completed_at = new Date().toISOString();
      }
    });
  } catch (error) {
    console.error('Bulk risk score error:', error);
    res.status(500).json({ error: 'Failed to queue bulk risk scoring job', details: error.message });
  }
});

/**
 * GET /api/customers/bulk-risk-score/:job_id
 * Check the status of a bulk risk scoring job.
 */
app.get('/api/customers/bulk-risk-score/:job_id', authenticateToken, async (req, res) => {
  try {
    const { job_id } = req.params;
    const job = bulkRiskJobs.get(job_id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found or expired' });
    }

    res.json({
      job_id,
      status: job.status,
      started_at: job.started_at,
      completed_at: job.completed_at,
      total_customers: job.total_customers,
      processed: job.processed,
      errors: job.errors,
      progress_pct: job.total_customers > 0 ? Math.round((job.processed / job.total_customers) * 100) : 0,
      results: job.status === 'completed' ? job.results : [],
      error: job.error || undefined
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch job status' });
  }
});

// ============ PAGINATION FOR REMAINING LIST ENDPOINTS ============
// Add paginated variants for endpoints that only returned all records

/**
 * GET /api/predictions/paginated - Paginated churn predictions
 */
app.get('/api/predictions/paginated', authenticateToken, async (req, res) => {
  try {
    const { query: q, countQuery, params, countParams, pageNum, limitNum } = buildListQuery(
      'churn_predictions',
      'SELECT cp.*, c.name as customer_name, c.company, c.email as customer_email FROM churn_predictions cp JOIN customers c ON cp.customer_id = c.id',
      req,
      ['c.name', 'c.company', 'cp.status']
    );
    const [dataResult, countResult] = await Promise.all([
      pool.query(q, params),
      pool.query(countQuery, countParams)
    ]);
    res.json({
      data: dataResult.rows,
      pagination: { page: pageNum, limit: limitNum, total: parseInt(countResult.rows[0].count), totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limitNum) }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/risk-scores/paginated - Paginated risk scores
 */
app.get('/api/risk-scores/paginated', authenticateToken, async (req, res) => {
  try {
    const { query: q, countQuery, params, countParams, pageNum, limitNum } = buildListQuery(
      'risk_scores',
      'SELECT rs.*, c.name as customer_name, c.company FROM risk_scores rs JOIN customers c ON rs.customer_id = c.id',
      req,
      ['c.name', 'c.company', 'rs.risk_level', 'rs.category']
    );
    const [dataResult, countResult] = await Promise.all([
      pool.query(q, params),
      pool.query(countQuery, countParams)
    ]);
    res.json({
      data: dataResult.rows,
      pagination: { page: pageNum, limit: limitNum, total: parseInt(countResult.rows[0].count), totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limitNum) }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/interventions/paginated - Paginated interventions
 */
app.get('/api/interventions/paginated', authenticateToken, async (req, res) => {
  try {
    const { query: q, countQuery, params, countParams, pageNum, limitNum } = buildListQuery(
      'interventions',
      'SELECT i.*, c.name as customer_name, c.company FROM interventions i JOIN customers c ON i.customer_id = c.id',
      req,
      ['c.name', 'c.company', 'i.type', 'i.status', 'i.priority']
    );
    const [dataResult, countResult] = await Promise.all([
      pool.query(q, params),
      pool.query(countQuery, countParams)
    ]);
    res.json({
      data: dataResult.rows,
      pagination: { page: pageNum, limit: limitNum, total: parseInt(countResult.rows[0].count), totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limitNum) }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/tickets/paginated - Paginated support tickets
 */
app.get('/api/tickets/paginated', authenticateToken, async (req, res) => {
  try {
    const { query: q, countQuery, params, countParams, pageNum, limitNum } = buildListQuery(
      'support_tickets',
      'SELECT st.*, c.name as customer_name, c.company FROM support_tickets st JOIN customers c ON st.customer_id = c.id',
      req,
      ['c.name', 'c.company', 'st.subject', 'st.status', 'st.priority', 'st.category']
    );
    const [dataResult, countResult] = await Promise.all([
      pool.query(q, params),
      pool.query(countQuery, countParams)
    ]);
    res.json({
      data: dataResult.rows,
      pagination: { page: pageNum, limit: limitNum, total: parseInt(countResult.rows[0].count), totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limitNum) }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/alerts/paginated - Paginated alerts
 */
app.get('/api/alerts/paginated', authenticateToken, async (req, res) => {
  try {
    const { query: q, countQuery, params, countParams, pageNum, limitNum } = buildListQuery(
      'alerts',
      'SELECT a.*, c.name as customer_name, c.company FROM alerts a JOIN customers c ON a.customer_id = c.id',
      req,
      ['c.name', 'c.company', 'a.alert_type', 'a.severity']
    );
    const [dataResult, countResult] = await Promise.all([
      pool.query(q, params),
      pool.query(countQuery, countParams)
    ]);
    res.json({
      data: dataResult.rows,
      pagination: { page: pageNum, limit: limitNum, total: parseInt(countResult.rows[0].count), totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limitNum) }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// === Custom Views (4 new features) - mounted before 404 handler ===
app.use('/api/custom-views', require('./routes/customViews'));

// ============ GLOBAL ERROR HANDLER ============
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Security: Helmet enabled, Rate limiting active, Input sanitization on`);
});


// === Batch 01 Gaps & Frontend Mounts ===
app.use('/api/gap-no-production-ml-model-wiring-predictions-stored-a', require('./routes/gap_no_production_ml_model_wiring_predictions_stored_a'));
app.use('/api/gap-no-automated-clustering-segment-discovery', require('./routes/gap_no_automated_clustering_segment_discovery'));
app.use('/api/gap-no-ai-win-back-message-variant-generator-linked-to', require('./routes/gap_no_ai_win_back_message_variant_generator_linked_to'));
app.use('/api/gap-no-streaming-feature-usage-signal-analyzer', require('./routes/gap_no_streaming_feature_usage_signal_analyzer'));
app.use('/api/gap-codebase-not-modularized-into-route-files-maintain', require('./routes/gap_codebase_not_modularized_into_route_files_maintain'));
app.use('/api/gap-no-webhook-outbound-api', require('./routes/gap_no_webhook_outbound_api'));
app.use('/api/gap-no-data-ingest-pipeline-from-crm-billing-systems', require('./routes/gap_no_data_ingest_pipeline_from_crm_billing_systems'));
app.use('/api/gap-no-notification-delivery-channel-alerts-table-only', require('./routes/gap_no_notification_delivery_channel_alerts_table_only'));
app.use('/api/gap-no-campaign-playbook-orchestration-ui', require('./routes/gap_no_campaign_playbook_orchestration_ui'));

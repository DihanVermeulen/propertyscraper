const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// Import routes
const propertiesRouter = require('./routes/properties');
const rentalPropertiesRouter = require('./routes/rentalProperties');
const scraperRouter = require('./routes/scraper');
const usersRouter = require('./routes/users');
const yieldCalculatorRouter = require('./routes/yieldCalculator');

// Import and initialize scheduler
// const Scheduler = require('./services/Scheduler');
// const scheduler = new Scheduler();

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000', // Next.js default port
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 200 // For legacy browser support
}));
app.use(compression());
app.use(morgan('combined'));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Handle preflight OPTIONS requests
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Initialize scheduler
if (process.env.NODE_ENV !== 'test') {
    // scheduler.init();
    console.log('🕒 Scheduler initialized');
}

// API routes
app.use('/api/users', usersRouter);
app.use('/api', propertiesRouter);
app.use('/api', rentalPropertiesRouter);
app.use('/api/scraper', scraperRouter);
app.use('/api/yield-calculator', yieldCalculatorRouter);

// CORS debug endpoint
app.get('/api/cors-test', (req, res) => {
    res.json({
        message: 'CORS is working!',
        origin: req.get('Origin'),
        headers: req.headers,
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    res.status(err.status || 500).json({
        error: err.message,
        ...(isDevelopment && { stack: err.stack })
    });
});

module.exports = app;

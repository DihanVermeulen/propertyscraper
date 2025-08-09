var createError = require('http-errors');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

// Import routes
const propertiesRouter = require('./routes/properties');
const scraperRouter = require('./routes/scraper');

// Import and initialize scheduler
const Scheduler = require('./services/Scheduler');
const scheduler = new Scheduler();

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
    // origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true
}));
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize scheduler
if (process.env.NODE_ENV !== 'test') {
    scheduler.init();
    console.log('🕒 Scheduler initialized');
}

// API routes
app.use('/api', propertiesRouter);
app.use('/api/scraper', scraperRouter);

// Scheduler control endpoints
app.get('/api/scheduler/status', (req, res) => {
    try {
        const status = scheduler.getJobStatus();
        res.json({
            enabled: scheduler.isEnabled,
            jobs: status
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/scheduler/enable', (req, res) => {
    try {
        scheduler.setEnabled(true);
        res.json({ message: 'Scheduler enabled', enabled: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/scheduler/disable', (req, res) => {
    try {
        scheduler.setEnabled(false);
        res.json({ message: 'Scheduler disabled', enabled: false });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/scheduler/jobs/:name/schedule', (req, res) => {
    try {
        const { name } = req.params;
        const { cronExpression } = req.body;
        
        const success = scheduler.updateJobSchedule(name, cronExpression);
        if (success) {
            res.json({ message: `Job '${name}' schedule updated`, cronExpression });
        } else {
            res.status(404).json({ error: `Job '${name}' not found` });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    const schedulerStatus = scheduler.getJobStatus();
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        scheduler: {
            enabled: scheduler.isEnabled,
            activeJobs: schedulerStatus.length
        }
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

// Graceful shutdown handling
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    scheduler.shutdown();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    scheduler.shutdown();
    process.exit(0);
});

// Make scheduler available to other modules
app.scheduler = scheduler;

module.exports = app;

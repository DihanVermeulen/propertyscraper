# Database Migrations

This document describes the database migration system implemented for the Property Scraper API.

## Overview

The migration system provides a robust way to:
- Version control database schema changes
- Apply and rollback database changes safely
- Track migration history and status
- Ensure consistency across different environments

## Architecture

### Components

1. **MigrationManager** (`db/migrations.js`) - Core migration logic
2. **MigrationCLI** (`scripts/migrate.js`) - Command-line interface
3. **DatabaseInitializer** (`db/initialize.js`) - App startup integration
4. **Migration Files** (`migrations/`) - Individual migration scripts

### Migration Tracking

Migrations are tracked in the `schema_migrations` table:
- `version` - Unique migration identifier (timestamp + name)
- `name` - Human-readable migration name
- `applied_at` - When the migration was applied
- `checksum` - File content checksum for integrity
- `execution_time_ms` - How long the migration took
- `success` - Whether migration succeeded
- `error_message` - Error details if migration failed

## Usage

### CLI Commands

#### Run Pending Migrations
```bash
npm run migrate
# or
node scripts/migrate.js migrate
```

#### Check Migration Status
```bash
npm run migrate:status
# or
node scripts/migrate.js status
```

#### Rollback Migrations
```bash
npm run migrate:rollback
# Rollback last migration

npm run migrate:rollback 3
# Rollback last 3 migrations

node scripts/migrate.js rollback 5
# Rollback last 5 migrations
```

#### Create New Migration
```bash
npm run migrate:create add_user_notifications
# or
node scripts/migrate.js create add_user_notifications
```

#### Reset All Migrations (⚠️ Dangerous)
```bash
npm run migrate:reset
# or  
node scripts/migrate.js reset
```

### Programmatic Usage

```javascript
const MigrationManager = require('./db/migrations');

const manager = new MigrationManager();

// Run all pending migrations
await manager.migrate();

// Check status
const pending = await manager.getPendingMigrations();
const applied = await manager.getAppliedMigrations();

// Rollback
await manager.rollback(2);
```

## Migration Files

### File Naming Convention

Migration files must follow this naming pattern:
```
YYYYMMDD_HHMMSS_description.js
```

Examples:
- `20250106_102527_normalize_sources.js`
- `20250106_102600_add_user_preferences.js`
- `20250106_103000_add_property_images_table.js`

### File Structure

Each migration file must export `up` and `down` functions:

```javascript
/**
 * Migration: Description
 * Created: 2025-01-06T10:25:27.000Z
 */

/**
 * Apply the migration
 * @param {Object} database - Database instance
 */
async function up(database) {
    await database.run(`
        CREATE TABLE example (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL
        )
    `);
    
    console.log('✅ Example table created');
}

/**
 * Rollback the migration  
 * @param {Object} database - Database instance
 */
async function down(database) {
    await database.run('DROP TABLE IF EXISTS example');
    console.log('✅ Example table dropped');
}

module.exports = {
    up,
    down
};
```

### Database API

The `database` parameter provides these methods:

- `database.run(sql, params)` - Execute INSERT, UPDATE, DELETE
- `database.query(sql, params)` - Execute SELECT, return all rows
- `database.get(sql, params)` - Execute SELECT, return single row

All methods return promises and support parameterized queries.

## Best Practices

### 1. Always Write Reversible Migrations

Every migration should have a corresponding rollback:

```javascript
// ✅ Good - Reversible
async function up(database) {
    await database.run('ALTER TABLE users ADD COLUMN phone TEXT');
}

async function down(database) {
    await database.run('ALTER TABLE users DROP COLUMN phone');
}

// ❌ Bad - No rollback
async function down(database) {
    throw new Error('Cannot rollback this migration');
}
```

### 2. Use Transactions for Complex Changes

Wrap related changes in transactions:

```javascript
async function up(database) {
    await database.run('BEGIN TRANSACTION');
    
    try {
        await database.run('CREATE TABLE temp_table (...)');
        await database.run('INSERT INTO temp_table SELECT ...');
        await database.run('DROP TABLE old_table');
        await database.run('ALTER TABLE temp_table RENAME TO old_table');
        
        await database.run('COMMIT');
    } catch (error) {
        await database.run('ROLLBACK');
        throw error;
    }
}
```

### 3. Handle Conditional Changes

Check for existing schema elements:

```javascript
async function up(database) {
    // Check if column exists before adding
    const columns = await database.query(
        "PRAGMA table_info(users)"
    );
    
    const hasPhoneColumn = columns.some(col => col.name === 'phone');
    
    if (!hasPhoneColumn) {
        await database.run('ALTER TABLE users ADD COLUMN phone TEXT');
    }
}
```

### 4. Add Proper Indexes

Don't forget to add indexes for performance:

```javascript
async function up(database) {
    await database.run('CREATE TABLE user_logs (...)');
    
    // Add indexes for common queries
    await database.run(
        'CREATE INDEX idx_user_logs_user_id ON user_logs(user_id)'
    );
    await database.run(
        'CREATE INDEX idx_user_logs_created_at ON user_logs(created_at)'
    );
}
```

### 5. Test Your Migrations

Always test both up and down migrations:

```bash
# Apply migration
npm run migrate

# Verify it worked
npm run migrate:status

# Test rollback
npm run migrate:rollback

# Verify rollback worked
npm run migrate:status

# Re-apply
npm run migrate
```

## Integration with App Startup

### Automatic Migrations (Optional)

You can enable automatic migrations on app startup by setting an environment variable:

```bash
AUTO_MIGRATE=true npm start
```

Or modify your app initialization:

```javascript
const DatabaseInitializer = require('./db/initialize');

const initializer = new DatabaseInitializer();

// Enable auto-migration in development
const autoMigrate = process.env.AUTO_MIGRATE === 'true' 
    || process.env.NODE_ENV === 'development';

await initializer.initialize(autoMigrate);
```

### Health Check Integration

Add migration status to your health check endpoint:

```javascript
app.get('/health', async (req, res) => {
    const dbStatus = await initializer.getStatus();
    
    res.json({
        status: 'OK',
        database: dbStatus,
        timestamp: new Date().toISOString()
    });
});
```

## Troubleshooting

### Failed Migration

If a migration fails:

1. Check the error message in the console
2. Review the failed migration in `schema_migrations` table
3. Fix the issue in the migration file
4. Manually clean up any partial changes
5. Re-run the migration

### Rollback Issues

If rollback fails:

1. Check if the `down` function is properly implemented
2. Verify the migration file still exists
3. Manually reverse changes if needed
4. Clean up the `schema_migrations` table entry

### Schema Conflicts

If you encounter schema conflicts:

1. Create a new migration to resolve conflicts
2. Don't modify existing migration files that have been applied
3. Use conditional logic to handle optional changes

## Production Considerations

### Backup Before Migrations

Always backup your database before running migrations in production:

```bash
# SQLite backup
cp database.db database_backup_$(date +%Y%m%d_%H%M%S).db

# Run migrations
npm run migrate
```

### Deployment Strategy

1. **Blue-Green Deployments**: Run migrations on the new environment
2. **Rolling Updates**: Ensure migrations are backward compatible
3. **Maintenance Windows**: Schedule breaking changes during maintenance

### Monitoring

Monitor migration execution:

- Log migration times
- Alert on failed migrations
- Track database schema drift
- Monitor performance impact

## Examples

See the `migrations/` directory for examples:

- `20250106_102527_normalize_sources.js` - Data normalization
- `20250106_102600_add_user_preferences.js` - New table creation

## Support

For questions or issues:

1. Check this documentation
2. Review existing migration files
3. Test migrations in development first
4. Create detailed error reports with logs

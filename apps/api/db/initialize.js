const MigrationManager = require('./migrations');

/**
 * Initialize database and optionally run migrations on app startup
 */
class DatabaseInitializer {
    constructor() {
        this.migrationManager = new MigrationManager();
    }

    /**
     * Initialize database with optional auto-migration
     * @param {boolean} autoMigrate - Whether to automatically run pending migrations
     * @param {boolean} silent - Whether to suppress console output
     */
    async initialize(autoMigrate = false, silent = false) {
        const log = silent ? () => {} : console.log;

        try {
            // Initialize migration tracking table
            await this.migrationManager.initializeMigrationTable();
            
            if (autoMigrate) {
                log('🔄 Auto-migration enabled, checking for pending migrations...');
                
                const pending = await this.migrationManager.getPendingMigrations();
                
                if (pending.length > 0) {
                    log(`📋 Found ${pending.length} pending migration(s), applying automatically...`);
                    const result = await this.migrationManager.migrate();
                    log(`✅ Applied ${result.applied} migration(s) successfully`);
                } else {
                    log('📋 No pending migrations found, database is up to date');
                }
            } else {
                // Just check status
                const pending = await this.migrationManager.getPendingMigrations();
                if (pending.length > 0) {
                    log(`⚠️  Database has ${pending.length} pending migration(s)`);
                    log('   Run "npm run migrate" to apply them');
                }
            }

        } catch (error) {
            console.error('❌ Database initialization failed:', error.message);
            throw error;
        }
    }

    /**
     * Get migration status for health checks
     */
    async getStatus() {
        try {
            await this.migrationManager.initializeMigrationTable();
            
            const applied = await this.migrationManager.getAppliedMigrations();
            const pending = await this.migrationManager.getPendingMigrations();
            
            return {
                applied: applied.filter(m => m.success).length,
                pending: pending.length,
                failed: applied.filter(m => !m.success).length,
                lastMigration: applied.length > 0 ? applied[applied.length - 1] : null
            };
        } catch (error) {
            return {
                error: error.message
            };
        }
    }
}

module.exports = DatabaseInitializer;

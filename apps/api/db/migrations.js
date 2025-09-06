const fs = require('fs').promises;
const path = require('path');
const database = require('./database');

class MigrationManager {
    constructor() {
        this.migrationDir = path.join(__dirname, '..', 'migrations');
        this.migrationTable = 'schema_migrations';
    }

    /**
     * Initialize the migrations table to track applied migrations
     */
    async initializeMigrationTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS ${this.migrationTable} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                version TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                checksum TEXT,
                execution_time_ms INTEGER,
                success BOOLEAN DEFAULT TRUE,
                error_message TEXT
            )
        `;
        
        await database.run(sql);
        console.log(`✅ Migration table '${this.migrationTable}' initialized`);
    }

    /**
     * Get list of applied migrations from database
     */
    async getAppliedMigrations() {
        try {
            const migrations = await database.query(
                `SELECT version, name, applied_at, success FROM ${this.migrationTable} ORDER BY applied_at`
            );
            return migrations;
        } catch (error) {
            if (error.message.includes('no such table')) {
                return [];
            }
            throw error;
        }
    }

    /**
     * Get list of available migration files
     */
    async getAvailableMigrations() {
        try {
            const files = await fs.readdir(this.migrationDir);
            const migrationFiles = files
                .filter(file => file.endsWith('.js') && /^\d{8}_\d{6}_/.test(file))
                .sort()
                .map(file => {
                    const [timestamp, name] = file.replace('.js', '').split('_').slice(0, -1).join('_').split('_');
                    const version = `${timestamp}_${name}`;
                    return {
                        version,
                        filename: file,
                        filepath: path.join(this.migrationDir, file),
                        name: file.replace(/^\d{8}_\d{6}_/, '').replace('.js', '')
                    };
                });
            return migrationFiles;
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log(`📁 Migration directory '${this.migrationDir}' doesn't exist. Creating it...`);
                await fs.mkdir(this.migrationDir, { recursive: true });
                return [];
            }
            throw error;
        }
    }

    /**
     * Get pending migrations that haven't been applied
     */
    async getPendingMigrations() {
        const available = await this.getAvailableMigrations();
        const applied = await this.getAppliedMigrations();
        const appliedVersions = new Set(applied.map(m => m.version));
        
        return available.filter(migration => !appliedVersions.has(migration.version));
    }

    /**
     * Calculate checksum for migration file content
     */
    async calculateChecksum(filepath) {
        const crypto = require('crypto');
        const content = await fs.readFile(filepath, 'utf8');
        return crypto.createHash('md5').update(content).digest('hex');
    }

    /**
     * Run a single migration
     */
    async runMigration(migration) {
        const startTime = Date.now();
        
        try {
            console.log(`🔄 Running migration: ${migration.name} (${migration.version})`);
            
            // Load migration module
            delete require.cache[require.resolve(migration.filepath)];
            const migrationModule = require(migration.filepath);
            
            if (typeof migrationModule.up !== 'function') {
                throw new Error(`Migration ${migration.name} doesn't export an 'up' function`);
            }

            // Calculate checksum
            const checksum = await this.calculateChecksum(migration.filepath);

            // Execute migration within a transaction
            await database.run('BEGIN TRANSACTION');
            
            try {
                await migrationModule.up(database);
                
                // Record successful migration
                const executionTime = Date.now() - startTime;
                await database.run(
                    `INSERT INTO ${this.migrationTable} (version, name, checksum, execution_time_ms, success) VALUES (?, ?, ?, ?, ?)`,
                    [migration.version, migration.name, checksum, executionTime, true]
                );
                
                await database.run('COMMIT');
                console.log(`✅ Migration ${migration.name} applied successfully (${executionTime}ms)`);
                
            } catch (migrationError) {
                await database.run('ROLLBACK');
                throw migrationError;
            }
            
        } catch (error) {
            const executionTime = Date.now() - startTime;
            
            // Record failed migration
            try {
                await database.run(
                    `INSERT INTO ${this.migrationTable} (version, name, execution_time_ms, success, error_message) VALUES (?, ?, ?, ?, ?)`,
                    [migration.version, migration.name, executionTime, false, error.message]
                );
            } catch (recordError) {
                console.error('❌ Failed to record migration failure:', recordError.message);
            }
            
            console.error(`❌ Migration ${migration.name} failed:`, error.message);
            throw error;
        }
    }

    /**
     * Rollback a migration
     */
    async rollbackMigration(migration) {
        const startTime = Date.now();
        
        try {
            console.log(`🔄 Rolling back migration: ${migration.name} (${migration.version})`);
            
            // Load migration module
            delete require.cache[require.resolve(migration.filepath)];
            const migrationModule = require(migration.filepath);
            
            if (typeof migrationModule.down !== 'function') {
                throw new Error(`Migration ${migration.name} doesn't export a 'down' function`);
            }

            // Execute rollback within a transaction
            await database.run('BEGIN TRANSACTION');
            
            try {
                await migrationModule.down(database);
                
                // Remove migration record
                await database.run(
                    `DELETE FROM ${this.migrationTable} WHERE version = ?`,
                    [migration.version]
                );
                
                await database.run('COMMIT');
                
                const executionTime = Date.now() - startTime;
                console.log(`✅ Migration ${migration.name} rolled back successfully (${executionTime}ms)`);
                
            } catch (rollbackError) {
                await database.run('ROLLBACK');
                throw rollbackError;
            }
            
        } catch (error) {
            console.error(`❌ Rollback of migration ${migration.name} failed:`, error.message);
            throw error;
        }
    }

    /**
     * Run all pending migrations
     */
    async migrate() {
        await this.initializeMigrationTable();
        
        const pending = await this.getPendingMigrations();
        
        if (pending.length === 0) {
            console.log('📋 No pending migrations to run');
            return { applied: 0, skipped: 0 };
        }

        console.log(`📋 Found ${pending.length} pending migration(s)`);
        
        let appliedCount = 0;
        for (const migration of pending) {
            await this.runMigration(migration);
            appliedCount++;
        }
        
        console.log(`🎉 Applied ${appliedCount} migration(s) successfully`);
        return { applied: appliedCount, skipped: 0 };
    }

    /**
     * Rollback the last N migrations
     */
    async rollback(count = 1) {
        await this.initializeMigrationTable();
        
        const applied = await this.getAppliedMigrations();
        const toRollback = applied
            .filter(m => m.success)
            .slice(-count)
            .reverse();

        if (toRollback.length === 0) {
            console.log('📋 No migrations to rollback');
            return { rolledBack: 0 };
        }

        console.log(`📋 Rolling back ${toRollback.length} migration(s)`);
        
        const available = await this.getAvailableMigrations();
        const availableMap = new Map(available.map(m => [m.version, m]));
        
        let rolledBackCount = 0;
        for (const applied of toRollback) {
            const migration = availableMap.get(applied.version);
            if (migration) {
                await this.rollbackMigration(migration);
                rolledBackCount++;
            } else {
                console.warn(`⚠️  Migration file not found for version: ${applied.version}`);
            }
        }
        
        console.log(`🎉 Rolled back ${rolledBackCount} migration(s) successfully`);
        return { rolledBack: rolledBackCount };
    }

    /**
     * Show migration status
     */
    async status() {
        await this.initializeMigrationTable();
        
        const available = await this.getAvailableMigrations();
        const applied = await this.getAppliedMigrations();
        const appliedMap = new Map(applied.map(m => [m.version, m]));

        console.log('\n📊 Migration Status:');
        console.log('==================');
        
        if (available.length === 0) {
            console.log('No migration files found');
            return;
        }

        available.forEach(migration => {
            const appliedInfo = appliedMap.get(migration.version);
            if (appliedInfo) {
                const status = appliedInfo.success ? '✅' : '❌';
                const date = new Date(appliedInfo.applied_at).toLocaleString();
                console.log(`${status} ${migration.version} - ${migration.name} (applied: ${date})`);
            } else {
                console.log(`⏳ ${migration.version} - ${migration.name} (pending)`);
            }
        });

        const pendingCount = available.length - applied.filter(m => m.success).length;
        console.log(`\n📈 Total: ${available.length} migrations, ${applied.filter(m => m.success).length} applied, ${pendingCount} pending`);
    }

    /**
     * Create a new migration file
     */
    async createMigration(name) {
        if (!name) {
            throw new Error('Migration name is required');
        }

        const timestamp = new Date().toISOString()
            .replace(/[-:]/g, '')
            .replace(/T/, '_')
            .split('.')[0];
        
        const filename = `${timestamp}_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.js`;
        const filepath = path.join(this.migrationDir, filename);

        const template = `/**
 * Migration: ${name}
 * Created: ${new Date().toISOString()}
 */

/**
 * Run the migration
 * @param {Object} database - Database instance
 */
async function up(database) {
    // Add your migration logic here
    // Example:
    // await database.run(\`
    //     ALTER TABLE properties 
    //     ADD COLUMN new_field TEXT
    // \`);
    
    console.log('Migration ${name} - up: implemented');
}

/**
 * Rollback the migration
 * @param {Object} database - Database instance
 */
async function down(database) {
    // Add your rollback logic here
    // Example:
    // await database.run(\`
    //     ALTER TABLE properties 
    //     DROP COLUMN new_field
    // \`);
    
    console.log('Migration ${name} - down: implemented');
}

module.exports = {
    up,
    down
};
`;

        await fs.writeFile(filepath, template);
        console.log(`📝 Created migration file: ${filename}`);
        
        return {
            filename,
            filepath,
            version: `${timestamp}_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
        };
    }
}

module.exports = MigrationManager;

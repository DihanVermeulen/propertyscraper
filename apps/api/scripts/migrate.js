#!/usr/bin/env node

const MigrationManager = require('../db/migrations');
const path = require('path');

/**
 * CLI tool for managing database migrations
 * 
 * Usage:
 *   node migrate.js migrate            - Run all pending migrations
 *   node migrate.js rollback [count]   - Rollback last N migrations (default: 1)
 *   node migrate.js status             - Show migration status
 *   node migrate.js create <name>      - Create a new migration file
 *   node migrate.js help               - Show help
 */

class MigrationCLI {
    constructor() {
        this.manager = new MigrationManager();
    }

    async run() {
        const args = process.argv.slice(2);
        const command = args[0];

        try {
            switch (command) {
                case 'migrate':
                case 'up':
                    await this.migrate();
                    break;
                
                case 'rollback':
                case 'down':
                    const count = parseInt(args[1]) || 1;
                    await this.rollback(count);
                    break;
                
                case 'status':
                    await this.status();
                    break;
                
                case 'create':
                    const name = args[1];
                    await this.create(name);
                    break;
                
                case 'reset':
                    await this.reset();
                    break;
                
                case 'help':
                case '--help':
                case '-h':
                default:
                    this.showHelp();
                    break;
            }
        } catch (error) {
            console.error('❌ Migration command failed:', error.message);
            process.exit(1);
        }
    }

    async migrate() {
        console.log('🚀 Starting database migration...');
        const result = await this.manager.migrate();
        
        if (result.applied > 0) {
            console.log(`\n🎉 Successfully applied ${result.applied} migration(s)`);
        } else {
            console.log('\n📋 Database is up to date');
        }
        
        process.exit(0);
    }

    async rollback(count) {
        console.log(`🔄 Rolling back ${count} migration(s)...`);
        const result = await this.manager.rollback(count);
        
        if (result.rolledBack > 0) {
            console.log(`\n🎉 Successfully rolled back ${result.rolledBack} migration(s)`);
        } else {
            console.log('\n📋 No migrations to rollback');
        }
        
        process.exit(0);
    }

    async status() {
        await this.manager.status();
        process.exit(0);
    }

    async create(name) {
        if (!name) {
            console.error('❌ Migration name is required');
            console.log('Usage: node migrate.js create <migration_name>');
            process.exit(1);
        }

        console.log(`📝 Creating new migration: ${name}...`);
        const migration = await this.manager.createMigration(name);
        
        console.log(`\n✅ Migration created successfully:`);
        console.log(`   File: ${migration.filename}`);
        console.log(`   Version: ${migration.version}`);
        console.log(`\nEdit the file and then run 'node migrate.js migrate' to apply it.`);
        
        process.exit(0);
    }

    async reset() {
        console.log('⚠️  WARNING: This will rollback ALL migrations!');
        console.log('Are you sure? This action cannot be undone.');
        console.log('Type "yes" to confirm:');
        
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question('', async (answer) => {
            rl.close();
            
            if (answer.toLowerCase() === 'yes') {
                try {
                    const applied = await this.manager.getAppliedMigrations();
                    const successfulCount = applied.filter(m => m.success).length;
                    
                    if (successfulCount > 0) {
                        console.log(`🔄 Rolling back ${successfulCount} migration(s)...`);
                        await this.manager.rollback(successfulCount);
                        console.log('🎉 Database reset complete');
                    } else {
                        console.log('📋 No migrations to rollback');
                    }
                } catch (error) {
                    console.error('❌ Reset failed:', error.message);
                    process.exit(1);
                }
            } else {
                console.log('📋 Reset cancelled');
            }
            
            process.exit(0);
        });
    }

    showHelp() {
        console.log(`
📚 Database Migration CLI

Usage:
  node migrate.js <command> [options]

Commands:
  migrate, up              Run all pending migrations
  rollback, down [count]   Rollback last N migrations (default: 1)
  status                   Show migration status
  create <name>            Create a new migration file
  reset                    Rollback ALL migrations (dangerous!)
  help                     Show this help message

Examples:
  node migrate.js migrate              # Run all pending migrations
  node migrate.js rollback             # Rollback last migration
  node migrate.js rollback 3           # Rollback last 3 migrations
  node migrate.js status               # Show migration status
  node migrate.js create add_user_preferences  # Create new migration
  node migrate.js reset                # Reset all migrations (careful!)

Migration File Naming:
  Migrations are automatically named with timestamp: YYYYMMDD_HHMMSS_<name>.js
  This ensures proper ordering and prevents conflicts.

Migration File Structure:
  Each migration file should export 'up' and 'down' functions:
  
  async function up(database) {
    // Apply changes
    await database.run('ALTER TABLE ...');
  }
  
  async function down(database) {
    // Rollback changes
    await database.run('DROP TABLE ...');
  }

🔗 For more information, see the project documentation.
`);
    }
}

// Run CLI if this file is executed directly
if (require.main === module) {
    const cli = new MigrationCLI();
    cli.run();
}

module.exports = MigrationCLI;

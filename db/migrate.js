const { Sequelize } = require('sequelize');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const sequelize = new Sequelize({
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    host: process.env.DB_HOST,
    port: 5432,
    dialect: 'postgres',
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false
        }
    }
});

async function migrate() {
    try {
        // Test connection
        await sequelize.authenticate();
        console.log('Database connection established.');

        // Import models
        const models = require('../models');

        // Sync all models
        await sequelize.sync({ alter: true });
        console.log('Database schema updated.');

        // Insert default achievements if they don't exist
        const achievements = [
            {
                name: 'First Victory',
                description: 'Win your first game',
                icon: '🏆',
                condition: 'wins',
                threshold: 1
            },
            {
                name: 'Winning Streak',
                description: 'Win 3 games in a row',
                icon: '🔥',
                condition: 'streak',
                threshold: 3
            },
            {
                name: 'Veteran Player',
                description: 'Play 10 games',
                icon: '⭐',
                condition: 'games',
                threshold: 10
            },
            {
                name: 'Perfect Game',
                description: 'Win without letting opponent make a move',
                icon: '👑',
                condition: 'perfect',
                threshold: 1
            },
            {
                name: 'Master Tactician',
                description: 'Win 5 games using diagonal victories',
                icon: '🎯',
                condition: 'diagonal_wins',
                threshold: 5
            },
            {
                name: 'Speed Demon',
                description: 'Win a game in under 10 seconds',
                icon: '⚡',
                condition: 'fast_win',
                threshold: 1
            },
            {
                name: 'Comeback King',
                description: 'Win after being one move away from losing',
                icon: '👑',
                condition: 'comeback',
                threshold: 1
            },
            {
                name: 'Social Butterfly',
                description: 'Play with 5 different opponents',
                icon: '🦋',
                condition: 'unique_opponents',
                threshold: 5
            }
        ];

        for (const achievement of achievements) {
            await models.Achievement.findOrCreate({
                where: { name: achievement.name },
                defaults: achievement
            });
        }
        console.log('Default achievements created.');

        // Create session table
        const sessionTableSQL = `
            CREATE TABLE IF NOT EXISTS "session" (
                "sid" varchar NOT NULL COLLATE "default",
                "sess" json NOT NULL,
                "expire" timestamp(6) NOT NULL,
                CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
            );
            CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session"("expire");
        `;
        await sequelize.query(sessionTableSQL);
        console.log('Session table created.');

        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

// Add rollback function
async function rollback() {
    try {
        await sequelize.authenticate();
        console.log('Database connection established for rollback.');

        // Drop all tables
        await sequelize.drop();
        console.log('All tables dropped.');

        console.log('Rollback completed successfully.');
    } catch (error) {
        console.error('Rollback failed:', error);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

// Check if rollback flag is passed
if (process.argv.includes('--rollback')) {
    rollback();
} else {
    migrate();
} 
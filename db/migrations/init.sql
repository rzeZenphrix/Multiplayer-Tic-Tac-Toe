-- Create UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS "Users" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    "gamesPlayed" INTEGER DEFAULT 0,
    "gamesWon" INTEGER DEFAULT 0,
    "winStreak" INTEGER DEFAULT 0,
    "currentStreak" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Achievements table
CREATE TABLE IF NOT EXISTS "Achievements" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    icon VARCHAR(255) NOT NULL,
    condition VARCHAR(50) NOT NULL CHECK (condition IN ('wins', 'streak', 'games', 'perfect', 'diagonal_wins', 'fast_win', 'comeback', 'unique_opponents')),
    threshold INTEGER NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Games table
CREATE TABLE IF NOT EXISTS "Games" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID REFERENCES "Users"(id) ON DELETE CASCADE,
    result VARCHAR(10) NOT NULL CHECK (result IN ('win', 'loss', 'draw')),
    opponent VARCHAR(255) NOT NULL,
    moves JSONB DEFAULT '[]'::jsonb,
    mode VARCHAR(20) DEFAULT 'classic' CHECK (mode IN ('classic', 'bestOf3', 'bestOf5', 'timed')),
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- User Achievements junction table
CREATE TABLE IF NOT EXISTS "UserAchievements" (
    "userId" UUID REFERENCES "Users"(id) ON DELETE CASCADE,
    "achievementId" UUID REFERENCES "Achievements"(id) ON DELETE CASCADE,
    "unlockedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("userId", "achievementId")
);

-- Sessions table for express-session with connect-pg-simple
CREATE TABLE IF NOT EXISTS "session" (
    "sid" varchar NOT NULL COLLATE "default",
    "sess" json NOT NULL,
    "expire" timestamp(6) NOT NULL,
    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "IDX_user_username" ON "Users"(username);
CREATE INDEX IF NOT EXISTS "IDX_user_email" ON "Users"(email);
CREATE INDEX IF NOT EXISTS "IDX_games_userId" ON "Games"("userId");
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session"("expire");

-- Insert default achievements
INSERT INTO "Achievements" (name, description, icon, condition, threshold)
VALUES 
    ('First Victory', 'Win your first game', '🏆', 'wins', 1),
    ('Winning Streak', 'Win 3 games in a row', '🔥', 'streak', 3),
    ('Veteran Player', 'Play 10 games', '⭐', 'games', 10),
    ('Perfect Game', 'Win without letting opponent make a move', '👑', 'perfect', 1),
    ('Master Tactician', 'Win 5 games using diagonal victories', '🎯', 'diagonal_wins', 5),
    ('Speed Demon', 'Win a game in under 10 seconds', '⚡', 'fast_win', 1),
    ('Comeback King', 'Win after being one move away from losing', '👑', 'comeback', 1),
    ('Social Butterfly', 'Play with 5 different opponents', '🦋', 'unique_opponents', 5)
ON CONFLICT (name) DO NOTHING; 
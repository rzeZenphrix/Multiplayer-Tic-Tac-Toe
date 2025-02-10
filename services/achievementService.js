const { User, Achievement, Game } = require('../models');
const logger = require('../utils/logger');

class AchievementService {
    static async checkAchievements(userId, gameResult) {
        try {
            const user = await User.findByPk(userId, {
                include: [Achievement, Game]
            });

            const achievements = await Achievement.findAll();
            const newAchievements = [];

            for (const achievement of achievements) {
                if (!user.Achievements.find(a => a.id === achievement.id)) {
                    const unlocked = await this.checkAchievementCondition(user, achievement, gameResult);
                    if (unlocked) {
                        await user.addAchievement(achievement);
                        newAchievements.push(achievement);
                    }
                }
            }

            return newAchievements;
        } catch (error) {
            logger.error('Error checking achievements:', error);
            throw error;
        }
    }

    static async checkAchievementCondition(user, achievement, gameResult) {
        switch (achievement.condition) {
            case 'wins':
                return user.gamesWon >= achievement.threshold;
            case 'streak':
                return user.winStreak >= achievement.threshold;
            case 'games':
                return user.gamesPlayed >= achievement.threshold;
            case 'perfect':
                return gameResult.moves.length <= 5 && gameResult.result === 'win';
            case 'diagonal_wins':
                return await this.checkDiagonalWins(user, achievement.threshold);
            case 'fast_win':
                return gameResult.result === 'win' && 
                       (gameResult.moves[gameResult.moves.length - 1].timestamp - 
                        gameResult.moves[0].timestamp) <= 10000;
            default:
                return false;
        }
    }
}

module.exports = AchievementService; 
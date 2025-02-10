const express = require('express');
const router = express.Router();
const { User, Game } = require('../models');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

router.get('/user/:userId/stats', async (req, res, next) => {
    try {
        const user = await User.findByPk(req.params.userId, {
            include: [Game]
        });

        if (!user) {
            throw new AppError('User not found', 404);
        }

        const stats = {
            gamesPlayed: user.gamesPlayed,
            gamesWon: user.gamesWon,
            winRate: (user.gamesWon / user.gamesPlayed * 100) || 0,
            currentStreak: user.currentStreak,
            bestStreak: user.winStreak,
            recentGames: await Game.findAll({
                where: { userId: user.id },
                order: [['createdAt', 'DESC']],
                limit: 5
            })
        };

        res.json(stats);
    } catch (error) {
        logger.error('Error fetching user stats:', error);
        next(error);
    }
});

module.exports = router; 
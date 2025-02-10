const { Game } = require('../models');
const logger = require('../utils/logger');

class GameReplayService {
    static async getGameReplay(gameId) {
        try {
            const game = await Game.findByPk(gameId);
            if (!game) {
                throw new Error('Game not found');
            }

            return {
                moves: game.moves,
                mode: game.mode,
                result: game.result,
                timestamp: game.createdAt
            };
        } catch (error) {
            logger.error('Error fetching game replay:', error);
            throw error;
        }
    }

    static async saveGameMove(gameId, move) {
        try {
            const game = await Game.findByPk(gameId);
            if (!game) {
                throw new Error('Game not found');
            }

            game.moves = [...game.moves, { ...move, timestamp: new Date() }];
            await game.save();
            return game;
        } catch (error) {
            logger.error('Error saving game move:', error);
            throw error;
        }
    }
}

module.exports = GameReplayService; 
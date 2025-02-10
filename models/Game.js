const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Game = sequelize.define('Game', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        result: {
            type: DataTypes.ENUM('win', 'loss', 'draw'),
            allowNull: false
        },
        opponent: {
            type: DataTypes.STRING,
            allowNull: false
        },
        moves: {
            type: DataTypes.JSONB,
            defaultValue: []
        },
        mode: {
            type: DataTypes.ENUM('classic', 'bestOf3', 'bestOf5', 'timed'),
            defaultValue: 'classic'
        }
    });

    return Game;
}; 
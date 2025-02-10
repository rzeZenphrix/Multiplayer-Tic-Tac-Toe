const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Achievement = sequelize.define('Achievement', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: false
        },
        description: {
            type: DataTypes.STRING,
            allowNull: false
        },
        icon: {
            type: DataTypes.STRING,
            allowNull: false
        },
        condition: {
            type: DataTypes.ENUM('wins', 'streak', 'games', 'perfect', 'diagonal_wins', 'fast_win', 'comeback', 'unique_opponents'),
            allowNull: false
        },
        threshold: {
            type: DataTypes.INTEGER,
            allowNull: false
        }
    });

    return Achievement;
}; 
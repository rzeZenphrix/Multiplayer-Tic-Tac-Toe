const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const UserAchievement = sequelize.define('UserAchievement', {
        unlockedAt: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    });

    return UserAchievement;
}; 
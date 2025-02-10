const { Sequelize } = require('sequelize');
const config = require('../config/database');

const sequelize = new Sequelize(config.database, config.username, config.password, {
    host: config.host,
    dialect: 'postgres',
    logging: false
});

const User = require('./User')(sequelize);
const Achievement = require('./Achievement')(sequelize);
const Game = require('./Game')(sequelize);
const UserAchievement = require('./UserAchievement')(sequelize);

// Define relationships
User.hasMany(Game);
Game.belongsTo(User);

User.belongsToMany(Achievement, { through: UserAchievement });
Achievement.belongsToMany(User, { through: UserAchievement });

module.exports = {
    sequelize,
    User,
    Achievement,
    Game,
    UserAchievement
}; 
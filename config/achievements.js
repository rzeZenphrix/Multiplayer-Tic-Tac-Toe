module.exports = [
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
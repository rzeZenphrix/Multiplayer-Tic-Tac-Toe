const express = require('express');
const { Server } = require('ws');
const path = require('path');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');
const Achievement = require('./models/Achievement');
const defaultAchievements = require('./config/achievements');
require('dotenv').config();

// Add MongoDB connection
const mongoose = require('mongoose');
const dbConfig = {
    host: process.env.DB_HOST,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    dialectOptions: process.env.NODE_ENV === 'production' ? {
        ssl: {
            require: true,
            rejectUnauthorized: false
        }
    } : {}
};

// Add rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});

const app = express();
const port = process.env.PORT || 8080;

// Add CORS headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Add session management
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost/tictactoe' }),
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Start HTTP server
const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

// Create WebSocket server with ping-pong to keep connection alive
const wss = new Server({ server });

const rooms = new Map();
const waitingPlayers = [];

wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => {
        ws.isAlive = true;
    });

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        
        switch(data.type) {
            case 'create_room':
                handleCreateRoom(ws);
                break;
            case 'join_room':
                handleJoinRoom(ws, data.room);
                break;
            case 'move':
                handleMove(ws, data);
                break;
            case 'restart':
                handleRestart(data.room);
                break;
            case 'leave_room':
                handleLeaveRoom(ws, data);
                break;
            case 'quick_play':
                handleQuickPlay(ws);
                break;
            case 'set_game_mode':
                handleSetGameMode(ws, data);
                break;
            case 'forfeit':
                handleForfeit(ws, data);
                break;
        }
    });

    ws.on('close', () => {
        const waitingIndex = waitingPlayers.indexOf(ws);
        if (waitingIndex !== -1) {
            waitingPlayers.splice(waitingIndex, 1);
        }
        
        for (const [roomCode, room] of rooms.entries()) {
            const playerIndex = room.players.indexOf(ws);
            if (playerIndex !== -1) {
                handleLeaveRoom(ws, { room: roomCode });
                cleanupRoom(roomCode);
                break;
            }
        }
    });
});

// Add ping interval to keep connections alive
setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

function handleCreateRoom(ws) {
    const roomCode = generateRoomCode();
    rooms.set(roomCode, {
        players: [ws],
        gameState: Array(9).fill('')
    });
    
    ws.send(JSON.stringify({
        type: 'room_created',
        room: roomCode
    }));
}

function handleJoinRoom(ws, roomCode) {
    const room = rooms.get(roomCode);
    if (room && room.players.length < 2) {
        room.players.push(ws);
        
        // Notify the joining player
        ws.send(JSON.stringify({
            type: 'room_joined',
            room: roomCode
        }));
        
        // Notify the existing player that someone joined
        room.players[0].send(JSON.stringify({
            type: 'player_joined',
            message: 'Player O has joined the game!'
        }));
    }
}

function handleLeaveRoom(ws, data) {
    const room = rooms.get(data.room);
    if (room) {
        const playerIndex = room.players.indexOf(ws);
        room.players.splice(playerIndex, 1);
        
        // Notify remaining player
        if (room.players.length > 0) {
            room.players[0].send(JSON.stringify({
                type: 'player_left',
                message: `Player ${playerIndex === 0 ? 'X' : 'O'} has left the game`
            }));
        }
    }
}

function handleMove(ws, data) {
    const room = rooms.get(data.room);
    if (room) {
        room.gameState[data.index] = data.player;
        room.moves = room.moves || [];
        room.moves.push({
            position: data.index,
            player: data.player,
            timestamp: new Date()
        });

        // Check for game end
        if (checkWin(room.gameState, data.player)) {
            const winner = room.players.find(p => p === ws);
            if (winner && winner.userId) {
                updateUserStats(winner.userId, 'win', room.moves);
                checkAchievements(winner.userId);
            }
        }

        room.players.forEach(player => {
            if (player !== ws) {
                player.send(JSON.stringify({
                    type: 'move',
                    index: data.index,
                    player: data.player,
                    isFirstMove: room.moves.length === 1
                }));
            }
        });
    }
}

function handleRestart(roomCode) {
    const room = rooms.get(roomCode);
    if (room) {
        room.gameState = Array(9).fill('');
        room.players.forEach(player => {
            player.send(JSON.stringify({
                type: 'game_state',
                state: room.gameState
            }));
        });
    }
}

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function cleanupRoom(roomCode) {
    const room = rooms.get(roomCode);
    if (room && room.players.length === 0) {
        rooms.delete(roomCode);
    }
}

function handleQuickPlay(ws) {
    if (waitingPlayers.length > 0) {
        // Match with waiting player
        const opponent = waitingPlayers.shift();
        const roomCode = generateRoomCode();
        
        // Create new room with both players
        rooms.set(roomCode, {
            players: [opponent, ws],
            gameState: Array(9).fill(''),
            mode: 'classic',
            scores: { X: 0, O: 0 },
            roundNumber: 1,
            moves: []
        });
        
        // Notify first player (X)
        opponent.send(JSON.stringify({
            type: 'quick_match_found',
            room: roomCode,
            symbol: 'X'
        }));
        
        // Notify second player (O)
        ws.send(JSON.stringify({
            type: 'quick_match_found',
            room: roomCode,
            symbol: 'O'
        }));
    } else {
        // Add to waiting queue
        waitingPlayers.push(ws);
        ws.send(JSON.stringify({
            type: 'waiting_for_match'
        }));
    }
}

// Add authentication middleware
const authMiddleware = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
};

// Add authentication routes
app.post('/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ username, email, password: hashedPassword });
        await user.save();
        res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ error: 'User not found' });
        }
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid password' });
        }
        req.session.userId = user._id;
        res.json({ message: 'Logged in successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.get('/auth/status', (req, res) => {
    res.json({ authenticated: !!req.session.userId });
});

app.get('/auth/profile', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        res.json(user);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logged out successfully' });
});

// Initialize achievements
async function initializeAchievements() {
    try {
        const count = await Achievement.countDocuments();
        if (count === 0) {
            await Achievement.insertMany(defaultAchievements);
        }
    } catch (error) {
        console.error('Failed to initialize achievements:', error);
    }
}

initializeAchievements();

// Add achievement check function
async function checkAchievements(userId) {
    try {
        const user = await User.findById(userId);
        const achievements = await Achievement.find();
        const newAchievements = [];

        for (const achievement of achievements) {
            const alreadyUnlocked = user.achievements.some(a => a.name === achievement.name);
            if (!alreadyUnlocked) {
                let unlocked = false;
                switch (achievement.condition) {
                    case 'wins':
                        unlocked = user.stats.gamesWon >= achievement.threshold;
                        break;
                    case 'streak':
                        unlocked = user.stats.winStreak >= achievement.threshold;
                        break;
                    case 'games':
                        unlocked = user.stats.gamesPlayed >= achievement.threshold;
                        break;
                    case 'perfect':
                        // Check game history for perfect games
                        const perfectGames = user.gameHistory.filter(game => 
                            game.result === 'win' && game.moves.length <= 5
                        ).length;
                        unlocked = perfectGames >= achievement.threshold;
                        break;
                }

                if (unlocked) {
                    user.achievements.push({
                        name: achievement.name,
                        unlockedAt: new Date()
                    });
                    newAchievements.push(achievement);
                }
            }
        }

        if (newAchievements.length > 0) {
            await user.save();
            return newAchievements;
        }
        return [];
    } catch (error) {
        console.error('Failed to check achievements:', error);
        return [];
    }
}

// Add user stats update function
async function updateUserStats(userId, result, moves) {
    try {
        const user = await User.findById(userId);
        user.stats.gamesPlayed++;
        
        if (result === 'win') {
            user.stats.gamesWon++;
            user.stats.currentStreak++;
            user.stats.winStreak = Math.max(user.stats.winStreak, user.stats.currentStreak);
        } else {
            user.stats.currentStreak = 0;
        }

        user.gameHistory.push({
            result,
            moves,
            date: new Date()
        });

        await user.save();
    } catch (error) {
        console.error('Failed to update user stats:', error);
    }
}

// Add handler for game mode setting
function handleSetGameMode(ws, data) {
    const room = rooms.get(data.room);
    if (room) {
        room.mode = data.mode;
        room.players.forEach(player => {
            player.send(JSON.stringify({
                type: 'mode_updated',
                mode: data.mode
            }));
        });
    }
}

// Add forfeit handler
function handleForfeit(ws, data) {
    const room = rooms.get(data.room);
    if (room) {
        const winner = room.players.find(p => p !== ws);
        room.players.forEach(player => {
            player.send(JSON.stringify({
                type: 'game_end',
                result: player === winner ? 'win' : 'forfeit'
            }));
        });
    }
}

// Add health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Add proper error handling for WebSocket
wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
}); 
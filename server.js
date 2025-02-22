const express = require('express');
const { Server } = require('ws');
const path = require('path');

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
        room.players.forEach(player => {
            if (player !== ws) {
                // Add first move notification for X's first move
                const isFirstMove = room.gameState.filter(cell => cell !== '').length === 1;
                player.send(JSON.stringify({
                    type: 'move',
                    index: data.index,
                    player: data.player,
                    isFirstMove
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
            gameState: Array(9).fill('')
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
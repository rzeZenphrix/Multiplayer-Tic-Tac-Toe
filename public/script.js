const board = document.getElementById('board');
const cells = document.querySelectorAll('[data-cell]');
const currentPlayerText = document.getElementById('currentPlayer');
const messageElement = document.getElementById('message');
const restartButton = document.getElementById('restartButton');

let currentPlayer = 'X';
let gameActive = true;
let gameState = ['', '', '', '', '', '', '', '', ''];

const winningCombinations = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6] // Diagonals
];

// Update WebSocket connection to use relative URL and secure connection
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = window.location.hostname === 'localhost' 
    ? `${protocol}//localhost:8080`
    : `${protocol}//${window.location.host}`;
const ws = new WebSocket(wsUrl);

// Add room management variables
let roomCode = null;
let playerSymbol = null;
let isMyTurn = false;

// Get new DOM elements
const roomControls = document.getElementById('roomControls');
const roomInfo = document.getElementById('roomInfo');
const roomCodeDisplay = document.getElementById('roomCode');
const playerSymbolDisplay = document.getElementById('playerSymbol');
const roomInput = document.getElementById('roomInput');
const createRoomBtn = document.getElementById('createRoom');
const joinRoomBtn = document.getElementById('joinRoom');
const leaveRoomBtn = document.getElementById('leaveRoom');

// Add at the top with other variables
const connectionStatus = document.createElement('div');
connectionStatus.id = 'connectionStatus';
const moveSound = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU...'); // Add base64 move sound
const winSound = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU...'); // Add base64 win sound

// Add after other DOM elements
document.querySelector('.container').prepend(connectionStatus);

// Add WebSocket connection handling
ws.onopen = () => {
    connectionStatus.textContent = '🟢 Connected';
    connectionStatus.className = 'connected';
};

ws.onclose = () => {
    connectionStatus.textContent = '🔴 Disconnected - Please refresh';
    connectionStatus.className = 'disconnected';
    gameActive = false;
};

ws.onerror = () => {
    connectionStatus.textContent = '⚠️ Connection Error';
    connectionStatus.className = 'error';
    gameActive = false;
};

function handleCellClick(e) {
    const cell = e.target;
    const cellIndex = Array.from(cells).indexOf(cell);

    if (gameState[cellIndex] !== '' || !gameActive || !isMyTurn) return;

    // Update local game state immediately
    gameState[cellIndex] = playerSymbol;
    cell.textContent = playerSymbol;
    
    // Send move to server
    ws.send(JSON.stringify({
        type: 'move',
        room: roomCode,
        index: cellIndex,
        player: playerSymbol
    }));

    // Check for win or draw first
    if (checkWin()) {
        gameActive = false;
        messageElement.textContent = 'You win!';
        messageElement.classList.remove('waiting', 'loading');
        winSound.play().catch(() => {});
        return;
    }

    if (checkDraw()) {
        gameActive = false;
        messageElement.textContent = "It's a draw!";
        messageElement.classList.remove('waiting', 'loading');
        return;
    }

    // Only update turn and display if game is still active
    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    currentPlayerText.textContent = currentPlayer;
    isMyTurn = false;
    messageElement.textContent = `Waiting for ${currentPlayer}'s move...`;
    messageElement.classList.add('waiting', 'loading');
    moveSound.play().catch(() => {});
}

function checkWin() {
    return winningCombinations.some(combination => {
        return combination.every(index => {
            return gameState[index] === currentPlayer;
        });
    });
}

function checkDraw() {
    return gameState.every(cell => cell !== '');
}

function restartGame() {
    ws.send(JSON.stringify({
        type: 'restart',
        room: roomCode
    }));
}

// Add WebSocket message handling
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    switch(data.type) {
        case 'room_created':
            handleRoomCreated(data);
            break;
        case 'room_joined':
            handleRoomJoined(data);
            break;
        case 'move':
            handleRemoteMove(data);
            break;
        case 'game_state':
            handleGameState(data);
            break;
        case 'error':
            handleError(data);
            break;
        case 'opponent_disconnected':
            messageElement.textContent = 'Opponent disconnected. Waiting for new player...';
            messageElement.classList.add('waiting', 'loading');
            gameActive = false;
            break;
        case 'player_joined':
            handlePlayerJoined(data);
            break;
        case 'player_left':
            handlePlayerLeft(data);
            break;
        case 'waiting_for_match':
            messageElement.textContent = 'Waiting for opponent...';
            messageElement.classList.add('waiting', 'loading');
            break;
        case 'quick_match_found':
            handleQuickMatch(data);
            break;
    }
};

function handleRoomCreated(data) {
    roomCode = data.room;
    playerSymbol = 'X';
    isMyTurn = true;
    showGameBoard();
    createRoomBtn.disabled = false;
    createRoomBtn.textContent = 'Create Room';
    messageElement.textContent = 'Waiting for opponent to join';
    messageElement.classList.add('waiting', 'loading');
}

function handleRoomJoined(data) {
    roomCode = data.room;
    playerSymbol = 'O';
    isMyTurn = false;
    showGameBoard();
    joinRoomBtn.disabled = false;
    joinRoomBtn.textContent = 'Join Room';
    messageElement.textContent = "Waiting for X to play...";
    messageElement.classList.add('waiting', 'loading');
}

function handleRemoteMove(data) {
    const { index, player, isFirstMove } = data;
    gameState[index] = player;
    cells[index].textContent = player;
    
    if (isFirstMove) {
        showNotification('Player X has made the first move!', 'info');
    }
    
    if (checkWin()) {
        gameActive = false;
        messageElement.textContent = 'You lost!';
        messageElement.classList.remove('waiting', 'loading');
        winSound.play().catch(() => {});
        return;
    }

    if (checkDraw()) {
        gameActive = false;
        messageElement.textContent = "It's a draw!";
        messageElement.classList.remove('waiting', 'loading');
        return;
    }

    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    currentPlayerText.textContent = currentPlayer;
    isMyTurn = currentPlayer === playerSymbol;
    
    if (isMyTurn) {
        messageElement.textContent = "It's your turn!";
        messageElement.classList.remove('waiting', 'loading');
    } else {
        messageElement.textContent = `Waiting for ${currentPlayer}'s move...`;
        messageElement.classList.add('waiting', 'loading');
    }

    moveSound.play().catch(() => {});
}

function showGameBoard() {
    quickPlayControls.style.display = 'none';
    roomControls.style.display = 'none';
    roomInfo.style.display = 'block';
    roomCodeDisplay.textContent = roomCode;
    playerSymbolDisplay.textContent = playerSymbol;
    
    // Add copy button next to room code
    const copyButton = document.createElement('button');
    copyButton.textContent = '📋 Copy';
    copyButton.className = 'copyButton';
    copyButton.onclick = () => {
        navigator.clipboard.writeText(roomCode)
            .then(() => {
                copyButton.textContent = '✓ Copied!';
                setTimeout(() => {
                    copyButton.textContent = '📋 Copy';
                }, 2000);
            });
    };
    roomCodeDisplay.parentElement.appendChild(copyButton);
}

// Add room management event listeners
createRoomBtn.addEventListener('click', () => {
    createRoomBtn.disabled = true;
    createRoomBtn.textContent = 'Creating...';
    ws.send(JSON.stringify({
        type: 'create_room'
    }));
});

joinRoomBtn.addEventListener('click', () => {
    const room = roomInput.value.trim();
    if (room) {
        joinRoomBtn.disabled = true;
        joinRoomBtn.textContent = 'Joining...';
        ws.send(JSON.stringify({
            type: 'join_room',
            room: room
        }));
    }
});

cells.forEach(cell => {
    cell.addEventListener('click', handleCellClick);
});

restartButton.addEventListener('click', restartGame);

function handleGameState(data) {
    // Reset game state
    gameState = data.state;
    gameActive = true;
    currentPlayer = 'X';
    isMyTurn = playerSymbol === 'X';
    currentPlayerText.textContent = currentPlayer;
    
    // Set appropriate message based on player and turn
    if (isMyTurn) {
        messageElement.textContent = "It's your turn!";
    } else {
        messageElement.textContent = "Waiting for X to play...";
    }
    
    // Clear all cells
    cells.forEach(cell => {
        cell.textContent = '';
    });
}

function handleError(data) {
    messageElement.textContent = data.message;
    messageElement.style.color = '#e74c3c';
    
    // Reset buttons
    joinRoomBtn.disabled = false;
    joinRoomBtn.textContent = 'Join Room';
    createRoomBtn.disabled = false;
    createRoomBtn.textContent = 'Create Room';
    
    // Clear input
    roomInput.value = '';
    
    setTimeout(() => {
        messageElement.textContent = '';
        messageElement.style.color = 'inherit';
    }, 3000);
}

// Add leave room functionality
leaveRoomBtn.addEventListener('click', () => {
    ws.send(JSON.stringify({
        type: 'leave_room',
        room: roomCode
    }));
    resetGame();
});

function resetGame() {
    roomCode = null;
    playerSymbol = null;
    isMyTurn = false;
    gameActive = true;
    gameState = ['', '', '', '', '', '', '', '', ''];
    currentPlayer = 'X';
    
    // Reset UI
    roomControls.style.display = 'block';
    roomInfo.style.display = 'none';
    messageElement.textContent = '';
    messageElement.classList.remove('waiting', 'loading');
    currentPlayerText.textContent = 'X';
    cells.forEach(cell => {
        cell.textContent = '';
    });
    
    // Show quick play controls
    quickPlayControls.style.display = 'block';
    quickPlayBtn.disabled = false;
    quickPlayBtn.textContent = 'Quick Play';
}

// Add keyboard support for room input
roomInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinRoomBtn.click();
    }
});

// Add keyboard support for game
document.addEventListener('keydown', (e) => {
    if (!gameActive || !isMyTurn) return;
    
    const key = e.key;
    const keyToIndex = {
        '1': 6, '2': 7, '3': 8,
        '4': 3, '5': 4, '6': 5,
        '7': 0, '8': 1, '9': 2
    };
    
    if (key in keyToIndex) {
        const index = keyToIndex[key];
        if (gameState[index] === '') {
            cells[index].click();
        }
    }
});

// Add new handler functions
function handlePlayerJoined(data) {
    showNotification(data.message, 'success');
    // Clear the waiting message if we're player X
    if (playerSymbol === 'X') {
        messageElement.textContent = "Game started! It's your turn!";
        messageElement.classList.remove('waiting', 'loading');
    } else if (playerSymbol === 'O') {
        messageElement.textContent = "Waiting for X to play...";
        messageElement.classList.add('waiting', 'loading');
    }
}

function handlePlayerLeft(data) {
    showNotification(data.message, 'warning');
    messageElement.textContent = 'Opponent left. Waiting for new player...';
    gameActive = false;
    messageElement.classList.add('waiting', 'loading');
}

// Add notification function
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.querySelector('.container').appendChild(notification);
    
    // Remove notification after animation
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 500);
    }, 3000);
}

// Add new DOM elements
const quickPlayBtn = document.getElementById('quickPlayBtn');
const quickPlayControls = document.getElementById('quickPlayControls');

// Add quick play button handler
quickPlayBtn.addEventListener('click', () => {
    quickPlayBtn.disabled = true;
    quickPlayBtn.textContent = 'Finding Match...';
    ws.send(JSON.stringify({
        type: 'quick_play'
    }));
});

// Add new handler function
function handleQuickMatch(data) {
    roomCode = data.room;
    playerSymbol = data.symbol;
    isMyTurn = playerSymbol === 'X';
    
    showGameBoard();
    quickPlayBtn.disabled = false;
    quickPlayBtn.textContent = 'Quick Play';
    
    if (isMyTurn) {
        messageElement.textContent = "Game started! It's your turn!";
        messageElement.classList.remove('waiting', 'loading');
    } else {
        messageElement.textContent = "Waiting for X to play...";
        messageElement.classList.add('waiting', 'loading');
    }
    
    showNotification('Match found!', 'success');
} 
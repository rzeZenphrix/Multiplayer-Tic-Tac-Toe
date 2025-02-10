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
let currentGameMode = 'classic';
let isAuthenticated = false;
let currentUser = null;

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
        case 'achievement_unlocked':
            data.achievements.forEach(achievement => {
                showAchievementUnlock(achievement);
            });
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
    if (data.isFirstMove && playerSymbol === 'O') {
        isMyTurn = true;
        messageElement.textContent = "Your turn!";
        messageElement.classList.remove('waiting', 'loading');
    }

    const cell = cells[data.index];
    cell.textContent = data.player;
    cell.classList.add(data.player.toLowerCase());
    gameState[data.index] = data.player;
    moveSound.play();

    // Start timer if it's timed mode and my turn
    if (currentGameMode === 'timed' && isMyTurn) {
        startTimer();
    }
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
    gameState = Array(9).fill('');
    gameActive = true;
    cells.forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('x', 'o');
    });

    if (playerSymbol === 'X') {
        isMyTurn = true;
        messageElement.textContent = "Your turn!";
    } else {
        isMyTurn = false;
        messageElement.textContent = "Waiting for X to play...";
    }

    // Handle timed mode reset
    if (currentGameMode === 'timed') {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        if (isMyTurn) {
            startTimer();
        }
    }
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
    
    // Add game mode to match data
    ws.send(JSON.stringify({
        type: 'set_game_mode',
        room: roomCode,
        mode: currentGameMode
    }));
}

// Add share functionality
function share(platform) {
    const url = 'https://multiplayer-tic-tac-toe-nkee.onrender.com/';
    const text = 'Play Tic Tac Toe with me!';
    
    const shareUrls = {
        twitter: `https://twitter.com/intent/tweet?url=${url}&text=${text}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
        whatsapp: `https://wa.me/?text=${text} ${url}`
    };
    
    window.open(shareUrls[platform], '_blank');
}

// Add authentication functions
async function login(username, password) {
    try {
        const response = await fetch('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (response.ok) {
            isAuthenticated = true;
            currentUser = await fetchUserProfile();
            updateUIForAuthenticatedUser();
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function register(username, email, password) {
    try {
        const response = await fetch('/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        const data = await response.json();
        if (response.ok) {
            showNotification('Registration successful! Please login.', 'success');
            switchAuthTab('login');
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// Add game mode variables
let gameScores = { X: 0, O: 0 };
let roundNumber = 1;
let timerInterval = null;
let timeLeft = 30;

// Update game mode handling
function handleGameModeSelection(mode) {
    currentGameMode = mode;
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    
    // Reset game state for new mode
    resetGame();
    gameScores = { X: 0, O: 0 };
    roundNumber = 1;
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    updateGameModeUI();
}

function updateGameModeUI() {
    const modeDisplay = document.getElementById('modeDisplay') || document.createElement('div');
    modeDisplay.id = 'modeDisplay';
    
    let modeText = `Mode: ${currentGameMode.charAt(0).toUpperCase() + currentGameMode.slice(1)}`;
    if (currentGameMode === 'bestOf3' || currentGameMode === 'bestOf5') {
        modeText += ` (Round ${roundNumber})`;
        modeText += ` - Score: X:${gameScores.X} O:${gameScores.O}`;
    }
    
    modeDisplay.textContent = modeText;
    document.getElementById('playerInfo').appendChild(modeDisplay);
    
    if (currentGameMode === 'timed' && isMyTurn) {
        startTimer();
    }
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timeLeft = 30;
    
    const timerDisplay = document.getElementById('timerDisplay') || document.createElement('div');
    timerDisplay.id = 'timerDisplay';
    document.getElementById('playerInfo').appendChild(timerDisplay);
    
    timerInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = `Time left: ${timeLeft}s`;
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            handleTimeOut();
        }
    }, 1000);
}

function handleTimeOut() {
    if (isMyTurn) {
        // Make a random move if possible
        const emptyCells = gameState.reduce((acc, cell, index) => {
            if (cell === '') acc.push(index);
            return acc;
        }, []);
        
        if (emptyCells.length > 0) {
            const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            handleCellClick(cells[randomCell]);
        } else {
            // Forfeit if no moves available
            ws.send(JSON.stringify({
                type: 'forfeit',
                room: roomCode
            }));
        }
    }
}

function handleWin(winner) {
    gameActive = false;
    if (currentGameMode === 'bestOf3' || currentGameMode === 'bestOf5') {
        gameScores[winner]++;
        const maxWins = currentGameMode === 'bestOf3' ? 2 : 3;
        
        if (gameScores[winner] >= maxWins) {
            messageElement.textContent = `Player ${winner} wins the series!`;
            // Reset scores for next game
            gameScores = { X: 0, O: 0 };
            roundNumber = 1;
        } else {
            messageElement.textContent = `Player ${winner} wins round ${roundNumber}!`;
            roundNumber++;
            // Auto-restart for next round
            setTimeout(resetGame, 2000);
        }
    } else {
        messageElement.textContent = `Player ${winner} wins!`;
    }
    
    updateGameModeUI();
}

// Add authentication event handlers
document.addEventListener('DOMContentLoaded', () => {
    // Auth tab switching
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            switchAuthTab(tab.dataset.tab);
        });
    });

    // Form submissions
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        await login(formData.get('username'), formData.get('password'));
    });

    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        await register(
            formData.get('username'),
            formData.get('email'),
            formData.get('password')
        );
    });

    // Logout handler
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Game mode selection
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => handleGameModeSelection(btn.dataset.mode));
    });

    // Check authentication status on load
    checkAuthStatus();
});

// Add authentication helper functions
function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tab);
    });
    document.getElementById('loginForm').style.display = tab === 'login' ? 'flex' : 'none';
    document.getElementById('registerForm').style.display = tab === 'register' ? 'flex' : 'none';
}

async function checkAuthStatus() {
    try {
        const response = await fetch('/auth/status');
        const data = await response.json();
        if (data.authenticated) {
            isAuthenticated = true;
            currentUser = await fetchUserProfile();
            updateUIForAuthenticatedUser();
        } else {
            showAuthModal();
        }
    } catch (error) {
        console.error('Auth status check failed:', error);
    }
}

async function fetchUserProfile() {
    const response = await fetch('/auth/profile');
    return response.json();
}

function updateUIForAuthenticatedUser() {
    document.getElementById('authModal').style.display = 'none';
    document.getElementById('userProfile').style.display = 'block';
    document.getElementById('username').textContent = currentUser.username;
    document.getElementById('gamesPlayed').textContent = currentUser.stats.gamesPlayed;
    document.getElementById('gamesWon').textContent = currentUser.stats.gamesWon;
    document.getElementById('winStreak').textContent = currentUser.stats.winStreak;
    
    updateGameHistory();
    updateAchievementDisplay();
}

async function logout() {
    try {
        await fetch('/auth/logout', { method: 'POST' });
        isAuthenticated = false;
        currentUser = null;
        document.getElementById('userProfile').style.display = 'none';
        showAuthModal();
    } catch (error) {
        showNotification('Logout failed', 'error');
    }
}

function showAuthModal() {
    document.getElementById('authModal').style.display = 'block';
    switchAuthTab('login');
}

// Add achievement notification function
function showAchievementUnlock(achievement) {
    const notification = document.createElement('div');
    notification.className = 'achievement-unlock';
    notification.innerHTML = `
        <div class="achievement-icon">${achievement.icon}</div>
        <div class="achievement-info">
            <h3>${achievement.name}</h3>
            <p>${achievement.description}</p>
        </div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 500);
        }, 3000);
    }, 100);
}

// Add game history functions
function updateGameHistory() {
    const historyList = document.querySelector('.history-list');
    historyList.innerHTML = '';
    
    currentUser.gameHistory.slice(0, 10).forEach(game => {
        const entry = document.createElement('div');
        entry.className = `game-entry ${game.result}`;
        
        const date = new Date(game.date);
        const timeAgo = getTimeAgo(date);
        
        entry.innerHTML = `
            <div class="game-result ${game.result}">${game.result.toUpperCase()}</div>
            <div class="game-details">
                vs ${game.opponent} • ${timeAgo}
            </div>
        `;
        
        historyList.appendChild(entry);
    });
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60
    };
    
    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
        }
    }
    
    return 'Just now';
}

// Add achievement display functions
function updateAchievementDisplay() {
    const achievementGrid = document.querySelector('.achievement-grid');
    achievementGrid.innerHTML = '';
    
    achievements.forEach(achievement => {
        const isUnlocked = currentUser.achievements.some(a => a.name === achievement.name);
        
        const card = document.createElement('div');
        card.className = `achievement-card ${isUnlocked ? 'unlocked' : 'locked'}`;
        
        card.innerHTML = `
            <div class="icon">${achievement.icon}</div>
            <div class="name">${achievement.name}</div>
            <div class="description">${achievement.description}</div>
        `;
        
        achievementGrid.appendChild(card);
    });
}

// Add filter handlers
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const filter = btn.dataset.filter;
        const entries = document.querySelectorAll('.game-entry');
        
        entries.forEach(entry => {
            if (filter === 'all' || entry.classList.contains(filter)) {
                entry.style.display = 'flex';
            } else {
                entry.style.display = 'none';
            }
        });
    });
}); 
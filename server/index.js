require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const gameManager = require('./games/gameManager');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: [
            'https://ranked-rps-client.vercel.app',
            'http://localhost:3000'
        ],
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: false
    },
    path: "/socket.io/",
    serveClient: false,
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 30000,
    agent: false,
    cookie: false,
    rejectUnauthorized: false
});

// Add this near the top after creating the app
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// CORS Configuration
app.use(cors({
    origin: [
        'https://ranked-rps-client.vercel.app',
        'http://localhost:3000'
    ],
    credentials: false,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
    res.header('Content-Type', 'application/json');
    console.log('Request:', {
        method: req.method,
        path: req.path,
        body: req.body
    });
    next();
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
}).then(() => {
    // Add more detailed connection logging
    const connection = mongoose.connection;
    console.log('Connected to MongoDB');
    console.log('Database name:', connection.name);
    console.log('Host:', connection.host);
    console.log('Port:', connection.port);
}).catch(err => {
    console.error('MongoDB connection error:', err);
});

// Add connection error handling
mongoose.connection.on('error', err => {
    console.error('MongoDB error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
    console.log('MongoDB reconnected');
});

// User Schema
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    credits: { type: Number, default: 100 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    winsBO3: { type: Number, default: 0 },
    winsBO5: { type: Number, default: 0 },
    lossesBO3: { type: Number, default: 0 },
    lossesBO5: { type: Number, default: 0 },
    skins: { type: Array, default: [] }
});

const User = mongoose.model('User', UserSchema);

// Game Logic
const activeGames = {};
const gameRounds = {};
const scores = {};
const gameStarted = {};
const gameScores = {};

// Add game state tracking
let waitingPlayer = null;
const games = new Map();

// Add user tracking
const connectedUsers = new Map(); // Map to track username -> socketId
const userSockets = new Map();    // Map to track socketId -> username

// Fix the evaluateRound function with correct RPS rules
// Update evaluateRound with reversed RPS rules
function evaluateRound(choice1, choice2) {
  const validChoices = ['rock', 'paper', 'scissors'];
  if (!validChoices.includes(choice1) || !validChoices.includes(choice2)) {
    console.error('Invalid choice detected:', { choice1, choice2 });
    return 0;
  }

  if (choice1 === choice2) return 0;

  // Reversed RPS rules 
  const rules = {
    rock: { beats: 'scissors', losesTo: 'paper' },
    paper: { beats: 'rock', losesTo: 'scissors' },
    scissors: { beats: 'paper', losesTo: 'rock' }
  };

  return rules[choice1].beats === choice2 ? 1 : -1;
}

// Socket Connection
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Add authentication handler
    socket.on('authenticate', ({ username }) => {
        if (username) {
            // Store both mappings
            connectedUsers.set(username, socket.id);
            userSockets.set(socket.id, username);
            console.log(`🔑 User ${username} authenticated with socket ${socket.id}`);
        }
    });

    socket.on('findMatch', ({ ranked, rounds }) => {
        const username = userSockets.get(socket.id);
        console.log('🔍 Player looking for match:', username || socket.id);

        if (!username) {
            socket.emit('matchmaking', 'Error: Please login to play');
            return;
        }

        if (waitingPlayer === socket.id) {
            console.log('⚠️ Player already in queue');
            return;
        }

        const waitingPlayerUsername = userSockets.get(waitingPlayer);
        if (waitingPlayerUsername === username) {
            console.log('⚠️ User trying to match with themselves');
            socket.emit('matchmaking', 'Error: Cannot match with yourself');
            return;
        }

        if (waitingPlayer && waitingPlayer !== socket.id) {
            const gameId = Date.now().toString();
            console.log(`✨ Creating match between ${username} and ${waitingPlayerUsername}`);

            games.set(gameId, {
                players: [socket.id, waitingPlayer],
                rounds: rounds || 3,
                scores: { [socket.id]: 0, [waitingPlayer]: 0 },
                ranked: ranked // Add ranked flag to game
            });

            socket.join(gameId);
            io.sockets.sockets.get(waitingPlayer).join(gameId);
            io.to(gameId).emit('matchFound', { gameId });
            
            setTimeout(() => {
                io.to(gameId).emit('gameStart');
            }, 1000);

            waitingPlayer = null;
        } else {
            waitingPlayer = socket.id;
            socket.emit('matchmaking', 'Waiting for opponent...');
        }
    });

    socket.on('joinGame', ({ gameId, rounds, ranked }) => {
        console.log(`Player ${socket.id} joining game ${gameId}`);
        
        socket.join(gameId);
        
        if (!games.has(gameId)) {
            console.log('Creating new game room with rounds:', rounds);
            games.set(gameId, {
                players: [socket.id],
                rounds: rounds || 3,
                totalRounds: rounds || 3,
                scores: { [socket.id]: 0 },
                currentRound: null,
                ranked: ranked || false
            });
            
            // Notify creator they're waiting for opponent
            socket.emit('matchmaking', 'Waiting for opponent to join...');
            
        } else {
            const game = games.get(gameId);
            console.log('Second player joining game');
            
            if (game.players.includes(socket.id)) {
                console.log('Player already in game');
                return;
            }
            
            game.players.push(socket.id);
            game.scores[socket.id] = 0;
            
            if (game.players.length === 2) {
                console.log('Game starting with both players');
                
                // Notify both players of game start
                io.to(gameId).emit('matchmaking', 'Both players connected!');
                io.to(gameId).emit('gameStart');
                
                // Sync rounds count for both players
                io.to(gameId).emit('updateRounds', { rounds: game.rounds });
            }
        }
    });

    // Update the playRound handler
    socket.on('playRound', async ({ gameId, choice }) => {
        console.log(`Player ${socket.id} chose ${choice} in game ${gameId}`);
        const game = games.get(gameId);
        if (!game) return;

        if (!game.currentRound) {
            game.currentRound = { choices: {} };
        }

        game.currentRound.choices[socket.id] = choice;
        
        if (Object.keys(game.currentRound.choices).length === 2) {
            const [player1, player2] = game.players;
            const choice1 = game.currentRound.choices[player1];
            const choice2 = game.currentRound.choices[player2];
            const result = evaluateRound(choice1, choice2);
            
            // Update scores - in reversed rules, losing player gets the point
            if (result === 1) {
                game.scores[player2]++; // Player2 gets point when Player1 "wins"
            } else if (result === -1) {
                game.scores[player1]++; // Player1 gets point when Player2 "wins"
            }

            const gameOver = game.scores[player1] >= 2 || game.scores[player2] >= 2;
            
            if (gameOver) {
                // In reversed rules, the player with more points is actually the loser
                const loser = game.scores[player1] >= 2 ? player1 : player2;
                const winner = loser === player1 ? player2 : player1;
                
                try {
                    const winnerUsername = userSockets.get(winner);
                    const loserUsername = userSockets.get(loser);
                    
                    // Only update stats if it's a ranked game
                    if (game.ranked && winnerUsername && loserUsername) {
                        const updateType = game.rounds === 3 ? 'BO3' : 'BO5';
                        await User.findOneAndUpdate(
                            { username: winnerUsername },
                            { 
                                $inc: { 
                                    wins: 1,
                                    [`wins${updateType}`]: 1 
                                }
                            }
                        );
                        
                        // Only increment losses for ranked games
                        await User.findOneAndUpdate(
                            { username: loserUsername },
                            { 
                                $inc: { 
                                    losses: 1,
                                    [`losses${updateType}`]: 1 
                                }
                            }
                        );

                        const updatedLeaderboard = await User.find()
                            .select('username wins losses winsBO3 winsBO5 lossesBO3 lossesBO5 credits -_id')
                            .sort({ wins: -1 })
                            .limit(50);
                        io.emit('leaderboardUpdate', updatedLeaderboard);
                    }
                } catch (error) {
                    console.error('Error updating user stats:', error);
                }
            }

            // Send results to players with reversed win/loss messages
            io.to(player1).emit('roundResult', {
                result: result === 1 ? 'You Lose!' : result === -1 ? 'You Win!' : 'Draw!',
                player1Choice: choice1,
                player2Choice: choice2,
                playerScore: game.scores[player1],
                opponentScore: game.scores[player2],
                gameOver: gameOver,
                playerId: player1,
                requiredWins: 2 // Add required wins for multiplayer games
            });

            io.to(player2).emit('roundResult', {
                result: result === -1 ? 'You Lose!' : result === 1 ? 'You Win!' : 'Draw!',
                player1Choice: choice2,
                player2Choice: choice1,
                playerScore: game.scores[player2],
                opponentScore: game.scores[player1],
                gameOver: gameOver,
                playerId: player2,
                requiredWins: 2 // Add required wins for multiplayer games
            });

            game.currentRound = null;
        } else {
            socket.to(gameId).emit('opponentMadeChoice');
        }
    });

    socket.on('requestRematch', ({ gameId }) => {
        const game = gameManager.getGame(gameId);
        if (game) {
            const otherPlayer = game.players.find(id => id !== socket.id);
            if (otherPlayer) {
                io.to(otherPlayer).emit('rematchRequested');
            }
        }
    });

    socket.on('acceptRematch', ({ gameId }) => {
        gameManager.resetGame(io, gameId);
    });

    socket.on('disconnect', () => {
        const username = userSockets.get(socket.id);
        if (username) {
            connectedUsers.delete(username);
            userSockets.delete(socket.id);
        }
        gameManager.leaveGame(socket);
        if (waitingPlayer === socket.id) {
            waitingPlayer = null;
        }
    });

    socket.on('gameWon', async ({ userId, gameType, opponentId, isWinner }) => {
        try {
            const updateWinner = {
                $inc: { 
                    wins: 1,
                    [`wins${gameType.toUpperCase()}`]: 1
                }
            };
            
            const updateLoser = {
                $inc: { 
                    losses: 1,
                    [`losses${gameType.toUpperCase()}`]: 1
                }
            };

            // Update both players' stats
            if (isWinner) {
                await Promise.all([
                    User.findByIdAndUpdate(userId, updateWinner),
                    User.findByIdAndUpdate(opponentId, updateLoser)
                ]);
            } else {
                await Promise.all([
                    User.findByIdAndUpdate(userId, updateLoser),
                    User.findByIdAndUpdate(opponentId, updateWinner)
                ]);
            }

            const updatedLeaderboard = await User.find()
                .select('username wins losses winsBO3 winsBO5 lossesBO3 lossesBO5 credits -_id')
                .sort({ wins: -1 })
                .limit(50);
            io.emit('leaderboardUpdate', updatedLeaderboard);
        } catch (error) {
            console.error('Error updating wins/losses:', error);
        }
    });

    socket.on('findMatch', () => {
        console.log('🔍 Player looking for match:', socket.id);
    
        if (waitingPlayer && socket.id !== waitingPlayer) {
            const gameId = Date.now().toString();
            console.log('✨ Creating match between', socket.id, 'and', waitingPlayer);
    
            // Create game state and add both players to the room
            socket.join(gameId);
            io.sockets.sockets.get(waitingPlayer).join(gameId);

            games.set(gameId, {
                players: [socket.id, waitingPlayer],
                rounds: 3,
                scores: { [socket.id]: 0, [waitingPlayer]: 0 },
                currentRound: null
            });
    
            // Notify both players
            io.to(gameId).emit('matchFound', { gameId });
            
            setTimeout(() => {
                io.to(gameId).emit('gameStart');
            }, 1000);
    
            waitingPlayer = null;
        } else {
            waitingPlayer = socket.id;
            console.log('⌛ Added to waiting list:', socket.id);
            socket.emit('matchmaking', 'Waiting for opponent...');
        }
    });

    // Add this inside your socket connection handler
    socket.on('playAgain', ({ gameId }) => {
        const game = games.get(gameId);
        if (game) {
            // Reset game state
            game.scores = {};
            game.players.forEach(playerId => {
                game.scores[playerId] = 0;
            });
            game.currentRound = null;
            
            // Notify both players
            io.to(gameId).emit('gameReset');
        }
    });

    // Add this inside socket connection handler
    socket.on('playBot', async ({ wager = 0 } = {}) => {
        const username = userSockets.get(socket.id);
        if (!username) {
            socket.emit('matchmaking', 'Error: Please login to play');
            return;
        }

        try {
            // Check if user has enough credits for wager
            const user = await User.findOne({ username });
            if (!user) {
                socket.emit('matchmaking', 'Error: User not found');
                return;
            }

            if (user.credits < wager) {
                socket.emit('matchmaking', 'Error: Not enough credits for wager');
                return;
            }

            const gameId = `bot-${Date.now()}`;
            
            // Clear any existing bot game for this player
            for (const [existingGameId, game] of games.entries()) {
                if (game.isBot && game.players.includes(socket.id)) {
                    games.delete(existingGameId);
                }
            }
            
            games.set(gameId, {
                players: [socket.id, 'bot'],
                rounds: 3,
                scores: { [socket.id]: 0, bot: 0 },
                isBot: true,
                wager
            });

            socket.join(gameId);
            socket.emit('matchFound', { gameId, isBot: true });
            
            setTimeout(() => {
                socket.emit('gameStart');
            }, 1000);
        } catch (error) {
            console.error('Error starting bot game:', error);
            socket.emit('matchmaking', 'Error: Could not start game');
        }
    });

    // Inside socket connection handler, update the bot game handling
    socket.on('playRound', async ({ gameId, choice }) => {
        const game = games.get(gameId);
        if (!game) return;

        // Handle bot game
        if (game.isBot) {
            const botChoices = ['rock', 'paper', 'scissors'];
            const botChoice = botChoices[Math.floor(Math.random() * 3)];
            const result = evaluateRound(choice, botChoice);
            
            // Update scores - remember we're using reversed rules
            if (result === 1) {
                game.scores.bot++; // Bot gets point when player "wins"
            } else if (result === -1) {
                game.scores[socket.id]++; // Player gets point when they "lose"
            }

            const gameOver = game.scores[socket.id] >= 2 || game.scores.bot >= 2;
            
            if (gameOver) {
                // In reversed rules, the player with MORE points is actually the loser
                const playerWon = game.scores.bot >= 2; // Player wins when bot has more points
                const username = userSockets.get(socket.id);
                
                if (username && game.wager > 0) {
                    try {
                        // Calculate rewards/losses including wager
                        const wagerResult = playerWon ? game.wager * 2 : -game.wager;
                        const creditChange = playerWon ? wagerResult + 10 : wagerResult; // Add base 10 credits for winning

                        await User.findOneAndUpdate(
                            { username },
                            { $inc: { credits: creditChange } }
                        );
                        socket.emit('creditsUpdated', { amount: creditChange });
                    } catch (error) {
                        console.error('Error updating credits:', error);
                    }
                } else if (username && playerWon) {
                    // Handle base 10 credit reward for non-wagered games
                    try {
                        await User.findOneAndUpdate(
                            { username },
                            { $inc: { credits: 10 } }
                        );
                        socket.emit('creditsUpdated', { amount: 10 });
                    } catch (error) {
                        console.error('Error updating credits:', error);
                    }
                }

                socket.emit('roundResult', {
                    result: result === 1 ? 'You Lose!' : result === -1 ? 'You Win!' : 'Draw!',
                    player1Choice: choice,
                    player2Choice: botChoice,
                    playerScore: game.scores[socket.id],
                    opponentScore: game.scores.bot,
                    gameOver: true,
                    isBot: true,
                    playerWon,
                    requiredWins: 2, // Add required wins for bot games
                    canPlayAgain: true,
                    wager: game.wager
                });

                games.delete(gameId);
            } else {
                socket.emit('roundResult', {
                    result: result === 1 ? 'You Lose!' : result === -1 ? 'You Win!' : 'Draw!',
                    player1Choice: choice,
                    player2Choice: botChoice,
                    playerScore: game.scores[socket.id],
                    opponentScore: game.scores.bot,
                    gameOver: false,
                    isBot: true
                });
            }
            return;
        }

        // ... rest of existing multiplayer game logic ...
    });

    // Add handler for bot game rematch
    socket.on('playBotAgain', async ({ wager = 0 } = {}) => {
        socket.emit('resetGame');
        socket.emit('playBot', { wager });
    });

    // Update the creditsUpdated socket event handler
    socket.on('roundResult', async ({ gameId, result }) => {
        // ...existing game logic...
        if (gameOver) {
            const username = userSockets.get(socket.id);
            if (username) {
                try {
                    const user = await User.findOneAndUpdate(
                        { username },
                        { $inc: { credits: creditChange } },
                        { new: true }
                    );
                    
                    socket.emit('creditsUpdated', { 
                        newTotal: user.credits,
                        change: creditChange
                    });
                    
                    // Update leaderboard after credits change
                    const updatedLeaderboard = await User.find()
                        .select('username wins losses winsBO3 winsBO5 lossesBO3 lossesBO5 credits -_id')
                        .sort({ wins: -1 })
                        .limit(50);
                    io.emit('leaderboardUpdate', updatedLeaderboard);
                } catch (error) {
                    console.error('Error updating credits:', error);
                }
            }
        }
    });
});

// Authentication Routes
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        const existingUser = await User.findOne({ 
            $or: [{ username }, { email }] 
        });
        
        if (existingUser) {
            return res.status(400).json({ message: 'Username or email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ 
            username, 
            email, 
            password: hashedPassword,
            credits: 100 // Ensure initial credits are set
        });

        await user.save();
        
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(201).json({ 
            success: true,
            data: {
                token,
                username: user.username,
                credits: user.credits,
                userId: user._id
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Registration failed' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required'
            });
        }

        const user = await User.findOne({ username });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        
        return res.status(200).json({
            success: true,
            data: {
                token,
                username: user.username,
                credits: user.credits, // Add credits to login response
                userId: user._id // Add userId to response
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});


app.post('/api/save', async (req, res) => {
    try {
        const { token, wins, skins } = req.body;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        await User.updateOne({ _id: decoded.id }, { wins, skins });
        res.json({ message: 'Data saved successfully' });
    } catch (error) {
        console.error('Save error:', error);
        res.status(401).json({ message: 'Unauthorized' });
    }
});

// Add auth middleware
const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Authentication required' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        
        // Refresh token if it's close to expiring
        const tokenExp = decoded.exp * 1000; // Convert to milliseconds
        const now = Date.now();
        if (tokenExp - now < 300000) { // Less than 5 minutes left
            const newToken = jwt.sign({ id: decoded.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
            res.setHeader('New-Token', newToken);
        }
        
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired' });
        }
        return res.status(403).json({ message: 'Invalid token' });
    }
};

// Protected route example
app.get('/api/user-data', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.json({
            success: true,
            data: {
                username: user.username,
                credits: user.credits || 0,
                wins: user.wins || 0,
                losses: user.losses || 0,
                skins: user.skins || []
            }
        });
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({ success: false, message: 'Error fetching user data' });
    }
});

// Add this new endpoint to get user credits
app.get('/api/credits', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('credits');
        res.json({
            success: true,
            data: { credits: user.credits || 0 }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching credits' });
    }
});

// Add endpoint to update credits
app.post('/api/credits/update', authenticateToken, async (req, res) => {
    try {
        const { amount } = req.body;
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { $inc: { credits: amount } },
            { new: true }
        ).select('credits');
        res.json({ credits: user.credits });
    } catch (error) {
        res.status(500).json({ message: 'Error updating credits' });
    }
});

// Update the leaderboard route
app.get('/api/leaderboard', async (req, res) => {
    try {
        console.log('Fetching leaderboard data...');
        const topPlayers = await User.find({})
            .select('username wins losses winsBO3 winsBO5 lossesBO3 lossesBO5 credits')
            .sort({ wins: -1 })
            .limit(50)
            .lean();

        console.log(`Found ${topPlayers.length} players for leaderboard`);
        
        // Transform the data to ensure it's valid
        const sanitizedPlayers = topPlayers.map(player => ({
            username: player.username,
            wins: player.wins || 0,
            losses: player.losses || 0,
            winsBO3: player.winsBO3 || 0,
            winsBO5: player.winsBO5 || 0,
            lossesBO3: player.lossesBO3 || 0,
            lossesBO5: player.lossesBO5 || 0,
            credits: player.credits || 0
        }));

        res.json(sanitizedPlayers);
    } catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).json({ 
            message: 'Error fetching leaderboard',
            error: error.message 
        });
    }
});

// Update the token verification endpoint
app.post('/api/verify-token', async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(401).json({ valid: false });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id)
            .select('-password')
            .lean();
        
        if (!user) {
            return res.status(404).json({ valid: false });
        }

        // Generate fresh token
        const newToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        
        res.json({
            valid: true,
            data: {
                token: newToken,
                username: user.username,
                credits: user.credits,
                userId: user._id,
                wins: user.wins,
                losses: user.losses
            }
        });
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(401).json({ valid: false });
    }
});

// Update server startup and export
const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'production') {
    server.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

// Export the server instance instead of app
module.exports = app;
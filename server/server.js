const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Add static file serving for the client
app.use(express.static('../client/build'));

// Add the rest API endpoints and socket.io handlers in one file
app.use(express.json());

// Setup state
let waitingPlayer = null;
const games = new Map();
const users = new Map();
const leaderboardData = new Map();

// API Routes
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.get(username);

  if (user && user.password === password) {
    const token = Math.random().toString(36).substring(7);
    res.json({
      success: true,
      token,
      username,
      userId: user.id
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid username or password'
    });
  }
});

app.post('/api/register', (req, res) => {
  const { username, password, email } = req.body;

  if (users.has(username)) {
    return res.status(400).json({
      success: false,
      message: 'Username already exists'
    });
  }

  const userId = Math.random().toString(36).substring(7);
  users.set(username, {
    id: userId,
    username,
    password,
    email,
    wins: 0,
    losses: 0
  });

  const token = Math.random().toString(36).substring(7);
  res.json({
    success: true,
    token,
    username,
    userId
  });
});

app.get('/api/leaderboard', (req, res) => {
  const leaderboardArray = Array.from(leaderboardData.values())
    .sort((a, b) => b.wins - a.wins);
  res.json(leaderboardArray);
});

// Socket.IO handlers
io.on('connection', (socket) => {
  socket.on('findMatch', () => {
    console.log(`Player ${socket.id} looking for match`);

    if (waitingPlayer && socket.id !== waitingPlayer) {
      // Match found
      const gameId = Date.now().toString();
      console.log(`Match found between ${socket.id} and ${waitingPlayer}`);

      // Create game
      games.set(gameId, {
        players: [socket.id, waitingPlayer],
        scores: { [socket.id]: 0, [waitingPlayer]: 0 }
      });

      // Send match found to both players
      socket.emit('matchFound', { gameId });
      io.to(waitingPlayer).emit('matchFound', { gameId });

      // Start game
      setTimeout(() => {
        socket.emit('gameStart');
        io.to(waitingPlayer).emit('gameStart');
      }, 1000);

      waitingPlayer = null;
    } else {
      // No match found, become waiting player
      console.log(`${socket.id} added to waiting list`);
      waitingPlayer = socket.id;
      socket.emit('matchmaking', 'Waiting for opponent...');
    }
  });

  socket.on('disconnect', () => {
    if (waitingPlayer === socket.id) {
      waitingPlayer = null;
    }
  });

  socket.on('joinGame', ({ gameId, rounds }) => {
    socket.join(gameId);
    
    if (!activeGames.has(gameId)) {
      activeGames.set(gameId, {
        players: [socket.id],
        rounds: rounds || 3,
        scores: { [socket.id]: 0 },
        currentRound: null,
        totalRounds: rounds // Add this to track total rounds
      });
    } else {
      const game = activeGames.get(gameId);
      game.players.push(socket.id);
      game.scores[socket.id] = 0;
      game.totalRounds = rounds; // Make sure both players have the same round count
      
      if (game.players.length === 2) {
        io.to(gameId).emit('gameStart');
      }
    }
  });

  socket.on('playRound', ({ gameId, choice }) => {
    const game = activeGames.get(gameId);
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
      if (result === 1) game.scores[player1]++;
      else if (result === -1) game.scores[player2]++;

      const requiredWins = Math.ceil(game.totalRounds / 2);
      const gameOver = Object.values(game.scores).some(score => score >= requiredWins);

      io.to(gameId).emit('roundResult', {
        result: result === 1 ? 'You Win!' : result === -1 ? 'You Lose!' : 'Draw!',
        player1Choice: choice1,
        player2Choice: choice2,
        playerScore: game.scores[player1],
        opponentScore: game.scores[player2],
        gameOver,
        playerId: player1,
        requiredWins
      });

      game.currentRound = null;

      // Clean up game immediately if it's over
      if (gameOver) {
        activeGames.delete(gameId);
      }
    } else {
      socket.to(gameId).emit('opponentMadeChoice');
    }
  });

  // Add handler for when player cancels matchmaking
  socket.on('cancelMatch', () => {
    if (waitingPlayer === socket.id) {
      waitingPlayer = null;
      socket.emit('matchmaking', 'Matchmaking cancelled');
    }
  });

  socket.on('gameWon', ({ userId, gameType, isWinner }) => {
    if (!leaderboardData.has(userId)) {
      leaderboardData.set(userId, {
        id: userId,
        username: userId,
        wins: 0,
        losses: 0
      });
    }

    const playerStats = leaderboardData.get(userId);
    if (isWinner) {
      playerStats.wins++;
    } else {
      playerStats.losses++;
    }

    // Broadcast updated leaderboard
    const updatedLeaderboard = Array.from(leaderboardData.values())
      .sort((a, b) => b.wins - a.wins);
    io.emit('leaderboardUpdate', updatedLeaderboard);
  });
});

function evaluateRound(choice1, choice2) {
  if (choice1 === choice2) return 0;
  if (
    (choice1 === 'rock' && choice2 === 'scissors') ||
    (choice1 === 'paper' && choice2 === 'rock') ||
    (choice1 === 'scissors' && choice2 === 'paper')
  ) return 1;
  return -1;
}

// Start server
const PORT = 5000;
http.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`👉 React app available at http://localhost:${PORT}`);
  console.log(`👥 Waiting for players to connect...`);
});







const activeGames = {};
const gameRounds = {};
const gameScores = {};

function joinGame(io, socket, { gameId, rounds }) {
    if (!activeGames[gameId]) {
        activeGames[gameId] = [];
        gameScores[gameId] = { rounds };
    }
    
    if (!activeGames[gameId].includes(socket.id)) {
        activeGames[gameId].push(socket.id);
        gameScores[gameId][socket.id] = 0;
        socket.join(gameId);
    }

    io.to(gameId).emit('playerConnected');

    if (activeGames[gameId].length === 2) {
        io.to(gameId).emit('gameStart');
    }
}

function playRound(io, socket, gameId, choice) {
    if (!gameRounds[gameId]) {
        gameRounds[gameId] = {};
    }

    // Prevent multiple choices in same round
    if (gameRounds[gameId][socket.id]) {
        return;
    }

    gameRounds[gameId][socket.id] = choice;
    
    const players = activeGames[gameId];
    if (!players || players.length !== 2) return;

    const otherPlayer = players.find(id => id !== socket.id);
    if (otherPlayer) {
        io.to(otherPlayer).emit('opponentMadeChoice');
    }

    // Only evaluate if both players have chosen
    if (Object.keys(gameRounds[gameId]).length === 2) {
        const [player1, player2] = players;
        const player1Choice = gameRounds[gameId][player1];
        const player2Choice = gameRounds[gameId][player2];

        // Initialize scores if they don't exist
        if (!gameScores[gameId]) {
            gameScores[gameId] = {};
        }
        if (!gameScores[gameId][player1]) gameScores[gameId][player1] = 0;
        if (!gameScores[gameId][player2]) gameScores[gameId][player2] = 0;

        let player1Result, player2Result;
        let gameOver = false;

        if (player1Choice === player2Choice) {
            player1Result = player2Result = "It's a draw!";
        } else if (
            (player1Choice === 'rock' && player2Choice === 'scissors') ||
            (player1Choice === 'paper' && player2Choice === 'rock') ||
            (player1Choice === 'scissors' && player2Choice === 'paper')
        ) {
            player1Result = 'You Win this round!';
            player2Result = 'You Lose this round!';
            gameScores[gameId][player1]++;
            
            // Check if player1 has won the game
            if (gameScores[gameId][player1] >= Math.ceil(gameScores[gameId].rounds / 2)) {
                gameOver = true;
                player1Result = '🏆 You Won the Game! 🏆';
                player2Result = '💔 You Lost the Game! 💔';
            }
        } else {
            player1Result = 'You Lose this round!';
            player2Result = 'You Win this round!';
            gameScores[gameId][player2]++;
            
            // Check if player2 has won the game
            if (gameScores[gameId][player2] >= Math.ceil(gameScores[gameId].rounds / 2)) {
                gameOver = true;
                player1Result = '💔 You Lost the Game! 💔';
                player2Result = '🏆 You Won the Game! 🏆';
            }
        }

        // Send results to players with current scores
        io.to(player1).emit('roundResult', {
            result: player1Result,
            player1Choice,
            player2Choice,
            playerId: player1,
            playerScore: gameScores[gameId][player1],
            opponentScore: gameScores[gameId][player2],
            gameOver
        });

        io.to(player2).emit('roundResult', {
            result: player2Result,
            player1Choice: player2Choice,
            player2Choice: player1Choice,
            playerId: player2,
            playerScore: gameScores[gameId][player2],
            opponentScore: gameScores[gameId][player1],
            gameOver
        });

        // Clear round data after sending results
        delete gameRounds[gameId];
    }
}

function resetGame(io, gameId) {
    if (gameScores[gameId]) {
        Object.keys(gameScores[gameId]).forEach(playerId => {
            gameScores[gameId][playerId] = 0;
        });
    }
    delete gameRounds[gameId];
    io.to(gameId).emit('gameReset');
}

function leaveGame(socket) {
    for (const gameId in activeGames) {
        if (activeGames[gameId].includes(socket.id)) {
            activeGames[gameId] = activeGames[gameId].filter(id => id !== socket.id);
            if (gameScores[gameId]) {
                delete gameScores[gameId][socket.id];
            }
            if (activeGames[gameId].length === 0) {
                delete activeGames[gameId];
                delete gameRounds[gameId];
                delete gameScores[gameId];
            }
        }
    }
}

module.exports = { joinGame, playRound, leaveGame, resetGame };

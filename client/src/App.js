import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';
import AuthForm from './AuthForm'; // Make sure this path matches your file structure
import Leaderboard from './Leaderboard';
import GameModeSelect from './GameModeSelect';
import Shop from './Shop';
import { verifyToken } from './utils/auth';

const socket = io(process.env.REACT_APP_API_URL || 'https://your-api-domain.vercel.app', {
    withCredentials: true, // Change to true for production
    transports: ['websocket'], // Try websocket only first
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    autoConnect: true
});

// Add better error logging
socket.on('connect_error', (error) => {
    console.error('Socket connection error details:', {
        error: error.message,
        description: error.description,
        context: {
            url: process.env.REACT_APP_API_URL,
            transport: socket.io?.engine?.transport?.name,
            protocol: window.location.protocol,
            hostname: window.location.hostname
        }
    });
});

const WagerDialog = ({ onConfirm, onCancel, maxCredits }) => {
  const [wagerAmount, setWagerAmount] = useState(0);
  
  return (
    <div className="wager-dialog-overlay">
      <div className="wager-dialog">
        <h3>Place Your Wager</h3>
        <div className="wager-content">
          <p>Available Credits: {maxCredits}</p>
          <input
            type="range"
            min="0"
            max={maxCredits}
            value={wagerAmount}
            onChange={(e) => setWagerAmount(Number(e.target.value))}
            className="wager-slider"
          />
          <div className="wager-amount">{wagerAmount} Credits</div>
          <div className="wager-buttons">
            <button onClick={() => onConfirm(wagerAmount)}>Confirm</button>
            <button onClick={() => onCancel()}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
};

function App() {
  // Add user state
  const [user, setUser] = useState(null);
  const [choice, setChoice] = useState(null);
  const [opponentChoice, setOpponentChoice] = useState(null);
  const [rounds, setRounds] = useState(3);
  const [playerScore, setPlayerScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [gameLink, setGameLink] = useState('');
  const [gameId, setGameId] = useState(null);
  const [gameOver, setGameOver] = useState(false);
  const [roundMessage, setRoundMessage] = useState('');
  const [displayResult, setDisplayResult] = useState(false);
  const [playerId, setPlayerId] = useState(null);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState(localStorage.getItem('username') || '');
  const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem('darkMode') === 'true');
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [notification, setNotification] = useState('');
  const [showGameModeSelect, setShowGameModeSelect] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [credits, setCredits] = useState(0);
  const [playingBot, setPlayingBot] = useState(false);
  const [wager, setWager] = useState(0);
  const [botThinking, setBotThinking] = useState(false);
  const [showBotChoices, setShowBotChoices] = useState(false);
  const [showWagerDialog, setShowWagerDialog] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);

  // Check authentication status on load
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUsername = localStorage.getItem('username');
    if (token && storedUsername) {
      setIsAuthenticated(true);
      setUsername(storedUsername);
      
      // Fetch user data including credits
      fetch(`${process.env.REACT_APP_API_URL}/api/user-data`, {
          headers: {
              'Authorization': `Bearer ${token}`
          },
          credentials: 'include'
      })
      .then(res => {
          if (!res.ok) throw new Error('Failed to fetch user data');
          return res.json();
      })
      .then(data => {
          if (data.credits !== undefined) {
              setCredits(data.credits);
          }
      })
      .catch(error => {
          console.error('Error fetching user data:', error);
          setNotification('Error loading user data');
      });
    }
  }, []);

  // Add this effect to handle theme changes
  useEffect(() => {
    document.body.classList.toggle('dark-mode', isDarkMode);
    localStorage.setItem('darkMode', isDarkMode);
  }, [isDarkMode]);

  // Fetch leaderboard on component mount
  useEffect(() => {
    fetchLeaderboard();
  }, []);

  // Update socket authentication when username changes
  useEffect(() => {
    if (username && socket.connected) {
      socket.emit('authenticate', { username });
    }
  }, [username]);

  // Add effect to fetch credits when authenticated
  useEffect(() => {
    const fetchCredits = async () => {
      if (isAuthenticated) {
        try {
          const response = await fetch(`${process.env.REACT_APP_API_URL}/api/credits`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });
          const data = await response.json();
          setCredits(data.credits);
        } catch (error) {
          console.error('Error fetching credits:', error);
        }
      }
    };

    fetchCredits();
  }, [isAuthenticated]);

  // Update the authentication effect
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUsername = localStorage.getItem('username');
    if (token && storedUsername) {
      setIsAuthenticated(true);
      setUsername(storedUsername);
      
      fetch(`${process.env.REACT_APP_API_URL}/api/user-data`, {
          headers: {
              'Authorization': `Bearer ${token}`
          }
      })
      .then(res => {
          if (!res.ok) throw new Error('Failed to fetch user data');
          return res.json();
      })
      .then(response => {
          if (response.success && response.data) {
              setCredits(response.data.credits);
          }
      })
      .catch(error => {
          console.error('Error fetching user data:', error);
          // Clear auth state if there's an error
          localStorage.removeItem('token');
          localStorage.removeItem('username');
          setIsAuthenticated(false);
          setUsername('');
      });
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
        const userData = await verifyToken();
        if (userData) {
            setUser(userData);
            setIsAuthenticated(true);
            setUsername(userData.username);
            setCredits(userData.credits || 0);
        }
    };

    checkAuth();
}, []);

  const startGame = (selectedRounds) => {
    setRounds(selectedRounds);
    setPlayerScore(0);
    setOpponentScore(0);
    setShowScoreboard(true);
    setGameOver(false);
    setRoundMessage('');
    setDisplayResult(false);
    setChoice(null);
    setOpponentChoice(null);
  };

  const handleChoice = (selection) => {
    // Prevent double picks and picks after game over
    if (gameOver || choice) {
      return;
    }
    
    setChoice(selection);
    setRoundMessage(`You chose ${selection}!`);
    setDisplayResult(true);
    setWaitingForOpponent(true); // Set to true when player makes a choice
    
    if (playingBot) {
      setBotThinking(true);
      setShowBotChoices(true);
      // Add delay to simulate bot thinking
      setTimeout(() => {
        socket.emit('playRound', { gameId, choice: selection });
        setBotThinking(false);
      }, 1000);
    } else if (gameId) {
      socket.emit('playRound', { gameId, choice: selection });
    }
  };

  const evaluateRound = (outcome, playerChoice, opponentChoice, playerScore, opponentScore, gameOver) => {
    setOpponentChoice(opponentChoice);
    setChoice(playerChoice);
    setPlayerScore(playerScore);
    setOpponentScore(opponentScore);
    setDisplayResult(true);

    if (gameOver) {
      setGameOver(true);
      const isWinner = playerScore > opponentScore;
      setRoundMessage(isWinner ? '🏆 Game Over - You Won! 🏆' : '💔 Game Over - You Lost! 💔');
      
      if (isAuthenticated) {
        socket.emit('gameWon', { 
          userId: localStorage.getItem('userId'),
          gameType: rounds === 3 ? 'bo3' : rounds === 5 ? 'bo5' : 'custom',
          opponentId: playerId,
          isWinner
        });
      }
    } else {
      setRoundMessage(`Round Result: ${outcome}`);
    }
  };

  const findOpponent = () => {
    if (!isAuthenticated) {
      setShowAuthForm(true);
      return;
    }

    console.log('Finding ranked opponent...');
    setShowScoreboard(true);
    setRoundMessage("Looking for opponent...");
    setGameOver(false);
    setChoice(null);
    setOpponentChoice(null);
    socket.emit('findMatch', { ranked: true, rounds: 3 }); // Always best of 3 for ranked
  };

  const createGameLink = () => {
    setShowGameModeSelect(true);
    setShowScoreboard(false); // Reset game board when creating new game
    setGameLink(''); // Clear any existing game link
  };

  const handleGameModeSelect = async (selectedRounds) => {
    setShowGameModeSelect(false);
    const newGameId = Math.random().toString(36).substring(7);
    const link = `${window.location.origin}/game/${newGameId}`;
    
    setGameLink(link);
    setGameId(newGameId);
    setRounds(selectedRounds);
    
    // Join the casual game room
    socket.emit('joinGame', { 
      gameId: newGameId, 
      rounds: selectedRounds,
      ranked: false
    });

    // Set initial game state
    setShowScoreboard(true);
    setRoundMessage("Waiting for opponent to join...");
    
    // Copy link to clipboard with fallback
    try {
      await navigator.clipboard.writeText(link);
      window.alert('Game link copied to clipboard! Share it with your friend.');
    } catch (err) {
      // Fallback for clipboard API failure
      const textarea = document.createElement('textarea');
      textarea.value = link;
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        window.alert('Game link copied to clipboard! Share it with your friend.');
      } catch (err) {
        window.alert(`Please copy this link manually: ${link}`);
      }
      document.body.removeChild(textarea);
    }
  };

  const fetchLeaderboard = async () => {
    try {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/leaderboard`, {
            credentials: 'include'
        });
        const data = await response.json();
        if (Array.isArray(data)) {
            setLeaderboardData(data);
            console.log('Leaderboard data loaded:', data.length, 'players');
        } else {
            console.error('Invalid leaderboard data:', data);
            setLeaderboardData([]);
        }
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        setLeaderboardData([]);
    }
};

  // Consolidate socket handlers into one useEffect
  useEffect(() => {
    socket.on('connect', () => {
      console.log("🔌 Socket connected:", socket.id);
      setPlayerId(socket.id);
      
      // Re-authenticate if we have a username
      if (username) {
        socket.emit('authenticate', { username });
      }
    });

    socket.on('roundResult', ({ 
      result, 
      player1Choice, 
      player2Choice, 
      playerScore,
      opponentScore,
      gameOver,
      playerId: resultPlayerId,
      requiredWins 
  }) => {
      setWaitingForOpponent(false); // Reset waiting state when round completes
      const personalizedResult = resultPlayerId === playerId ? 
          result : (result === 'You Win!' ? 'You Lose!' : result === 'You Lose!' ? 'You Win!' : 'Draw!');
      
      evaluateRound(
          personalizedResult,
          player1Choice,
          player2Choice,
          resultPlayerId === playerId ? playerScore : opponentScore,
          resultPlayerId === playerId ? opponentScore : playerScore,
          gameOver
      );

      if (!gameOver) {
        setTimeout(() => {
          setChoice(null);
          setOpponentChoice(null);
          setRoundMessage(`Next round! First to ${requiredWins} wins.`);
        }, 2000);
      }
  });

    socket.on('playerConnected', () => {
      setNotification('A player has connected!');
      setTimeout(() => setNotification(''), 3000);
    });

    socket.on('gameStart', () => {
      setNotification('Both players connected. Game started!');
      setTimeout(() => setNotification(''), 3000);
      setShowScoreboard(true);
    });

    socket.on('opponentMadeChoice', () => {
      setRoundMessage("Opponent has made their choice! Your turn to choose!");
    });

    socket.on('leaderboardUpdate', (data) => {
      setLeaderboardData(data);
    });

    socket.on('matchFound', ({ gameId: matchGameId, opponentId }) => {
      setGameId(matchGameId);
      setRoundMessage("Opponent found! Game starting...");
      startGame(3); // Best of 3
    });

    socket.on('matchmaking', (message) => {
      setRoundMessage(message);
    });

    socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected');
    });

    socket.on('connect_error', (error) => {
      console.error('🔴 Connection error:', error);
    });

    // Update how we handle URL-based game joining
    const path = window.location.pathname;
    const urlGameId = path.split('/game/')[1];
    if (urlGameId) {
      console.log('Joining game by URL:', urlGameId);
      setGameId(urlGameId);
      setShowScoreboard(true);
      setRoundMessage("Joining game...");
      
      socket.emit('joinGame', { 
        gameId: urlGameId, 
        rounds: 3,
        ranked: false 
      });
    }

    // Add handler for game join updates
    socket.on('updateRounds', ({ rounds }) => {
      setRounds(rounds);
      startGame(rounds);
    });

    socket.on('gameReset', () => {
      setGameOver(false);
      setPlayerScore(0);
      setOpponentScore(0);
      setChoice(null);
      setOpponentChoice(null);
      setRoundMessage('New game started!');
      setWaitingForOpponent(false); // Reset waiting state on game reset
    });

    socket.on('creditsUpdated', ({ amount }) => {
      setCredits(prev => prev + amount);
      setNotification(`Won ${amount} credits!`);
      setTimeout(() => setNotification(''), 3000);
    });

    return () => {
      socket.off('gameStart');
      socket.off('roundResult');
      socket.off('playerConnected');
      socket.off('opponentMadeChoice');
      socket.off('leaderboardUpdate');
      socket.off('matchFound');
      socket.off('matchmaking');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('updateRounds');
      socket.off('gameReset');
      socket.off('creditsUpdated');
    };
  }, [username]);

  useEffect(() => {
    socket.on('connect', () => {
      console.log("Socket connected:", socket.id);
      setPlayerId(socket.id);
    });

    socket.on('matchFound', ({ gameId: matchGameId }) => {
      console.log('Match found:', matchGameId);
      setGameId(matchGameId);
      setRoundMessage("Opponent found! Game starting soon...");
    });

    socket.on('gameStart', () => {
      console.log('Game starting');
      startGame(3);
      setRoundMessage("Game started! Make your choice!");
    });

    socket.on('opponentDisconnected', () => {
      setNotification('Opponent disconnected!');
      setTimeout(() => setNotification(''), 3000);
      setShowScoreboard(false);
      setGameOver(true);
    });

    socket.on('matchmaking', (message) => {
      console.log('Matchmaking status:', message);
      setRoundMessage(message);
    });

    return () => {
      socket.off('matchFound');
      socket.off('gameStart');
      socket.off('opponentDisconnected');
      socket.off('matchmaking');
    };
  }, [playerId]);

    // Add error handling for account creation
  const createAccount = async (userData) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(userData)
      });
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Account creation failed:', error);
      if (!navigator.onLine) {
        alert('Please check your internet connection');
      } else {
        alert('Unable to create account. Please try again later.');
      }
      throw error;
    }
  };
  
  // Add error handling to socket connection
  useEffect(() => {
    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      alert('Connection error. Attempting to reconnect...');
      socket.connect();
    });
  
    socket.on('connect', () => {
      console.log("Socket connected:", socket.id);
      setPlayerId(socket.id);
    });
    
    // ...existing socket event handlers...
  }, []);

  // Add new socket event listeners for credits in the main useEffect
  useEffect(() => {
    // ...existing socket listeners...

    socket.on('creditsUpdated', ({ newTotal, change }) => {
      setCredits(newTotal);
      const message = change > 0 ? `Won ${change} credits!` : `Lost ${Math.abs(change)} credits!`;
      setNotification(message);
      setTimeout(() => setNotification(''), 3000);
    });

    socket.on('wagerResult', ({ result, credits: newCredits }) => {
      setCredits(newCredits);
      setNotification(`Game finished! New balance: ${newCredits} credits`);
      setTimeout(() => setNotification(''), 3000);
    });

    return () => {
      // ...existing cleanup...
      socket.off('creditsUpdated');
      socket.off('wagerResult');
    };
  }, []);

  // Update the credits socket listener
  useEffect(() => {
    socket.on('creditsUpdated', ({ newTotal, change }) => {
      setCredits(newTotal); // Use the new total directly instead of incrementing
      const message = change > 0 ? `Won ${change} credits!` : `Lost ${Math.abs(change)} credits!`;
      setNotification(message);
      setTimeout(() => setNotification(''), 3000);
    });

    // Add periodic credits refresh
    const refreshInterval = setInterval(() => {
      if (isAuthenticated) {
        fetch(`${process.env.REACT_APP_API_URL}/api/user-data`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data.credits !== undefined) {
            setCredits(data.data.credits);
          }
        })
        .catch(error => console.error('Error refreshing credits:', error));
      }
    }, 30000); // Refresh every 30 seconds

    return () => {
      socket.off('creditsUpdated');
      clearInterval(refreshInterval);
    };
  }, [isAuthenticated]);

  // Update handlePlayAgain function
  const handlePlayAgain = () => {
    if (gameId) {
      if (playingBot) {
        setShowWagerDialog(true); // Use wager dialog instead of prompt
      } else {
        // Regular game reset
        setGameOver(false);
        setPlayerScore(0);
        setOpponentScore(0);
        setChoice(null);
        setOpponentChoice(null);
        setRoundMessage('Starting new game...');
        socket.emit('playAgain', { gameId });
      }
    }
  };

  // Add bot play handler
  const playBot = () => {
    if (!isAuthenticated) {
        setShowAuthForm(true);
        return;
    }

    // Show wager dialog instead of prompt
    setShowWagerDialog(true);
};

  // Add handler for wager confirmation
  const handleWagerConfirm = (amount) => {
    if (amount > credits) {
      setNotification('Insufficient credits!');
      setTimeout(() => setNotification(''), 3000);
      return;
    }
    
    setShowWagerDialog(false);
    setWager(amount);
    setPlayingBot(true);
    setShowScoreboard(true);
    setRoundMessage("Starting game against bot...");
    setGameOver(false);
    setPlayerScore(0);
    setOpponentScore(0);
    setChoice(null);
    setOpponentChoice(null);
    setBotThinking(false);
    setShowBotChoices(true);
    
    socket.emit('playBot', { wager: amount });
  };

  // Update the auth check effect
useEffect(() => {
    const checkAuth = async () => {
        try {
            const userData = await verifyToken();
            if (userData) {
                setUser(userData);
                setIsAuthenticated(true);
                setUsername(userData.username);
                setCredits(userData.credits || 0);
                
                // Authenticate socket connection
                if (socket.connected) {
                    socket.emit('authenticate', { username: userData.username });
                }
                
                // Fetch leaderboard after successful auth
                fetchLeaderboard();
            } else {
                // Clear auth state if verification fails
                setUser(null);
                setIsAuthenticated(false);
                setUsername('');
                setCredits(0);
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            // Clear auth state on error
            setUser(null);
            setIsAuthenticated(false);
            setUsername('');
            setCredits(0);
        }
    };

    checkAuth();
    
    // Set up periodic token verification
    const verifyInterval = setInterval(checkAuth, 4 * 60 * 1000); // Check every 4 minutes
    
    return () => clearInterval(verifyInterval);
}, []);

// Add effect for leaderboard updates
useEffect(() => {
    // Initial fetch
    fetchLeaderboard();
    
    // Set up periodic refresh
    const refreshInterval = setInterval(fetchLeaderboard, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(refreshInterval);
}, []);

  return (
    <div className={`App ${isDarkMode ? 'dark-mode' : ''}`}>
      {notification && (
        <div className="notification">
          {notification}
        </div>
      )}
      <div className="user-welcome">
        {isAuthenticated && (
          <>
            <span>Welcome, {username}!</span>
            <span className="credits">💰 {credits} Credits</span>
          </>
        )}
      </div>
      
      <h1>Ranked RPS</h1>
      <div className="actions">
        <button onClick={findOpponent}>Find Opponent</button>
        <button onClick={createGameLink}>Play with Friend</button>
        <button onClick={playBot}>Play vs Bot</button>
        <button onClick={() => setShowShop(true)}>Shop</button>
        {isAuthenticated ? (
          <button onClick={() => {
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            setIsAuthenticated(false);
            setUsername('');
          }}>Logout</button>
        ) : (
          <button onClick={() => setShowAuthForm(true)}>Login/Register</button>
        )}
      </div>

      {/* Show leaderboard when game is not active */}
      {!showScoreboard && (
        <div className="main-leaderboard">
          <Leaderboard 
            leaderboardData={leaderboardData}
            onClose={() => {}} // Remove close functionality
            permanent={true}
          />
        </div>
      )}
  
      {showAuthForm && (
        <AuthForm onClose={(userData) => {
          setShowAuthForm(false);
          if (userData) {
            setIsAuthenticated(true);
            setUsername(userData.username);
            setCredits(userData.credits);
            localStorage.setItem('token', userData.token);
            localStorage.setItem('username', userData.username);
            
            // Immediately fetch fresh user data after login
            fetch(`${process.env.REACT_APP_API_URL}/api/user-data`, {
                headers: {
                    'Authorization': `Bearer ${userData.token}`
                }
            })
            .then(res => res.json())
            .then(response => {
                if (response.success && response.data) {
                    setCredits(response.data.credits);
                }
            })
            .catch(error => console.error('Error fetching initial credits:', error));
          }
        }} />
      )}
  
      {gameLink && (
        <div className="game-link">
          <p></p>
            Send this link to your friend:{' '}
            <a href={gameLink} target="_blank" rel="noopener noreferrer">
              {gameLink}
            </a>
        </div>
      )}
  
      {showLeaderboard && (
        <Leaderboard 
          leaderboardData={leaderboardData}
          onClose={() => setShowLeaderboard(false)}
        />
      )}
  
      {showScoreboard && (
        <div className="game-container">
          {playingBot && (
            <div className="bot-info">
              <div className="bot-avatar">
                <img src="/avatarrpsbot.png" alt="Bot Avatar" />
                <div className="bot-name">RPS Bot</div>
              </div>
              <div className="bot-info-content">
                {botThinking && <div className="bot-thinking">🤖 Thinking...</div>}
                {showBotChoices && (
                  <div className="bot-choices">
                    <div className="bot-choice-preview" title="Bot might pick Rock">🪨</div>
                    <div className="bot-choice-preview" title="Bot might pick Paper">📄</div>
                    <div className="bot-choice-preview" title="Bot might pick Scissors">✂️</div>
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="score-display">
            <div className="player-score">
              <span className="score-label">You</span>
              <span className="score-number">{playerScore}</span>
            </div>
            <div className="score-divider">vs</div>
            <div className="opponent-score">
              <span className="score-label">Opponent</span>
              <span className="score-number">{opponentScore}</span>
            </div>
          </div>

          {playingBot && wager > 0 && (
            <div className="wager-display">
              Current Wager: {wager} Credits
            </div>
          )}

          {(displayResult || roundMessage) && (
            <div className="round-info">
              <p className="choice-announcement">{roundMessage}</p>
              <div className="moves-container">
                {choice && (
                  <div className="move-display player">
                    <div className={`move-icon ${choice.toLowerCase()}`} />
                    <p className="player-move">Your move: {choice}</p>
                  </div>
                )}
                {opponentChoice && (
                  <div className="move-display opponent">
                    <div className={`move-icon ${opponentChoice.toLowerCase()}`} />
                    <p className="opponent-move">Opponent's move: {opponentChoice}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {gameOver ? (
            <div className="game-over-container">
              <div className="game-over-message">{roundMessage}</div>
              <button 
                className="play-again-btn"
                onClick={handlePlayAgain}
              >
                Play Again
              </button>
            </div>
          ) : (
            <div className="choices">
              <button 
                className={`choice-btn ${waitingForOpponent ? 'disabled' : ''}`}
                onClick={() => handleChoice('rock')} 
                disabled={waitingForOpponent}
              >
                <div className="move-icon rock"></div>
                Rock
              </button>
              <button 
                className={`choice-btn ${waitingForOpponent ? 'disabled' : ''}`}
                onClick={() => handleChoice('paper')} 
                disabled={waitingForOpponent}
              >
                <div className="move-icon paper"></div>
                Paper
              </button>
              <button 
                className={`choice-btn ${waitingForOpponent ? 'disabled' : ''}`}
                onClick={() => handleChoice('scissors')} 
                disabled={waitingForOpponent}
              >
                <div className="move-icon scissors"></div>
                Scissors
              </button>
            </div>
          )}
        </div>
      )}

      {showGameModeSelect && (
        <GameModeSelect 
          onSelect={handleGameModeSelect}
          onClose={() => setShowGameModeSelect(false)}
          isRanked={false} // Add this prop to indicate it's for friend game
        />
      )}

      {showShop && (
        <Shop onClose={() => setShowShop(false)} />
      )}

      {showWagerDialog && (
        <WagerDialog
          onConfirm={handleWagerConfirm}
          onCancel={() => setShowWagerDialog(false)}
          maxCredits={credits}
        />
      )}

      <button 
        className="theme-toggle"
        onClick={() => setIsDarkMode(!isDarkMode)}
      >
        {isDarkMode ? '☀️ Light' : '🌙 Dark'}
      </button>
    </div>
  );
}

export default App;
import React, { useState } from 'react';
import './GameModeSelect.css';

function GameModeSelect({ onSelect, onClose, isRanked }) {
  const [customRounds, setCustomRounds] = useState(3);
  const [showCustomInput, setShowCustomInput] = useState(false);

  const modes = [
    {
      rounds: 3,
      title: "Best of 3",
      icon: "🎮",
      description: "Quick match - First to 2 wins"
    },
    {
      rounds: 5,
      title: "Best of 5",
      icon: "🏆",
      description: "Standard match - First to 3 wins"
    },
    {
      rounds: 7,
      title: "Best of 7",
      icon: "⚔️",
      description: "Extended battle - First to 4 wins"
    }
  ];

  const isDarkMode = document.body.classList.contains('dark-mode');

  const handleCustomRounds = (e) => {
    const value = Math.min(Math.max(parseInt(e.target.value) || 1, 1), 100);
    setCustomRounds(value);
  };

  const handleSelect = (rounds) => {
    if (rounds === 'custom') {
      setShowCustomInput(true);
    } else {
      onSelect(rounds);
    }
  };

  const confirmCustomRounds = () => {
    onSelect(customRounds);
    setShowCustomInput(false);
  };

  return (
    <div className="game-mode-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className={`game-mode-container ${isDarkMode ? 'dark-mode' : ''}`}>
        <button className="close-button" onClick={onClose}>&times;</button>
        <h2 className="game-mode-title">{isRanked ? 'Select Ranked Game Mode' : 'Select Game Mode'}</h2>
        
        {showCustomInput ? (
          <div className="custom-rounds-container">
            <input
              type="number"
              min="1"
              max="100"
              value={customRounds}
              onChange={handleCustomRounds}
            />
            <button onClick={confirmCustomRounds}>Confirm</button>
          </div>
        ) : (
          <div className="game-modes">
            {modes.map((mode) => (
              <button
                key={mode.rounds}
                className="mode-button"
                onClick={() => handleSelect(mode.rounds)}
              >
                <span className="mode-icon">{mode.icon}</span>
                <span className="mode-title">{mode.title}</span>
                <span className="mode-description">{mode.description}</span>
              </button>
            ))}
            {!isRanked && (
              <button
                className="mode-button"
                onClick={() => handleSelect('custom')}
              >
                <span className="mode-icon">🎲</span>
                <span className="mode-title">Custom Rounds</span>
                <span className="mode-description">Choose 1-100 rounds</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default GameModeSelect;

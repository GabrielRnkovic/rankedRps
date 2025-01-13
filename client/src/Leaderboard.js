import React, { useState, useEffect } from 'react';

function Leaderboard({ leaderboardData, onClose, permanent }) {
  const [activeTab, setActiveTab] = useState('overall');
  const [filteredData, setFilteredData] = useState([]);

  const renderLeaderboardList = (data) => {
    return (
      <div className="leaderboard-list">
        <div className="leaderboard-header">
          <span className="rank">Rank</span>
          <span className="username">Player</span>
          <span className="stats">
            {activeTab === 'losses' ? 'L/W' : 'W/L'}
          </span>
        </div>
        {data.map((player, index) => {
          return (
            <div key={index} className="leaderboard-item">
              <span className="rank">{index + 1}</span>
              <span className="username">{player.username}</span>
              {renderStats(player)}
            </div>
          );
        })}
      </div>
    );
  };

  useEffect(() => {
    let sorted = [...leaderboardData];
    switch (activeTab) {
      case 'bo3':
        sorted.sort((a, b) => (b.winsBO3 || 0) - (a.winsBO3 || 0));
        break;
      case 'bo5':
        sorted.sort((a, b) => (b.winsBO5 || 0) - (a.winsBO5 || 0));
        break;
      case 'credits':
        sorted.sort((a, b) => (b.credits || 0) - (a.credits || 0));
        break;
      case 'losses':
        sorted.sort((a, b) => (b.losses || 0) - (a.losses || 0));
        break;
      default:
        sorted.sort((a, b) => b.wins - a.wins);
    }
    setFilteredData(sorted.slice(0, 50));
  }, [leaderboardData, activeTab]);

  const tabs = [
    { id: 'overall', label: 'Overall' },
    { id: 'bo3', label: 'Best of 3' },
    { id: 'bo5', label: 'Best of 5' },
    { id: 'credits', label: 'Most Credits' },
    { id: 'losses', label: 'Most Losses' }
  ];

  const getDisplayValues = (player) => {
    switch (activeTab) {
      case 'bo3':
        return { wins: player.winsBO3 || 0, losses: player.lossesBO3 || 0 };
      case 'bo5':
        return { wins: player.winsBO5 || 0, losses: player.lossesBO5 || 0 };
      case 'credits':
        return { mainValue: player.credits || 0 };
      case 'losses':
        // For total losses, sum both BO3 and BO5 losses
        return { 
          losses: (player.lossesBO3 || 0) + (player.lossesBO5 || 0), 
          wins: (player.winsBO3 || 0) + (player.winsBO5 || 0) 
        };
      default:
        return { 
          wins: (player.winsBO3 || 0) + (player.winsBO5 || 0), 
          losses: (player.lossesBO3 || 0) + (player.lossesBO5 || 0) 
        };
    }
  };

  const renderStats = (player) => {
    const stats = getDisplayValues(player);
    if (activeTab === 'credits') {
      return <span className="credits-value">💰 {stats.mainValue}</span>;
    }
    return (
      <span className="stats">
        <span className="wins-count">
          {activeTab === 'losses' ? stats.losses : stats.wins}
        </span>
        <span className="stats-separator">/</span>
        <span className="losses-count">
          {activeTab === 'losses' ? stats.wins : stats.losses}
        </span>
      </span>
    );
  };

  return (
    <div className={`leaderboard-overlay ${permanent ? 'permanent' : ''}`}>
      <div className="leaderboard-modal">
        <h2>Top 50 Players</h2>
        {!permanent && <button className="close-button" onClick={onClose}>×</button>}
        
        <div className="leaderboard-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="leaderboard-list">
          <div className="leaderboard-header">
            <span className="rank">Rank</span>
            <span className="username">Player</span>
            <span className="stats">
              {activeTab === 'losses' ? 'L/W' : 'W/L'}
            </span>
          </div>
          {filteredData.map((player, index) => {
            return (
              <div key={index} className="leaderboard-item">
                <span className="rank">{index + 1}</span>
                <span className="username">{player.username}</span>
                {renderStats(player)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Leaderboard;

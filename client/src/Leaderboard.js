import React, { useState, useEffect } from 'react';

function Leaderboard({ leaderboardData, onClose, permanent }) {
  const [activeTab, setActiveTab] = useState('overall');
  const [filteredData, setFilteredData] = useState([]);

  // Add data validation and logging
  useEffect(() => {
    if (!leaderboardData || !Array.isArray(leaderboardData)) {
        console.log('No leaderboard data available');
        setFilteredData([]);
        return;
    }

    console.log('Processing leaderboard data:', leaderboardData.length, 'players');

    const validatedData = leaderboardData
        .filter(player => player && player.username) // Only include players with usernames
        .map(player => ({
            username: player.username,
            wins: parseInt(player.wins || 0),
            losses: parseInt(player.losses || 0),
            winsBO3: parseInt(player.winsBO3 || 0),
            winsBO5: parseInt(player.winsBO5 || 0),
            lossesBO3: parseInt(player.lossesBO3 || 0),
            lossesBO5: parseInt(player.lossesBO5 || 0),
            credits: parseInt(player.credits || 0)
        }));

    let sorted = [...validatedData];
    switch (activeTab) {
      case 'bo3':
        sorted.sort((a, b) => b.winsBO3 - a.winsBO3);
        break;
      case 'bo5':
        sorted.sort((a, b) => b.winsBO5 - a.winsBO5);
        break;
      case 'credits':
        sorted.sort((a, b) => b.credits - a.credits);
        break;
      case 'losses':
        sorted.sort((a, b) => (b.lossesBO3 + b.lossesBO5) - (a.lossesBO3 + a.lossesBO5));
        break;
      default: // overall
        sorted.sort((a, b) => (b.winsBO3 + b.winsBO5) - (a.winsBO3 + a.winsBO5));
    }

    console.log('Processed leaderboard data:', sorted.length, 'players');
    setFilteredData(sorted);
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
        return {
          wins: Number(player.winsBO3),
          losses: Number(player.lossesBO3)
        };
      case 'bo5':
        return {
          wins: Number(player.winsBO5),
          losses: Number(player.lossesBO5)
        };
      case 'credits':
        return { mainValue: Number(player.credits) };
      case 'losses':
        return {
          losses: Number(player.lossesBO3) + Number(player.lossesBO5),
          wins: Number(player.winsBO3) + Number(player.winsBO5)
        };
      default: // overall
        return {
          wins: Number(player.winsBO3) + Number(player.winsBO5),
          losses: Number(player.lossesBO3) + Number(player.lossesBO5)
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

        {filteredData.length > 0 ? (
          <div className="leaderboard-list">
            <div className="leaderboard-header">
              <span className="rank">Rank</span>
              <span className="username">Player</span>
              <span className="stats">
                {activeTab === 'credits' ? 'Credits' : activeTab === 'losses' ? 'L/W' : 'W/L'}
              </span>
            </div>
            {filteredData.map((player, index) => (
              <div key={index} className="leaderboard-item">
                <span className="rank">{index + 1}</span>
                <span className="username">{player.username}</span>
                {renderStats(player)}
              </div>
            ))}
          </div>
        ) : (
          <div className="no-data">No players found</div>
        )}
      </div>
    </div>
  );
}

export default Leaderboard;

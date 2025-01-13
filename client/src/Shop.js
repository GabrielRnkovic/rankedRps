import React from 'react';
import './Shop.css';

function Shop({ onClose }) {
  const shopItems = [
    {
      id: 1,
      name: "Golden Rock",
      description: "Sigma rock with golden particles",
      price: 1000,
      type: "animation",
      preview: "🪨✨",
      comingSoon: true
    },
    {
      id: 2,
      name: "Rainbow Paper",
      description: "Skibidi skin for paper",
      price: 1500,
      type: "animation",
      preview: "📜🌈",
      comingSoon: true
    },
    {
      id: 3,
      name: "Fire Scissors",
      description: "Looksmaxing scissors with fire effect",
      price: 2000,
      type: "animation",
      preview: "✂️🔥",
      comingSoon: true
    },
    {
      id: 4,
      name: "Victory Dance",
      description: "Special win emote",
      price: 3000,
      type: "emote",
      preview: "🕺",
      comingSoon: true
    }
  ];

  return (
    <>
      <div className="shop-overlay" onClick={onClose}></div>
      <div className="shop-container">
        <h2 className="shop-title">RPS Shop</h2>
        <p className="shop-subtitle">Coming Soon</p>
        <div className="shop-items">
          {shopItems.map(item => (
            <div key={item.id} className="shop-item">
              <div className="item-preview">{item.preview}</div>
              <h3>{item.name}</h3>
              <p>{item.description}</p>
              <div className="item-price">
                <span>💎 {item.price}</span>
                {item.comingSoon && <span className="coming-soon">Coming Soon!</span>}
              </div>
            </div>
          ))}
        </div>
        <button className="close-button" onClick={onClose}>&times;</button>
      </div>
    </>
  );
}

export default Shop;

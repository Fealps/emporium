import React, { useState } from 'react';
import { db } from './utils/db';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import DMPanel from './components/DMPanel';
import PlayerPanel from './components/PlayerPanel';

function App() {
  const [currentUser, setCurrentUser] = useState(db.getCurrentUser());
  const [activeGameId, setActiveGameId] = useState(null);
  const [userRole, setUserRole] = useState(null); // 'dm' | 'player'

  const handleAuthSuccess = (username) => {
    setCurrentUser(username);
  };

  const handleLogout = () => {
    db.logout();
    setCurrentUser(null);
    setActiveGameId(null);
    setUserRole(null);
  };

  const handleSelectCampaign = (gameId, role) => {
    setActiveGameId(gameId);
    setUserRole(role);
  };

  const handleBackToDashboard = () => {
    setActiveGameId(null);
    setUserRole(null);
  };

  // Auth Guard
  if (!currentUser) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  // Active game view routing
  if (activeGameId) {
    if (userRole === 'dm') {
      return (
        <DMPanel
          gameId={activeGameId}
          username={currentUser}
          onBackToDashboard={handleBackToDashboard}
        />
      );
    } else {
      return (
        <PlayerPanel
          gameId={activeGameId}
          username={currentUser}
          onBackToDashboard={handleBackToDashboard}
        />
      );
    }
  }

  // Fallback to Dashboard Campaign List
  return (
    <Dashboard
      username={currentUser}
      onSelectCampaign={handleSelectCampaign}
      onLogout={handleLogout}
    />
  );
}

export default App;

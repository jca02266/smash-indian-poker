import './style.css';
import { onAuthChanged, signOut } from './auth.js';
import { renderLogin } from './views/login.js';
import { renderLobby } from './views/lobby.js';
import { renderGame, cleanupGame } from './views/game.js';

const app = document.getElementById('app');

// ===== Toast System =====
let toastContainer = null;

export function showToast(message, type = 'info') {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// ===== Router =====
let currentView = null;
let currentRoomId = null;

function navigate(view, data = {}) {
  // ゲーム画面から離れる場合はクリーンアップ
  if (currentView === 'game' && view !== 'game') {
    cleanupGame();
  }

  currentView = view;

  switch (view) {
    case 'login':
      renderLogin(app, (user) => {
        navigate('lobby', { user });
      });
      break;

    case 'lobby':
      renderLobby(app, data.user, {
        onRoomJoined: (roomId) => {
          currentRoomId = roomId;
          localStorage.setItem('smash_poker_room_id', roomId);
          navigate('game', { user: data.user, roomId });
        },
        onLogout: async () => {
          localStorage.removeItem('smash_poker_room_id');
          await signOut();
          navigate('login');
        },
      });
      break;

    case 'game':
      renderGame(app, data.user, data.roomId, {
        onLeave: () => {
          currentRoomId = null;
          localStorage.removeItem('smash_poker_room_id');
          navigate('lobby', { user: data.user });
        },
      });
      break;
  }
}

// ===== Auth State Listener =====
onAuthChanged((user) => {
  if (user) {
    // ゲーム中ならそのまま
    if (currentView === 'game') return;

    // リロード時のルーム復帰
    const savedRoomId = localStorage.getItem('smash_poker_room_id');
    if (savedRoomId) {
      currentRoomId = savedRoomId;
      navigate('game', { user, roomId: savedRoomId });
    } else {
      navigate('lobby', { user });
    }
  } else {
    navigate('login');
  }
});

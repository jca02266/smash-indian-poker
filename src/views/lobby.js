import { createRoom, joinRoom } from '../game/room.js';
import { showToast } from '../main.js';

export function renderLobby(container, user, { onRoomJoined, onLogout }) {
  container.innerHTML = `
    <div class="lobby-screen">
      <div class="lobby-header">
        <h1>⚔️ ロビー</h1>
        <div class="user-info">
          ${user.photoURL ? `<img class="user-avatar" src="${user.photoURL}" alt="" />` : ''}
          <span>${user.displayName || 'プレイヤー'}</span>
          <button class="btn-secondary btn-small" id="btn-logout">ログアウト</button>
        </div>
      </div>

      <div class="lobby-actions">
        <div class="action-card">
          <h2>🏠 ルームを作成</h2>
          <button class="btn-primary" id="btn-create-room" style="width: 100%;">
            新しいルームを作る
          </button>
        </div>

        <div class="action-card">
          <h2>🚪 ルームに参加</h2>
          <div class="join-form">
            <input type="text" id="input-room-id" placeholder="ルームID" maxlength="6" />
            <button class="btn-primary" id="btn-join-room">参加</button>
          </div>
          <p class="error-msg" id="join-error"></p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-logout').addEventListener('click', onLogout);

  document.getElementById('btn-create-room').addEventListener('click', async () => {
    const btn = document.getElementById('btn-create-room');
    try {
      btn.disabled = true;
      btn.innerHTML = `<span class="loading-spinner"></span> 作成中...`;
      const roomId = await createRoom(user);
      showToast(`ルーム ${roomId} を作成しました`, 'success');
      onRoomJoined(roomId);
    } catch (err) {
      showToast('ルーム作成に失敗しました', 'error');
      btn.innerHTML = '新しいルームを作る';
      btn.disabled = false;
    }
  });

  document.getElementById('btn-join-room').addEventListener('click', async () => {
    const input = document.getElementById('input-room-id');
    const errorEl = document.getElementById('join-error');
    const roomId = input.value.trim().toUpperCase();

    if (!roomId) {
      errorEl.textContent = 'ルームIDを入力してください';
      return;
    }

    try {
      errorEl.textContent = '';
      await joinRoom(roomId, user);
      showToast(`ルーム ${roomId} に参加しました`, 'success');
      onRoomJoined(roomId);
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });

  // Enterキーで参加
  document.getElementById('input-room-id').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('btn-join-room').click();
    }
  });
}

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
          <h2>👤ホスト：ロビーを作成</h2>
          <p class="action-desc">このボタンを押して参加者にロビーIDを共有します。</p>
          <button class="btn-primary" id="btn-create-room" style="width: 100%;">
            新しいロビーを作る
          </button>
        </div>

        <div class="action-card">
          <h2>👥他の参加者：ロビーに参加</h2>
          <p class="action-desc">ホストから教えてもらったロビーIDを入力して「参加」します。</p>
          <div class="join-form">
            <input type="text" id="input-room-id" placeholder="ロビーID" maxlength="6" autocomplete="off" spellcheck="false" autocorrect="off" />
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
      showToast(`ロビー ${roomId} を作成しました`, 'success');
      onRoomJoined(roomId);
    } catch (err) {
      console.error('Room creation error:', err);
      showToast('ロビー作成に失敗しました', 'error');
      btn.innerHTML = '新しいロビーを作る';
      btn.disabled = false;
    }
  });

  document.getElementById('btn-join-room').addEventListener('click', async () => {
    const input = document.getElementById('input-room-id');
    const errorEl = document.getElementById('join-error');
    const roomId = input.value.trim().toUpperCase();

    if (!roomId) {
      errorEl.textContent = 'ロビーIDを入力してください';
      return;
    }

    try {
      errorEl.textContent = '';
      await joinRoom(roomId, user);
      showToast(`ロビー ${roomId} に参加しました`, 'success');
      onRoomJoined(roomId);
    } catch (err) {
      console.error('Room join error:', err);
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

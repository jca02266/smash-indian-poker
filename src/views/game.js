import { subscribeRoom, leaveRoom } from '../game/room.js';
import { startRound, submitDecision, checkAllDecided, revealCards, submitResult, resetForNextRound } from '../game/round.js';
import { getCharacterById } from '../game/cards.js';
import { showToast } from '../main.js';

let unsubscribe = null;

function getHandicapClass(handicap) {
  if (handicap >= 150) return 'high';
  if (handicap >= 60) return 'medium';
  return 'low';
}

function getStatusLabel(status) {
  const labels = {
    waiting: '待機中',
    playing: 'カード配布済み',
    judging: '全カード公開',
    result: 'ラウンド結果',
    waiting_next: '次のラウンド待ち',
  };
  return labels[status] || status;
}

export function renderGame(container, user, roomId, { onLeave }) {
  // 初期表示
  container.innerHTML = `
    <div class="game-screen">
      <div id="game-content">
        <p style="text-align:center; color: var(--text-muted);">
          <span class="loading-spinner"></span> 読み込み中...
        </p>
      </div>
    </div>
  `;

  // リアルタイム監視開始
  unsubscribe = subscribeRoom(roomId, (roomData) => {
    if (!roomData) {
      showToast('ルームが見つかりません', 'error');
      cleanup();
      onLeave();
      return;
    }
    renderRoomState(container.querySelector('#game-content'), user, roomId, roomData, onLeave);
  });
}

function cleanup() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}

function renderRoomState(el, user, roomId, room, onLeave) {
  const isHost = room.hostUid === user.uid;
  const players = room.players || {};
  const playerUids = Object.keys(players);
  const myCard = room.currentCards?.[user.uid];

  let html = '';

  // ===== 待機中 =====
  if (room.status === 'waiting') {
    html = renderWaitingRoom(room, roomId, user, isHost, players, playerUids);
  }
  // ===== プレイ中（カード配布済み、意思表示フェーズ） =====
  else if (room.status === 'playing') {
    html = renderPlayingPhase(room, user, roomId, players, playerUids, isHost);
  }
  // ===== 全カード公開（判定フェーズ） =====
  else if (room.status === 'judging') {
    html = renderJudgingPhase(room, user, roomId, players, playerUids, isHost);
  }
  // ===== ラウンド結果 =====
  else if (room.status === 'result') {
    html = renderResultPhase(room, user, roomId, players, playerUids, isHost);
  }
  // ===== 次のラウンド待ち =====
  else if (room.status === 'waiting_next') {
    html = renderWaitingRoom(room, roomId, user, isHost, players, playerUids);
  }

  el.innerHTML = html;
  bindEventHandlers(el, user, roomId, room, isHost, onLeave);
}

// ===== Render Functions =====

function renderWaitingRoom(room, roomId, user, isHost, players, playerUids) {
  return `
    <div class="waiting-screen">
      <div class="room-id-display">
        <div class="room-id-label">ルームID</div>
        <div class="room-id-value" id="room-id-copy" title="クリックしてコピー">${roomId}</div>
        <div class="room-id-hint">タップしてコピー</div>
      </div>

      ${renderScoreboard(players)}

      <ul class="player-list">
        ${playerUids.map(uid => {
          const p = players[uid];
          return `
            <li class="player-item ${uid === room.hostUid ? 'host' : ''}">
              ${p.photoURL ? `<img class="player-avatar" src="${p.photoURL}" alt="" />` : '<div class="player-avatar" style="background: var(--bg-card-hover); display:flex; align-items:center; justify-content:center;">👤</div>'}
              <span class="player-name">${p.displayName}</span>
              ${uid === room.hostUid ? '<span class="player-badge">ホスト</span>' : ''}
            </li>
          `;
        }).join('')}
      </ul>

      <div class="deck-info">
        残りキャラカード: ${(room.characterDeck || []).length}枚
      </div>

      <div class="waiting-actions">
        ${isHost && playerUids.length >= 2 ? '<button class="btn-primary" id="btn-start-round">ゲーム開始</button>' : ''}
        ${isHost && playerUids.length < 2 ? '<button class="btn-primary" disabled>2人以上で開始</button>' : ''}
        <button class="btn-secondary" id="btn-leave-room">退出</button>
      </div>
    </div>
  `;
}

function renderPlayingPhase(room, user, roomId, players, playerUids, isHost) {
  const allDecided = checkAllDecided(room);
  const myDecision = room.decisions?.[user.uid];

  return `
    ${renderGameHeader(room)}
    ${renderCards(room, user, players, playerUids, false)}

    <div class="decision-area">
      ${!myDecision ? `
        <p class="decision-prompt">対戦に参加しますか？</p>
        <div class="decision-buttons">
          <button class="btn-fight" id="btn-fight">⚔️ 参加する</button>
          <button class="btn-fold" id="btn-fold">🏳️ 降りる</button>
        </div>
      ` : `
        <p class="decision-done">
          ${myDecision === 'fight' ? '⚔️ 参加を選択しました' : '🏳️ 降りることにしました'}
        </p>
        <p class="decision-waiting" style="margin-top: 0.5rem;">
          他のプレイヤーの選択を待っています...
          （${Object.keys(room.decisions || {}).length}/${playerUids.length}）
        </p>
      `}
    </div>

    ${allDecided && isHost ? `
      <div class="game-actions">
        <button class="btn-primary" id="btn-reveal">全カードを公開する</button>
      </div>
    ` : ''}
  `;
}

function renderJudgingPhase(room, user, roomId, players, playerUids, isHost) {
  // 参加者のみ取得
  const fighters = playerUids.filter(uid => room.decisions?.[uid] === 'fight');

  return `
    ${renderGameHeader(room)}
    ${renderCards(room, user, players, playerUids, true)}

    ${isHost ? `
      <div class="result-area">
        <h3 class="result-title">🏆 対戦結果を入力</h3>
        <div class="result-form">
          <label for="select-winner">優勝（+1pt）</label>
          <select id="select-winner">
            <option value="">-- 選択 --</option>
            <option value="none">優勝なし</option>
            ${fighters.map(uid => `<option value="${uid}">${players[uid].displayName}</option>`).join('')}
          </select>

          <label for="select-loser">最下位（-1pt）</label>
          <select id="select-loser">
            <option value="">-- 選択 --</option>
            <option value="none">最下位なし</option>
            ${fighters.map(uid => `<option value="${uid}">${players[uid].displayName}</option>`).join('')}
          </select>

          <button class="btn-primary" id="btn-submit-result" style="width: 100%; margin-top: 0.5rem;">
            結果を確定
          </button>
        </div>
      </div>
    ` : `
      <div style="text-align:center; color: var(--text-muted); padding: 1rem;">
        ホストが結果を入力中...
      </div>
    `}
  `;
}

function renderResultPhase(room, user, roomId, players, playerUids, isHost) {
  const winner = room.results?.winner;
  const loser = room.results?.loser;

  return `
    ${renderGameHeader(room)}
    ${renderCards(room, user, players, playerUids, true)}

    <div class="round-result-display">
      <h3>ラウンド ${room.round} 結果</h3>
      ${winner && players[winner] ? `<div class="result-winner">🏆 優勝: ${players[winner].displayName} (+1pt)</div>` : ''}
      ${loser && players[loser] ? `<div class="result-loser">💀 最下位: ${players[loser].displayName} (-1pt)</div>` : ''}
      ${!winner && !loser ? '<div style="color: var(--text-muted);">結果なし</div>' : ''}
    </div>

    ${renderScoreboard(players)}

    <div class="game-actions">
      ${isHost ? `
        ${(room.characterDeck || []).length >= playerUids.length
          ? '<button class="btn-primary" id="btn-next-round">次のラウンドへ</button>'
          : '<button class="btn-secondary" disabled>カードがありません</button>'}
        <button class="btn-secondary" id="btn-leave-room">ゲーム終了</button>
      ` : `
        <div style="text-align:center; color: var(--text-muted);">
          ホストが次のラウンドを開始します...
        </div>
      `}
    </div>
  `;
}

// ===== Helper Renderers =====

function renderGameHeader(room) {
  return `
    <div class="game-header">
      <div class="game-round">ROUND <span>${room.round}</span></div>
      <div class="game-status">${getStatusLabel(room.status)}</div>
    </div>
  `;
}

function renderCards(room, user, players, playerUids, showAll) {
  return `
    <div class="cards-container">
      ${playerUids.map(uid => {
        const card = room.currentCards?.[uid];
        if (!card) return '';

        const isMe = uid === user.uid;
        const isHidden = isMe && !showAll;
        const character = getCharacterById(card.characterId);
        const decision = room.decisions?.[uid];
        const cardClass = isMe ? (showAll ? 'mine revealed' : 'mine hidden') : (showAll ? 'revealed' : '');

        return `
          <div class="card ${cardClass}">
            ${decision ? `<span class="card-decision-badge ${decision}">${decision === 'fight' ? '⚔️' : '🏳️'}</span>` : ''}
            <div class="card-player-name ${isMe ? 'is-me' : ''}">${players[uid].displayName}${isMe ? '（自分）' : ''}</div>
            <div class="card-content">
              ${character ? `
                <img class="card-character-icon" src="/icons/${character.icon}" alt="${character.name}" />
                <div class="card-character-name">${character.name}</div>
              ` : `
                <div class="card-character-name">???</div>
              `}
              <div class="card-handicap ${getHandicapClass(card.handicap)}">${card.handicap}%</div>
            </div>
            ${isHidden ? '<div class="card-hidden-label">🃏</div>' : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderScoreboard(players) {
  const entries = Object.entries(players).sort((a, b) => (b[1].score || 0) - (a[1].score || 0));

  return `
    <div class="scoreboard">
      <div class="scoreboard-title">📊 スコア</div>
      <ul class="scoreboard-list">
        ${entries.map(([uid, p]) => {
          const score = p.score || 0;
          const cls = score > 0 ? 'positive' : score < 0 ? 'negative' : 'zero';
          return `
            <li class="score-item">
              <span class="score-name">${p.displayName}</span>
              <span class="score-value ${cls}">${score > 0 ? '+' : ''}${score}</span>
            </li>
          `;
        }).join('')}
      </ul>
    </div>
  `;
}

// ===== Event Binding =====

function bindEventHandlers(el, user, roomId, room, isHost, onLeave) {
  // ルームIDコピー
  el.querySelector('#room-id-copy')?.addEventListener('click', () => {
    navigator.clipboard.writeText(roomId).then(() => {
      showToast('ルームIDをコピーしました', 'success');
    });
  });

  // ゲーム開始
  el.querySelector('#btn-start-round')?.addEventListener('click', async () => {
    try {
      await startRound(roomId, room);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // 参加
  el.querySelector('#btn-fight')?.addEventListener('click', async () => {
    try {
      await submitDecision(roomId, user.uid, 'fight');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // 降りる
  el.querySelector('#btn-fold')?.addEventListener('click', async () => {
    try {
      await submitDecision(roomId, user.uid, 'fold');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // 全カード公開
  el.querySelector('#btn-reveal')?.addEventListener('click', async () => {
    try {
      await revealCards(roomId);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // 結果送信
  el.querySelector('#btn-submit-result')?.addEventListener('click', async () => {
    const winnerVal = document.getElementById('select-winner')?.value;
    const loserVal = document.getElementById('select-loser')?.value;

    if (!winnerVal || !loserVal) {
      showToast('優勝と最下位を選択してください', 'error');
      return;
    }

    const winnerId = winnerVal === 'none' ? null : winnerVal;
    const loserId = loserVal === 'none' ? null : loserVal;

    try {
      await submitResult(roomId, room, winnerId, loserId);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // 次のラウンド
  el.querySelector('#btn-next-round')?.addEventListener('click', async () => {
    try {
      await resetForNextRound(roomId);
      // resetForNextRoundでstatus='waiting_next'にした後、すぐに次のラウンドを開始
      const updatedRoom = { ...room, status: 'waiting_next' };
      await startRound(roomId, room);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // 退出
  el.querySelector('#btn-leave-room')?.addEventListener('click', async () => {
    try {
      await leaveRoom(roomId, user.uid);
      cleanup();
      onLeave();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

export function cleanupGame() {
  cleanup();
}

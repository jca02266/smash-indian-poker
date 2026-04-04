import { subscribeRoom, leaveRoom, updateUserRole, kickPlayer, deleteRoom } from '../game/room.js';
import { startRound, submitDecision, checkAllDecided, revealCards, submitResult, resetForNextRound, abortRound } from '../game/round.js';
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
  unsubscribe = subscribeRoom(roomId, (data) => {
    const el = container.querySelector('#game-content');
    if (!data) {
      showToast('ルームが見つかりません', 'error');
      cleanup();
      onLeave();
      return;
    }

    // 自分がキックされたか退席した場合
    if (!data.players[user.uid]) {
      cleanup();
      onLeave();
      return;
    }

    renderRoomState(el, user, roomId, data, onLeave);
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
  const playerUids = Object.keys(players).sort((a, b) => (players[a].order || 0) - (players[b].order || 0));
  const myCard = room.currentCards?.[user.uid];

  let html = '';

  const isSpectator = players[user.uid]?.isSpectator;

  // ===== 待機中 =====
  if (room.status === 'waiting') {
    html = renderWaitingRoom(room, roomId, user, isHost, players, playerUids, isSpectator);
  }
  // ===== プレイ中（カード配布済み、意思表示フェーズ） =====
  else if (room.status === 'playing') {
    html = renderPlayingPhase(room, user, roomId, players, playerUids, isHost, isSpectator);
  }
  // ===== 全カード公開（判定フェーズ） =====
  else if (room.status === 'judging') {
    html = renderJudgingPhase(room, user, roomId, players, playerUids, isHost, isSpectator);
  }
  // ===== ラウンド結果 =====
  else if (room.status === 'result') {
    html = renderResultPhase(room, user, roomId, players, playerUids, isHost, isSpectator);
  }
  // ===== 次のラウンド待ち =====
  else if (room.status === 'waiting_next') {
    html = renderWaitingRoom(room, roomId, user, isHost, players, playerUids, isSpectator);
  }

  el.innerHTML = html;
  bindEventHandlers(el, user, roomId, room, isHost, onLeave);
}

// ===== Render Functions =====

function renderWaitingRoom(room, roomId, user, isHost, players, playerUids, isSpectator) {
  const activePlayers = playerUids.filter(uid => !players[uid].isSpectator);
  const spectators = playerUids.filter(uid => players[uid].isSpectator);

  return `
    <div class="waiting-screen">
      <div class="room-id-display">
        <div class="room-id-label">ルームID</div>
        <div class="room-id-value" id="room-id-copy" title="クリックしてコピー">${roomId}</div>
        <div class="room-id-hint">タップしてコピー</div>
      </div>

      <div class="spectator-counter">
        👁️ 観戦者: ${spectators.length} / 10
      </div>

      ${renderRoleSelector(isSpectator, false)}

      ${renderScoreboard(players)}

      <div class="waiting-section-title">対戦者 (${activePlayers.length} / 4)</div>
      <ul class="player-list">
        ${activePlayers.map(uid => {
          const p = players[uid];
          return `
            <li class="player-item ${uid === room.hostUid ? 'host' : ''}">
              <div class="player-avatar" style="background: var(--bg-card-hover); display:flex; align-items:center; justify-content:center;">👤</div>
              <span class="player-name">${p.displayName}${uid === user.uid ? '（自分）' : ''}</span>
              ${uid === room.hostUid ? '<span class="player-badge">ホスト</span>' : ''}
              ${isHost && uid !== user.uid ? `<button class="btn-kick" data-uid="${uid}" data-name="${p.displayName}">❌</button>` : ''}
            </li>
          `;
        }).join('')}
      </ul>

      ${spectators.length > 0 ? `
        <div class="waiting-section-title">観戦者</div>
        <ul class="player-list spectator-list">
          ${spectators.map(uid => {
            const p = players[uid];
            return `
              <li class="player-item ${uid === room.hostUid ? 'host' : ''} spectator-item">
                <span class="player-name">${p.displayName}${uid === user.uid ? '（自分）' : ''}</span>
                ${uid === room.hostUid ? '<span class="player-badge">ホスト</span>' : ''}
                ${isHost && uid !== user.uid ? `<button class="btn-kick" data-uid="${uid}" data-name="${p.displayName}">❌</button>` : ''}
              </li>
            `;
          }).join('')}
        </ul>
      ` : ''}

      <div class="deck-info" style="margin-top: 1.5rem;">
        残りキャラカード: ${(room.characterDeck || []).length}枚
      </div>

      <div class="waiting-actions">
        ${isHost && activePlayers.length >= 2 ? '<button class="btn-primary" id="btn-start-round">ゲーム開始</button>' : ''}
        ${isHost && activePlayers.length < 2 ? '<button class="btn-primary" disabled>2人以上で開始</button>' : ''}
        <button class="btn-secondary" id="btn-leave-room">退出</button>
      </div>

      ${isHost ? `
        <div class="game-actions" style="margin-top: 2rem;">
          <button class="btn-danger btn-small" id="btn-delete-room" style="opacity: 0.7;">🗑️ ルームを削除して終了</button>
        </div>
      ` : ''}
    </div>
  `;
}

function renderPlayingPhase(room, user, roomId, players, playerUids, isHost, isSpectator) {
  const allDecided = checkAllDecided(room);
  const myDecision = room.decisions?.[user.uid];
  const activePlayers = playerUids.filter(uid => !players[uid].isSpectator);
  const spectatorCount = playerUids.filter(uid => players[uid].isSpectator).length;

  return `
    ${renderGameHeader(room)}
    ${renderScoreboard(players)}
    ${renderRoleSelector(isSpectator, true)}
    <div class="spectator-counter-mini">👁️ 観戦者: ${spectatorCount} / 10</div>
    ${renderCards(room, user, players, playerUids, isSpectator)}

    <div class="decision-area">
      ${isSpectator ? `
        <p class="decision-done" style="color: var(--accent-blue);">👁️ 観戦中です（全員のカードが見えています）</p>
      ` : !myDecision ? `
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
          （${Object.keys(room.decisions || {}).length}/${activePlayers.length}）
        </p>
      `}
    </div>

    ${allDecided && isHost ? `
      <div class="game-actions">
        <button class="btn-primary" id="btn-reveal">全カードを公開する</button>
      </div>
    ` : ''}

    ${isHost ? `
      <div class="game-actions" style="margin-top: 1rem;">
        <button class="btn-danger btn-small" id="btn-abort">⚠️ ラウンドを中断する</button>
      </div>
    ` : ''}
  `;
}

function renderJudgingPhase(room, user, roomId, players, playerUids, isHost, isSpectator) {
  // 参加者のみ取得
  const fighters = playerUids.filter(uid => room.decisions?.[uid] === 'fight');
  const spectatorCount = playerUids.filter(uid => players[uid].isSpectator).length;

  return `
    ${renderGameHeader(room)}
    ${renderScoreboard(players)}
    ${renderRoleSelector(isSpectator, true)}
    <div class="spectator-counter-mini">👁️ 観戦者: ${spectatorCount} / 10</div>
    ${renderCards(room, user, players, playerUids, true)}

    ${isHost ? `
      <div class="result-area">
        <h3 class="result-title">🏆 対戦結果を入力</h3>
        <div class="result-grid">
          <div class="result-grid-header">
            <span>プレイヤー</span>
            <span>🏆 優勝</span>
            <span>💀 最下位</span>
          </div>
          <div class="result-grid-row">
            <span>（選択なし）</span>
            <label><input type="radio" name="winner" value="none" checked></label>
            <label><input type="radio" name="loser" value="none" checked></label>
          </div>
          ${fighters.map(uid => `
            <div class="result-grid-row">
              <span class="player-name">${players[uid].displayName}</span>
              <label><input type="radio" name="winner" value="${uid}"></label>
              <label><input type="radio" name="loser" value="${uid}"></label>
            </div>
          `).join('')}
        </div>
        <button class="btn-primary" id="btn-submit-result" style="width: 100%; margin-top: 1.5rem;">
          結果を確定
        </button>
      </div>
    ` : `
      <div style="text-align:center; color: var(--text-muted); padding: 1rem;">
        ホストが結果を入力中...
      </div>
    `}

    ${isHost ? `
      <div class="game-actions" style="margin-top: 1rem;">
        <button class="btn-danger btn-small" id="btn-abort">⚠️ 記録せず中断</button>
      </div>
    ` : ''}
  `;
}

function renderResultPhase(room, user, roomId, players, playerUids, isHost, isSpectator) {
  const winner = room.results?.winner;
  const loser = room.results?.loser;
  const spectatorCount = playerUids.filter(uid => players[uid].isSpectator).length;

  return `
    ${renderGameHeader(room)}
    ${renderScoreboard(players)}
    ${renderRoleSelector(isSpectator, true)}
    <div class="spectator-counter-mini">👁️ 観戦者: ${spectatorCount} / 10</div>
    ${renderCards(room, user, players, playerUids, true)}

    <div class="round-result-display">
      <h3>ラウンド ${room.round} 結果</h3>
      ${winner && players[winner] ? `<div class="result-winner">🏆 優勝: ${players[winner].displayName} (+1pt)</div>` : ''}
      ${loser && players[loser] ? `<div class="result-loser">💀 最下位: ${players[loser].displayName} (-1pt)</div>` : ''}
      ${!winner && !loser ? '<div style="color: var(--text-muted);">結果なし</div>' : ''}
    </div>

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

      ${isHost ? `
        <div class="game-actions" style="margin-top: 2rem;">
          <button class="btn-danger btn-small" id="btn-delete-room" style="opacity: 0.7;">🗑️ ルームを削除して終了</button>
        </div>
      ` : ''}
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
      ${playerUids.filter(uid => !players[uid].isSpectator).map(uid => {
        const card = room.currentCards?.[uid];
        if (!card) return '';

        const isMe = uid === user.uid;
        const character = getCharacterById(card.characterId);
        const decision = room.decisions?.[uid];
        
        let cardClass = isMe ? 'mine' : '';
        if (isMe && !showAll) {
          cardClass += ' hidden';
        } else {
          cardClass += ' revealed';
        }

        return `
          <div class="card ${cardClass}">
            ${decision ? `<span class="card-decision-badge ${decision}">${decision === 'fight' ? '⚔️' : '🏳️'}</span>` : ''}
            <div class="card-player-name ${isMe ? 'is-me' : ''}">${players[uid].displayName}${isMe ? '（自分）' : ''}</div>
            <div class="card-content" ${isMe && !showAll ? 'style="display: none;"' : ''}>
              ${character ? `
                <img class="card-character-icon" src="/icons/${character.icon}" alt="${character.name}" />
                <div class="card-character-name">${character.name}</div>
              ` : `
                <div class="card-character-name">???</div>
              `}
              <div class="card-handicap ${getHandicapClass(card.handicap)}">${card.handicap}%</div>
            </div>
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
    const winner = el.querySelector('input[name="winner"]:checked')?.value;
    const loser = el.querySelector('input[name="loser"]:checked')?.value;
    
    if (!winner || !loser) {
      showToast('優勝と最下位を選択してください（なしの場合は「選択なし」）', 'error');
      return;
    }
    
    if (winner !== 'none' && loser !== 'none' && winner === loser) {
      showToast('同じプレイヤーを優勝と最下位に選ぶことはできません', 'error');
      return;
    }

    try {
      await submitResult(roomId, {
        winner: winner === 'none' ? null : winner,
        loser: loser === 'none' ? null : loser
      });
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // 次のラウンドへ
  el.querySelector('#btn-next-round')?.addEventListener('click', async () => {
    try {
      await resetForNextRound(roomId);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // ルームを削除
  el.querySelector('#btn-delete-room')?.addEventListener('click', async () => {
    if (!confirm('ルームを完全に削除して終了しますか？参加者全員がロビーに戻されます。')) return;
    try {
      await deleteRoom(roomId);
      localStorage.removeItem('roomId');
      showToast('ルームを削除しました', 'info');
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

  // 役割変更（プレイヤー）
  el.querySelector('#btn-role-player')?.addEventListener('click', async () => {
    if (room.status !== 'waiting' && room.status !== 'waiting_next') {
      showToast('ゲーム進行中の役割変更はできません（次のラウンドをお待ちください）', 'error');
      return;
    }
    try {
      await updateUserRole(roomId, user.uid, false);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // 役割変更（観戦者）
  el.querySelector('#btn-role-spectator')?.addEventListener('click', async () => {
    if (room.status !== 'waiting' && room.status !== 'waiting_next') {
      showToast('ゲーム進行中の役割変更はできません（次のラウンドをお待ちください）', 'error');
      return;
    }
    try {
      await updateUserRole(roomId, user.uid, true);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // ラウンド中断
  el.querySelector('#btn-abort')?.addEventListener('click', async () => {
    if (!confirm('現在のラウンドを中断して待機画面へ戻りますか？（スコアは記録されません）')) return;
    try {
      await abortRound(roomId);
      showToast('ゲームを中断しました', 'info');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // プレイヤーのキック
  el.querySelectorAll('.btn-kick').forEach(btn => {
    btn.addEventListener('click', async () => {
      const targetUid = btn.dataset.uid;
      const targetName = btn.dataset.name;
      if (!confirm(`${targetName} さんを退室させますか？`)) return;
      try {
        await kickPlayer(roomId, targetUid);
        showToast(`${targetName} さんを退室させました`, 'info');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

function renderRoleSelector(isSpectator, isMidGame) {
  return `
    <div class="role-selectorcard ${isMidGame ? 'mid-game' : ''}">
      <p class="role-selector-label">${isMidGame ? '現在の役割' : 'あなたの役割を選択'}</p>
      <div class="role-switch">
        <button class="role-btn ${!isSpectator ? 'active' : ''} ${isMidGame && isSpectator ? 'disabled' : ''}" id="btn-role-player">⚔️ 対戦する</button>
        <button class="role-btn ${isSpectator ? 'active' : ''} ${isMidGame && !isSpectator ? 'disabled' : ''}" id="btn-role-spectator">👁️ 観戦する</button>
      </div>
      ${isMidGame ? '<p class="role-hint">ゲーム進行中は変更できません</p>' : ''}
    </div>
  `;
}

export function cleanupGame() {
  cleanup();
}

import { db } from '../firebase.js';
import { doc, updateDoc } from 'firebase/firestore';
import { dealCards, createHandicapDeck, shuffle } from './cards.js';

function roomRef(roomId) {
  return doc(db, 'rooms', roomId);
}

/**
 * 新しいラウンドを開始（カード配布）
 */
export async function startRound(roomId, roomData) {
  const playerUids = Object.keys(roomData.players);
  const playerCount = playerUids.length;

  if (playerCount < 2) {
    throw new Error('2人以上のプレイヤーが必要です');
  }

  // キャラクターカードを配る（山札から消費）
  let charDeck = roomData.characterDeck || [];
  if (charDeck.length < playerCount) {
    throw new Error('キャラクターカードが足りません。ゲーム終了です。');
  }
  const charResult = dealCards(charDeck, playerCount);

  // ハンデカードは毎回全デッキからシャッフルして配る
  const handicapDeck = shuffle(createHandicapDeck());
  const dealtHandicaps = handicapDeck.slice(0, playerCount);

  // 各プレイヤーにカードを割り当て
  const currentCards = {};
  playerUids.forEach((uid, i) => {
    currentCards[uid] = {
      characterId: charResult.dealt[i],
      handicap: dealtHandicaps[i],
    };
  });

  const newRound = (roomData.round || 0) + 1;

  await updateDoc(roomRef(roomId), {
    status: 'playing',
    round: newRound,
    characterDeck: charResult.remaining,
    currentCards,
    decisions: {},
    results: { winner: null, loser: null },
  });

  return newRound;
}

/**
 * 参加/降りの意思表示
 */
export async function submitDecision(roomId, uid, decision) {
  if (decision !== 'fight' && decision !== 'fold') {
    throw new Error('無効な選択です');
  }

  await updateDoc(roomRef(roomId), {
    [`decisions.${uid}`]: decision,
  });
}

/**
 * 全員が意思表示したか判定
 */
export function checkAllDecided(roomData) {
  const playerUids = Object.keys(roomData.players);
  const decisionUids = Object.keys(roomData.decisions || {});
  return playerUids.every(uid => decisionUids.includes(uid));
}

/**
 * 全カード公開フェーズへ移行
 */
export async function revealCards(roomId) {
  await updateDoc(roomRef(roomId), {
    status: 'judging',
  });
}

/**
 * 対戦結果を入力
 */
export async function submitResult(roomId, roomData, winnerId, loserId) {
  const players = { ...roomData.players };

  // ポイント計算
  if (winnerId && players[winnerId]) {
    players[winnerId] = {
      ...players[winnerId],
      score: (players[winnerId].score || 0) + 1,
    };
  }
  if (loserId && players[loserId]) {
    players[loserId] = {
      ...players[loserId],
      score: (players[loserId].score || 0) - 1,
    };
  }

  await updateDoc(roomRef(roomId), {
    status: 'result',
    results: { winner: winnerId || null, loser: loserId || null },
    players,
  });
}

/**
 * 次のラウンドへ（待機状態に戻す）
 */
export async function resetForNextRound(roomId) {
  await updateDoc(roomRef(roomId), {
    status: 'waiting_next',
  });
}

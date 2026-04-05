import { db } from '../firebase.js';
import {
  doc, setDoc, getDoc, updateDoc, onSnapshot, serverTimestamp, deleteField, deleteDoc
} from 'firebase/firestore';
import { createCharacterDeck, createHandicapDeck, shuffle } from './cards.js';

/**
 * 6桁のロビーIDを生成
 */
export function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 紛らわしい文字を除外
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

/**
 * ロビードキュメントの参照を取得
 */
function roomRef(roomId) {
  return doc(db, 'smashindianpoker', 'data', 'rooms', roomId);
}

/**
 * ロビーを作成
 */
export async function createRoom(user, isSpectator = false) {
  const roomId = generateRoomId();
  const characterDeck = shuffle(createCharacterDeck());
  const handicapDeck = shuffle(createHandicapDeck());

  await setDoc(roomRef(roomId), {
    hostUid: user.uid,
    status: 'waiting',
    round: 0,
    createdAt: serverTimestamp(),
    characterDeck,
    handicapDeck,
    currentCards: {},
    decisions: {},
    results: { winner: null, loser: null },
    players: {
      [user.uid]: {
        displayName: user.displayName || 'プレイヤー',
        photoURL: user.photoURL || '',
        score: 0,
        order: 0,
        isSpectator: false,
      },
    },
  });

  return roomId;
}

/**
 * ロビーに参加
 */
export async function joinRoom(roomId, user) {
  const ref = roomRef(roomId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error('ロビーが見つかりません');
  }

  const data = snap.data();
  const isMidGame = data.status !== 'waiting' && data.status !== 'waiting_next';

  // 既に参加済みならスキップ
  if (data.players[user.uid]) {
    return;
  }

  const players = Object.values(data.players);
  if (players.length >= 14) {
    throw new Error('ロビーが満員です');
  }

  await updateDoc(ref, {
    [`players.${user.uid}`]: {
      displayName: user.displayName || 'プレイヤー',
      photoURL: user.photoURL || '',
      score: 0,
      order: players.length,
      isSpectator: isMidGame, // ゲーム中なら強制的に観戦者
    },
  });
}

/**
 * 役割（プレイヤー/観戦者）を変更
 */
export async function updateUserRole(roomId, uid, isSpectator) {
  const ref = roomRef(roomId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data();
  const players = Object.values(data.players);

  if (isSpectator) {
    const spectatorCount = players.filter(p => p.isSpectator).length;
    if (spectatorCount >= 10) throw new Error('観戦者が満員です（最大10人）');
  } else {
    const activeCount = players.filter(p => !p.isSpectator).length;
    if (activeCount >= 4) throw new Error('プレイヤーが満員です（最大4人）');
  }

  await updateDoc(ref, {
    [`players.${uid}.isSpectator`]: isSpectator,
  });
}

/**
 * ロビーから退出
 */
export async function leaveRoom(roomId, uid) {
  const ref = roomRef(roomId);
  await updateDoc(ref, {
    [`players.${uid}`]: deleteField(),
  });
}

/**
 * ロビーから強制退出（ホスト用）
 */
export async function kickPlayer(roomId, uid) {
  const ref = roomRef(roomId);
  await updateDoc(ref, {
    [`players.${uid}`]: deleteField(),
  });
}

/**
 * ロビーを完全に削除（ホスト用）
 */
export async function deleteRoom(roomId) {
  const ref = roomRef(roomId);
  await deleteDoc(ref);
}

/**
 * ロビーをリアルタイム監視
 */
export function subscribeRoom(roomId, callback) {
  return onSnapshot(roomRef(roomId), (snap) => {
    if (snap.exists()) {
      callback({ id: snap.id, ...snap.data() });
    } else {
      callback(null);
    }
  });
}

/**
 * ロビーデータを取得
 */
export async function getRoom(roomId) {
  const snap = await getDoc(roomRef(roomId));
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() };
  }
  return null;
}

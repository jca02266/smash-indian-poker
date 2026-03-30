import { db } from '../firebase.js';
import {
  doc, setDoc, getDoc, updateDoc, onSnapshot, serverTimestamp, deleteField
} from 'firebase/firestore';
import { createCharacterDeck, createHandicapDeck, shuffle } from './cards.js';

/**
 * 6桁のルームIDを生成
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
 * ルームドキュメントの参照を取得
 */
function roomRef(roomId) {
  return doc(db, 'rooms', roomId);
}

/**
 * ルームを作成
 */
export async function createRoom(user) {
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
      },
    },
  });

  return roomId;
}

/**
 * ルームに参加
 */
export async function joinRoom(roomId, user) {
  const ref = roomRef(roomId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error('ルームが見つかりません');
  }

  const data = snap.data();
  if (data.status !== 'waiting') {
    throw new Error('このルームはすでにゲーム中です');
  }

  const playerCount = Object.keys(data.players).length;
  if (playerCount >= 4) {
    throw new Error('ルームが満員です（最大4人）');
  }

  // 既に参加済みならスキップ
  if (data.players[user.uid]) {
    return;
  }

  await updateDoc(ref, {
    [`players.${user.uid}`]: {
      displayName: user.displayName || 'プレイヤー',
      photoURL: user.photoURL || '',
      score: 0,
      order: playerCount,
    },
  });
}

/**
 * ルームから退出
 */
export async function leaveRoom(roomId, uid) {
  const ref = roomRef(roomId);
  await updateDoc(ref, {
    [`players.${uid}`]: deleteField(),
  });
}

/**
 * ルームをリアルタイム監視
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
 * ルームデータを取得
 */
export async function getRoom(roomId) {
  const snap = await getDoc(roomRef(roomId));
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() };
  }
  return null;
}

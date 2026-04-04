import { signInAnonymously, updateProfile, signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase.js';

export async function signInAsGuest(displayName) {
  try {
    const result = await signInAnonymously(auth);
    await updateProfile(result.user, {
      displayName: displayName || '匿名プレイヤー'
    });
    return result.user;
  } catch (error) {
    console.error('ゲストログインエラー:', error);
    throw error;
  }
}

export async function signOut() {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('ログアウトエラー:', error);
    throw error;
  }
}

export function onAuthChanged(callback) {
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser() {
  return auth.currentUser;
}

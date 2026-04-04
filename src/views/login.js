import { signInAsGuest } from '../auth.js';

export function renderLogin(container, onLogin) {
  container.innerHTML = `
    <div class="login-screen">
      <div class="login-logo">⚔️ インディアンポーカー</div>
      <p class="login-subtitle">スマブラ × カードゲーム</p>
      <div class="login-card">
        <div class="guest-login-form">
          <label for="input-guest-name" style="display: block; font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.75rem;">
            プレイヤー名を入力
          </label>
          <input type="text" id="input-guest-name" placeholder="名前" maxlength="10" />
          <p class="error-msg" id="login-error"></p>
          <button class="btn-primary" id="btn-guest-login" style="width: 100%; margin-top: 1rem;">
            ゲームを開始
          </button>
        </div>
      </div>
    </div>
  `;

  const input = document.getElementById('input-guest-name');
  const btn = document.getElementById('btn-guest-login');
  const errorEl = document.getElementById('login-error');

  // 前回の名前があればセット
  const savedName = localStorage.getItem('smash_indian_poker_name');
  if (savedName) input.value = savedName;

  const handleLogin = async () => {
    const name = input.value.trim();
    if (!name) {
      errorEl.textContent = '名前を入力してください';
      return;
    }

    try {
      btn.disabled = true;
      btn.innerHTML = `<span class="loading-spinner"></span> ログイン中...`;
      errorEl.textContent = '';
      
      const user = await signInAsGuest(name);
      localStorage.setItem('smash_indian_poker_name', name);
      onLogin(user);
    } catch (err) {
      errorEl.textContent = 'ログインに失敗しました。もう一度お試しください。';
      btn.innerHTML = 'ゲームを開始';
      btn.disabled = false;
    }
  };

  btn.addEventListener('click', handleLogin);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
}

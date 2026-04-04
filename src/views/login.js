import { signInAsGuest } from '../auth.js';

export function renderLogin(container, onLogin) {
  container.innerHTML = `
    <div class="login-screen">
      <div class="login-header-group">
        <div class="login-logo">⚔️ スマブラ・インディアンポーカー</div>
        <p class="login-subtitle">自分以外の「ハンデ%」を見て、勝負か撤退かを選べ！</p>
      </div>

      <div class="login-card">
        <div class="guest-login-form">
          <label for="input-guest-name" style="display: block; font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.75rem;">
            プレイヤー名を入力して開始
          </label>
          <input type="text" id="input-guest-name" placeholder="例: マリオ" maxlength="10" />
          <p class="error-msg" id="login-error"></p>
          <button class="btn-primary" id="btn-guest-login" style="width: 100%; margin-top: 1rem;">
            ルームへ進む
          </button>
        </div>
      </div>

      <div class="login-info">
        <h3 class="login-info-title">🎮 遊び方</h3>
        <div class="rule-steps">
          <div class="rule-step">
            <div class="rule-icon">🃏</div>
            <div class="rule-content">
              <h4>1. カードが配られる</h4>
              <p>自分以外の「キャラクター」と「ハンデ%」が見えます。自分のカードは本人には見えません。</p>
            </div>
          </div>
          <div class="rule-step">
            <div class="rule-icon">🤝</div>
            <div class="rule-content">
              <h4>2. 駆け引きと決断</h4>
              <p>他人の数値から自分の強さを推測し、勝てると思えば「参加」、負けると思えば「降りる」を選択します。</p>
            </div>
          </div>
          <div class="rule-step">
            <div class="rule-icon">🏆</div>
            <div class="rule-content">
              <h4>3. 結果発表</h4>
              <p>全員でカードを公開！「参加」した人の中で、最もハンデ%が低い（撃墜されにくい）人が勝利です。</p>
            </div>
          </div>
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

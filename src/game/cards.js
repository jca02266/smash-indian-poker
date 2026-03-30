import characters from '../../characters.json';

// ハンデカードの種類（%値）
const HANDICAP_VALUES = [300, 200, 150, 125, 100, 80, 60, 50, 40, 30, 20, 10, 0];
const HANDICAP_COPIES = 4; // 各ハンデカード4枚ずつ

/**
 * キャラクター一覧を取得
 */
export function getCharacters() {
  return characters;
}

/**
 * IDからキャラクター情報を取得
 */
export function getCharacterById(id) {
  return characters.find(c => c.id === id);
}

/**
 * キャラクターデッキを作成（IDの配列）
 */
export function createCharacterDeck() {
  return characters.map(c => c.id);
}

/**
 * ハンデカードデッキを作成
 * 各値4枚ずつ = 52枚
 */
export function createHandicapDeck() {
  const deck = [];
  for (const value of HANDICAP_VALUES) {
    for (let i = 0; i < HANDICAP_COPIES; i++) {
      deck.push(value);
    }
  }
  return deck;
}

/**
 * Fisher-Yates シャッフル
 */
export function shuffle(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * デッキからカードを配る
 * @param {number[]} deck - カードデッキ
 * @param {number} count - 配る枚数
 * @returns {{ dealt: number[], remaining: number[] }}
 */
export function dealCards(deck, count) {
  const shuffled = shuffle(deck);
  return {
    dealt: shuffled.slice(0, count),
    remaining: shuffled.slice(count),
  };
}

export { HANDICAP_VALUES };

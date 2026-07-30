export const COLOR_PALETTE = [
  ['signal-red', 'シグナルレッド', '#ef4444'], ['crimson', 'クリムゾン', '#dc2648'],
  ['coral', 'コーラル', '#f06b5b'], ['orange', 'オレンジ', '#ed7b2f'],
  ['amber', 'アンバー', '#e7a62b'], ['warm-yellow', 'ウォームイエロー', '#d9bd39'],
  ['acid-yellow', 'アシッドイエロー', '#c8e34a'], ['lime', 'ライム', '#8dcc4b'],
  ['mint', 'ミント', '#58c991'], ['emerald', 'エメラルド', '#29a66f'],
  ['forest', 'フォレスト', '#267454'], ['teal', 'ティール', '#268d8a'],
  ['cyan', 'シアン', '#3ab7c7'], ['sky', 'スカイ', '#5bb6ea'],
  ['electric-blue', 'エレクトリックブルー', '#4488ff'], ['cobalt', 'コバルト', '#315fd0'],
  ['navy', 'ネイビー', '#283f7e'], ['iris', 'アイリス', '#6967d9'],
  ['violet', 'バイオレット', '#875bd2'], ['deep-violet', 'ディープバイオレット', '#6138a7'],
  ['magenta', 'マゼンタ', '#c84faf'], ['rose', 'ローズ', '#dc5f88'],
  ['wine', 'ワイン', '#8d3d56'], ['graphite', 'グラファイト', '#52575d'],
  ['silver', 'シルバー', '#969da3'], ['warm-gray', 'ウォームグレー', '#8a8177'],
  ['sand', 'サンド', '#b4a16f'], ['khaki', 'カーキ', '#827b4d'],
  ['brown', 'ブラウン', '#74533d'], ['copper', 'カッパー', '#a5653f'],
  ['clay', 'クレイ', '#9b6258'], ['charcoal', 'チャコール', '#34383b'],
  ['slate', 'スレート', '#4d626e'], ['ice', 'アイス', '#8eb9bf'],
  ['paper', 'ペーパー', '#d8d5c9'], ['white', 'ホワイト', '#f0f0ea'],
].map(([token, label, hex]) => ({ token, label, hex }));

export function resolveColor(tokenOrHex) {
  if (!tokenOrHex) return COLOR_PALETTE.find((color) => color.token === 'graphite');
  const byToken = COLOR_PALETTE.find((color) => color.token === tokenOrHex);
  if (byToken) return byToken;
  if (/^#[0-9a-f]{6}$/i.test(tokenOrHex)) {
    const value = Number.parseInt(tokenOrHex.slice(1), 16);
    const r = value >> 16;
    const g = (value >> 8) & 255;
    const b = value & 255;
    return COLOR_PALETTE.reduce((closest, color) => {
      const candidate = Number.parseInt(color.hex.slice(1), 16);
      const distance = (r - (candidate >> 16)) ** 2
        + (g - ((candidate >> 8) & 255)) ** 2
        + (b - (candidate & 255)) ** 2;
      return !closest || distance < closest.distance ? { ...color, distance } : closest;
    }, null);
  }
  return COLOR_PALETTE.find((color) => color.token === 'graphite');
}

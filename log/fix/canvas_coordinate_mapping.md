# Canvas座標マッピング問題の修正

## 問題の概要

特徴点をcanvasにマーキングする際、ユーザーがクリックした位置と実際に特徴点が描画される位置に大きなズレが発生していました。この問題は、canvas要素の表示サイズと実際の内部サイズが異なることによるものでした。

## 問題の原因分析

### 1. CSS による canvas サイズ制御
```css
/* Canvas */
canvas {
    max-width: 100%;
    height: auto;
    border: 2px solid #3498db;
    border-radius: 5px;
    cursor: crosshair;
    margin-top: 10px;
}

.processed-image-container canvas {
    max-width: 100%;
    height: auto;
    border: 2px solid #27ae60;
    border-radius: 5px;
    cursor: crosshair;
}
```

### 2. Canvas の内部サイズと表示サイズの不一致

**元の画像のcanvas:**
- 内部サイズ: 400px以下にスケーリング済み
- 表示サイズ: CSSの`max-width: 100%`でさらに縮小される可能性

**処理済み画像のcanvas:**
- 内部サイズ: 元画像の自然サイズ（例: 800x600px）
- 表示サイズ: CSSの`max-width: 100%`で大幅に縮小

### 3. 座標変換の欠如

クリック座標は表示サイズ基準で取得されるが、描画は内部サイズ基準で行われるため、座標にズレが発生していました。

## 修正内容

### 1. 処理済み画像用クリックハンドラーの修正

**修正前:**
```javascript
function handleProcessedCanvasClick(event, imageType) {
    const canvas = document.getElementById(`processed-canvas-${imageType}`);
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // 直接クリック座標を使用（問題あり）
    const point = { x: x, y: y, type: currentFeatureType, label: label };
}
```

**修正後:**
```javascript
function handleProcessedCanvasClick(event, imageType) {
    const canvas = document.getElementById(`processed-canvas-${imageType}`);
    
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    // Canvas の表示サイズと実際のサイズの比率を計算
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // 実際のcanvas座標に変換
    const x = clickX * scaleX;
    const y = clickY * scaleY;

    const point = { x: x, y: y, type: currentFeatureType, label: label };
}
```

### 2. 元画像用クリックハンドラーの修正

元画像用も同様の問題があるため、同じ座標変換ロジックを適用しました。

**修正前:**
```javascript
function handleCanvasClick(event, imageType) {
    const canvas = canvases[imageType];
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // 直接クリック座標を使用（問題あり）
}
```

**修正後:**
```javascript
function handleCanvasClick(event, imageType) {
    const canvas = canvases[imageType];
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    // Canvas の表示サイズと実際のサイズの比率を計算
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // 実際のcanvas座標に変換
    const x = clickX * scaleX;
    const y = clickY * scaleY;
}
```

## 座標変換の詳細解説

### 座標変換の計算式

```javascript
// 表示座標を取得
const clickX = event.clientX - rect.left;
const clickY = event.clientY - rect.top;

// スケール比率を計算
const scaleX = canvas.width / rect.width;   // 内部幅 / 表示幅
const scaleY = canvas.height / rect.height; // 内部高さ / 表示高さ

// 内部座標に変換
const x = clickX * scaleX;
const y = clickY * scaleY;
```

### 具体例

**処理済み画像の場合:**
- Canvas内部サイズ: 800x600px
- 表示サイズ: 400x300px (CSSで50%縮小)
- クリック位置: (200, 150) ← 表示座標
- スケール比率: scaleX = 800/400 = 2, scaleY = 600/300 = 2
- 実際の座標: (200×2, 150×2) = (400, 300) ← 内部座標

## 修正結果

### 修正前の問題
- ✗ クリック位置と特徴点描画位置に大きなズレ
- ✗ 処理済み画像で特に顕著（内部サイズが大きいため）
- ✗ ユーザビリティの大幅な低下

### 修正後の改善
- ✅ クリック位置と特徴点描画位置が正確に一致
- ✅ 元画像・処理済み画像の両方で正常動作
- ✅ 画面サイズが変わっても正確な座標変換
- ✅ レスポンシブデザインに対応

## 技術的な背景

### Canvas要素の二重サイズ問題

Canvas要素には2つのサイズ概念があります：

1. **内部サイズ（canvas.width/height）**: 実際の描画領域のピクセル数
2. **表示サイズ（CSS width/height）**: ブラウザ上での見た目のサイズ

この2つが異なる場合、座標変換が必要になります。

### getBoundingClientRect()の活用

```javascript
const rect = canvas.getBoundingClientRect();
```

この関数で取得できる情報：
- `rect.width`: 表示幅
- `rect.height`: 表示高さ
- `rect.left/top`: 画面上での位置

## テスト方法

1. 各種画面サイズでテスト
2. 異なるサイズの画像でテスト
3. ブラウザのズーム機能でテスト
4. 元画像と処理済み画像の両方でテスト

## 今後の考慮事項

- デバイスピクセル比（Retina display等）への対応
- タッチデバイスでの座標精度向上
- 高解像度画像でのパフォーマンス最適化

## まとめ

Canvas要素の内部サイズと表示サイズの違いによる座標ズレ問題を、適切な座標変換により解決しました。これにより、ユーザーがクリックした正確な位置に特徴点が描画されるようになり、システムの使いやすさが大幅に向上しました。
# 特徴点編集機能の実装

## 実装概要

特徴点の編集機能として、右クリックでの削除とドラッグ&ドロップでの移動機能を実装しました。これにより、ユーザーは特徴点を正確に配置・調整できるようになり、システムの使いやすさが大幅に向上しました。

## 実装した機能

### 1. 右クリックでの特徴点削除
- 特徴点を右クリックすることで削除
- ブラウザのコンテキストメニューは無効化
- 削除後は自動的にラベルが再番号付け

### 2. ドラッグ&ドロップでの特徴点移動
- 特徴点をクリックしてドラッグすることで位置を変更
- リアルタイムでの位置更新
- ドラッグ終了時にサーバーへ自動保存

### 3. 操作の改善
- ヒットテスト機能（クリック位置が特徴点の範囲内かチェック）
- 座標変換の統一化
- Canvas全体の再描画機能

## 技術実装の詳細

### 1. 状態管理

ドラッグ操作用のグローバル状態を追加：

```javascript
let dragState = {
    isDragging: false,
    draggedPoint: null,
    draggedPointIndex: -1,
    draggedImageType: null,
    draggedIsProcessed: false,
    startX: 0,
    startY: 0
};
```

### 2. イベントハンドラーの再構築

**従来のclickイベント**から**mousedown/mousemove/mouseup**イベントに変更：

```javascript
// 従来
canvas.addEventListener('click', handleCanvasClick);

// 新実装
canvas.addEventListener('mousedown', handleCanvasMouseDown);
canvas.addEventListener('mousemove', handleCanvasMouseMove);
canvas.addEventListener('mouseup', handleCanvasMouseUp);
canvas.addEventListener('contextmenu', handleCanvasRightClick);
```

### 3. ヒットテスト機能

特徴点のクリック範囲を判定する関数：

```javascript
function hitTestFeaturePoint(x, y, point, radius = 10) {
    const dx = x - point.x;
    const dy = y - point.y;
    return Math.sqrt(dx * dx + dy * dy) <= radius;
}
```

**特徴:**
- 半径10ピクセルの範囲で特徴点を検出
- 数学的距離計算による正確な判定
- カスタマイズ可能な検出範囲

### 4. 座標変換の統一化

座標変換処理を関数化して再利用性を向上：

```javascript
function getCanvasCoordinates(event, canvas) {
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
        x: clickX * scaleX,
        y: clickY * scaleY
    };
}
```

### 5. Canvas再描画システム

効率的な画面更新のための再描画機能：

```javascript
function redrawAllCanvas(imageType, isProcessed) {
    const canvas = isProcessed ? 
        document.getElementById(`processed-canvas-${imageType}`) : 
        canvases[imageType];
    
    const ctx = canvas.getContext('2d');
    
    if (isProcessed) {
        // 処理済み画像の再描画
        const img = new Image();
        img.onload = function() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            redrawFeaturePoints(imageType, true);
        };
        img.src = imageData[imageType].processedImage;
    } else {
        // 元画像の再描画
        // ファイルから画像を読み込んで描画
    }
}
```

## イベントハンドラーの詳細

### 1. マウスダウンハンドラー

```javascript
function handleCanvasMouseDown(event, imageType) {
    const coords = getCanvasCoordinates(event, canvas);

    // 既存の特徴点をチェック
    for (let i = points.length - 1; i >= 0; i--) {
        if (hitTestFeaturePoint(coords.x, coords.y, points[i])) {
            // ドラッグ開始
            dragState.isDragging = true;
            dragState.draggedPoint = points[i];
            // ...その他の状態設定
            return;
        }
    }

    // 新しい特徴点を追加
    const newPoint = { x: coords.x, y: coords.y, type: currentFeatureType };
    points.push(newPoint);
    redrawAllCanvas(imageType, isProcessed);
}
```

### 2. マウス移動ハンドラー

```javascript
function handleCanvasMouseMove(event, imageType) {
    if (!dragState.isDragging) return;

    const coords = getCanvasCoordinates(event, canvas);
    
    // ドラッグ中の特徴点位置を更新
    dragState.draggedPoint.x = coords.x;
    dragState.draggedPoint.y = coords.y;

    // リアルタイム再描画
    redrawAllCanvas(imageType, isProcessed);
}
```

### 3. 右クリックハンドラー

```javascript
function handleCanvasRightClick(event, imageType) {
    event.preventDefault(); // コンテキストメニュー無効化
    
    const coords = getCanvasCoordinates(event, canvas);

    // 特徴点を検索して削除
    for (let i = points.length - 1; i >= 0; i--) {
        if (hitTestFeaturePoint(coords.x, coords.y, points[i])) {
            points.splice(i, 1);
            relabelFeaturePoints(imageType);
            redrawAllCanvas(imageType, isProcessed);
            break;
        }
    }
}
```

### 4. ラベル再番号付け機能

特徴点削除後のラベル整理：

```javascript
function relabelFeaturePoints(imageType) {
    const points = imageData[imageType].points;
    const typeCounts = {};
    
    points.forEach(point => {
        if (!typeCounts[point.type]) {
            typeCounts[point.type] = 0;
        }
        typeCounts[point.type]++;
        point.label = `${getFeatureTypeLabel(point.type)}_${typeCounts[point.type]}`;
    });
}
```

## UI/UXの改善

### 1. 操作説明の追加

HTMLに操作方法の説明を追加：

```html
<div class="marking-instructions">
    <h4>操作方法</h4>
    <ul>
        <li><strong>左クリック:</strong> 新しい特徴点を追加</li>
        <li><strong>ドラッグ:</strong> 特徴点を移動（特徴点をクリックしてドラッグ）</li>
        <li><strong>右クリック:</strong> 特徴点を削除</li>
    </ul>
</div>
```

### 2. スタイリングの改善

操作説明のための専用スタイル：

```css
.marking-instructions {
    background-color: #e8f5e8;
    padding: 15px;
    border-radius: 5px;
    border-left: 4px solid #27ae60;
    margin-bottom: 20px;
}
```

## 動作フロー

### 特徴点追加フロー
1. 空白部分を左クリック
2. 現在選択されている特徴点タイプで新しい点を追加
3. Canvas再描画
4. サーバーに保存
5. UI更新

### 特徴点移動フロー
1. 既存の特徴点をマウスダウン
2. ドラッグ状態を開始
3. マウス移動中はリアルタイムで位置更新
4. マウスアップでドラッグ終了
5. サーバーに保存

### 特徴点削除フロー
1. 既存の特徴点を右クリック
2. 特徴点を配列から削除
3. ラベルを再番号付け
4. Canvas再描画
5. サーバーに保存

## 対応範囲

### ✅ 実装済み機能
- 元画像での特徴点編集（追加・移動・削除）
- 処理済み画像での特徴点編集（追加・移動・削除）
- 正確な座標変換
- リアルタイム更新
- 自動保存
- ラベル自動再番号付け
- 操作説明UI

### ✅ 技術的配慮
- イベントリスナーの重複防止
- メモリリークの防止
- レスポンシブデザイン対応
- ブラウザ互換性

## パフォーマンスの最適化

### 1. 効率的な再描画
- 必要な場合のみCanvas全体を再描画
- 画像の非同期読み込み
- 適切なイベント処理

### 2. 状態管理の最適化
- ドラッグ状態の効率的な管理
- 不要な処理の回避
- メモリ使用量の最小化

## 今後の拡張可能性

### 改善案
1. **特徴点の選択表示**: 選択中の特徴点をハイライト表示
2. **キーボードショートカット**: DeleteキーやEscキーでの操作
3. **アンドゥ・リドゥ機能**: 操作履歴の管理
4. **特徴点のグループ化**: 関連する特徴点をまとめて操作
5. **マルチセレクション**: 複数の特徴点を同時に選択・操作

### 技術的拡張
1. **タッチデバイス対応**: モバイル端末でのタッチ操作
2. **精度向上**: サブピクセル精度での位置調整
3. **バリデーション**: 特徴点配置の妥当性チェック

## まとめ

特徴点編集機能の実装により、ユーザーは直感的に特徴点を配置・調整できるようになりました。右クリック削除とドラッグ移動の機能により、作業効率が大幅に向上し、より正確な顔認証システムの構築が可能になりました。

実装は適度な複雑さに抑えながらも、必要な機能を網羅し、拡張性も考慮した設計となっています。
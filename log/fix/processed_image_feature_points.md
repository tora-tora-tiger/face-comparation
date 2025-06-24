# 処理済み画像での特徴点表示問題の修正

## 問題の概要

顔検出・処理後の画像（processed image）のcanvasで特徴点をクリックした際、処理は実行されるが画面上に特徴点が表示されない問題が発生していました。

## 問題の原因分析

1. **イベントリスナーの重複登録**: 処理済み画像のcanvasに対してイベントリスナーが重複して登録される可能性がありました
2. **特徴点再描画の不備**: 処理済み画像のcanvasで特徴点が適切に再描画されていませんでした
3. **ハンドラー関数の混在**: 元の画像用と処理済み画像用のクリックハンドラーが混在していました

## 修正内容

### 1. displayProcessedImage()関数の修正

**修正前:**
```javascript
function displayProcessedImage(imageType, base64Image) {
    const canvas = document.getElementById(`processed-canvas-${imageType}`);
    
    if (canvas) {
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = function() {
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            ctx.drawImage(img, 0, 0);
            canvas.style.display = 'block';
            
            // 処理済み画像のキャンバスにもクリックイベントを追加
            canvas.addEventListener('click', (e) => handleCanvasClick(e, imageType, true));
        };
        
        img.src = base64Image;
    }
}
```

**修正後:**
```javascript
function displayProcessedImage(imageType, base64Image) {
    const canvas = document.getElementById(`processed-canvas-${imageType}`);
    
    if (canvas) {
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = function() {
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            ctx.drawImage(img, 0, 0);
            canvas.style.display = 'block';
            
            // 既存の特徴点を再描画
            redrawFeaturePoints(imageType, true);
            
            // 処理済み画像のキャンバスにクリックイベントを追加（重複防止）
            if (!canvas.hasProcessedClickListener) {
                canvas.addEventListener('click', (e) => handleProcessedCanvasClick(e, imageType));
                canvas.hasProcessedClickListener = true;
            }
        };
        
        img.src = base64Image;
    }
}
```

**修正ポイント:**
- `redrawFeaturePoints(imageType, true)`を追加して既存の特徴点を再描画
- 重複防止フラグ(`hasProcessedClickListener`)を使用してイベントリスナーの重複登録を防止
- 専用の`handleProcessedCanvasClick`ハンドラーを使用

### 2. redrawFeaturePoints()関数の拡張

**修正前:**
```javascript
function redrawFeaturePoints(imageType) {
    const canvas = canvases[imageType];
    imageData[imageType].points.forEach(point => {
        drawFeaturePoint(canvas, point);
    });
}
```

**修正後:**
```javascript
function redrawFeaturePoints(imageType, isProcessed = false) {
    const canvas = isProcessed ? 
        document.getElementById(`processed-canvas-${imageType}`) : 
        canvases[imageType];
    
    if (canvas && imageData[imageType].points) {
        imageData[imageType].points.forEach(point => {
            drawFeaturePoint(canvas, point);
        });
    }
}
```

**修正ポイント:**
- `isProcessed`パラメータを追加して処理済み画像のcanvasも対応
- 適切なcanvas要素を取得するように条件分岐を追加
- null/undefinedチェックを追加

### 3. クリックハンドラーの分離

**修正前:**
```javascript
// 処理済み画像用のキャンバスクリックハンドラー
function handleCanvasClick(event, imageType, isProcessed = false) {
    // 複雑な条件分岐処理...
}
```

**修正後:**
```javascript
// 処理済み画像用のキャンバスクリックハンドラー
function handleProcessedCanvasClick(event, imageType) {
    const targetImageData = imageData[imageType];
    
    if (!targetImageData.id) return;

    const canvas = document.getElementById(`processed-canvas-${imageType}`);
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // 特徴点を追加
    const point = {
        x: x,
        y: y,
        type: currentFeatureType,
        label: `${getFeatureTypeLabel(currentFeatureType)}_${targetImageData.points.length + 1}`
    };

    targetImageData.points.push(point);

    // 特徴点を描画
    drawFeaturePoint(canvas, point);

    // 特徴点データをサーバーに送信
    saveFeaturePoints(imageType);

    // UI更新
    updateUI();
}

// 元の画像用のキャンバスクリックハンドラー
function handleCanvasClick(event, imageType) {
    // 元の画像用の処理...
}
```

**修正ポイント:**
- 処理済み画像用と元画像用のハンドラーを完全に分離
- それぞれに特化した処理を実装
- コードの可読性と保守性を向上

## 修正結果

### 修正前の問題
- ✗ 処理済み画像のcanvasで特徴点をクリックしても表示されない
- ✗ イベントリスナーの重複登録による不安定な動作
- ✗ 特徴点の再描画が正常に動作しない

### 修正後の改善
- ✅ 処理済み画像のcanvasで特徴点が正常に表示される
- ✅ イベントリスナーの重複登録を防止
- ✅ 既存の特徴点が画像再読み込み時に適切に再描画される
- ✅ 元画像と処理済み画像の両方で特徴点マーキングが可能

## テスト方法

1. 画像を3枚アップロード
2. "顔を検出・処理"ボタンをクリック
3. 処理済み画像が表示されることを確認
4. 処理済み画像のcanvasをクリックして特徴点をマーク
5. 特徴点が正常に表示されることを確認
6. 特徴点数カウンターが正常に更新されることを確認

## 今後の改善点

- 特徴点の削除機能（右クリックで削除等）
- 特徴点のドラッグ&ドロップによる位置調整
- 処理済み画像と元画像の特徴点の同期機能
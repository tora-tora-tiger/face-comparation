# 自動特徴点表示不具合修正ログ

## 問題の概要
自動特徴点抽出において、以下の不具合が発生していました：
1. 基準画像以外の画像（比較画像1、比較画像2）に特徴点が表示されない
2. 基準画像においても特徴点の位置が正確に描画されない
3. 特徴点のサイズが適切でない

## 問題の原因分析

### 1. 再描画タイミングの問題
- 自動特徴点抽出後、すべての画像に対して再描画が実行されていなかった
- `redrawAllCanvas()` の呼び出しが特定の条件下でのみ実行されていた

### 2. Canvas サイズ設定の問題
- 再描画時にキャンバスサイズが適切に設定されていなかった
- 画像とキャンバスのサイズが一致していない場合の処理が不適切

### 3. 特徴点描画サイズの問題
- 特徴点の描画サイズが過度に大きく設定されていた（半径50px）
- フォントサイズも48pxと大きすぎた

## 実装した修正

### 1. Canvas再描画機能の改善

**修正ファイル**: `frontend/js/featurePoints.js`

#### 修正前
```javascript
function redrawAllCanvas(imageType, isProcessed) {
    if (!isProcessed) return;

    const canvas = document.getElementById(`processed-canvas-${imageType}`);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (imageData[imageType].processedImage) {
        const img = new Image();
        img.onload = function() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            redrawFeaturePoints(imageType, true);
        };
        img.src = imageData[imageType].processedImage;
    }
}
```

#### 修正後
```javascript
function redrawAllCanvas(imageType, isProcessed) {
    if (!isProcessed) return;

    const canvas = document.getElementById(`processed-canvas-${imageType}`);
    if (!canvas) {
        console.warn(`Canvas not found for ${imageType}`);
        return;
    }

    const ctx = canvas.getContext('2d');

    if (imageData[imageType].processedImage) {
        const img = new Image();
        img.onload = function() {
            // キャンバスサイズを画像に合わせて設定
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;

            // 画像をクリアして再描画
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);

            // 特徴点を再描画
            console.log(`Redrawing ${imageData[imageType].points.length} feature points for ${imageType}`);
            redrawFeaturePoints(imageType, true);
        };
        img.onerror = function() {
            console.error(`Failed to load processed image for ${imageType}`);
        };
        img.src = imageData[imageType].processedImage;
    } else {
        console.warn(`No processed image found for ${imageType}`);
    }
}
```

**改善点**:
- キャンバスサイズを画像の実際のサイズに合わせて設定
- エラーハンドリングとログ出力を追加
- 画像読み込み失敗時の処理を追加

### 2. 特徴点描画サイズの最適化

**修正ファイル**: `frontend/js/featurePoints.js`

#### 修正前
```javascript
// 点を描画（半径を10から50に拡大 = 5倍）
ctx.fillStyle = colors[point.type] || colors.other;
ctx.strokeStyle = 'white';
ctx.lineWidth = 8;

ctx.beginPath();
ctx.arc(point.x, point.y, 50, 0, 2 * Math.PI);
ctx.fill();
ctx.stroke();

// ラベルを描画（フォントサイズをさらに大きく）
ctx.fillStyle = '#2c3e50';
ctx.font = 'bold 48px Arial';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText(point.label, point.x, point.y);
```

#### 修正後
```javascript
// 点を描画（適切なサイズに調整）
ctx.fillStyle = colors[point.type] || colors.other;
ctx.strokeStyle = 'white';
ctx.lineWidth = 3;

const radius = 8; // 適切なサイズに調整
ctx.beginPath();
ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI);
ctx.fill();
ctx.stroke();

// ラベルを描画（適切なフォントサイズに調整）
ctx.fillStyle = '#2c3e50';
ctx.font = 'bold 12px Arial';
ctx.textAlign = 'center';
ctx.textBaseline = 'top';
ctx.fillText(point.label, point.x, point.y + radius + 2);
```

**改善点**:
- 特徴点の半径を50px → 8pxに調整
- フォントサイズを48px → 12pxに調整
- ラベル位置を点の中央から下部に変更
- 線の太さを適切に調整

### 3. 色定義の拡張

**修正ファイル**: `frontend/js/featurePoints.js`

#### 修正前
```javascript
const colors = {
    rightEye: '#3498db',
    leftEye: '#9b59b6',
    nose: '#f39c12',
    mouth: '#e74c3c',
    other: '#95a5a6'
};
```

#### 修正後
```javascript
const colors = {
    rightEye: '#3498db',
    leftEye: '#9b59b6',
    nose: '#f39c12',
    mouth: '#e74c3c',
    face_contour: '#1abc9c',
    other: '#95a5a6'
};
```

**改善点**:
- `face_contour` タイプの色定義を追加

### 4. 自動特徴点抽出後の一括再描画

**修正ファイル**: `frontend/js/autoFeatures.js`

#### 修正前
```javascript
if (result.success) {
    // 既存の手動特徴点と統合
    const existingManualPoints = imageData[imageType].points.filter(
        p => p.landmark_index === undefined
    );
    imageData[imageType].points = [...existingManualPoints, ...newPoints];

    // 処理済み画像のcanvasに特徴点を再描画
    if (imageData[imageType].processedImage) {
        redrawAllCanvas(imageType, true);
    }

    successCount++;
}

if (successCount > 0) {
    alert(`${successCount}個の画像で自動特徴点抽出が完了しました。`);
    updateUI();
    updateFeaturePointStatistics();
}
```

#### 修正後
```javascript
if (result.success) {
    // 既存の手動特徴点と統合
    const existingManualPoints = imageData[imageType].points.filter(
        p => p.landmark_index === undefined
    );
    imageData[imageType].points = [...existingManualPoints, ...newPoints];

    console.log(`自動抽出成功 (${imageType}): ${newPoints.length}点追加`);
    console.log(`Total points for ${imageType}: ${imageData[imageType].points.length}`);

    successCount++;
}

if (successCount > 0) {
    // すべての処理済み画像を再描画
    const imageTypes = ['reference', 'compare1', 'compare2'];
    imageTypes.forEach(imageType => {
        if (imageData[imageType].processedImage && imageData[imageType].points.length > 0) {
            console.log(`Redrawing canvas for ${imageType} with ${imageData[imageType].points.length} points`);
            setTimeout(() => redrawAllCanvas(imageType, true), 100); // 少し遅延を入れて確実に実行
        }
    });

    alert(`${successCount}個の画像で自動特徴点抽出が完了しました。`);
    updateUI();
    updateFeaturePointStatistics();
}
```

**改善点**:
- 個別の画像処理時ではなく、全画像処理完了後に一括再描画
- `setTimeout` を使用して確実に実行されるように調整
- 詳細なログ出力を追加

### 5. 自動特徴点クリア機能の改善

**修正ファイル**: `frontend/js/autoFeatures.js`

#### 修正前
```javascript
if (response.ok) {
    // ローカルデータからも自動特徴点を削除
    imageData[imageType].points = imageData[imageType].points.filter(
        p => p.landmark_index === undefined
    );

    // 処理済み画像のcanvasを再描画
    if (imageData[imageType].processedImage) {
        redrawAllCanvas(imageType, true);
    }

    successCount++;
}
```

#### 修正後
```javascript
if (response.ok) {
    // ローカルデータからも自動特徴点を削除
    imageData[imageType].points = imageData[imageType].points.filter(
        p => p.landmark_index === undefined
    );

    successCount++;
}

// 処理完了後に一括再描画
if (successCount > 0) {
    // すべての処理済み画像を再描画
    const imageTypes = ['reference', 'compare1', 'compare2'];
    imageTypes.forEach(imageType => {
        if (imageData[imageType].processedImage) {
            setTimeout(() => redrawAllCanvas(imageType, true), 100);
        }
    });

    alert(`${successCount}個の画像の自動特徴点をクリアしました。`);
    updateUI();
    updateFeaturePointStatistics();
}
```

**改善点**:
- クリア機能でも一括再描画を実装
- 処理完了後に統一的な再描画を実行

### 6. CSS色定義の拡張

**修正ファイル**: `frontend/style.css`

#### 修正前
```css
.feature-point.rightEye { background-color: #3498db; }
.feature-point.leftEye { background-color: #9b59b6; }
.feature-point.nose { background-color: #f39c12; }
.feature-point.mouth { background-color: #e74c3c; }
.feature-point.other { background-color: #95a5a6; }
```

#### 修正後
```css
.feature-point.rightEye { background-color: #3498db; }
.feature-point.leftEye { background-color: #9b59b6; }
.feature-point.nose { background-color: #f39c12; }
.feature-point.mouth { background-color: #e74c3c; }
.feature-point.face_contour { background-color: #1abc9c; }
.feature-point.other { background-color: #95a5a6; }
```

**改善点**:
- `face_contour` タイプのCSS色定義を追加

## 技術的詳細

### 問題の根本原因
1. **非同期処理の順序問題**: 自動抽出処理が完了する前に再描画が実行されていた
2. **Canvas サイズの不一致**: 画像とキャンバスのサイズが一致していなかった
3. **部分的な再描画**: 全ての画像に対して一貫した再描画が行われていなかった

### 解決手法
1. **一括処理**: 全画像の処理完了後に一括再描画を実行
2. **サイズ統一**: キャンバスサイズを画像の実際のサイズに合わせて設定
3. **遅延実行**: `setTimeout` を使用して確実な実行を保証
4. **ログ出力**: 詳細なログでデバッグを容易に

### 座標精度の確保
- バックエンドから返される座標は正確であることを確認
- フロントエンドでの座標変換処理は不要
- Canvas のサイズ設定が適切であれば座標は正確に描画される

## テスト結果

### 修正前の問題
1. ✗ 基準画像以外に特徴点が表示されない
2. ✗ 特徴点のサイズが過大（半径50px）
3. ✗ 特徴点の位置が正確でない

### 修正後の改善
1. ✓ 全ての画像に特徴点が正確に表示される
2. ✓ 特徴点のサイズが適切（半径8px）
3. ✓ 特徴点の位置が正確に描画される
4. ✓ 自動特徴点クリア機能も正常に動作する

## 今後の拡張可能性

### 1. パフォーマンス最適化
- Canvas再描画の効率化
- 大量特徴点時の描画最適化

### 2. 視覚的改善
- 特徴点のホバー効果
- アニメーション付きの特徴点表示

### 3. デバッグ機能
- 特徴点座標の詳細表示
- 描画プロセスの可視化

## 実装完了日
2024年6月24日

## 修正したファイル一覧
1. `frontend/js/featurePoints.js` - Canvas再描画機能とサイズ調整
2. `frontend/js/autoFeatures.js` - 一括再描画機能の実装
3. `frontend/style.css` - face_contour色定義の追加

## 関連機能
- 自動特徴点抽出機能
- 手動特徴点編集機能
- 特徴点統計表示機能
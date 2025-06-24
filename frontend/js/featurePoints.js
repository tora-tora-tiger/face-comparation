// 特徴点関連機能

// 特徴点を描画
function drawFeaturePoint(canvas, point) {
    const ctx = canvas.getContext('2d');
    
    // 特徴点の色を設定
    const colors = {
        rightEye: '#3498db',
        leftEye: '#9b59b6',
        nose: '#f39c12',
        mouth: '#e74c3c',
        other: '#95a5a6'
    };

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
}

// 特徴点を再描画
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

// 特徴点データをサーバーに保存
async function saveFeaturePoints(imageType) {
    const imageId = imageData[imageType].id;
    const points = imageData[imageType].points;

    try {
        const response = await fetch('/api/feature-points', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image_id: imageId,
                points: points
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to save feature points: ${response.statusText}`);
        }

        const result = await response.json();
        console.log(`Feature points saved for ${imageType}:`, result);

    } catch (error) {
        console.error('Failed to save feature points:', error);
    }
}

// 全ての特徴点をクリア
function clearAllPoints() {
    Object.keys(imageData).forEach(imageType => {
        imageData[imageType].points = [];
        
        // 処理済み画像のCanvas を再描画
        if (imageData[imageType].processedImage) {
            redrawAllCanvas(imageType, true);
        }
        
        // サーバーの特徴点データも更新
        if (imageData[imageType].id) {
            saveFeaturePoints(imageType);
        }
    });
    
    updateUI();
}

// Canvas全体を再描画する関数（処理済み画像のみ）
function redrawAllCanvas(imageType, isProcessed) {
    // 処理済み画像のみ対応
    if (!isProcessed) return;
    
    const canvas = document.getElementById(`processed-canvas-${imageType}`);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // 処理済み画像の場合、元の画像を再描画
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
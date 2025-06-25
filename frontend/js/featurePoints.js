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
        face_contour: '#1abc9c',
        other: '#95a5a6'
    };

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
    if (!canvas) {
        console.warn(`Canvas not found for ${imageType}`);
        return;
    }
    
    const ctx = canvas.getContext('2d');
    
    // 処理済み画像の場合、元の画像を再描画
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
// ユーティリティ関数

// 特徴点タイプのラベル変換
function getFeatureTypeLabel(type) {
    const labels = {
        rightEye: '右目',
        leftEye: '左目',
        nose: '鼻',
        mouth: '口',
        other: 'その他'
    };
    return labels[type] || 'その他';
}

// 特徴点のヒットテスト（クリック位置が特徴点の範囲内かチェック）
function hitTestFeaturePoint(x, y, point, radius = 55) {
    const dx = x - point.x;
    const dy = y - point.y;
    return Math.sqrt(dx * dx + dy * dy) <= radius;
}

// 座標変換関数
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

// 特徴点のラベルを再番号付けする関数
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

// UI更新関数
function updateUI() {
    // 特徴点数の更新
    document.getElementById('points-count-reference').textContent = imageData.reference.points.length;
    document.getElementById('points-count-compare1').textContent = imageData.compare1.points.length;
    document.getElementById('points-count-compare2').textContent = imageData.compare2.points.length;

    // 比較実行ボタンの有効/無効
    const allImagesUploaded = imageData.reference.id && imageData.compare1.id && imageData.compare2.id;
    const allHavePoints = imageData.reference.points.length > 0 && 
                         imageData.compare1.points.length > 0 && 
                         imageData.compare2.points.length > 0;
    const samePointCount = imageData.reference.points.length === imageData.compare1.points.length &&
                          imageData.reference.points.length === imageData.compare2.points.length;

    executeButton.disabled = !(allImagesUploaded && allHavePoints && samePointCount);
    
    // ボタンのテキスト更新
    if (!allImagesUploaded) {
        executeButton.textContent = '全ての画像をアップロードしてください';
    } else if (!allHavePoints) {
        executeButton.textContent = '全ての画像に特徴点をマークしてください';
    } else if (!samePointCount) {
        executeButton.textContent = '全ての画像の特徴点数を同じにしてください';
    } else {
        executeButton.textContent = '比較を実行';
    }

    // 顔検出ボタンの有効/無効
    processFacesButton.disabled = !allImagesUploaded;
    
    if (!allImagesUploaded) {
        processFacesButton.textContent = '全ての画像をアップロードしてください';
    } else {
        processFacesButton.textContent = '顔を検出・処理';
    }
    
    // 特徴点統計も更新
    if (typeof updateFeaturePointStatistics === 'function') {
        updateFeaturePointStatistics();
    }
}
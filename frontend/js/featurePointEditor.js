// 特徴点編集機能（マウスイベント処理）

// 処理済み画像用のマウスダウンハンドラー
function handleProcessedCanvasMouseDown(event, imageType) {
    event.preventDefault();
    
    const targetImageData = imageData[imageType];
    if (!targetImageData.id) return;

    const canvas = document.getElementById(`processed-canvas-${imageType}`);
    const coords = getCanvasCoordinates(event, canvas);

    // 既存の特徴点をチェック
    for (let i = targetImageData.points.length - 1; i >= 0; i--) {
        const point = targetImageData.points[i];
        if (hitTestFeaturePoint(coords.x, coords.y, point)) {
            // 特徴点をドラッグ開始
            dragState.isDragging = true;
            dragState.draggedPoint = point;
            dragState.draggedPointIndex = i;
            dragState.draggedImageType = imageType;
            dragState.draggedIsProcessed = true;
            dragState.startX = coords.x;
            dragState.startY = coords.y;
            return;
        }
    }

    // 特徴点がない場所をクリック - 新しい特徴点を追加
    const point = {
        x: coords.x,
        y: coords.y,
        type: currentFeatureType,
        label: `${getFeatureTypeLabel(currentFeatureType)}_${targetImageData.points.length + 1}`
    };

    targetImageData.points.push(point);
    
    // Canvas全体を再描画
    redrawAllCanvas(imageType, true);
    
    saveFeaturePoints(imageType);
    updateUI();
}

// 処理済み画像用のマウス移動ハンドラー
function handleProcessedCanvasMouseMove(event, imageType) {
    if (!dragState.isDragging || dragState.draggedImageType !== imageType || !dragState.draggedIsProcessed) return;

    const canvas = document.getElementById(`processed-canvas-${imageType}`);
    const coords = getCanvasCoordinates(event, canvas);

    // ドラッグ中の特徴点位置を更新
    dragState.draggedPoint.x = coords.x;
    dragState.draggedPoint.y = coords.y;

    // Canvas全体を再描画
    redrawAllCanvas(imageType, true);
}

// 処理済み画像用のマウスアップハンドラー
function handleProcessedCanvasMouseUp(event, imageType) {
    if (dragState.isDragging && dragState.draggedImageType === imageType && dragState.draggedIsProcessed) {
        // ドラッグ終了
        dragState.isDragging = false;
        dragState.draggedPoint = null;
        dragState.draggedPointIndex = -1;
        dragState.draggedImageType = null;
        dragState.draggedIsProcessed = false;

        // サーバーに保存
        saveFeaturePoints(imageType);
        updateUI();
    }
}

// 処理済み画像用の右クリックハンドラー
function handleProcessedCanvasRightClick(event, imageType) {
    event.preventDefault();
    
    const targetImageData = imageData[imageType];
    if (!targetImageData.id) return;

    const canvas = document.getElementById(`processed-canvas-${imageType}`);
    const coords = getCanvasCoordinates(event, canvas);

    // 特徴点を検索して削除
    for (let i = targetImageData.points.length - 1; i >= 0; i--) {
        const point = targetImageData.points[i];
        if (hitTestFeaturePoint(coords.x, coords.y, point)) {
            // 特徴点を削除
            targetImageData.points.splice(i, 1);
            
            // ラベルを再番号付け
            relabelFeaturePoints(imageType);
            
            // Canvas全体を再描画
            redrawAllCanvas(imageType, true);
            
            saveFeaturePoints(imageType);
            updateUI();
            break;
        }
    }
}
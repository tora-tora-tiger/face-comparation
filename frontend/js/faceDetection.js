// 顔検出機能

// 顔検出処理を実行
async function processFaceDetection() {
    // ローディング表示
    faceProcessingLoading.style.display = 'block';
    processFacesButton.disabled = true;
    processedImagesGrid.style.display = 'none';
    detectionInfo.style.display = 'none';

    const imageTypes = ['reference', 'compare1', 'compare2'];
    const detectionResults = {};

    try {
        // 各画像に対して顔検出を実行
        for (const imageType of imageTypes) {
            const imageId = imageData[imageType].id;
            
            console.log(`Processing face detection for ${imageType}: ${imageId}`);
            
            const response = await fetch('/api/detect-face', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    image_id: imageId
                })
            });

            if (!response.ok) {
                throw new Error(`顔検出に失敗しました (${imageType}): ${response.statusText}`);
            }

            const result = await response.json();
            detectionResults[imageType] = result;
            
            if (result.success && result.processed_image) {
                // 処理済み画像を表示
                displayProcessedImage(imageType, result.processed_image);
                imageData[imageType].processed = true;
                imageData[imageType].processedImage = result.processed_image;
                
                // 顔検出結果を保存
                faceDetectionResults[imageType] = result;
            } else {
                console.warn(`顔検出に失敗: ${imageType} - ${result.message}`);
            }
        }

        // 検出情報を表示
        displayDetectionInfo(detectionResults);
        
        // 処理済み画像グリッドを表示
        processedImagesGrid.style.display = 'grid';
        detectionInfo.style.display = 'block';

    } catch (error) {
        console.error('顔検出処理中にエラー:', error);
        alert('顔検出処理中にエラーが発生しました: ' + error.message);
    } finally {
        // ローディング非表示
        faceProcessingLoading.style.display = 'none';
        processFacesButton.disabled = false;
    }
}

// 処理済み画像を表示
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
            
            // 処理済み画像のキャンバスにイベントリスナーを追加（重複防止）
            if (!canvas.hasProcessedClickListener) {
                canvas.addEventListener('mousedown', (e) => handleProcessedCanvasMouseDown(e, imageType));
                canvas.addEventListener('mousemove', (e) => handleProcessedCanvasMouseMove(e, imageType));
                canvas.addEventListener('mouseup', (e) => handleProcessedCanvasMouseUp(e, imageType));
                canvas.addEventListener('contextmenu', (e) => handleProcessedCanvasRightClick(e, imageType));
                canvas.hasProcessedClickListener = true;
            }
        };
        
        img.src = base64Image;
    }
}

// 検出情報を表示
function displayDetectionInfo(detectionResults) {
    let infoHtml = '';
    
    Object.keys(detectionResults).forEach(imageType => {
        const result = detectionResults[imageType];
        const typeLabel = imageType === 'reference' ? '基準画像' : 
                         imageType === 'compare1' ? '比較画像1' : '比較画像2';
        
        infoHtml += `<div class="detection-detail-item">
            <span class="detection-detail-label">${typeLabel}</span>
            <span class="detection-detail-value">${result.success ? '成功' : '失敗'}</span>
        </div>`;
        
        if (result.success && result.processing_info) {
            infoHtml += `<div class="detection-detail-item">
                <span class="detection-detail-label">　検出信頼度</span>
                <span class="detection-detail-value">${(result.processing_info.detection_confidence * 100).toFixed(1)}%</span>
            </div>`;
            
            infoHtml += `<div class="detection-detail-item">
                <span class="detection-detail-label">　ランドマーク数</span>
                <span class="detection-detail-value">${result.processing_info.landmarks_detected}</span>
            </div>`;
            
            infoHtml += `<div class="detection-detail-item">
                <span class="detection-detail-label">　処理後サイズ</span>
                <span class="detection-detail-value">${result.processing_info.processed_size[1]} x ${result.processing_info.processed_size[0]}</span>
            </div>`;
        }
        
        if (!result.success) {
            infoHtml += `<div class="detection-detail-item">
                <span class="detection-detail-label">　エラー</span>
                <span class="detection-detail-value" style="color: #e74c3c;">${result.message}</span>
            </div>`;
        }
    });
    
    detectionDetails.innerHTML = infoHtml;
}
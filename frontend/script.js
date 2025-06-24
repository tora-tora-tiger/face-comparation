// グローバル変数
const imageData = {
    reference: { id: null, file: null, canvas: null, points: [], processed: false, processedImage: null },
    compare1: { id: null, file: null, canvas: null, points: [], processed: false, processedImage: null },
    compare2: { id: null, file: null, canvas: null, points: [], processed: false, processedImage: null }
};

let currentFeatureType = 'rightEye';
let faceDetectionResults = {};

// ドラッグ操作用の変数
let dragState = {
    isDragging: false,
    draggedPoint: null,
    draggedPointIndex: -1,
    draggedImageType: null,
    draggedIsProcessed: false,
    startX: 0,
    startY: 0
};

// DOM要素の取得
const fileInputs = {
    reference: document.getElementById('file-reference'),
    compare1: document.getElementById('file-compare1'),
    compare2: document.getElementById('file-compare2')
};

const canvases = {
    reference: document.getElementById('canvas-reference'),
    compare1: document.getElementById('canvas-compare1'),
    compare2: document.getElementById('canvas-compare2')
};

const executeButton = document.getElementById('execute-comparison');
const featureTypeSelect = document.getElementById('feature-type');
const clearPointsButton = document.getElementById('clear-points');

// 顔検出関連のDOM要素
const processFacesButton = document.getElementById('process-faces');
const faceProcessingLoading = document.getElementById('face-processing-loading');
const processedImagesGrid = document.getElementById('processed-images-grid');
const detectionInfo = document.getElementById('detection-info');
const detectionDetails = document.getElementById('detection-details');

// 初期化
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    updateUI();
});

function setupEventListeners() {
    // ファイル入力のイベントリスナー
    Object.keys(fileInputs).forEach(key => {
        fileInputs[key].addEventListener('change', (e) => handleFileSelect(e, key));
    });

    // Canvas イベント（前処理前の画像では特徴点機能を無効化）
    // 特徴点は処理済み画像でのみ使用可能

    // ドラッグ&ドロップ
    setupDragAndDrop();

    // 特徴点タイプ選択
    featureTypeSelect.addEventListener('change', (e) => {
        currentFeatureType = e.target.value;
    });

    // ボタンイベント
    executeButton.addEventListener('click', executeComparison);
    clearPointsButton.addEventListener('click', clearAllPoints);
    processFacesButton.addEventListener('click', processFaceDetection);
}

function setupDragAndDrop() {
    const uploadAreas = ['reference', 'compare1', 'compare2'];
    
    uploadAreas.forEach(area => {
        const uploadArea = document.getElementById(`upload-area-${area}`);
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.backgroundColor = '#ecf0f1';
        });
        
        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.style.backgroundColor = '';
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.backgroundColor = '';
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                fileInputs[area].files = files;
                handleFileSelect({ target: { files: files } }, area);
            }
        });
    });
}

async function handleFileSelect(event, imageType) {
    const file = event.target.files[0];
    if (!file) return;

    // ファイル形式チェック
    if (!file.type.startsWith('image/')) {
        alert('画像ファイルを選択してください。');
        return;
    }

    // ファイルサイズチェック（5MB）
    if (file.size > 5 * 1024 * 1024) {
        alert('ファイルサイズは5MB以下にしてください。');
        return;
    }

    try {
        // 画像をアップロード
        const uploadResult = await uploadImage(file);
        
        // 画像データを保存
        imageData[imageType].id = uploadResult.image_id;
        imageData[imageType].file = file;
        imageData[imageType].points = [];

        // Canvas に画像を表示
        displayImageOnCanvas(file, imageType);
        
        // UI更新
        updateUI();
        
        console.log(`${imageType} image uploaded:`, uploadResult);
        
    } catch (error) {
        console.error('Upload failed:', error);
        alert('画像のアップロードに失敗しました。');
    }
}

async function uploadImage(file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
    }

    return await response.json();
}

function displayImageOnCanvas(file, imageType) {
    const canvas = canvases[imageType];
    const ctx = canvas.getContext('2d');
    const uploadArea = document.getElementById(`upload-area-${imageType}`);

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            // Canvas サイズを設定（最大幅400px）
            const maxWidth = 400;
            const scale = Math.min(maxWidth / img.width, maxWidth / img.height);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;

            // 画像を描画
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Canvas を表示し、アップロードエリアを非表示
            canvas.style.display = 'block';
            uploadArea.style.display = 'none';

            // 前処理前の画像では特徴点は使用しない
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function handleCanvasClick(event, imageType) {
    if (!imageData[imageType].id) return;

    const canvas = canvases[imageType];
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // 特徴点を追加
    const point = {
        x: x,
        y: y,
        type: currentFeatureType,
        label: `${getFeatureTypeLabel(currentFeatureType)}_${imageData[imageType].points.length + 1}`
    };

    imageData[imageType].points.push(point);

    // 特徴点を描画
    drawFeaturePoint(canvas, point);

    // 特徴点データをサーバーに送信
    saveFeaturePoints(imageType);

    // UI更新
    updateUI();
}

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

    // ラベルを描画（フォントサイズも5倍に拡大）
    ctx.fillStyle = '#2c3e50';
    ctx.font = 'bold 30px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(point.label, point.x, point.y);
}

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

async function executeComparison() {
    // ローディング表示
    document.getElementById('loading').style.display = 'block';
    executeButton.disabled = true;

    try {
        const response = await fetch('/api/compare', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                reference_id: imageData.reference.id,
                compare_ids: [imageData.compare1.id, imageData.compare2.id]
            })
        });

        if (!response.ok) {
            throw new Error(`Comparison failed: ${response.statusText}`);
        }

        const result = await response.json();
        displayResults(result);

    } catch (error) {
        console.error('Comparison failed:', error);
        alert('比較処理に失敗しました。');
    } finally {
        // ローディング非表示
        document.getElementById('loading').style.display = 'none';
        executeButton.disabled = false;
    }
}

function displayResults(result) {
    const resultsSection = document.getElementById('comparison-results');
    const winnerDiv = document.getElementById('result-winner');
    
    // 結果表示
    resultsSection.style.display = 'block';
    
    // 勝者表示
    const winnerText = result.closer_image === 'image1' ? 
        '比較画像1の方が基準画像に近いです' : 
        '比較画像2の方が基準画像に近いです';
    
    winnerDiv.textContent = winnerText;
    winnerDiv.className = `winner ${result.closer_image}`;
    
    // スコア表示
    document.getElementById('score1').textContent = result.image1_score.toFixed(4);
    document.getElementById('score2').textContent = result.image2_score.toFixed(4);
    document.getElementById('lambda1').textContent = result.optimal_lambda1.toFixed(4);
    document.getElementById('lambda2').textContent = result.optimal_lambda2.toFixed(4);
    
    // 詳細情報表示
    const metadataContent = document.getElementById('result-metadata-content');
    metadataContent.innerHTML = `
        <p>実行時間: ${result.execution_time.toFixed(3)}秒</p>
        <p>基準画像特徴点数: ${result.details.reference_points_count}</p>
        <p>距離の差: ${result.details.distance_difference.toFixed(4)}</p>
        <p>類似度比率: ${result.details.similarity_ratio.toFixed(4)}</p>
        <p>使用された特徴点タイプ: ${result.details.feature_types_used.join(', ')}</p>
    `;
}

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
}

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

// 顔検出機能
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

// 元の画像用のイベントハンドラーは削除
// 特徴点は処理済み画像でのみ使用可能
// グローバル変数
const imageData = {
    reference: { id: null, file: null, canvas: null, points: [] },
    compare1: { id: null, file: null, canvas: null, points: [] },
    compare2: { id: null, file: null, canvas: null, points: [] }
};

let currentFeatureType = 'rightEye';

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

    // Canvas クリックイベント
    Object.keys(canvases).forEach(key => {
        canvases[key].addEventListener('click', (e) => handleCanvasClick(e, key));
    });

    // ドラッグ&ドロップ
    setupDragAndDrop();

    // 特徴点タイプ選択
    featureTypeSelect.addEventListener('change', (e) => {
        currentFeatureType = e.target.value;
    });

    // ボタンイベント
    executeButton.addEventListener('click', executeComparison);
    clearPointsButton.addEventListener('click', clearAllPoints);
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

            // 既存の特徴点を再描画
            redrawFeaturePoints(imageType);
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

    // 点を描画
    ctx.fillStyle = colors[point.type] || colors.other;
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    // ラベルを描画
    ctx.fillStyle = '#2c3e50';
    ctx.font = '12px Arial';
    ctx.fillText(point.label, point.x + 10, point.y - 5);
}

function redrawFeaturePoints(imageType) {
    const canvas = canvases[imageType];
    imageData[imageType].points.forEach(point => {
        drawFeaturePoint(canvas, point);
    });
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
        
        // Canvas を再描画（画像のみ）
        if (imageData[imageType].file) {
            displayImageOnCanvas(imageData[imageType].file, imageType);
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
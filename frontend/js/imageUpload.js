// 画像アップロード機能

// ファイル選択処理
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

// 画像アップロードAPI呼び出し
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

// Canvas に画像を表示
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

// ドラッグ&ドロップ設定
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
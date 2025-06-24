// イベントリスナーの設定

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

    // 自動特徴点関連のイベント
    const extractAutoButton = document.getElementById('extract-auto-features');
    const clearAutoButton = document.getElementById('clear-auto-features');
    
    if (extractAutoButton) {
        extractAutoButton.addEventListener('click', extractAutoFeatures);
    }
    
    if (clearAutoButton) {
        clearAutoButton.addEventListener('click', clearAutoFeatures);
    }

    // モード切り替え
    const modeRadios = document.querySelectorAll('input[name="marking-mode"]');
    modeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            switchMarkingMode(e.target.value);
        });
    });

    // 信頼度スライダー
    const confidenceSlider = document.getElementById('confidence-threshold');
    if (confidenceSlider) {
        confidenceSlider.addEventListener('input', updateConfidenceValue);
    }
}
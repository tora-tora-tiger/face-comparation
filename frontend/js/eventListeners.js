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
}
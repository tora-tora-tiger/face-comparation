// メインアプリケーション

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', function() {
    console.log('Face Recognition System - Frontend Loaded');
    setupEventListeners();
    updateUI();
    
    // 自動特徴点機能の初期化
    loadAvailableFeatureTypes();
    updateConfidenceValue();
});
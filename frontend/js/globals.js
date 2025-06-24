// グローバル変数とDOM要素の管理

// アプリケーション状態
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
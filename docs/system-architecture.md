# システム構成・アーキテクチャ

## システム全体構成

### アーキテクチャ概要
```
┌─────────────────┐    HTTP API    ┌─────────────────┐
│   フロントエンド  │ ────────────→ │   バックエンド   │
│  (JavaScript)   │               │    (FastAPI)    │
│                 │ ←──────────── │                 │
└─────────────────┘    JSON       └─────────────────┘
         │                                  │
         │                                  │
    Canvas API                         画像処理
    画像表示・UI                    OpenCV + MediaPipe
```

### 責任分離設計
- **フロントエンド**: 画像表示、特徴点マーキング、ユーザーインターフェース
- **バックエンド**: 画像処理、数値計算、λ最適化、MediaPipe処理
- **通信**: RESTful API（JSON形式）

## バックエンド構成（FastAPI）

### プロジェクト構造
```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPIアプリケーション本体
│   ├── models.py               # Pydanticデータモデル
│   ├── routers/                # APIエンドポイント群
│   │   ├── __init__.py
│   │   ├── images.py           # 画像管理API
│   │   ├── comparison.py       # 顔比較API
│   │   ├── face_detection.py   # 顔検出API
│   │   └── auto_features.py    # 自動特徴点抽出API
│   ├── services/               # ビジネスロジック
│   │   ├── __init__.py
│   │   ├── face_comparison.py  # 顔比較アルゴリズム
│   │   ├── face_detection.py   # 顔検出・正面化処理
│   │   └── auto_feature_extraction.py # MediaPipe統合
│   └── utils/
│       └── __init__.py
├── requirements.txt
├── uploads/                    # アップロード画像保存
└── venv/                      # Python仮想環境
```

### 主要コンポーネント

#### 1. メインアプリケーション（main.py）
```python
# 主要設定
app = FastAPI(title="Face Comparison API", version="1.0.0")

# CORS設定 - フロントエンドとの通信許可
app.add_middleware(CORSMiddleware, ...)

# 静的ファイル配信
app.mount("/static", StaticFiles(directory=frontend_dir), name="static")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ルーター統合
app.include_router(images.router, prefix="/api", tags=["images"])
app.include_router(comparison.router, prefix="/api", tags=["comparison"])
app.include_router(face_detection.router, prefix="/api", tags=["face_detection"])
app.include_router(auto_features.router, prefix="/api", tags=["auto_features"])
```

#### 2. データモデル（models.py）
**定義されているモデル**:
- `FeaturePoint`: 特徴点データ（座標、タイプ、ラベル、信頼度）
- `ImageFeatures`: 画像の特徴点集合
- `ComparisonRequest`: 比較リクエスト
- `ComparisonResult`: 比較結果
- `AutoFeatureExtractionRequest`: 自動抽出リクエスト
- その他12のモデル（合計15モデル）

#### 3. APIエンドポイント

**画像管理API（images.py）**:
- `POST /api/upload-image`: 画像アップロード
- `POST /api/feature-points`: 特徴点データ保存
- `GET /api/feature-points/{image_id}`: 特徴点データ取得

**顔比較API（comparison.py）**:
- `POST /api/compare`: 顔画像比較実行

**顔検出API（face_detection.py）**:
- `POST /api/detect-face`: 顔検出・正面化実行

**自動特徴点抽出API（auto_features.py）**:
- `POST /api/extract-auto-features`: 自動特徴点抽出
- `POST /api/validate-extraction-parameters`: パラメータ検証
- `GET /api/extraction-info`: 抽出機能情報取得
- その他3エンドポイント

#### 4. ビジネスロジック（services/）

**顔比較サービス（face_comparison.py）**:
```python
class FaceComparisonService:
    def calculate_distance(self, ref_points, comp_points, lambda_val):
        # D(λ) = Σ(xi - λ×yi)² の実装
        
    def optimize_lambda(self, ref_points, comp_points):
        # 黄金分割法による最適化
        result = minimize_scalar(
            self.calculate_distance_for_optimization,
            bounds=(0.1, 3.0),
            method='bounded'
        )
```

**自動特徴点抽出サービス（auto_feature_extraction.py）**:
```python
class AutoFeatureExtractionService:
    def __init__(self):
        self.face_mesh = mp.solutions.face_mesh.FaceMesh(...)
        # MediaPipeランドマークインデックス定義
        self.landmark_indices = {
            'rightEye': [33, 7, 163, ...],
            'leftEye': [362, 382, 381, ...],
            # ...
        }
```

### データストレージ
```python
# インメモリストレージ（開発用）
uploaded_images = {}      # アップロード画像情報
feature_points_storage = {} # 特徴点データ
processed_images_storage = {} # 処理済み画像情報

# ファイルストレージ
uploads/                  # 元画像と処理済み画像を保存
  ├── {image_id}.jpg     # 元画像
  └── processed_{id}.jpg # 処理済み画像
```

## フロントエンド構成（JavaScript）

### モジュール分割設計
```
frontend/js/
├── globals.js           # グローバル変数・DOM要素定義
├── utils.js             # 共通ユーティリティ関数
├── imageUpload.js       # 画像アップロード処理
├── featurePoints.js     # 特徴点描画・管理
├── featurePointEditor.js # 特徴点編集（マウスイベント）
├── faceDetection.js     # 顔検出・正面化処理
├── autoFeatures.js      # 自動特徴点抽出
├── comparison.js        # 顔比較処理
├── eventListeners.js    # イベントリスナー設定
└── app.js               # アプリケーション初期化
```

### 主要モジュール詳細

#### 1. 状態管理（globals.js）
```javascript
// アプリケーション状態
const imageData = {
    reference: { file: null, imageId: null, processed: null, points: [] },
    compare1: { file: null, imageId: null, processed: null, points: [] },
    compare2: { file: null, imageId: null, processed: null, points: [] }
};

// UI要素参照
const elements = {
    canvases: { /* Canvas要素 */ },
    buttons: { /* ボタン要素 */ },
    inputs: { /* 入力要素 */ }
};
```

#### 2. Canvas描画エンジン（featurePoints.js）
```javascript
// 特徴点描画
function drawFeaturePoint(ctx, point, isSelected = false) {
    // 円とラベルの描画
    ctx.beginPath();
    ctx.arc(point.x, point.y, isSelected ? 8 : 5, 0, 2 * Math.PI);
    ctx.fill();
    
    // ラベル描画
    ctx.fillText(point.label, point.x + 10, point.y - 10);
}

// 全特徴点の再描画
function redrawFeaturePoints(imageType) {
    // Canvas クリア → 画像描画 → 特徴点描画
}
```

#### 3. 自動特徴点抽出（autoFeatures.js）
```javascript
async function extractAutoFeatures() {
    const params = getAutoFeatureParams();
    
    // パラメータ検証
    const validationResult = await validateExtractionParameters(params);
    if (!validationResult.valid) return;
    
    // 3つの画像に対して並列実行
    const promises = Object.keys(imageData).map(async (imageType) => {
        if (imageData[imageType].processed) {
            return extractFeaturesForImage(imageType, params);
        }
    });
    
    await Promise.all(promises);
}
```

### HTMLレイアウト構造
```html
<!DOCTYPE html>
<html>
<head>
    <title>顔認証システム</title>
    <link rel="stylesheet" href="/static/style.css">
</head>
<body>
    <!-- ヘッダー -->
    <header>
        <h1>顔認証システム</h1>
    </header>
    
    <!-- メインコンテンツ -->
    <main>
        <!-- 画像アップロードセクション -->
        <section class="upload-section">
            <!-- 3つの画像スロット -->
        </section>
        
        <!-- 特徴点マーキングセクション -->
        <section class="marking-section">
            <!-- 手動・自動モード切り替え -->
            <!-- パラメータ設定 -->
        </section>
        
        <!-- 比較結果セクション -->
        <section class="results-section">
            <!-- 結果表示エリア -->
        </section>
    </main>
    
    <!-- JavaScriptモジュール読み込み -->
    <script src="/static/js/globals.js"></script>
    <script src="/static/js/utils.js"></script>
    <!-- ... 他8ファイル ... -->
    <script src="/static/js/app.js"></script>
</body>
</html>
```

## 通信プロトコル

### API通信フロー
```
1. 画像アップロード
   POST /api/upload-image
   → 画像ID返却

2. 顔検出・正面化
   POST /api/detect-face
   → 処理済み画像返却

3. 特徴点設定
   手動: UI操作で配置
   自動: POST /api/extract-auto-features

4. 特徴点保存
   POST /api/feature-points
   → 保存確認

5. 比較実行
   POST /api/compare
   → 比較結果返却
```

### データフォーマット

**特徴点データ**:
```json
{
  "image_id": "550e8400-e29b-41d4-a716-446655440000",
  "points": [
    {
      "x": 123.45,
      "y": 234.56,
      "type": "rightEye",
      "label": "右目_1",
      "confidence": 0.95,
      "landmark_index": 33
    }
  ]
}
```

**比較結果**:
```json
{
  "image1_score": 123.45,
  "image2_score": 456.78,
  "optimal_lambda1": 1.23,
  "optimal_lambda2": 0.89,
  "closer_image": "image1",
  "details": {
    "calculation_details": "...",
    "point_distances": [...]
  },
  "execution_time": 0.001234
}
```

## セキュリティ・制限事項

### セキュリティ対策
- **CORS設定**: フロントエンドからのアクセス制限
- **ファイルサイズ制限**: 5MB/画像
- **形式検証**: 画像ファイル形式の検証
- **入力検証**: 全APIパラメータの検証

### パフォーマンス制限
- **特徴点数**: 最大50点/画像
- **計算時間**: 通常1秒以内
- **同時処理**: 単一セッション前提

### 現在の制限事項
- **データ永続化**: メモリ内ストレージのみ
- **マルチユーザー**: 単一ユーザー前提
- **リアルタイム**: バッチ処理ベース

## 拡張性・スケーラビリティ

### 水平拡張のための設計
- **ステートレス設計**: APIエンドポイントは状態を持たない
- **モジュール分離**: 各機能が独立して動作
- **データ抽象化**: ストレージ層の分離

### 将来の拡張ポイント
- **データベース統合**: PostgreSQL/MongoDB対応
- **認証システム**: JWT認証の追加
- **キャッシュ層**: Redis統合
- **ロードバランサー**: Nginx/Apache統合
- **コンテナ化**: Docker対応

## 監視・ログ

### ログ出力
```python
# FastAPIログ
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 処理時間ログ
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    logger.info(f"{request.method} {request.url} - {process_time:.4f}s")
    return response
```

### エラーハンドリング
- **APIレベル**: HTTPExceptionによる適切なエラーレスポンス
- **サービスレベル**: try-catch による例外処理
- **フロントエンド**: fetch API のエラーハンドリング

このシステム構成により、保守性・拡張性・パフォーマンスのバランスの取れた顔認証システムが実現されています。
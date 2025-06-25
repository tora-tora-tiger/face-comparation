# 技術仕様書

## アルゴリズム仕様

### 顔照合アルゴリズムの数学的定義

#### 距離関数
基準画像の特徴点座標を `(xi, yi)`、比較画像の特徴点座標を `(ui, vi)` とし、スケーリングパラメータを `λ` とした時、距離関数 `D(λ)` は以下のように定義されます：

```
D(λ) = Σ(i=1 to n) [(xi - λ×ui)² + (yi - λ×vi)²]
```

**パラメータ説明**:
- `n`: 特徴点数（同一である必要がある）
- `λ`: スケーリングパラメータ（0.1 ≤ λ ≤ 3.0）
- `(xi, yi)`: 基準画像の第i番目の特徴点座標
- `(ui, vi)`: 比較画像の第i番目の特徴点座標

#### λ最適化
```
λ* = arg min D(λ)
      λ∈[0.1,3.0]
```

最適化手法として **黄金分割法（Golden Section Search）** を使用：
```python
from scipy.optimize import minimize_scalar

result = minimize_scalar(
    distance_function,
    bounds=(0.1, 3.0),
    method='bounded'
)
optimal_lambda = result.x
min_distance = result.fun
```

#### 類似度判定
```
similarity_score = 1 / (1 + D(λ*))
```

2つの比較画像 `A`, `B` において：
- `D_A(λ*_A) < D_B(λ*_B)` ならば画像Aが基準画像により近い
- λ値は画像のスケール比を表し、1.0に近いほどサイズが類似

### 特徴点抽出仕様

#### MediaPipeランドマーク仕様
MediaPipe Face Meshは468個のランドマークを提供し、各部位は以下のインデックスで定義されます：

**右目領域 (16点)**:
```python
rightEye_indices = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
```

**左目領域 (16点)**:
```python
leftEye_indices = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]
```

**鼻領域 (10点)**:
```python
nose_indices = [1, 2, 5, 4, 6, 168, 8, 9, 10, 151]
```

**口領域 (12点)**:
```python
mouth_indices = [61, 84, 17, 314, 405, 320, 307, 375, 321, 308, 324, 318]
```

**顔輪郭 (36点)**:
```python
face_contour_indices = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
```

#### 信頼度計算
MediaPipeのz座標（奥行き情報）を用いて信頼度を計算：
```python
def calculate_confidence(landmark):
    # z座標が0に近いほど信頼度が高い
    confidence = max(0.0, min(1.0, 1.0 - abs(landmark.z)))
    return confidence
```

#### 座標変換
MediaPipeの正規化座標 `(0.0-1.0)` をピクセル座標に変換：
```python
def normalize_to_pixel(landmark, image_width, image_height):
    return {
        "x": landmark.x * image_width,
        "y": landmark.y * image_height,
        "z": landmark.z  # 相対的な奥行き
    }
```

## API仕様

### RESTful APIエンドポイント

#### 1. 画像管理API

**画像アップロード**
```http
POST /api/upload-image
Content-Type: multipart/form-data

Parameters:
- file: UploadFile (required) - 画像ファイル (max 5MB)

Response:
{
  "image_id": "550e8400-e29b-41d4-a716-446655440000",
  "url": "/uploads/550e8400-e29b-41d4-a716-446655440000.jpg",
  "filename": "550e8400-e29b-41d4-a716-446655440000.jpg",
  "upload_time": "2025-06-24T12:00:00.123456"
}

Errors:
- 400: Unsupported file type
- 413: File too large (>5MB)
- 500: Upload failed
```

**特徴点データ保存**
```http
POST /api/feature-points
Content-Type: application/json

Body:
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

Response:
{
  "success": true,
  "message": "Feature points saved successfully",
  "point_count": 15
}
```

#### 2. 顔検出API

**顔検出・正面化**
```http
POST /api/detect-face
Content-Type: application/json

Body:
{
  "image_id": "550e8400-e29b-41d4-a716-446655440000"
}

Response:
{
  "success": true,
  "processed_image": "base64_encoded_image_data",
  "detection_info": {
    "face_bounds": [x, y, width, height],
    "rotation_angle": -5.2,
    "confidence": 0.95,
    "processing_time": 0.123
  }
}

Errors:
- 404: No face detected
- 422: Invalid image format
```

#### 3. 自動特徴点抽出API

**自動特徴点抽出**
```http
POST /api/extract-auto-features
Content-Type: application/json

Body:
{
  "image_id": "550e8400-e29b-41d4-a716-446655440000",
  "feature_types": ["rightEye", "leftEye", "nose", "mouth"],
  "points_per_type": {
    "rightEye": 4,
    "leftEye": 4,
    "nose": 3,
    "mouth": 4
  },
  "confidence_threshold": 0.5
}

注意: このAPIは処理済み画像（顔検出・正面化後）を優先的に使用します。
処理済み画像が存在しない場合のみ元画像を使用します。

Response:
{
  "success": true,
  "features": [
    {
      "x": 123.45,
      "y": 234.56,
      "type": "rightEye",
      "label": "右目_1",
      "confidence": 0.92,
      "landmark_index": 33
    }
  ],
  "extraction_time": 0.234,
  "total_points": 15
}
```

**パラメータ検証**
```http
POST /api/validate-extraction-parameters
Content-Type: application/json

Body:
{
  "feature_types": ["rightEye", "leftEye"],
  "points_per_type": {"rightEye": 4, "leftEye": 4},
  "confidence_threshold": 0.5
}

Response:
{
  "valid": true,
  "errors": [],
  "warnings": ["輪郭特徴点を含めると精度が向上します"],
  "estimated_points": 8
}
```

#### 4. 顔比較API

**顔画像比較**
```http
POST /api/compare
Content-Type: application/json

Body:
{
  "reference_id": "550e8400-e29b-41d4-a716-446655440000",
  "compare_ids": [
    "660e8400-e29b-41d4-a716-446655440001",
    "770e8400-e29b-41d4-a716-446655440002"
  ]
}

Response:
{
  "image1_score": 123.45,
  "image2_score": 456.78,
  "optimal_lambda1": 1.23,
  "optimal_lambda2": 0.89,
  "closer_image": "image1",
  "details": {
    "calculation_details": {
      "reference_points": 15,
      "compare1_points": 15,
      "compare2_points": 15,
      "optimization_iterations": [12, 8]
    },
    "point_distances": [
      {"point_index": 0, "distance1": 2.34, "distance2": 5.67},
      {"point_index": 1, "distance1": 1.23, "distance2": 3.45}
    ]
  },
  "execution_time": 0.001234
}

Errors:
- 400: Inconsistent point counts
- 404: Image or feature points not found
- 422: Insufficient feature points
```

## データ構造仕様

### Pydanticモデル定義

#### FeaturePoint
```python
class FeaturePoint(BaseModel):
    x: float = Field(..., ge=0, description="X座標 (ピクセル)")
    y: float = Field(..., ge=0, description="Y座標 (ピクセル)")
    type: Literal['rightEye', 'leftEye', 'nose', 'mouth', 'face_contour', 'other']
    label: str = Field(..., min_length=1, max_length=50)
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    landmark_index: Optional[int] = Field(None, ge=0, le=467)
```

#### ImageFeatures
```python
class ImageFeatures(BaseModel):
    image_id: str = Field(..., regex=r'^[0-9a-f-]{36}$')
    points: List[FeaturePoint] = Field(..., max_items=50)
    
    @validator('points')
    def validate_points(cls, v):
        if len(v) == 0:
            raise ValueError('At least one feature point is required')
        return v
```

#### ComparisonResult
```python
class ComparisonResult(BaseModel):
    image1_score: float = Field(..., ge=0)
    image2_score: float = Field(..., ge=0)
    optimal_lambda1: float = Field(..., ge=0.1, le=3.0)
    optimal_lambda2: float = Field(..., ge=0.1, le=3.0)
    closer_image: Literal['image1', 'image2']
    details: Dict[str, Any]
    execution_time: float = Field(..., ge=0)
```

### データベーススキーマ（将来実装）

#### images テーブル
```sql
CREATE TABLE images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255),
    file_size INTEGER,
    content_type VARCHAR(50),
    upload_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_image_data TEXT,  -- Base64エンコード
    face_detection_info JSONB
);
```

#### feature_points テーブル
```sql
CREATE TABLE feature_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_id UUID REFERENCES images(id) ON DELETE CASCADE,
    x FLOAT NOT NULL,
    y FLOAT NOT NULL,
    point_type VARCHAR(20) NOT NULL,
    label VARCHAR(50) NOT NULL,
    confidence FLOAT,
    landmark_index INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### comparison_results テーブル
```sql
CREATE TABLE comparison_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_image_id UUID REFERENCES images(id),
    compare_image1_id UUID REFERENCES images(id),
    compare_image2_id UUID REFERENCES images(id),
    image1_score FLOAT NOT NULL,
    image2_score FLOAT NOT NULL,
    optimal_lambda1 FLOAT NOT NULL,
    optimal_lambda2 FLOAT NOT NULL,
    closer_image VARCHAR(10) NOT NULL,
    calculation_details JSONB,
    execution_time FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## パフォーマンス仕様

### 処理時間要件

| 処理 | 目標時間 | 最大許容時間 |
|------|----------|-------------|
| 画像アップロード | < 1秒 | 3秒 |
| 顔検出・正面化 | < 0.5秒 | 2秒 |
| 自動特徴点抽出 | < 0.3秒 | 1秒 |
| λ最適化計算 | < 0.001秒 | 0.1秒 |
| 比較結果表示 | < 0.1秒 | 0.5秒 |

### リソース制限

| リソース | 制限値 | 説明 |
|----------|--------|------|
| 画像ファイルサイズ | 5MB | アップロード時の最大サイズ |
| 特徴点数 | 50点/画像 | メモリ使用量制限 |
| 同時処理数 | 3画像 | 並列処理上限 |
| セッション保持時間 | 1時間 | メモリ内データ保持時間 |
| API呼び出し頻度 | 100req/min | レート制限 |

### メモリ使用量

| コンポーネント | 使用量 | 詳細 |
|----------------|--------|------|
| MediaPipe初期化 | ~100MB | 顔検出モデル読み込み |
| 画像データ | ~15MB/画像 | 2048x2048最大 |
| 特徴点データ | ~2KB/画像 | 50点×座標情報 |
| 計算バッファ | ~1MB | λ最適化計算用 |

## セキュリティ仕様

### 入力検証

#### ファイルアップロード検証
```python
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

def validate_image_file(file: UploadFile):
    # 拡張子チェック
    if not any(file.filename.lower().endswith(ext) for ext in ALLOWED_EXTENSIONS):
        raise HTTPException(400, "Unsupported file type")
    
    # サイズチェック
    if file.size > MAX_FILE_SIZE:
        raise HTTPException(413, "File too large")
    
    # MIMEタイプチェック
    if not file.content_type.startswith('image/'):
        raise HTTPException(400, "Invalid content type")
```

#### パラメータ検証
```python
def validate_feature_points(points: List[FeaturePoint]):
    if len(points) > 50:
        raise HTTPException(422, "Too many feature points")
    
    for point in points:
        if point.x < 0 or point.y < 0:
            raise HTTPException(422, "Invalid coordinates")
        if point.confidence and (point.confidence < 0 or point.confidence > 1):
            raise HTTPException(422, "Invalid confidence value")
```

### データ保護

#### 画像データの暗号化（将来実装）
```python
from cryptography.fernet import Fernet

class ImageEncryption:
    def __init__(self):
        self.key = Fernet.generate_key()
        self.fernet = Fernet(self.key)
    
    def encrypt_image(self, image_data: bytes) -> bytes:
        return self.fernet.encrypt(image_data)
    
    def decrypt_image(self, encrypted_data: bytes) -> bytes:
        return self.fernet.decrypt(encrypted_data)
```

#### アクセス制御
```python
# API認証（将来実装）
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer

security = HTTPBearer()

async def authenticate(token: str = Depends(security)):
    if not validate_token(token):
        raise HTTPException(401, "Invalid authentication")
    return get_user_from_token(token)
```

### CORS設定
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"]
)
```

## エラーハンドリング仕様

### HTTPステータスコード

| コード | 用途 | 例 |
|--------|------|---|
| 200 | 成功 | 正常処理完了 |
| 400 | リクエストエラー | 不正なパラメータ |
| 404 | リソースなし | 画像ID不存在 |
| 413 | ペイロード過大 | ファイルサイズ超過 |
| 422 | 検証エラー | 特徴点データ不正 |
| 500 | サーバーエラー | 予期しないエラー |

### エラーレスポンス形式
```json
{
  "error": {
    "code": "INVALID_PARAMETERS",
    "message": "特徴点数が画像間で一致していません",
    "details": {
      "reference_points": 15,
      "compare1_points": 12,
      "compare2_points": 15
    },
    "timestamp": "2025-06-24T12:00:00Z"
  }
}
```

### 例外処理階層
```python
# カスタム例外
class FaceDetectionError(Exception):
    pass

class FeatureExtractionError(Exception):
    pass

class ComparisonError(Exception):
    pass

# グローバル例外ハンドラー
@app.exception_handler(FaceDetectionError)
async def face_detection_exception_handler(request: Request, exc: FaceDetectionError):
    return JSONResponse(
        status_code=404,
        content={"error": {"code": "FACE_NOT_DETECTED", "message": str(exc)}}
    )
```

## テスト仕様

### 単体テスト

#### 距離計算テスト
```python
def test_distance_calculation():
    ref_points = [{"x": 100, "y": 100}, {"x": 200, "y": 200}]
    comp_points = [{"x": 110, "y": 110}, {"x": 220, "y": 220}]
    lambda_val = 1.0
    
    expected_distance = (100-110)**2 + (100-110)**2 + (200-220)**2 + (200-220)**2
    actual_distance = calculate_distance(ref_points, comp_points, lambda_val)
    
    assert abs(actual_distance - expected_distance) < 1e-10
```

#### λ最適化テスト
```python
def test_lambda_optimization():
    ref_points = [{"x": 100, "y": 100}]
    comp_points = [{"x": 200, "y": 200}]  # 2倍サイズ
    
    result = optimize_lambda(ref_points, comp_points)
    
    assert abs(result['optimal_lambda'] - 0.5) < 0.01  # λ≈0.5で最小
    assert result['min_distance'] < 100  # 距離が改善される
```

### 統合テスト

#### APIエンドポイントテスト
```python
def test_full_comparison_workflow():
    # 1. 画像アップロード
    response1 = client.post("/api/upload-image", files={"file": test_image1})
    image_id1 = response1.json()["image_id"]
    
    # 2. 特徴点設定
    points_data = {"image_id": image_id1, "points": test_points}
    client.post("/api/feature-points", json=points_data)
    
    # 3. 比較実行
    compare_data = {"reference_id": image_id1, "compare_ids": [image_id2, image_id3]}
    response = client.post("/api/compare", json=compare_data)
    
    assert response.status_code == 200
    result = response.json()
    assert "closer_image" in result
    assert result["execution_time"] < 1.0
```

### パフォーマンステスト
```python
def test_performance_requirements():
    start_time = time.time()
    
    # 50点特徴点での比較処理
    result = execute_comparison_with_50_points()
    
    execution_time = time.time() - start_time
    assert execution_time < 0.1  # 100ms以下
    assert result["execution_time"] < 0.001  # 1ms以下
```

この技術仕様書により、システムの実装詳細、API定義、パフォーマンス要件、セキュリティ対策、テスト方針が明確に定義されています。
# データフロー・処理フロー

## システム全体のデータフロー

### 概要図
```
┌──────────────┐    ①Upload     ┌─────────────────┐
│   画像ファイル │ ────────────→ │  画像データ保存  │
│ (3枚の顔画像) │               │  (uploads/)     │
└──────────────┘               └─────────────────┘
                                        │
                                        ▼
┌──────────────┐    ②Detect     ┌─────────────────┐
│  顔検出結果   │ ←────────────── │   顔検出・正面化  │
│ (正面化画像)  │                │  (OpenCV処理)   │
└──────────────┘                └─────────────────┘
        │                                │
        ▼                                ▼
┌──────────────┐    ③Extract    ┌─────────────────┐
│  特徴点データ　 │←────────────── │  特徴点抽出処理 　 │
│ (座標・タイプ) │                │ (MediaPipe/手動) │
└──────────────┘                └─────────────────┘
        │
        ▼
┌──────────────┐    ④Compare    ┌─────────────────┐
│   比較結果    │ ←────────────── │   λ最適化比較    │
│　(距離・λ値)   │                │ (SciPy最適化)   │
└──────────────┘                └─────────────────┘
```

## 詳細処理フロー

### 1. 画像アップロードフロー

#### フロントエンド側
```javascript
// ファイル選択・ドラッグ&ドロップ
handleFileSelect(event, imageType) {
    const file = event.target.files[0];
    uploadImage(file, imageType);
}

// サーバーへアップロード
async function uploadImage(file, imageType) {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData
    });
    
    const result = await response.json();
    imageData[imageType].imageId = result.image_id;
    displayImageOnCanvas(result.url, imageType);
}
```

#### バックエンド側
```python
@router.post("/upload-image")
async def upload_image(file: UploadFile = File(...)):
    # ファイル検証
    if file.content_type not in ["image/jpeg", "image/png", ...]:
        raise HTTPException(400, "Unsupported file type")
    
    # 一意ファイル名生成
    image_id = str(uuid.uuid4())
    filename = f"{image_id}.jpg"
    
    # ファイル保存
    file_path = os.path.join("uploads", filename)
    with open(file_path, "wb") as f:
        f.write(await file.read())
    
    # メタデータ保存
    uploaded_images[image_id] = {
        "filename": filename,
        "original_filename": file.filename,
        "upload_time": datetime.now()
    }
    
    return {
        "image_id": image_id,
        "url": f"/uploads/{filename}",
        "filename": filename,
        "upload_time": uploaded_images[image_id]["upload_time"]
    }
```

**データ変換**: `File Object` → `MultipartForm` → `Binary Data` → `Image File` → `UUID + URL`

### 2. 顔検出・正面化フロー

#### 処理シーケンス
```
画像データ → OpenCV読み込み → 顔検出 → 境界ボックス → トリミング → 角度計算 → 回転補正 → Base64エンコード
```

#### フロントエンド側
```javascript
async function processFaceDetection(imageType) {
    const imageId = imageData[imageType].imageId;
    
    const response = await fetch('/api/detect-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_id: imageId })
    });
    
    const result = await response.json();
    displayProcessedImage(result.processed_image, imageType);
    displayDetectionInfo(result.detection_info, imageType);
}

function displayProcessedImage(base64Image, imageType) {
    const img = new Image();
    img.onload = () => {
        const canvas = elements.canvases.processed[imageType];
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = `data:image/jpeg;base64,${base64Image}`;
}
```

#### バックエンド側
```python
class FaceDetectionService:
    def detect_and_process_face(self, image_path: str):
        # 1. 画像読み込み
        image = cv2.imread(image_path)
        
        # 2. 顔検出
        faces = self.face_cascade.detectMultiScale(image, ...)
        if len(faces) == 0:
            raise HTTPException(404, "No face detected")
        
        # 3. 最大の顔を選択
        face = max(faces, key=lambda f: f[2] * f[3])
        x, y, w, h = face
        
        # 4. マージン付きトリミング
        margin = int(min(w, h) * 0.3)
        cropped = image[max(0, y-margin):y+h+margin, 
                       max(0, x-margin):x+w+margin]
        
        # 5. 目検出・角度計算
        angle = self.calculate_face_angle(cropped)
        
        # 6. 回転補正
        corrected = self.rotate_image(cropped, -angle)
        
        # 7. Base64エンコード
        _, buffer = cv2.imencode('.jpg', corrected)
        base64_image = base64.b64encode(buffer).decode('utf-8')
        
        return {
            "processed_image": base64_image,
            "detection_info": {
                "face_bounds": [x, y, w, h],
                "rotation_angle": angle,
                "confidence": 0.95
            }
        }
```

**データ変換**: `Image File` → `OpenCV Mat` → `Face Bounds` → `Cropped Image` → `Rotated Image` → `Base64 String`

### 3. 特徴点抽出フロー

#### 手動特徴点設定フロー
```javascript
// マウスクリック処理
function handleProcessedCanvasMouseDown(event, imageType) {
    const canvas = elements.canvases.processed[imageType];
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // 既存特徴点のヒットテスト
    const hitPoint = hitTestFeaturePoint(x, y, imageData[imageType].points);
    
    if (hitPoint) {
        // 既存点を選択
        setSelectedPoint(hitPoint, imageType);
    } else {
        // 新しい特徴点を追加
        addFeaturePoint(x, y, imageType);
    }
}

function addFeaturePoint(x, y, imageType) {
    const newPoint = {
        x: x,
        y: y,
        type: currentFeatureType,
        label: generateLabel(currentFeatureType, imageType)
    };
    
    imageData[imageType].points.push(newPoint);
    drawFeaturePoint(ctx, newPoint);
    updateUI();
}
```

#### 自動特徴点抽出フロー
```javascript
async function extractAutoFeatures() {
    // 1. 処理済み画像の確認
    const processedImageTypes = ['reference', 'compare1', 'compare2'].filter(
        imageType => imageData[imageType].processedImage
    );
    
    if (processedImageTypes.length === 0) {
        alert('自動特徴点抽出を実行するには、まず顔検出・正面化処理を実行してください。');
        return;
    }
    
    // 2. パラメータ検証
    const params = getAutoFeatureParams();
    const validation = await validateExtractionParameters(params);
    if (!validation.valid) {
        displayErrors(validation.errors);
        return;
    }
    
    // 3. 処理済み画像のみに対して実行
    for (const imageType of processedImageTypes) {
        const result = await extractFeaturesForImage(imageType, params);
        displayAutoFeatures(result.features, imageType);
    }
}

async function extractFeaturesForImage(imageType, params) {
    const response = await fetch('/api/extract-auto-features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            image_id: imageData[imageType].imageId,
            feature_types: params.feature_types,
            points_per_type: params.points_per_type,
            confidence_threshold: params.confidence_threshold
        })
    });
    
    return await response.json();
}
```

#### MediaPipe処理（バックエンド）
```python
class AutoFeatureExtractionService:
    def extract_auto_features(self, image_path=None, image_data=None, params=None):
        # 1. 画像読み込み（処理済み画像を優先）
        if image_data:
            # Base64データから画像を復元（正面化後の画像）
            image_bytes = base64.b64decode(image_data)
            pil_image = Image.open(BytesIO(image_bytes))
            rgb_image = np.array(pil_image)
        elif image_path:
            # ファイルパスから読み込み（元画像）
            image = cv2.imread(image_path)
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        else:
            raise ValueError("画像パスまたは画像データが必要です")
        
        # 2. MediaPipe処理
        results = self.face_mesh.process(rgb_image)
        if not results.multi_face_landmarks:
            raise HTTPException(404, "No face landmarks detected")
        
        # 3. ランドマーク抽出
        landmarks = results.multi_face_landmarks[0]
        extracted_points = []
        
        for feature_type in params['feature_types']:
            indices = self.landmark_indices[feature_type]
            points_needed = params['points_per_type'][feature_type]
            
            # 4. 信頼度フィルタリング
            filtered_points = self.filter_by_confidence(
                landmarks, indices, params['confidence_threshold']
            )
            
            # 5. 上位N点を選択
            selected_points = filtered_points[:points_needed]
            
            # 6. 座標変換（正規化座標 → ピクセル座標）
            for i, point in enumerate(selected_points):
                extracted_points.append({
                    "x": point.x * rgb_image.shape[1],
                    "y": point.y * rgb_image.shape[0],
                    "type": feature_type,
                    "label": f"{self.get_type_label(feature_type)}_{i+1}",
                    "confidence": self.calculate_confidence(point),
                    "landmark_index": indices[i]
                })
        
        return {"features": extracted_points}
```

**データ変換**: `Processed Image (Base64)` → `PIL Image` → `NumPy Array` → `MediaPipe Landmarks` → `Normalized Coordinates` → `Pixel Coordinates` → `Feature Points`

### 4. 比較処理フロー

#### フロントエンド側
```javascript
async function executeComparison() {
    // 1. 特徴点数の検証
    const refPoints = imageData.reference.points.length;
    const comp1Points = imageData.compare1.points.length;
    const comp2Points = imageData.compare2.points.length;
    
    if (refPoints === 0 || comp1Points === 0 || comp2Points === 0) {
        alert('全ての画像に特徴点を設定してください');
        return;
    }
    
    // 2. 特徴点データを保存
    await Promise.all([
        saveFeaturePoints('reference'),
        saveFeaturePoints('compare1'),
        saveFeaturePoints('compare2')
    ]);
    
    // 3. 比較実行
    const response = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            reference_id: imageData.reference.imageId,
            compare_ids: [imageData.compare1.imageId, imageData.compare2.imageId]
        })
    });
    
    const result = await response.json();
    displayResults(result);
}
```

#### λ最適化処理（バックエンド）
```python
class FaceComparisonService:
    def compare_faces(self, reference_id: str, compare_ids: List[str]):
        # 1. 特徴点データ取得
        ref_points = feature_points_storage[reference_id]
        comp1_points = feature_points_storage[compare_ids[0]]
        comp2_points = feature_points_storage[compare_ids[1]]
        
        # 2. 各比較画像に対してλ最適化
        result1 = self.optimize_lambda(ref_points, comp1_points)
        result2 = self.optimize_lambda(ref_points, comp2_points)
        
        # 3. 結果比較
        closer_image = "image1" if result1['min_distance'] < result2['min_distance'] else "image2"
        
        return {
            "image1_score": result1['min_distance'],
            "image2_score": result2['min_distance'],
            "optimal_lambda1": result1['optimal_lambda'],
            "optimal_lambda2": result2['optimal_lambda'],
            "closer_image": closer_image,
            "details": {
                "calculation_details": self.get_calculation_details(),
                "point_distances": self.get_point_distances()
            },
            "execution_time": time.time() - start_time
        }
    
    def optimize_lambda(self, ref_points: List, comp_points: List):
        def objective_function(lambda_val):
            return self.calculate_distance(ref_points, comp_points, lambda_val)
        
        # 黄金分割法による最適化
        result = minimize_scalar(
            objective_function,
            bounds=(0.1, 3.0),
            method='bounded'
        )
        
        return {
            "optimal_lambda": result.x,
            "min_distance": result.fun
        }
    
    def calculate_distance(self, ref_points: List, comp_points: List, lambda_val: float):
        # D(λ) = Σ(xi - λ×yi)² の計算
        total_distance = 0.0
        
        for ref_point, comp_point in zip(ref_points, comp_points):
            dx = ref_point['x'] - lambda_val * comp_point['x']
            dy = ref_point['y'] - lambda_val * comp_point['y']
            total_distance += dx*dx + dy*dy
        
        return total_distance
```

**データ変換**: `Feature Points` → `Coordinate Arrays` → `Distance Function` → `Optimization` → `λ Value + Min Distance`

## 座標系変換

### 座標変換フロー
```
Canvas座標 ←→ 画像座標 ←→ MediaPipe正規化座標
```

#### Canvas座標 → 画像座標
```javascript
function getCanvasCoordinates(event, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY
    };
}
```

#### MediaPipe正規化座標 → ピクセル座標
```python
def normalize_to_pixel(landmark, image_width, image_height):
    return {
        "x": landmark.x * image_width,
        "y": landmark.y * image_height
    }
```

## エラーハンドリングフロー

### APIエラー処理
```javascript
async function apiCall(url, options) {
    try {
        const response = await fetch(url, options);
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'API Error');
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        displayError(error.message);
        throw error;
    }
}
```

### バックエンドエラー処理
```python
@router.post("/api/endpoint")
async def endpoint_handler(request: RequestModel):
    try:
        result = await process_request(request)
        return result
    except ValidationError as e:
        raise HTTPException(422, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(404, detail="Image not found")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise HTTPException(500, detail="Internal server error")
```

## パフォーマンス最適化

### 非同期処理
```javascript
// 並列画像処理
async function processAllImages() {
    const promises = Object.keys(imageData).map(async (imageType) => {
        if (imageData[imageType].imageId) {
            return processFaceDetection(imageType);
        }
    });
    
    await Promise.all(promises);
}
```

### キャッシュ機能
```python
# 計算結果キャッシュ
calculation_cache = {}

def get_cached_result(key: str):
    if key in calculation_cache:
        return calculation_cache[key]
    return None

def cache_result(key: str, result: dict):
    calculation_cache[key] = result
```

## データ整合性

### 状態同期
```javascript
// UI状態の一元管理
function updateUI() {
    updateFeaturePointsDisplay();
    updateButtonStates();
    updateCounters();
    updateValidationStatus();
}

// データ整合性チェック
function validateDataConsistency() {
    const issues = [];
    
    // 特徴点数の一致確認
    const pointCounts = Object.keys(imageData).map(
        key => imageData[key].points.length
    );
    
    if (new Set(pointCounts).size > 1) {
        issues.push('特徴点数が画像間で一致していません');
    }
    
    return issues;
}
```

このデータフローにより、画像アップロードから最終的な比較結果まで、一貫した処理パイプラインが構築されています。各段階でのデータ変換と検証により、システムの信頼性と精度が確保されています。
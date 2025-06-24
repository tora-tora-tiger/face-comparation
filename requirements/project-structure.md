# プロジェクト構造設計（更新版）

## ディレクトリ構造

```
class-human-interface/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPIアプリケーション
│   │   ├── models.py            # Pydanticモデル
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── images.py        # 画像アップロードAPI
│   │   │   └── comparison.py    # 比較計算API
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── image_storage.py # 画像保存管理
│   │   │   └── face_comparison.py # 顔比較アルゴリズム
│   │   └── utils/
│   │       ├── __init__.py
│   │       └── optimization.py  # λ最適化
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── index.html               # メインHTML
│   ├── style.css                # スタイルシート
│   ├── script.js                # メインJavaScript
│   └── assets/
│       └── images/              # 静的画像
├── uploads/                     # アップロードされた画像保存
├── requirements/
│   ├── question.md
│   ├── technical-requirements.md
│   └── project-structure.md
├── .gitignore
├── README.md
└── CLAUDE.md
```

## バックエンド構成

### main.py
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Face Comparison API")

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 静的ファイル配信
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
```

### models.py
```python
from pydantic import BaseModel
from typing import List, Literal

class FeaturePoint(BaseModel):
    x: float
    y: float
    type: Literal['rightEye', 'leftEye', 'nose', 'mouth', 'other']
    label: str

class ImageFeatures(BaseModel):
    image_id: str
    points: List[FeaturePoint]

class ComparisonRequest(BaseModel):
    reference_id: str
    compare_ids: List[str]

class ComparisonResult(BaseModel):
    image1_score: float
    image2_score: float
    optimal_lambda1: float
    optimal_lambda2: float
    closer_image: Literal['image1', 'image2']
    details: dict
```

## フロントエンド構成（Minimum）

### index.html
- 画像アップロードエリア（3つ）
- Canvas要素（画像表示と特徴点描画）
- 結果表示エリア
- 比較実行ボタン

### script.js 主要機能
```javascript
// 画像アップロード処理
async function uploadImage(file) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData
    });
    return response.json();
}

// 特徴点マーキング
function markFeaturePoint(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    // 特徴点を配列に追加
    // Canvasに描画
}

// 比較実行
async function executeComparison() {
    const response = await fetch('/api/compare', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            reference_id: referenceImageId,
            compare_ids: [image1Id, image2Id]
        })
    });
    const result = await response.json();
    displayResult(result);
}
```

## API仕様

### POST /api/upload-image
- multipart/form-dataで画像受信
- 画像をuploads/に保存
- レスポンス: `{"image_id": "uuid", "url": "/uploads/uuid.jpg"}`

### POST /api/feature-points
- 画像IDと特徴点配列を受信
- メモリまたはファイルに保存
- レスポンス: `{"success": true}`

### POST /api/compare
- 基準画像IDと比較画像ID2つを受信
- 特徴点データを取得
- 距離計算とλ最適化を実行
- レスポンス: 比較結果JSON

## 開発手順

1. バックエンド環境構築
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. FastAPI起動
   ```bash
   uvicorn app.main:app --reload
   ```

3. フロントエンド開発
   - 静的ファイルを直接編集
   - ブラウザでlocalhost:8000を開く
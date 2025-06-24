# 顔認証システム (Face Recognition System)

特徴点ベースの顔認証アルゴリズムを実装したWebアプリケーション

## 概要

3枚の顔画像（基準画像1枚、比較画像2枚）をアップロードし、各画像に特徴点をマーキングして、基準画像により近い画像を判定します。

### 主な機能

- 画像アップロード（ドラッグ&ドロップ対応）
- 特徴点マーキング（5種類の特徴点タイプ）
- 距離計算アルゴリズム（D(λ) = Σ(xi - λ×yi)²）
- λパラメータの最適化
- 結果の可視化

## 技術スタック

### バックエンド
- **FastAPI**: RESTful API
- **Python**: 3.8以上
- **NumPy/SciPy**: 数値計算
- **Pillow**: 画像処理

### フロントエンド
- **HTML/CSS/JavaScript**: シンプルなUI
- **Canvas API**: 画像表示と特徴点描画

## セットアップ

### 1. 依存関係のインストール

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. サーバー起動

```bash
cd backend
source venv/bin/activate  # Windows: venv\Scripts\activate
uvicorn app.main:app --reload
```

### 3. アプリケーションにアクセス

ブラウザで http://localhost:8000 を開く

## 使用方法

1. **画像アップロード**: 3枚の顔画像をアップロード
2. **基準画像選択**: 左端の画像が基準画像として使用される
3. **特徴点マーキング**: 各画像をクリックして特徴点を配置
   - 右目、左目、鼻、口、その他の5種類から選択可能
   - 全ての画像で同じ数の特徴点が必要
4. **比較実行**: 「比較を実行」ボタンをクリック
5. **結果確認**: 計算結果と詳細情報を表示

## API仕様

### POST /api/upload-image
画像をアップロードします。

**Request**: multipart/form-data
**Response**: 
```json
{
  "image_id": "uuid",
  "url": "/uploads/filename.jpg",
  "filename": "filename.jpg",
  "upload_time": "2024-01-01T00:00:00"
}
```

### POST /api/feature-points
特徴点データを保存します。

**Request**:
```json
{
  "image_id": "uuid",
  "points": [
    {
      "x": 100.0,
      "y": 150.0,
      "type": "rightEye",
      "label": "右目_1"
    }
  ]
}
```

### POST /api/compare
顔画像の比較を実行します。

**Request**:
```json
{
  "reference_id": "uuid",
  "compare_ids": ["uuid1", "uuid2"]
}
```

**Response**:
```json
{
  "image1_score": 123.45,
  "image2_score": 234.56,
  "optimal_lambda1": 1.23,
  "optimal_lambda2": 1.45,
  "closer_image": "image1",
  "details": {...},
  "execution_time": 0.123
}
```

## プロジェクト構造

```
class-human-interface/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPIアプリケーション
│   │   ├── models.py            # Pydanticモデル
│   │   ├── routers/
│   │   │   ├── images.py        # 画像API
│   │   │   └── comparison.py    # 比較API
│   │   └── services/
│   │       └── face_comparison.py # 顔比較アルゴリズム
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
└── uploads/                     # アップロード画像保存
```

## アルゴリズム

### 距離計算式
```
D(λ) = Σ(xi - λ×yi)²
```

- xi: 基準画像の特徴点座標
- yi: 比較画像の特徴点座標
- λ: スケーリングパラメータ（0.1〜3.0の範囲で最適化）

### 最適化手法
- 黄金分割法（scipy.optimize.minimize_scalar）を使用
- λ値を最適化して最小距離を求める
- より小さい距離スコアを持つ画像が基準画像に近いと判定

## 制限事項

- 画像サイズ: 最大5MB
- 対応形式: JPEG, PNG, GIF, BMP
- 特徴点数: 最大50点/画像
- 計算時間: 通常1秒以内

## 開発

### 開発サーバー起動
```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### APIドキュメント
サーバー起動後、以下のURLでSwagger UIを確認できます：
- http://localhost:8000/docs
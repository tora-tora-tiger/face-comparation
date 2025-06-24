# 技術要件定義書

## 1. アプリケーション概要

顔画像の特徴点をマーキングし、複数の画像間で類似度を計算する顔認証アプリケーション

## 2. 機能要件

### 2.1 画像管理機能
- 3枚の顔画像をアップロード（基準画像1枚、比較画像2枚）
- 対応画像形式: JPEG, PNG
- 画像のプレビュー表示

### 2.2 特徴点マーキング機能
- 画像上でクリックして特徴点を配置
- 特徴点の可視化（点とラベル表示）
- 特徴点の編集・削除
- 特徴点のタイプ設定（右目、左目、鼻、口など）
- 座標データの保存

### 2.3 類似度計算機能
- λパラメータの自動最適化
- 距離計算: D(λ) = Σ(xi - λ×yi)²
- 比較結果の表示（どちらの画像が基準に近いか）
- 計算過程の可視化

## 3. 技術スタック

### 3.1 フロントエンド（Minimum構成）
- **HTML/CSS/JavaScript**: シンプルな実装
- **画像表示**: Canvas API
- **HTTPクライアント**: Fetch API
- **ビルドツール**: なし（静的ファイルのみ）

### 3.2 バックエンド
- **フレームワーク**: FastAPI
- **画像処理**: OpenCV / Pillow
- **数値計算**: NumPy/SciPy
- **パッケージ管理**: venv

### 3.3 開発ツール
- **Python**: 3.8以上
- **リンター**: Black + isort
- **API文書**: FastAPI自動生成（Swagger UI）

## 4. アーキテクチャ設計

### 4.1 アーキテクチャ概要
- フロントエンド: 画像表示と特徴点マーキングのみ
- バックエンド: 全ての計算処理（距離計算、λ最適化）
- API通信: REST API（JSON形式）

### 4.2 API エンドポイント

```
POST /api/upload-image
  - 画像アップロード
  - Response: { image_id: string, url: string }

POST /api/feature-points
  - 特徴点データ送信
  - Body: { image_id: string, points: [{x, y, type, label}] }

POST /api/compare
  - 顔画像比較実行
  - Body: { reference_id: string, compare_ids: [string, string] }
  - Response: { results: {...}, closer_image: string }
```

### 4.3 データ構造（Python）

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

class ComparisonResult(BaseModel):
    image1_score: float
    image2_score: float
    optimal_lambda1: float
    optimal_lambda2: float
    closer_image: Literal['image1', 'image2']
```

## 5. UI/UX 要件

### 5.1 レイアウト
- 3つの画像を並べて表示
- 各画像の下に特徴点リスト
- 計算結果を別セクションに表示

### 5.2 操作フロー
1. 3枚の画像をアップロード
2. 基準画像を選択
3. 各画像に特徴点をマーキング
4. 「比較実行」ボタンで計算
5. 結果表示

## 6. パフォーマンス要件

- 画像サイズ: 最大 5MB/枚
- 特徴点数: 最大 50点/画像
- 計算時間: 1秒以内

## 7. ブラウザ対応

- Chrome (最新版)
- Firefox (最新版)
- Safari (最新版)
- Edge (最新版)
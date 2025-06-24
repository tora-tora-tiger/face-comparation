from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

# ルーターのインポート
from app.routers import images, comparison

app = FastAPI(
    title="Face Comparison API",
    description="顔認証システムのバックエンドAPI",
    version="1.0.0"
)

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 本番環境では適切に設定
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# プロジェクトルートディレクトリを取得
project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))

# 静的ファイル配信（アップロードされた画像）
uploads_dir = os.path.join(project_root, "uploads")
if not os.path.exists(uploads_dir):
    os.makedirs(uploads_dir)

app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# フロントエンド静的ファイル配信
frontend_dir = os.path.join(project_root, "frontend")
if os.path.exists(frontend_dir):
    app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

# APIルーターを追加
app.include_router(images.router, prefix="/api", tags=["images"])
app.include_router(comparison.router, prefix="/api", tags=["comparison"])

@app.get("/")
async def serve_frontend():
    """フロントエンドのindex.htmlを返す"""
    frontend_index = os.path.join(project_root, "frontend", "index.html")
    if os.path.exists(frontend_index):
        return FileResponse(frontend_index)
    else:
        return {"message": "Frontend not found. Please access API documentation at /docs"}

@app.get("/health")
async def health_check():
    """ヘルスチェックエンドポイント"""
    return {"status": "healthy", "message": "Face Comparison API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
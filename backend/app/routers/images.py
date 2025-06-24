from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import uuid
import os
from datetime import datetime
from PIL import Image
import shutil

from app.models import ImageUploadResponse, ImageFeatures, FeaturePointsResponse

router = APIRouter()

# アップロード可能な画像形式
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

# 特徴点データを一時的に保存（本番環境ではデータベースを使用）
feature_points_storage = {}

def allowed_file(filename: str) -> bool:
    """ファイル形式をチェック"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def validate_image(file: UploadFile) -> bool:
    """画像ファイルを検証"""
    if not allowed_file(file.filename):
        return False
    
    if file.size > MAX_FILE_SIZE:
        return False
    
    return True

@router.post("/upload-image", response_model=ImageUploadResponse)
async def upload_image(file: UploadFile = File(...)):
    """画像をアップロードする"""
    
    # ファイル検証
    if not validate_image(file):
        raise HTTPException(
            status_code=400,
            detail="Invalid file format or file too large (max 5MB)"
        )
    
    try:
        # ユニークなファイル名を生成
        image_id = str(uuid.uuid4())
        file_extension = file.filename.rsplit('.', 1)[1].lower()
        filename = f"{image_id}.{file_extension}"
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
        uploads_dir = os.path.join(project_root, "uploads")
        file_path = os.path.join(uploads_dir, filename)
        
        # ファイルを保存
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 画像が正常に開けるかチェック
        try:
            with Image.open(file_path) as img:
                img.verify()
        except Exception:
            os.remove(file_path)
            raise HTTPException(status_code=400, detail="Invalid image file")
        
        return ImageUploadResponse(
            image_id=image_id,
            url=f"/uploads/{filename}",
            filename=filename,
            upload_time=datetime.now()
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.post("/feature-points", response_model=FeaturePointsResponse)
async def save_feature_points(image_features: ImageFeatures):
    """特徴点データを保存する"""
    
    try:
        # 特徴点データを保存（メモリ内）
        feature_points_storage[image_features.image_id] = image_features.points
        
        return FeaturePointsResponse(
            success=True,
            message="Feature points saved successfully",
            image_id=image_features.image_id,
            points_count=len(image_features.points)
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save feature points: {str(e)}")

@router.get("/feature-points/{image_id}")
async def get_feature_points(image_id: str):
    """指定された画像の特徴点データを取得する"""
    
    if image_id not in feature_points_storage:
        raise HTTPException(status_code=404, detail="Feature points not found for this image")
    
    return {
        "image_id": image_id,
        "points": feature_points_storage[image_id]
    }

@router.delete("/image/{image_id}")
async def delete_image(image_id: str):
    """画像とその特徴点データを削除する"""
    
    try:
        # 画像ファイルを削除
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
        uploads_dir = os.path.join(project_root, "uploads")
        for ext in ALLOWED_EXTENSIONS:
            file_path = os.path.join(uploads_dir, f"{image_id}.{ext}")
            if os.path.exists(file_path):
                os.remove(file_path)
                break
        
        # 特徴点データを削除
        if image_id in feature_points_storage:
            del feature_points_storage[image_id]
        
        return {"success": True, "message": "Image and feature points deleted successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete image: {str(e)}")
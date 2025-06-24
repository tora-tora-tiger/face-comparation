from fastapi import APIRouter, HTTPException
import os
from typing import Dict, Any

from app.models import FaceDetectionRequest, FaceDetectionResponse
from app.services.face_detection import FaceDetectionService
from app.routers.images import feature_points_storage

router = APIRouter()
face_detection_service = FaceDetectionService()

# 処理済み画像を一時的に保存（本番環境ではデータベースを使用）
processed_images_storage = {}

@router.post("/detect-face", response_model=FaceDetectionResponse)
async def detect_and_process_face(request: FaceDetectionRequest) -> FaceDetectionResponse:
    """
    顔検出・トリミング・正面化処理を実行する
    
    Args:
        request: 顔検出リクエスト（画像ID）
        
    Returns:
        顔検出・処理結果
    """
    
    image_id = request.image_id
    
    # 画像ファイルのパスを構築
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
    uploads_dir = os.path.join(project_root, "uploads")
    
    # 対応する画像ファイルを検索
    image_path = None
    allowed_extensions = ['jpg', 'jpeg', 'png', 'bmp']
    
    for ext in allowed_extensions:
        potential_path = os.path.join(uploads_dir, f"{image_id}.{ext}")
        if os.path.exists(potential_path):
            image_path = potential_path
            break
    
    if not image_path:
        raise HTTPException(
            status_code=404,
            detail=f"画像が見つかりません: {image_id}"
        )
    
    try:
        # 顔検出・処理を実行
        result = face_detection_service.detect_and_process_face(image_path)
        
        # 処理済み画像をストレージに保存
        if result["success"] and result["processed_image"]:
            processed_images_storage[image_id] = {
                "processed_image": result["processed_image"],
                "face_landmarks": result["face_landmarks"],
                "processing_info": result["processing_info"]
            }
        
        # レスポンスデータを構築
        response_data = {
            "success": result["success"],
            "message": result["message"],
            "image_id": image_id,
            "original_image": result.get("original_image"),
            "processed_image": result.get("processed_image"),
            "face_bbox": result.get("face_bbox"),
            "face_landmarks": result.get("face_landmarks"),
            "processing_info": result.get("processing_info")
        }
        
        return FaceDetectionResponse(**response_data)
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"顔検出処理中にエラーが発生しました: {str(e)}"
        )

@router.get("/processed-image/{image_id}")
async def get_processed_image(image_id: str):
    """処理済み画像データを取得する"""
    
    if image_id not in processed_images_storage:
        raise HTTPException(
            status_code=404,
            detail="処理済み画像が見つかりません"
        )
    
    return processed_images_storage[image_id]

@router.get("/face-detection-info")
async def get_face_detection_info():
    """顔検出サービスの情報を取得"""
    return face_detection_service.get_processing_info()

@router.delete("/processed-image/{image_id}")
async def delete_processed_image(image_id: str):
    """処理済み画像データを削除する"""
    
    if image_id in processed_images_storage:
        del processed_images_storage[image_id]
        return {"success": True, "message": "処理済み画像データを削除しました"}
    else:
        raise HTTPException(
            status_code=404,
            detail="処理済み画像が見つかりません"
        )

@router.get("/detection-status")
async def get_detection_status():
    """顔検出サービスの状態を取得"""
    return {
        "service_status": "active",
        "processed_images": len(processed_images_storage),
        "available_processed_images": list(processed_images_storage.keys()),
        "detection_service_info": face_detection_service.get_processing_info()
    }
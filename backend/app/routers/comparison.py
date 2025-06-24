from fastapi import APIRouter, HTTPException
from typing import Dict, Any

from app.models import ComparisonRequest, ComparisonResult
from app.services.face_comparison import FaceComparisonService
from app.routers.images import feature_points_storage

router = APIRouter()
face_comparison_service = FaceComparisonService()

@router.post("/compare", response_model=ComparisonResult)
async def compare_faces(request: ComparisonRequest) -> ComparisonResult:
    """
    顔画像の比較を実行する
    
    Args:
        request: 比較リクエスト（基準画像IDと比較画像ID2つ）
        
    Returns:
        比較結果
    """
    
    # 基準画像の特徴点を取得
    if request.reference_id not in feature_points_storage:
        raise HTTPException(
            status_code=404, 
            detail=f"Feature points not found for reference image: {request.reference_id}"
        )
    
    reference_points = feature_points_storage[request.reference_id]
    
    # 比較画像の特徴点を取得
    if len(request.compare_ids) != 2:
        raise HTTPException(
            status_code=400,
            detail="Exactly 2 comparison images are required"
        )
    
    comparison1_id, comparison2_id = request.compare_ids
    
    if comparison1_id not in feature_points_storage:
        raise HTTPException(
            status_code=404,
            detail=f"Feature points not found for comparison image 1: {comparison1_id}"
        )
    
    if comparison2_id not in feature_points_storage:
        raise HTTPException(
            status_code=404,
            detail=f"Feature points not found for comparison image 2: {comparison2_id}"
        )
    
    comparison1_points = feature_points_storage[comparison1_id]
    comparison2_points = feature_points_storage[comparison2_id]
    
    # 特徴点数の一致をチェック
    if len(reference_points) != len(comparison1_points) or len(reference_points) != len(comparison2_points):
        raise HTTPException(
            status_code=400,
            detail="All images must have the same number of feature points"
        )
    
    # 特徴点データの妥当性をチェック
    if not (face_comparison_service.validate_points(reference_points) and
            face_comparison_service.validate_points(comparison1_points) and
            face_comparison_service.validate_points(comparison2_points)):
        raise HTTPException(
            status_code=400,
            detail="Invalid feature points data"
        )
    
    try:
        # 顔比較を実行
        result = face_comparison_service.compare_faces(
            reference_points,
            comparison1_points,
            comparison2_points
        )
        
        return ComparisonResult(**result)
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comparison failed: {str(e)}")

@router.get("/comparison-status")
async def get_comparison_status():
    """比較サービスの状態を取得"""
    return {
        "service_status": "active",
        "stored_images": len(feature_points_storage),
        "available_images": list(feature_points_storage.keys()),
        "lambda_range": face_comparison_service.lambda_range
    }
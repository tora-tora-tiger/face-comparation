from fastapi import APIRouter, HTTPException
import os
from typing import Dict, Any

from app.models import (
    AutoFeatureExtractionRequest, 
    AutoFeatureExtractionResponse,
    FeatureExtractionParametersRequest,
    FeatureExtractionInfo
)
from app.services.auto_feature_extraction import AutoFeatureExtractionService
from app.routers.images import feature_points_storage

router = APIRouter()
auto_feature_service = AutoFeatureExtractionService()

@router.post("/extract-auto-features", response_model=AutoFeatureExtractionResponse)
async def extract_auto_features(request: AutoFeatureExtractionRequest) -> AutoFeatureExtractionResponse:
    """
    画像から自動で特徴点を抽出する
    
    Args:
        request: 自動特徴点抽出リクエスト
        
    Returns:
        自動特徴点抽出結果
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
        # パラメータの妥当性をチェック
        validation_result = auto_feature_service.validate_extraction_parameters(
            request.feature_types, 
            request.points_per_type
        )
        
        if not validation_result['valid']:
            raise HTTPException(
                status_code=400,
                detail=f"無効なパラメータ: {', '.join(validation_result['errors'])}"
            )
        
        # 自動特徴点抽出を実行
        result = auto_feature_service.extract_auto_features(
            image_path=image_path,
            feature_types=request.feature_types,
            points_per_type=request.points_per_type,
            confidence_threshold=request.confidence_threshold
        )
        
        # 抽出した特徴点をストレージに保存（手動特徴点と統合）
        if result["success"] and result["feature_points"]:
            # 既存の手動特徴点を取得
            existing_points = feature_points_storage.get(image_id, [])
            
            # 自動抽出した特徴点を追加
            combined_points = existing_points + result["feature_points"]
            feature_points_storage[image_id] = combined_points
        
        # レスポンスデータを構築
        response_data = {
            "success": result["success"],
            "message": result["message"],
            "image_id": image_id,
            "feature_points": result["feature_points"],
            "total_landmarks_detected": result.get("total_landmarks_detected"),
            "extraction_parameters": result.get("extraction_parameters")
        }
        
        return AutoFeatureExtractionResponse(**response_data)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"自動特徴点抽出中にエラーが発生しました: {str(e)}"
        )

@router.post("/validate-extraction-parameters")
async def validate_extraction_parameters(request: FeatureExtractionParametersRequest):
    """
    自動特徴点抽出のパラメータを検証する
    
    Args:
        request: 特徴点抽出パラメータ
        
    Returns:
        パラメータの妥当性チェック結果
    """
    
    try:
        validation_result = auto_feature_service.validate_extraction_parameters(
            request.feature_types,
            request.points_per_type
        )
        
        return {
            "valid": validation_result["valid"],
            "errors": validation_result["errors"],
            "warnings": validation_result["warnings"],
            "validated_parameters": {
                "feature_types": request.feature_types,
                "points_per_type": request.points_per_type,
                "confidence_threshold": request.confidence_threshold
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"パラメータ検証中にエラーが発生しました: {str(e)}"
        )

@router.get("/extraction-info", response_model=FeatureExtractionInfo)
async def get_extraction_info() -> FeatureExtractionInfo:
    """
    自動特徴点抽出機能の情報を取得する
    
    Returns:
        自動特徴点抽出機能の詳細情報
    """
    
    try:
        info = auto_feature_service.get_extraction_info()
        return FeatureExtractionInfo(**info)
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"抽出情報の取得中にエラーが発生しました: {str(e)}"
        )

@router.get("/available-feature-types")
async def get_available_feature_types():
    """
    利用可能な特徴点タイプの一覧を取得する
    
    Returns:
        利用可能な特徴点タイプのリスト
    """
    
    try:
        feature_types = auto_feature_service.get_available_feature_types()
        max_points = auto_feature_service.get_max_points_per_type()
        
        return {
            "available_feature_types": feature_types,
            "max_points_per_type": max_points,
            "feature_type_labels": {
                "rightEye": "右目",
                "leftEye": "左目", 
                "nose": "鼻",
                "mouth": "口",
                "face_contour": "輪郭"
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"特徴点タイプ情報の取得中にエラーが発生しました: {str(e)}"
        )

@router.delete("/auto-features/{image_id}")
async def clear_auto_features(image_id: str):
    """
    指定画像の自動抽出特徴点をクリアする
    
    Args:
        image_id: 画像ID
        
    Returns:
        クリア結果
    """
    
    try:
        if image_id in feature_points_storage:
            # 手動特徴点のみを残し、自動特徴点を削除
            manual_points = [
                point for point in feature_points_storage[image_id]
                if point.get('landmark_index') is None
            ]
            feature_points_storage[image_id] = manual_points
            
            return {
                "success": True,
                "message": f"画像 {image_id} の自動抽出特徴点をクリアしました",
                "remaining_points": len(manual_points)
            }
        else:
            return {
                "success": False,
                "message": f"画像 {image_id} の特徴点データが見つかりません"
            }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"自動特徴点のクリア中にエラーが発生しました: {str(e)}"
        )

@router.get("/extraction-status/{image_id}")
async def get_extraction_status(image_id: str):
    """
    指定画像の特徴点抽出状況を取得する
    
    Args:
        image_id: 画像ID
        
    Returns:
        特徴点抽出状況
    """
    
    try:
        points = feature_points_storage.get(image_id, [])
        
        manual_points = [p for p in points if p.get('landmark_index') is None]
        auto_points = [p for p in points if p.get('landmark_index') is not None]
        
        # 特徴点タイプ別の統計
        type_stats = {}
        for point in points:
            point_type = point.get('type', 'other')
            if point_type not in type_stats:
                type_stats[point_type] = {'manual': 0, 'auto': 0, 'total': 0}
            
            if point.get('landmark_index') is None:
                type_stats[point_type]['manual'] += 1
            else:
                type_stats[point_type]['auto'] += 1
            type_stats[point_type]['total'] += 1
        
        return {
            "image_id": image_id,
            "total_points": len(points),
            "manual_points": len(manual_points),
            "auto_points": len(auto_points),
            "type_statistics": type_stats,
            "has_auto_features": len(auto_points) > 0,
            "has_manual_features": len(manual_points) > 0
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"抽出状況の取得中にエラーが発生しました: {str(e)}"
        )
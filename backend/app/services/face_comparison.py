import numpy as np
from typing import List, Dict, Tuple
from scipy.optimize import minimize_scalar
import time

from app.models import FeaturePoint

class FaceComparisonService:
    """顔比較サービス"""
    
    def __init__(self):
        self.lambda_range = (0, 300.0)  # λの探索範囲
        
    def calculate_distance(self, reference_points: List[FeaturePoint], 
                          comparison_points: List[FeaturePoint], 
                          lambda_val: float) -> float:
        """
        距離計算: D(λ) = Σ(xi - λ×yi)²
        
        Args:
            reference_points: 基準画像の特徴点
            comparison_points: 比較画像の特徴点
            lambda_val: スケーリングパラメータλ
            
        Returns:
            計算された距離
        """
        if len(reference_points) != len(comparison_points):
            raise ValueError("Reference and comparison points must have the same length")
        
        total_distance = 0.0
        
        for ref_point, comp_point in zip(reference_points, comparison_points):
            # 辞書形式とオブジェクト形式の両方に対応
            ref_x = ref_point.x if hasattr(ref_point, 'x') else ref_point.get('x', 0)
            ref_y = ref_point.y if hasattr(ref_point, 'y') else ref_point.get('y', 0)
            comp_x = comp_point.x if hasattr(comp_point, 'x') else comp_point.get('x', 0)
            comp_y = comp_point.y if hasattr(comp_point, 'y') else comp_point.get('y', 0)
            
            # x座標の差の二乗
            dx = ref_x - (lambda_val * comp_x)
            # y座標の差の二乗
            dy = ref_y - (lambda_val * comp_y)
            
            total_distance += dx**2 + dy**2
        
        return total_distance
    
    def optimize_lambda(self, reference_points: List[FeaturePoint], 
                       comparison_points: List[FeaturePoint]) -> Tuple[float, float]:
        """
        λを最適化して最小距離を求める
        
        Args:
            reference_points: 基準画像の特徴点
            comparison_points: 比較画像の特徴点
            
        Returns:
            (最適なλ値, 最小距離)
        """
        def objective_function(lambda_val):
            return self.calculate_distance(reference_points, comparison_points, lambda_val)
        
        # 黄金分割法を使用してλを最適化
        result = minimize_scalar(
            objective_function, 
            bounds=self.lambda_range, 
            method='bounded'
        )
        
        optimal_lambda = result.x
        min_distance = result.fun
        
        return optimal_lambda, min_distance
    
    def compare_faces(self, reference_points: List[FeaturePoint],
                     comparison1_points: List[FeaturePoint],
                     comparison2_points: List[FeaturePoint]) -> Dict:
        """
        2つの画像を基準画像と比較する
        
        Args:
            reference_points: 基準画像の特徴点
            comparison1_points: 比較画像1の特徴点
            comparison2_points: 比較画像2の特徴点
            
        Returns:
            比較結果の辞書
        """
        start_time = time.time()
        
        try:
            # 画像1との比較
            optimal_lambda1, min_distance1 = self.optimize_lambda(
                reference_points, comparison1_points
            )
            
            # 画像2との比較
            optimal_lambda2, min_distance2 = self.optimize_lambda(
                reference_points, comparison2_points
            )
            
            # より近い画像を判定
            closer_image = "image1" if min_distance1 < min_distance2 else "image2"
            
            # 詳細な情報を含む結果
            details = {
                "reference_points_count": len(reference_points),
                "comparison1_points_count": len(comparison1_points),
                "comparison2_points_count": len(comparison2_points),
                "lambda_optimization_range": self.lambda_range,
                "distance_difference": abs(min_distance1 - min_distance2),
                "similarity_ratio": min(min_distance1, min_distance2) / max(min_distance1, min_distance2),
                "feature_types_used": list(set([
                    point.type if hasattr(point, 'type') else point.get('type', 'unknown') 
                    for point in reference_points
                ]))
            }
            
            execution_time = time.time() - start_time
            
            return {
                "image1_score": float(min_distance1),
                "image2_score": float(min_distance2),
                "optimal_lambda1": float(optimal_lambda1),
                "optimal_lambda2": float(optimal_lambda2),
                "closer_image": closer_image,
                "details": details,
                "execution_time": execution_time
            }
            
        except Exception as e:
            raise ValueError(f"Face comparison failed: {str(e)}")
    
    def validate_points(self, points) -> bool:
        """特徴点データの妥当性をチェック"""
        if not points:
            return False
        
        for point in points:
            # 辞書形式とオブジェクト形式の両方に対応
            x = point.x if hasattr(point, 'x') else point.get('x', 0)
            y = point.y if hasattr(point, 'y') else point.get('y', 0)
            
            # 座標が負の値でないかチェック
            if x < 0 or y < 0:
                return False
            
            # 座標が合理的な範囲内かチェック（0-10000の範囲を想定）
            if x > 10000 or y > 10000:
                return False
        
        return True
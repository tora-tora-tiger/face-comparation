import cv2
import numpy as np
import mediapipe as mp
from typing import List, Dict, Any, Optional, Tuple
import base64
from io import BytesIO
from PIL import Image


class AutoFeatureExtractionService:
    """自動特徴点抽出サービス"""
    
    def __init__(self):
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        # MediaPipeの顔ランドマークインデックス定義
        self.landmark_indices = {
            'rightEye': [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
            'leftEye': [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398],
            'nose': [1, 2, 5, 4, 6, 168, 8, 9, 10, 151],
            'mouth': [61, 84, 17, 314, 405, 320, 307, 375, 321, 308, 324, 318],
            'face_contour': [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
        }
    
    def extract_auto_features(
        self, 
        image_path: str = None,
        image_data: str = None,
        feature_types: List[str] = None,
        points_per_type: Dict[str, int] = None,
        confidence_threshold: float = 0.5
    ) -> Dict[str, Any]:
        """
        画像から自動で特徴点を抽出する
        
        Args:
            image_path: 画像ファイルのパス（元画像用）
            image_data: Base64エンコードされた画像データ（処理済み画像用）
            feature_types: 抽出する特徴点のタイプリスト
            points_per_type: 各特徴点タイプごとの点数
            confidence_threshold: 検出信頼度の閾値
            
        Returns:
            抽出結果の辞書
        """
        
        # デフォルト値の設定
        if feature_types is None:
            feature_types = ['rightEye', 'leftEye', 'nose', 'mouth']
        
        if points_per_type is None:
            points_per_type = {
                'rightEye': 4,
                'leftEye': 4, 
                'nose': 3,
                'mouth': 4,
                'face_contour': 8
            }
        
        try:
            # 画像を読み込み（パスまたはBase64データから）
            if image_data:
                # Base64データから画像を復元
                try:
                    image_bytes = base64.b64decode(image_data)
                    pil_image = Image.open(BytesIO(image_bytes))
                    # PIL→OpenCV形式に変換
                    rgb_image = np.array(pil_image)
                    # RGB→BGR変換（OpenCV用）
                    if len(rgb_image.shape) == 3 and rgb_image.shape[2] == 3:
                        image = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2BGR)
                    else:
                        image = rgb_image
                except Exception as e:
                    return {
                        'success': False,
                        'message': f'Base64画像データの読み込みに失敗しました: {str(e)}',
                        'feature_points': []
                    }
            elif image_path:
                # ファイルパスから画像を読み込み
                image = cv2.imread(image_path)
                if image is None:
                    return {
                        'success': False,
                        'message': f'画像の読み込みに失敗しました: {image_path}',
                        'feature_points': []
                    }
                # RGB変換
                rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            else:
                return {
                    'success': False,
                    'message': '画像パスまたは画像データが指定されていません',
                    'feature_points': []
                }
            
            # RGB画像が既に準備済みでない場合は変換
            if image_data and 'rgb_image' not in locals():
                rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            elif not image_data:
                rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # MediaPipeで顔ランドマークを検出
            results = self.face_mesh.process(rgb_image)
            
            if not results.multi_face_landmarks:
                return {
                    'success': False,
                    'message': '顔のランドマークが検出されませんでした',
                    'feature_points': []
                }
            
            # 最初の顔のランドマークを使用
            face_landmarks = results.multi_face_landmarks[0]
            
            # 画像サイズを取得
            height, width = rgb_image.shape[:2]
            
            # 特徴点を抽出
            extracted_points = []
            
            for feature_type in feature_types:
                if feature_type not in self.landmark_indices:
                    continue
                
                # 指定されたタイプのランドマークインデックスを取得
                indices = self.landmark_indices[feature_type]
                max_points = points_per_type.get(feature_type, len(indices))
                
                # ランドマークから座標を抽出
                type_points = []
                for i, idx in enumerate(indices[:max_points]):
                    if idx < len(face_landmarks.landmark):
                        landmark = face_landmarks.landmark[idx]
                        x = int(landmark.x * width)
                        y = int(landmark.y * height)
                        
                        # 信頼度をチェック（zスコアを信頼度として使用）
                        confidence = max(0.0, min(1.0, 1.0 - abs(landmark.z)))
                        
                        if confidence >= confidence_threshold:
                            type_points.append({
                                'x': x,
                                'y': y,
                                'type': feature_type,
                                'label': f'{self._get_feature_label(feature_type)}_{len(type_points) + 1}',
                                'confidence': confidence,
                                'landmark_index': idx
                            })
                
                extracted_points.extend(type_points)
            
            return {
                'success': True,
                'message': f'{len(extracted_points)}個の特徴点を自動抽出しました',
                'feature_points': extracted_points,
                'total_landmarks_detected': len(face_landmarks.landmark),
                'extraction_parameters': {
                    'feature_types': feature_types,
                    'points_per_type': points_per_type,
                    'confidence_threshold': confidence_threshold
                }
            }
            
        except Exception as e:
            return {
                'success': False,
                'message': f'特徴点の自動抽出中にエラーが発生しました: {str(e)}',
                'feature_points': []
            }
    
    def _get_feature_label(self, feature_type: str) -> str:
        """特徴点タイプのラベルを取得"""
        labels = {
            'rightEye': '右目',
            'leftEye': '左目',
            'nose': '鼻',
            'mouth': '口',
            'face_contour': '輪郭'
        }
        return labels.get(feature_type, 'その他')
    
    def get_available_feature_types(self) -> List[str]:
        """利用可能な特徴点タイプの一覧を取得"""
        return list(self.landmark_indices.keys())
    
    def get_max_points_per_type(self) -> Dict[str, int]:
        """各特徴点タイプの最大点数を取得"""
        return {
            feature_type: len(indices) 
            for feature_type, indices in self.landmark_indices.items()
        }
    
    def validate_extraction_parameters(
        self, 
        feature_types: List[str], 
        points_per_type: Dict[str, int]
    ) -> Dict[str, Any]:
        """抽出パラメータの妥当性をチェック"""
        
        available_types = self.get_available_feature_types()
        max_points = self.get_max_points_per_type()
        
        validation_result = {
            'valid': True,
            'errors': [],
            'warnings': []
        }
        
        # 特徴点タイプの妥当性チェック
        for feature_type in feature_types:
            if feature_type not in available_types:
                validation_result['valid'] = False
                validation_result['errors'].append(
                    f'無効な特徴点タイプ: {feature_type}'
                )
        
        # 点数の妥当性チェック
        for feature_type, count in points_per_type.items():
            if feature_type in max_points:
                if count > max_points[feature_type]:
                    validation_result['valid'] = False
                    validation_result['errors'].append(
                        f'{feature_type}の点数が最大値を超えています: {count} > {max_points[feature_type]}'
                    )
                elif count <= 0:
                    validation_result['valid'] = False
                    validation_result['errors'].append(
                        f'{feature_type}の点数は1以上である必要があります: {count}'
                    )
        
        return validation_result
    
    def get_extraction_info(self) -> Dict[str, Any]:
        """自動抽出機能の情報を取得"""
        return {
            'service_name': 'Auto Feature Extraction Service',
            'version': '1.0.0',
            'available_feature_types': self.get_available_feature_types(),
            'max_points_per_type': self.get_max_points_per_type(),
            'default_parameters': {
                'feature_types': ['rightEye', 'leftEye', 'nose', 'mouth'],
                'points_per_type': {
                    'rightEye': 4,
                    'leftEye': 4,
                    'nose': 3,
                    'mouth': 4,
                    'face_contour': 8
                },
                'confidence_threshold': 0.5
            },
            'supported_image_formats': ['jpg', 'jpeg', 'png', 'bmp'],
            'mediapipe_version': mp.__version__
        }
import cv2
import numpy as np
import mediapipe as mp
from PIL import Image
import io
import base64
import os
import uuid
from typing import Tuple, Optional, Dict, Any

class FaceDetectionService:
    """顔検出・処理サービス"""
    
    def __init__(self):
        # MediaPipe の初期化
        self.mp_face_detection = mp.solutions.face_detection
        self.mp_face_mesh = mp.solutions.face_mesh
        self.mp_drawing = mp.solutions.drawing_utils
        
        # 顔検出用
        self.face_detection = self.mp_face_detection.FaceDetection(
            model_selection=1,  # 0: 近距離用, 1: 遠距離用
            min_detection_confidence=0.5
        )
        
        # 顔ランドマーク検出用
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
    
    def detect_and_process_face(self, image_path: str, uploads_dir: str = None) -> Dict[str, Any]:
        """
        顔を検出し、トリミング・正面化処理を行う
        
        Args:
            image_path: 処理する画像のパス
            
        Returns:
            処理結果の辞書
        """
        try:
            # 画像を読み込み
            image = cv2.imread(image_path)
            if image is None:
                raise ValueError(f"画像を読み込めません: {image_path}")
            
            # RGB に変換（MediaPipe 用）
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # 顔検出
            detection_result = self.face_detection.process(image_rgb)
            
            if not detection_result.detections:
                return {
                    "success": False,
                    "message": "顔が検出されませんでした",
                    "original_image": self._image_to_base64(image),
                    "processed_image": None,
                    "face_landmarks": None
                }
            
            # 最初に検出された顔を使用
            detection = detection_result.detections[0]
            
            # 顔の境界ボックスを取得
            face_bbox = self._get_face_bbox(detection, image.shape)
            
            # 顔をトリミング（余白を追加）
            cropped_face = self._crop_face_with_margin(image, face_bbox, margin=0.3)
            
            # 顔ランドマークを検出
            landmarks_result = self.face_mesh.process(cv2.cvtColor(cropped_face, cv2.COLOR_BGR2RGB))
            
            # 正面化処理
            if landmarks_result.multi_face_landmarks:
                aligned_face = self._align_face(cropped_face, landmarks_result.multi_face_landmarks[0])
            else:
                aligned_face = cropped_face
            
            # ランドマークデータの取得
            landmarks_data = None
            if landmarks_result.multi_face_landmarks:
                landmarks_data = self._extract_landmarks_data(
                    landmarks_result.multi_face_landmarks[0], 
                    aligned_face.shape
                )
            
            # 処理済み画像をファイルに保存
            processed_image_filename = None
            processed_image_url = None
            if uploads_dir:
                # ユニークなファイル名を生成
                processed_image_id = str(uuid.uuid4())
                processed_image_filename = f"processed_{processed_image_id}.jpg"
                processed_image_path = os.path.join(uploads_dir, processed_image_filename)
                
                # 画像を保存
                cv2.imwrite(processed_image_path, aligned_face)
                
                # URLパスを生成
                processed_image_url = f"/uploads/{processed_image_filename}"
            
            return {
                "success": True,
                "message": "顔の検出・処理が完了しました",
                "original_image": self._image_to_base64(image),
                "processed_image": self._image_to_base64(aligned_face),  # 後方互換性のため残す
                "processed_image_id": processed_image_id if uploads_dir else None,
                "processed_image_filename": processed_image_filename,
                "processed_image_url": processed_image_url,
                "face_bbox": face_bbox,
                "face_landmarks": landmarks_data,
                "processing_info": {
                    "detection_confidence": detection.score[0],
                    "landmarks_detected": len(landmarks_result.multi_face_landmarks) if landmarks_result.multi_face_landmarks else 0,
                    "processed_size": aligned_face.shape[:2]
                }
            }
            
        except Exception as e:
            return {
                "success": False,
                "message": f"処理中にエラーが発生しました: {str(e)}",
                "original_image": None,
                "processed_image": None,
                "face_landmarks": None
            }
    
    def _get_face_bbox(self, detection, image_shape) -> Dict[str, int]:
        """顔の境界ボックスを取得"""
        bbox = detection.location_data.relative_bounding_box
        h, w, _ = image_shape
        
        x = int(bbox.xmin * w)
        y = int(bbox.ymin * h)
        width = int(bbox.width * w)
        height = int(bbox.height * h)
        
        return {
            "x": max(0, x),
            "y": max(0, y),
            "width": min(width, w - x),
            "height": min(height, h - y)
        }
    
    def _crop_face_with_margin(self, image: np.ndarray, bbox: Dict[str, int], margin: float = 0.3) -> np.ndarray:
        """顔を余白付きでトリミング"""
        h, w, _ = image.shape
        
        # 余白を計算
        margin_x = int(bbox["width"] * margin)
        margin_y = int(bbox["height"] * margin)
        
        # 拡張された境界ボックス
        x1 = max(0, bbox["x"] - margin_x)
        y1 = max(0, bbox["y"] - margin_y)
        x2 = min(w, bbox["x"] + bbox["width"] + margin_x)
        y2 = min(h, bbox["y"] + bbox["height"] + margin_y)
        
        return image[y1:y2, x1:x2]
    
    def _align_face(self, face_image: np.ndarray, landmarks) -> np.ndarray:
        """顔を正面に向ける（基本的な回転補正）"""
        try:
            h, w, _ = face_image.shape
            
            # 重要なランドマークのインデックス（MediaPipe Face Mesh）
            # 左目の外側角、右目の外側角
            left_eye_corner = 33   # 左目外側
            right_eye_corner = 263 # 右目外側
            
            # ランドマーク座標を取得
            left_eye = np.array([
                landmarks.landmark[left_eye_corner].x * w,
                landmarks.landmark[left_eye_corner].y * h
            ])
            
            right_eye = np.array([
                landmarks.landmark[right_eye_corner].x * w,
                landmarks.landmark[right_eye_corner].y * h
            ])
            
            # 目の間の角度を計算
            eye_vector = right_eye - left_eye
            angle = np.degrees(np.arctan2(eye_vector[1], eye_vector[0]))
            
            # 回転行列を作成（中心は画像の中心）
            center = (w // 2, h // 2)
            rotation_matrix = cv2.getRotationMatrix2D(center, -angle, 1.0)
            
            # 回転適用
            aligned_face = cv2.warpAffine(face_image, rotation_matrix, (w, h))
            
            return aligned_face
            
        except Exception as e:
            print(f"顔の正面化でエラー: {e}")
            return face_image  # エラー時は元の画像を返す
    
    def _extract_landmarks_data(self, landmarks, image_shape) -> Dict[str, Any]:
        """ランドマークデータを抽出"""
        h, w = image_shape[:2]
        
        # 重要なランドマークのインデックス
        key_landmarks = {
            "nose_tip": 1,        # 鼻先
            "left_eye_center": 468, # 左目中心（虹彩）
            "right_eye_center": 473, # 右目中心（虹彩）
            "mouth_center": 13,   # 口の中心
            "chin": 175,          # あご
            "left_cheek": 116,    # 左頬
            "right_cheek": 345    # 右頬
        }
        
        extracted_landmarks = {}
        
        for name, index in key_landmarks.items():
            if index < len(landmarks.landmark):
                landmark = landmarks.landmark[index]
                extracted_landmarks[name] = {
                    "x": landmark.x * w,
                    "y": landmark.y * h,
                    "z": landmark.z if hasattr(landmark, 'z') else 0
                }
        
        return {
            "key_points": extracted_landmarks,
            "total_landmarks": len(landmarks.landmark),
            "image_size": {"width": w, "height": h}
        }
    
    def _image_to_base64(self, image: np.ndarray) -> str:
        """OpenCV画像をBase64文字列に変換"""
        # OpenCV (BGR) を PIL (RGB) に変換
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        pil_image = Image.fromarray(image_rgb)
        
        # Base64エンコード
        buffered = io.BytesIO()
        pil_image.save(buffered, format="JPEG", quality=90)
        img_str = base64.b64encode(buffered.getvalue()).decode()
        
        return f"data:image/jpeg;base64,{img_str}"
    
    def get_processing_info(self) -> Dict[str, Any]:
        """処理情報を取得"""
        return {
            "mediapipe_version": mp.__version__,
            "opencv_version": cv2.__version__,
            "face_detection_model": "MediaPipe Face Detection (Long Range)",
            "face_mesh_model": "MediaPipe Face Mesh",
            "supported_formats": ["JPEG", "PNG", "BMP"],
            "max_faces": 1,
            "landmark_points": 468
        }
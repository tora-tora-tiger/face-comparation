from pydantic import BaseModel
from typing import List, Literal, Optional, Dict, Any
from datetime import datetime

class FeaturePoint(BaseModel):
    x: float
    y: float
    type: Literal['rightEye', 'leftEye', 'nose', 'mouth', 'face_contour', 'other']
    label: str
    confidence: Optional[float] = None
    landmark_index: Optional[int] = None

class ImageUploadResponse(BaseModel):
    image_id: str
    url: str
    filename: str
    upload_time: datetime

class ImageFeatures(BaseModel):
    image_id: str
    points: List[FeaturePoint]

class FeaturePointsResponse(BaseModel):
    success: bool
    message: str
    image_id: str
    points_count: int

class ComparisonRequest(BaseModel):
    reference_id: str
    compare_ids: List[str]

class ComparisonResult(BaseModel):
    image1_score: float
    image2_score: float
    optimal_lambda1: float
    optimal_lambda2: float
    closer_image: Literal['image1', 'image2']
    details: Dict[str, Any]
    execution_time: float

class ErrorResponse(BaseModel):
    error: str
    message: str
    status_code: int

# 自動特徴点抽出関連のモデル
class AutoFeatureExtractionRequest(BaseModel):
    image_id: str
    feature_types: Optional[List[str]] = ['rightEye', 'leftEye', 'nose', 'mouth']
    points_per_type: Optional[Dict[str, int]] = {
        'rightEye': 4,
        'leftEye': 4,
        'nose': 3,
        'mouth': 4,
        'face_contour': 8
    }
    confidence_threshold: Optional[float] = 0.5

class AutoFeatureExtractionResponse(BaseModel):
    success: bool
    message: str
    image_id: str
    feature_points: List[FeaturePoint]
    total_landmarks_detected: Optional[int] = None
    extraction_parameters: Optional[Dict[str, Any]] = None

class FeatureExtractionParametersRequest(BaseModel):
    feature_types: List[str]
    points_per_type: Dict[str, int]
    confidence_threshold: Optional[float] = 0.5

class FeatureExtractionInfo(BaseModel):
    service_name: str
    version: str
    available_feature_types: List[str]
    max_points_per_type: Dict[str, int]
    default_parameters: Dict[str, Any]
    supported_image_formats: List[str]
    mediapipe_version: str

# 顔検出関連のモデル
class FaceBoundingBox(BaseModel):
    x: int
    y: int
    width: int
    height: int

class LandmarkPoint(BaseModel):
    x: float
    y: float
    z: Optional[float] = 0.0

class FaceLandmarks(BaseModel):
    key_points: Dict[str, LandmarkPoint]
    total_landmarks: int
    image_size: Dict[str, int]

class ProcessingInfo(BaseModel):
    detection_confidence: float
    landmarks_detected: int
    processed_size: List[int]

class FaceDetectionRequest(BaseModel):
    image_id: str

class FaceDetectionResponse(BaseModel):
    success: bool
    message: str
    image_id: str
    original_image: Optional[str] = None
    processed_image: Optional[str] = None
    face_bbox: Optional[FaceBoundingBox] = None
    face_landmarks: Optional[FaceLandmarks] = None
    processing_info: Optional[ProcessingInfo] = None
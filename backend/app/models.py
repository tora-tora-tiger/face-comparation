from pydantic import BaseModel
from typing import List, Literal, Optional, Dict, Any
from datetime import datetime

class FeaturePoint(BaseModel):
    x: float
    y: float
    type: Literal['rightEye', 'leftEye', 'nose', 'mouth', 'other']
    label: str

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
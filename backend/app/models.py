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
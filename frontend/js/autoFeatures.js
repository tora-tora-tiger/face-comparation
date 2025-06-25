// 自動特徴点抽出機能

// グローバル変数の追加
let currentMarkingMode = 'manual'; // 'manual' or 'auto'
let autoFeatureParams = {
  feature_types: ['rightEye', 'leftEye', 'nose', 'mouth'],
  points_per_type: {
    rightEye: 4,
    leftEye: 4,
    nose: 3,
    mouth: 4,
    face_contour: 8
  },
  confidence_threshold: 0.5
};

// 自動特徴点抽出を実行
async function extractAutoFeatures() {
  const allImagesUploaded = imageData.reference.id && imageData.compare1.id && imageData.compare2.id;
  
  if (!allImagesUploaded) {
    alert('すべての画像をアップロードしてから自動抽出を実行してください。');
    return;
  }
  
  // 処理済み画像があるかチェック
  const processedImageTypes = ['reference', 'compare1', 'compare2'].filter(
    imageType => imageData[imageType].processedImage
  );
  
  if (processedImageTypes.length === 0) {
    alert('自動特徴点抽出を実行するには、まず顔検出・正面化処理を実行してください。');
    return;
  }
  
  if (processedImageTypes.length < 3) {
    const missingTypes = ['reference', 'compare1', 'compare2'].filter(
      imageType => !imageData[imageType].processedImage
    );
    const missingLabels = missingTypes.map(type => {
      if (type === 'reference') return '基準画像';
      if (type === 'compare1') return '比較画像1';
      if (type === 'compare2') return '比較画像2';
    });
    
    if (!confirm(`以下の画像で顔検出・正面化が完了していません：${missingLabels.join(', ')}\n\n処理済みの画像のみで自動抽出を実行しますか？`)) {
      return;
    }
  }
  
  // パラメータを取得
  const params = getAutoFeatureParams();
  
  // パラメータ検証
  const validation = await validateExtractionParameters(params);
  if (!validation.valid) {
    alert('パラメータエラー: ' + validation.errors.join(', '));
    return;
  }
  
  // ローディング表示
  const extractButton = document.getElementById('extract-auto-features');
  extractButton.disabled = true;
  extractButton.textContent = '抽出中...';
  
  let successCount = 0;
  
  try {
    // 処理済み画像がある画像のみ処理
    for (const imageType of processedImageTypes) {
      const imageId = imageData[imageType].id;
      
      console.log(`Auto feature extraction for ${imageType}: ${imageId}`);
      
      const response = await fetch('/api/extract-auto-features', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image_id: imageId,
          feature_types: params.feature_types,
          points_per_type: params.points_per_type,
          confidence_threshold: params.confidence_threshold
        })
      });
      
      if (!response.ok) {
        throw new Error(`自動抽出に失敗 (${imageType}): ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        // 抽出された特徴点をローカルデータに追加
        const newPoints = result.feature_points.map(point => ({
          x: point.x,
          y: point.y,
          type: point.type,
          label: point.label,
          confidence: point.confidence,
          landmark_index: point.landmark_index
        }));
        
        // 既存の手動特徴点と統合
        const existingManualPoints = imageData[imageType].points.filter(
          p => p.landmark_index === undefined
        );
        imageData[imageType].points = [...existingManualPoints, ...newPoints];
        
        console.log(`自動抽出成功 (${imageType}): ${newPoints.length}点追加`);
        console.log(`Total points for ${imageType}: ${imageData[imageType].points.length}`);
        
        successCount++;
      } else {
        console.warn(`自動抽出失敗 (${imageType}): ${result.message}`);
      }
    }
    
    if (successCount > 0) {
      // 処理済み画像を再描画
      processedImageTypes.forEach(imageType => {
        if (imageData[imageType].processedImage && imageData[imageType].points.length > 0) {
          console.log(`Redrawing canvas for ${imageType} with ${imageData[imageType].points.length} points`);
          setTimeout(() => redrawAllCanvas(imageType, true), 100); // 少し遅延を入れて確実に実行
        }
      });
      
      alert(`${successCount}個の画像で自動特徴点抽出が完了しました。`);
      updateUI();
      updateFeaturePointStatistics();
    } else {
      alert('自動特徴点抽出に失敗しました。');
    }
    
  } catch (error) {
    console.error('自動特徴点抽出中にエラー:', error);
    alert('自動特徴点抽出中にエラーが発生しました: ' + error.message);
  } finally {
    // ローディング終了
    extractButton.disabled = false;
    extractButton.textContent = '自動特徴点抽出';
  }
}

// 自動特徴点をクリア
async function clearAutoFeatures() {
  const allImagesUploaded = imageData.reference.id && imageData.compare1.id && imageData.compare2.id;
  
  if (!allImagesUploaded) {
    alert('すべての画像をアップロードしてからクリアしてください。');
    return;
  }
  
  if (!confirm('すべての画像の自動特徴点をクリアしますか？手動特徴点は残ります。')) {
    return;
  }
  
  const imageTypes = ['reference', 'compare1', 'compare2'];
  let successCount = 0;
  
  try {
    for (const imageType of imageTypes) {
      const imageId = imageData[imageType].id;
      
      const response = await fetch(`/api/auto-features/${imageId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        // ローカルデータからも自動特徴点を削除
        imageData[imageType].points = imageData[imageType].points.filter(
          p => p.landmark_index === undefined
        );
        
        successCount++;
      }
    }
    
    if (successCount > 0) {
      // すべての処理済み画像を再描画
      const imageTypes = ['reference', 'compare1', 'compare2'];
      imageTypes.forEach(imageType => {
        if (imageData[imageType].processedImage) {
          setTimeout(() => redrawAllCanvas(imageType, true), 100);
        }
      });
      
      alert(`${successCount}個の画像の自動特徴点をクリアしました。`);
      updateUI();
      updateFeaturePointStatistics();
    } else {
      alert('自動特徴点のクリアに失敗しました。');
    }
    
  } catch (error) {
    console.error('自動特徴点クリア中にエラー:', error);
    alert('自動特徴点クリア中にエラーが発生しました: ' + error.message);
  }
}

// UIからパラメータを取得
function getAutoFeatureParams() {
  // 選択された特徴点タイプ
  const checkboxes = document.querySelectorAll('.feature-checkboxes input[type="checkbox"]:checked');
  const feature_types = Array.from(checkboxes).map(cb => cb.value);
  
  // 各タイプの点数
  const points_per_type = {};
  ['rightEye', 'leftEye', 'nose', 'mouth', 'face_contour'].forEach(type => {
    const input = document.getElementById(`points-${type}`);
    if (input) {
      points_per_type[type] = parseInt(input.value);
    }
  });
  
  // 信頼度しきい値
  const confidenceThreshold = parseFloat(document.getElementById('confidence-threshold').value);
  
  return {
    feature_types,
    points_per_type,
    confidence_threshold: confidenceThreshold
  };
}

// パラメータの妥当性を検証
async function validateExtractionParameters(params) {
  try {
    const response = await fetch('/api/validate-extraction-parameters', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });
    
    if (!response.ok) {
      return { valid: false, errors: ['サーバーとの通信に失敗しました'] };
    }
    
    return await response.json();
    
  } catch (error) {
    console.error('パラメータ検証エラー:', error);
    return { valid: false, errors: ['パラメータ検証中にエラーが発生しました'] };
  }
}

// モード切り替え処理
function switchMarkingMode(mode) {
  currentMarkingMode = mode;
  
  const manualSettings = document.getElementById('manual-mode-settings');
  const autoSettings = document.getElementById('auto-mode-settings');
  
  if (mode === 'manual') {
    manualSettings.style.display = 'block';
    autoSettings.style.display = 'none';
  } else {
    manualSettings.style.display = 'none';
    autoSettings.style.display = 'block';
  }
}

// 信頼度スライダーの値を更新
function updateConfidenceValue() {
  const slider = document.getElementById('confidence-threshold');
  const valueDisplay = document.getElementById('confidence-value');
  valueDisplay.textContent = slider.value;
}

// 利用可能な特徴点タイプ情報を取得
async function loadAvailableFeatureTypes() {
  try {
    const response = await fetch('/api/available-feature-types');
    if (response.ok) {
      const data = await response.json();
      console.log('利用可能な特徴点タイプ:', data);
      
      // 最大点数の制限を動的に更新
      Object.keys(data.max_points_per_type).forEach(type => {
        const input = document.getElementById(`points-${type}`);
        if (input) {
          input.max = data.max_points_per_type[type];
        }
      });
    }
  } catch (error) {
    console.error('特徴点タイプ情報の取得に失敗:', error);
  }
}

// 抽出状況を取得
async function getExtractionStatus(imageId) {
  try {
    const response = await fetch(`/api/extraction-status/${imageId}`);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('抽出状況の取得に失敗:', error);
  }
  return null;
}

// モード制限メッセージを表示
function showModeRestrictionMessage() {
  const message = '自動モードでは手動での特徴点操作はできません。手動モードに切り替えてください。';
  
  // 既存のメッセージを削除
  const existingMessage = document.getElementById('mode-restriction-message');
  if (existingMessage) {
    existingMessage.remove();
  }
  
  // メッセージ要素を作成
  const messageDiv = document.createElement('div');
  messageDiv.id = 'mode-restriction-message';
  messageDiv.className = 'mode-restriction-message';
  messageDiv.textContent = message;
  
  // マーキングセクションに追加
  const markingSection = document.querySelector('.marking-section');
  markingSection.insertBefore(messageDiv, markingSection.firstChild.nextSibling);
  
  // 3秒後に自動削除
  setTimeout(() => {
    if (document.getElementById('mode-restriction-message')) {
      messageDiv.remove();
    }
  }, 3000);
}

// 特徴点統計を更新表示
function updateFeaturePointStatistics() {
  const statisticsDiv = document.getElementById('feature-point-statistics');
  const contentDiv = document.getElementById('statistics-content');
  
  if (!statisticsDiv || !contentDiv) return;
  
  // 統計データを収集
  const imageTypes = ['reference', 'compare1', 'compare2'];
  const imageLabels = {
    'reference': '基準画像',
    'compare1': '比較画像1',
    'compare2': '比較画像2'
  };
  
  let hasData = false;
  let statisticsHtml = '';
  
  imageTypes.forEach(imageType => {
    const points = imageData[imageType].points || [];
    if (points.length === 0) return;
    
    hasData = true;
    
    // 手動・自動の分類
    const manualPoints = points.filter(p => p.landmark_index === undefined);
    const autoPoints = points.filter(p => p.landmark_index !== undefined);
    
    // 特徴点タイプ別の統計
    const typeStats = {};
    points.forEach(point => {
      const type = point.type || 'unknown';
      if (!typeStats[type]) {
        typeStats[type] = { manual: 0, auto: 0, total: 0 };
      }
      
      if (point.landmark_index === undefined) {
        typeStats[type].manual++;
      } else {
        typeStats[type].auto++;
      }
      typeStats[type].total++;
    });
    
    // HTML生成
    statisticsHtml += `
            <div class="image-statistics">
                <h5>${imageLabels[imageType]}</h5>
                <div class="stat-item">
                    <span class="stat-label">総特徴点数:</span>
                    <span class="stat-value">${points.length}点</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">手動特徴点:</span>
                    <span class="stat-value">${manualPoints.length}点</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">自動特徴点:</span>
                    <span class="stat-value">${autoPoints.length}点</span>
                </div>
                
                <div class="feature-type-breakdown">
                    <strong>部位別内訳:</strong>
                    ${Object.keys(typeStats).map(type => {
    const stat = typeStats[type];
    const typeLabel = getFeatureTypeLabel(type);
    let countClass = '';
    if (stat.manual > 0 && stat.auto > 0) {
      countClass = 'mixed';
    } else if (stat.auto > 0) {
      countClass = 'auto';
    } else {
      countClass = 'manual';
    }
    
    return `
                            <div class="feature-type-item">
                                <span class="feature-type-label">${typeLabel}:</span>
                                <span class="feature-type-count ${countClass}">
                                    ${stat.total}点 (手動:${stat.manual}, 自動:${stat.auto})
                                </span>
                            </div>
                        `;
  }).join('')}
                </div>
            </div>
        `;
});

if (hasData) {
  contentDiv.innerHTML = statisticsHtml;
  statisticsDiv.style.display = 'block';
} else {
  statisticsDiv.style.display = 'none';
}
}
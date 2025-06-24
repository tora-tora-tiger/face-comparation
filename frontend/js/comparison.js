// 顔比較機能

// 比較処理を実行
async function executeComparison() {
    // ローディング表示
    document.getElementById('loading').style.display = 'block';
    executeButton.disabled = true;

    try {
        const response = await fetch('/api/compare', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                reference_id: imageData.reference.id,
                compare_ids: [imageData.compare1.id, imageData.compare2.id]
            })
        });

        if (!response.ok) {
            throw new Error(`Comparison failed: ${response.statusText}`);
        }

        const result = await response.json();
        displayResults(result);

    } catch (error) {
        console.error('Comparison failed:', error);
        alert('比較処理に失敗しました。');
    } finally {
        // ローディング非表示
        document.getElementById('loading').style.display = 'none';
        executeButton.disabled = false;
    }
}

// 比較結果を表示
function displayResults(result) {
    const resultsSection = document.getElementById('comparison-results');
    const winnerDiv = document.getElementById('result-winner');
    
    // 結果表示
    resultsSection.style.display = 'block';
    
    // 勝者表示
    const winnerText = result.closer_image === 'image1' ? 
        '比較画像1の方が基準画像に近いです' : 
        '比較画像2の方が基準画像に近いです';
    
    winnerDiv.textContent = winnerText;
    winnerDiv.className = `winner ${result.closer_image}`;
    
    // スコア表示
    document.getElementById('score1').textContent = result.image1_score.toFixed(4);
    document.getElementById('score2').textContent = result.image2_score.toFixed(4);
    document.getElementById('lambda1').textContent = result.optimal_lambda1.toFixed(4);
    document.getElementById('lambda2').textContent = result.optimal_lambda2.toFixed(4);
    
    // 詳細情報表示
    const metadataContent = document.getElementById('result-metadata-content');
    metadataContent.innerHTML = `
        <p>実行時間: ${result.execution_time.toFixed(3)}秒</p>
        <p>基準画像特徴点数: ${result.details.reference_points_count}</p>
        <p>距離の差: ${result.details.distance_difference.toFixed(4)}</p>
        <p>類似度比率: ${result.details.similarity_ratio.toFixed(4)}</p>
        <p>使用された特徴点タイプ: ${result.details.feature_types_used.join(', ')}</p>
    `;
}
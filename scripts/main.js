const RETRY_DELAY = 1000; // 重试间隔毫秒数
let activeRetries = 0; // 全局重试计数器

// 延迟函数
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 数组分块函数
function chunk(array, size) {
    const chunked_arr = [];
    for (let i = 0; i < array.length; i++) {
        const lastChunk = chunked_arr[chunked_arr.length - 1];
        if (!lastChunk || lastChunk.length === size) {
            chunked_arr.push([array[i]]);
        } else {
            lastChunk.push(array[i]);
        }
    }
    return chunked_arr;
}

async function checkToken(token, apiBaseUrl, testModel, retries) {
    const fullUrl = `${apiBaseUrl.replace(/\/$/, '')}/chat/completions`;
    try {
        const response = await fetch(fullUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                "model": testModel,
                "messages": [{ "role": "user", "content": "hi" }],
                "stream": false
            })
        });

        const responseData = await response.json().catch(() => null);

        if (response.ok) {
            return { token, category: 'VALID' };
        }

        const errorData = responseData && Array.isArray(responseData) ? responseData[0] : responseData;
        const error = errorData ? errorData.error : null;
        const errorMessage = error ? error.message : `HTTP ${response.status} - ${response.statusText}`;

        if (response.status === 429 && error && error.status === 'RESOURCE_EXHAUSTED') {
            // 新增：细化429错误，判断 quota_limit_value
            const isProjectQuota = error.details?.some(d => d.metadata?.quota_limit_value === "0");
            if (isProjectQuota) {
                return { token, category: 'PROJECT_QUOTA_EXCEEDED', message: '项目配额限制值为0 (quota_limit_value: "0")' };
            }
            
            // 对于普通的速率限制，进行重试
            if (retries > 0) {
                activeRetries++;
                updateRetryStatus(); // 只更新重试状态
                await sleep(RETRY_DELAY);
                activeRetries--;
                updateRetryStatus(); // 恢复重试状态
                return checkToken(token, apiBaseUrl, testModel, retries - 1);
            }
            return { token, category: 'QUOTA_EXCEEDED', message: `速率限制，重试后依然失败` };
        }
        
        if (response.status === 403 && error && error.status === 'PERMISSION_DENIED') {
            return { token, category: 'KEY_SUSPENDED', message: errorMessage };
        }

        if (response.status === 400 && error && error.status === 'INVALID_ARGUMENT') {
            return { token, category: 'INVALID_KEY', message: errorMessage };
        }

        return { token, category: 'UNKNOWN_ERROR', message: errorMessage };

    } catch (error) {
        return { token, category: 'UNKNOWN_ERROR', message: `请求失败: ${error.message}` };
    }
}

async function checkTokens() {
    const tokensTextarea = document.getElementById('tokens');
    const checkButton = document.getElementById('checkButton');
    const apiBaseUrl = document.getElementById('apiBaseUrl').value.trim();
    const testModel = document.getElementById('testModel').value.trim();
    const concurrentRequests = parseInt(document.getElementById('concurrentRequests').value, 10) || 5;
    const retryCount = parseInt(document.getElementById('retryCount').value, 10) || 3;

    localStorage.setItem('apiBaseUrl', apiBaseUrl);
    localStorage.setItem('testModel', testModel);

    if (!apiBaseUrl || !testModel) {
        alert('请填写有效的 API 地址和测试模型');
        return;
    }

    const inputText = tokensTextarea.value.trim();
    const rawTokens = inputText.replace(/[\n,]+/g, ' ').split(' ');
    let allTokens = rawTokens.map(t => t.trim()).filter(t => t !== '');

    let tokenCount = new Map();
    let duplicateTokens = new Set();
    
    allTokens.forEach(token => {
        tokenCount.set(token, (tokenCount.get(token) || 0) + 1);
        if (tokenCount.get(token) > 1) {
            duplicateTokens.add(token);
        }
    });

    const uniqueTokens = [...new Set(allTokens)];

    if (uniqueTokens.length === 0) {
        alert('请输入至少一个 API Key');
        return;
    }
    

    checkButton.disabled = true;
    checkButton.innerHTML = '<span class="loader"></span>检测中... (0%)';
    resetUI(); // 重置UI
    document.getElementById('results-layout').style.display = 'flex';
    displayDuplicates(duplicateTokens);

    // 初始化状态对象
    let stats = {
        total: uniqueTokens.length,
        pending: uniqueTokens.length,
        valid: 0,
        quota: 0,
        projectQuota: 0,
        suspended: 0,
        invalid: 0,
        unknown: 0,
        retries: 0
    };
    updateStatusPanel(stats); // 首次更新状态面板

    const tokenChunks = chunk(uniqueTokens, concurrentRequests);
    let completedCount = 0;

    for (const tokenChunk of tokenChunks) {
        const results = await Promise.all(
            tokenChunk.map(token => checkToken(token, apiBaseUrl, testModel, retryCount))
        );
        
        appendResults(results); // 增量更新UI

        // 更新统计数据
        completedCount += results.length;
        stats.pending = stats.total - completedCount;
        results.forEach(result => {
            switch(result.category) {
                case 'VALID': stats.valid++; break;
                case 'QUOTA_EXCEEDED': stats.quota++; break;
                case 'PROJECT_QUOTA_EXCEEDED': stats.projectQuota++; break;
                case 'KEY_SUSPENDED': stats.suspended++; break;
                case 'INVALID_KEY': stats.invalid++; break;
                case 'UNKNOWN_ERROR': stats.unknown++; break;
            }
        });
        
        stats.retries = activeRetries; // 更新重试计数
        updateStatusPanel(stats); // 更新状态面板

        const progress = Math.round((completedCount / uniqueTokens.length) * 100);
        checkButton.innerHTML = `<span class="loader"></span>检测中... (${progress}%)`;
    }
    
    checkButton.disabled = false;
    checkButton.textContent = '开始检测';
    stats.pending = 0; // 最终确保待检测为0
    stats.retries = 0; // 重置重试计数
    updateStatusPanel(stats);
}

function updateRetryStatus() {
    document.getElementById('status-retries').textContent = activeRetries;
}

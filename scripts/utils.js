function copyCategoryTokens(category, format) {
    const categoryId = {
        'VALID': 'valid',
        'QUOTA_EXCEEDED': 'quota',
        'PROJECT_QUOTA_EXCEEDED': 'project-quota',
        'KEY_SUSPENDED': 'suspended',
        'INVALID_KEY': 'invalid',
        'UNKNOWN_ERROR': 'unknown'
    }[category];

    if (!categoryId) return;

    const container = document.getElementById(`results-${categoryId}`);
    if (!container) {
        console.error(`Container not found for category: ${category}`);
        return;
    }

    let tokens = [];
    
    if (category === 'VALID') {
        tokens = container.textContent.trim().split('\n').filter(t => t.trim() !== '');
    } else {
        const tokenElements = container.querySelectorAll('.invalid-token-token');
        tokenElements.forEach(el => tokens.push(el.textContent.trim()));
    }

    if (tokens.length === 0) {
        alert('没有可复制的内容。');
        return;
    }

    const textToCopy = format === 'comma' ? tokens.join(',') : tokens.join('\n');
    const formatText = format === 'comma' ? '逗号' : '换行';

    navigator.clipboard.writeText(textToCopy).then(() => {
        // 添加成功反馈动画
        const button = event.target;
        const originalText = button.textContent;
        button.textContent = '✅ 已复制';
        button.style.background = 'linear-gradient(135deg, #2ecc71, #27ae60)';
        
        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '';
        }, 2000);
    }, (err) => {
        console.error('复制失败:', err);
        alert('复制失败。请检查浏览器权限或手动复制。');
    });
}
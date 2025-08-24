// 全局状态，用于跟踪哪个tab是激活的
let activeTab = null;

const CATEGORY_MAP = {
    VALID: { id: 'valid', title: '✅ 有效 Keys' },
    QUOTA_EXCEEDED: { id: 'quota', title: '😅 额度用尽' },
    PROJECT_QUOTA_EXCEEDED: { id: 'project-quota', title: '📉 项目配额用尽' },
    KEY_SUSPENDED: { id: 'suspended', title: '🚫 已被禁用' },
    INVALID_KEY: { id: 'invalid', title: '❌ 无效/格式错误' },
    UNKNOWN_ERROR: { id: 'unknown', title: '❓ 其他错误' },
    DUPLICATE: { id: 'duplicate', title: '🔄 重复账号' }
};

function updateStatusPanel(stats) {
    const panel = document.getElementById('status-panel');
    if (!panel) return;
    panel.style.display = 'flex';

    document.getElementById('status-total').textContent = stats.total;
    document.getElementById('status-pending').textContent = stats.pending;
    document.getElementById('status-valid-count').textContent = stats.valid;
    document.getElementById('status-quota-count').textContent = stats.quota;
    document.getElementById('status-project-quota-count').textContent = stats.projectQuota;
    document.getElementById('status-suspended-count').textContent = stats.suspended;
    document.getElementById('status-invalid-count').textContent = stats.invalid;
    document.getElementById('status-unknown-count').textContent = stats.unknown;
    document.getElementById('status-retries').textContent = stats.retries;
}

function resetUI() {
    document.getElementById('results-layout').style.display = 'none';
    const sidebar = document.getElementById('sidebar');
    const contentArea = document.getElementById('content-area');
    sidebar.innerHTML = '';
    contentArea.innerHTML = '';

    for (const key in CATEGORY_MAP) {
        const category = CATEGORY_MAP[key];
        // 创建侧边栏导航项
        const sidebarItem = document.createElement('div');
        sidebarItem.className = `sidebar-item category-${category.id}`;
        sidebarItem.id = `sidebar-${category.id}`;
        sidebarItem.style.display = 'none';
        sidebarItem.innerHTML = `<span>${category.title}</span><span id="count-${category.id}" class="count-badge">0</span>`;
        sidebarItem.onclick = () => switchTab(category.id);
        sidebar.appendChild(sidebarItem);
        // 创建内容区
        const contentItem = document.createElement('div');
        contentItem.className = 'content-item';
        contentItem.id = `content-${category.id}`;
        const resultsContent = document.createElement('div');
        resultsContent.className = 'results-content';
        resultsContent.id = `results-${category.id}`;
        contentItem.appendChild(resultsContent);
        if (key !== 'DUPLICATE') {
            const buttonGroup = document.createElement('div');
            buttonGroup.className = 'button-group';
            buttonGroup.innerHTML = `<button class="copy-button" onclick="copyCategoryTokens('${key}', 'newline')">📋 换行</button><button class="copy-button" onclick="copyCategoryTokens('${key}', 'comma')">📋 逗号</button>`;
            contentItem.appendChild(buttonGroup);
        }
        contentArea.appendChild(contentItem);
    }
    
    const panel = document.getElementById('status-panel');
    if (panel) panel.style.display = 'none';
    activeTab = null;
}

function switchTab(categoryId) {
    if (activeTab === categoryId) return;
    if (activeTab) {
        document.getElementById(`sidebar-${activeTab}`).classList.remove('active');
        document.getElementById(`content-${activeTab}`).classList.remove('active');
    }
    document.getElementById(`sidebar-${categoryId}`).classList.add('active');
    document.getElementById(`content-${categoryId}`).classList.add('active');
    activeTab = categoryId;
}

function appendResults(results) {
    results.forEach(result => {
        const category = CATEGORY_MAP[result.category];
        if (!category) return;

        const sidebarItem = document.getElementById(`sidebar-${category.id}`);
        const countBadge = document.getElementById(`count-${category.id}`);
        const resultsContent = document.getElementById(`results-${category.id}`);

        if (sidebarItem.style.display === 'none') {
            sidebarItem.style.display = 'flex';
            if (!activeTab) switchTab(category.id);
        }

        countBadge.textContent = parseInt(countBadge.textContent, 10) + 1;
        
        if (result.category === 'VALID') {
            resultsContent.textContent += (resultsContent.textContent ? '\n' : '') + result.token;
        } else {
            const div = document.createElement('div');
            div.className = 'invalid-token';
            div.innerHTML = `<div class="invalid-token-content"><div class="invalid-token-token">${result.token}</div><div class="invalid-token-message">原因: ${result.message}</div></div>`;
            resultsContent.appendChild(div);
        }
    });
}

function displayDuplicates(duplicateTokens) {
    if (duplicateTokens.size === 0) return;
    const category = CATEGORY_MAP['DUPLICATE'];
    const sidebarItem = document.getElementById(`sidebar-${category.id}`);
    const countBadge = document.getElementById(`count-${category.id}`);
    const resultsContent = document.getElementById(`results-${category.id}`);
    sidebarItem.style.display = 'flex';
    if (!activeTab) switchTab(category.id);
    countBadge.textContent = duplicateTokens.size;
    resultsContent.textContent = `发现 ${duplicateTokens.size} 个重复Key:\n${[...duplicateTokens].join('\n')}\n(检测时已自动去重)`;
}

document.addEventListener('DOMContentLoaded', function() {
    const providerSelector = document.getElementById('apiProviderSelector');
    const apiBaseUrlInput = document.getElementById('apiBaseUrl');
    const testModelInput = document.getElementById('testModel');
    const checkButton = document.getElementById('checkButton');
    const savedApiBaseUrl = localStorage.getItem('apiBaseUrl') || 'https://generativelanguage.googleapis.com/v1beta/openai/';
    const savedTestModel = localStorage.getItem('testModel') || 'gemini-1.5-flash';
    apiBaseUrlInput.value = savedApiBaseUrl;
    testModelInput.value = savedTestModel;
    const matchingOption = Array.from(providerSelector.options).find(opt => opt.value === savedApiBaseUrl);
    if (matchingOption) {
        providerSelector.value = matchingOption.value;
        apiBaseUrlInput.readOnly = true;
    } else {
        providerSelector.value = 'custom';
        apiBaseUrlInput.readOnly = false;
    }
    providerSelector.addEventListener('change', function() {
        const selectedValue = this.value;
        if (selectedValue === 'custom') {
            apiBaseUrlInput.value = '';
            apiBaseUrlInput.readOnly = false;
            apiBaseUrlInput.focus();
        } else {
            apiBaseUrlInput.value = selectedValue;
            apiBaseUrlInput.readOnly = true;
            if (selectedValue === 'https://generativelanguage.googleapis.com/v1beta/openai/') {
                testModelInput.value = 'gemini-1.5-flash';
            } else if (selectedValue === 'https://api.openai.com/v1') {
                testModelInput.value = 'gpt-3.5-turbo';
            }
        }
    });
    checkButton.addEventListener('click', checkTokens);
});
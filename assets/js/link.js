// 常见 favicon 路径
const DASHBOARD_COMMON_ICON_PATHS = [
    '/favicon.ico',
    '/favicon.png',
    '/favicon.svg',
    '/assets/favicon.png',
    '/static/favicon.ico',
    '/img/favicon.svg'
];

// 生成首字母 fallback 图标（Canvas）
function createDashboardFallbackIcon(name) {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const colors = ['#4A90E2', '#50C878', '#D9534F', '#F0AD4E', '#9B59B6'];
    const bg = colors[Math.floor(Math.random() * colors.length)];
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 32, 32);
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // 处理名称可能为空的情况
    const firstChar = name.charAt(0).toUpperCase() || '?';
    ctx.fillText(firstChar, 16, 16);
    return canvas.toDataURL('image/png');
}

// --- 修改后的 探测图标是否存在 函数 ---
// 目标：更可靠地探测图标，并在失败时返回 fallback 图标
// 策略：先尝试 CORS 请求，失败后再尝试 no-cors 探测
async function loadDashboardIcon(baseUrl, name) {
    // 确保 baseUrl 是一个有效的 URL 对象，用于解析相对路径
    let baseUrlObj;
    try {
        baseUrlObj = new URL(baseUrl);
    } catch (e) {
        console.error(`Invalid base URL provided: ${baseUrl}`, e);
        return createDashboardFallbackIcon(name);
    }

    // 创建一个 AbortController 用于设置超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 500); // 0.5秒超时

    for (const path of DASHBOARD_COMMON_ICON_PATHS) {
        try {
            // 使用 URL 构造函数确保路径正确拼接
            const iconUrl = new URL(path, baseUrlObj).href;
            // console.log(`[Debug] Trying to fetch icon (CORS): ${iconUrl}`);

            // --- 第一步：尝试标准 CORS 请求 ---
            let response;
            try {
                response = await fetch(iconUrl, {
                    method: 'GET',
                    mode: 'cors', // 明确指定 CORS 模式
                    signal: controller.signal
                });
                 // console.log(`[Debug] CORS request completed for: ${iconUrl}`);
            } catch (corsError) {
                // console.log(`[Debug] CORS request failed for: ${iconUrl}`, corsError.message);
                // 如果 CORS 失败，进入第二步
                // 重置超时控制器（因为上一次 fetch 可能已经 abort 了）
                clearTimeout(timeoutId);
                const controller2 = new AbortController();
                const timeoutId2 = setTimeout(() => controller2.abort(), 500);

                try {
                    // --- 第二步：尝试 no-cors 模式探测 ---
                    // console.log(`[Debug] Trying no-cors fetch for: ${iconUrl}`);
                    const noCorsResponse = await fetch(iconUrl, {
                        method: 'HEAD', // HEAD 请求更轻量
                        mode: 'no-cors',
                        signal: controller2.signal
                    });
                    clearTimeout(timeoutId2); // 清除本次 no-cors 尝试的超时

                     // console.log(`[Debug] no-cors response type for ${iconUrl}:`, noCorsResponse.type);
                    // 在 no-cors 模式下，如果请求发出（即使被阻止读取内容），type 通常是 'opaque'
                    // 我们假设 'opaque' 意味着图标存在
                    if (noCorsResponse.type === 'opaque') {
                        // console.log(`[Debug] Assuming icon exists (no-cors opaque) for: ${iconUrl}`);
                        return iconUrl; // 返回 URL，让浏览器尝试加载
                    } else {
                        // console.log(`[Debug] no-cors request for ${iconUrl} did not return opaque.`);
                        // 可能是网络错误等，继续下一个路径
                        continue;
                    }
                } catch (noCorsError) {
                    clearTimeout(timeoutId2);
                    // console.log(`[Debug] no-cors fetch also failed for: ${iconUrl}`, noCorsError.message);
                    // 两种方式都失败，继续下一个路径
                    continue;
                }
            }

            // 如果执行到这里，说明 CORS 请求成功完成
            clearTimeout(timeoutId); // 清除主超时

            // 检查 CORS 响应状态码
            if (response.ok) {
                // console.log(`[Debug] Icon found via CORS: ${iconUrl}`);
                return iconUrl;
            } else {
                // console.log(`[Debug] Icon not found via CORS (Status ${response.status}): ${iconUrl}`);
                // 状态码不是 2xx，继续尝试下一个路径
                continue;
            }

        } catch (generalError) {
            clearTimeout(timeoutId);
            // console.log(`[Debug] General error for path ${path}:`, generalError.message);
            // 其他未预期的错误，继续下一个路径
            continue;
        }
    }

    // 如果所有预定义路径都尝试失败，则使用 fallback 图标
    // console.log(`[Debug] All icon paths failed for ${name}, using fallback.`);
    return createDashboardFallbackIcon(name);
}
// --- 修改结束 ---


// 加载 links.txt 并渲染链接 (保持不变)
async function loadDashboardLinks() {
    const container = document.getElementById('dashboard-links-container');
    container.innerHTML = '<p>正在加载常用网站目录...</p>'; // 显示加载状态

    try {
        // --- 重要：请确保存在 links.txt 文件 ---
        const res = await fetch('links.txt');
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        const text = await res.text();
        container.innerHTML = ''; // 清空加载状态

        const lines = text.trim().split('\n');
        for (const line of lines) {
            if (!line || line.startsWith('#')) continue;
            const parts = line.trim().split(/\s+/);
            if (parts.length < 2) continue; // 至少需要名称和URL

            const name = parts[0];
            // 将剩余部分重新组合为URL，以支持包含空格的URL（虽然不常见）
            const url = parts.slice(1).join(' ');

            const a = document.createElement('a');
            a.href = url;
            a.target = '_blank';
            a.className = 'dashboard-link-item';

            const img = document.createElement('img');
            img.className = 'dashboard-link-icon';
            img.alt = `${name} icon`;
            // 异步加载图标
            img.src = await loadDashboardIcon(url, name);

            const span = document.createElement('span');
            span.textContent = name;
            span.className = 'dashboard-link-text';

            a.appendChild(img);
            a.appendChild(span);
            container.appendChild(a);
        }

        if (container.children.length === 0) {
            container.innerHTML = '<p>links.txt 中未找到有效服务。</p>';
        }
    } catch (err) {
        console.error('加载 links.txt 失败:', err);
        container.innerHTML = `<p style="color:red;">加载内网服务列表失败: ${err.message}</p>`;
    }
}

// 页面加载完成后执行导航链接加载 (保持不变)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadDashboardLinks);
} else {
    loadDashboardLinks();
}




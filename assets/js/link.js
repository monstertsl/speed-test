// --- 核心逻辑 ---

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

/**
 * 内部辅助函数：使用 <img> 标签检测图标 URL 是否有效
 * 绕过 fetch 的 CORS 限制
 * @param {string} iconUrl - 要检测的图标 URL
 * @returns {Promise<boolean>} - Promise resolve 为 true(有效) 或 false(无效/404等)
 */
function isValidIconUrl(iconUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        // 设置一个合理的超时时间
        const timeoutId = setTimeout(() => {
            img.onload = null;
            img.onerror = null;
            // console.log(`[ImgCheck] Timeout for: ${iconUrl}`);
            resolve(false); // 超时则认为无效
        }, 500); // 0.5秒超时

        // 图片加载成功回调
        img.onload = () => {
            clearTimeout(timeoutId);
            // 简单检查尺寸，确保不是占位图或损坏的图
            if (img.width > 0 && img.height > 0) {
                // console.log(`[ImgCheck] Loaded successfully: ${iconUrl}`);
                resolve(true);
            } else {
                // console.log(`[ImgCheck] Loaded but zero dimensions: ${iconUrl}`);
                resolve(false);
            }
        };

        // 图片加载失败回调 (包括 404, CORS blocked, 网络错误等)
        img.onerror = () => {
            clearTimeout(timeoutId);
            // console.log(`[ImgCheck] Failed to load (onerror): ${iconUrl}`);
            resolve(false);
        };

        // 开始加载
        img.src = iconUrl;
    });
}


/**
 * 探测并加载网站图标 (使用 <img> 检测)
 * @param {string} baseUrl - 网站的基础 URL
 * @param {string} name - 网站名称，用于生成 fallback 图标
 * @returns {Promise<string>} - Promise resolve 为图标 URL 或 fallback Data URL
 */
async function loadDashboardIcon(baseUrl, name) {
    // 确保 baseUrl 是一个有效的 URL 对象，用于解析相对路径
    let baseUrlObj;
    try {
        baseUrlObj = new URL(baseUrl);
    } catch (e) {
        console.error(`Invalid base URL provided: ${baseUrl}`, e);
        return createDashboardFallbackIcon(name);
    }

    // console.log(`[IconLoader] Starting icon search for: ${name} (${baseUrl})`);

    // 为整个探测过程设置一个总体超时 (例如 8 秒)
    const overallTimeoutPromise = new Promise(resolve => {
        setTimeout(() => {
            console.log(`[IconLoader] Overall timeout for ${name}`);
            resolve(createDashboardFallbackIcon(name));
        }, 5000); 
    });

    // 创建一个 Promise 来执行实际的探测逻辑
    const probePromise = (async () => {
         for (const path of DASHBOARD_COMMON_ICON_PATHS) {
            try {
                const iconUrl = new URL(path, baseUrlObj).href;
                // console.log(`[IconLoader] Trying (via <img>): ${iconUrl}`);

                // 使用 <img> 标签方式检测
                const isValid = await isValidIconUrl(iconUrl);

                if (isValid) {
                    // console.log(`[IconLoader] Valid icon found using <img>: ${iconUrl}`);
                    // 如果有效，直接返回该 URL
                    return iconUrl;
                } else {
                    // console.log(`[IconLoader] Icon not valid or not found using <img>: ${iconUrl}`);
                    // 无效则继续尝试下一个路径
                    continue;
                }

            } catch (error) {
                console.warn(`[IconLoader] Unexpected error checking ${path} for ${name}:`, error);
                continue; // 捕获意外错误，继续循环
            }
        }

        // 所有路径都尝试完毕且未找到有效图标
        // console.log(`[IconLoader] All paths exhausted for ${name}, using fallback.`);
        return createDashboardFallbackIcon(name);
    })();

    // 使用 Promise.race 确保不会超过总体超时
    return Promise.race([probePromise, overallTimeoutPromise]);
}

// --- 加载 links.txt 并渲染链接 (保持不变)---

// 加载 links.txt 并渲染链接
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
            img.loading = 'lazy'; // 启用懒加载
            // 异步加载图标
            try {
                 // 使用新的、使用 <img> 检测的函数
                const iconSrc = await loadDashboardIcon(url, name);
                img.src = iconSrc;
                // console.log(`[Renderer] Icon set for ${name}:`, iconSrc);
            } catch (iconError) {
                console.error(`[Renderer] Error setting icon for ${name} (${url}):`, iconError);
                // 即使异步加载出错，也使用 fallback
                img.src = createDashboardFallbackIcon(name);
            }


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

// 页面加载完成后执行导航链接加载
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadDashboardLinks);
} else {
    loadDashboardLinks();
}
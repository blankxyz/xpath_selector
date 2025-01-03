import { NextResponse } from 'next/server';
import iconv from 'iconv-lite';

// 首先定义 selectorScript
const selectorScript = `
<script>
    (function() {
        let isSelecting = false;
        let selectedElements = new Set();
        let selectionCount = 0;

       // 获取元素的XPath
        const getXPath = (element) => {
            if (!element) return '';
            if (element.nodeType !== 1) return '';
            
            if (element.id) {
                return '//*[@id="' + element.id + '"]';
            }
            
            const getElementIndex = (element) => {
                let index = 1;
                let sibling = element.previousElementSibling;
                
                while (sibling) {
                    if (sibling.tagName === element.tagName) {
                        index++;
                    }
                    sibling = sibling.previousElementSibling;
                }
                
                return index;
            };
            
            const path = [];
            while (element && element.nodeType === 1) {
                let selector = element.tagName.toLowerCase();
                const index = getElementIndex(element);
                
                if (element.parentElement && element.parentElement.getElementsByTagName(selector).length > 1) {
                    selector += '[' + index + ']';
                }
                
                path.unshift(selector);
                element = element.parentElement;
            }
            
            return '/' + path.join('/');
        };


        // 高亮元素并添加选择标记
        const highlightElement = (element) => {
            if (element && element instanceof HTMLElement && 
                !element.classList.contains('xpath-selection-marker')) {
                selectionCount++;
                element.classList.add('xpath-highlight');
                element.setAttribute('data-selection-id', selectionCount.toString());
                
                // 添加选择标记
                const marker = document.createElement('div');
                marker.className = 'xpath-selection-marker';
                marker.textContent = selectionCount.toString();
                element.appendChild(marker);
                
                selectedElements.add(element);
            }
        };

        // 清除所有高亮和标记
        const clearHighlights = () => {
            selectedElements.forEach(element => {
                element.classList.remove('xpath-highlight');
                element.removeAttribute('data-selection-id');
                const marker = element.querySelector('.xpath-selection-marker');
                if (marker) {
                    marker.remove();
                }
            });
            selectedElements.clear();
            selectionCount = 0;
        };

        // 处理点击事件
        const handleClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const target = e.target;
            if (target instanceof HTMLElement && 
                !target.classList.contains('xpath-selection-marker')) {
                
                clearHighlights();  // 清除之前的选择
                highlightElement(target);  // 高亮当前选择

                // 发送选中元素的信息
                const xpath = getXPath(target);
                window.parent.postMessage({ 
                    type: 'XPATH_SELECTED', 
                    xpath,
                    innerHTML: target.innerHTML.substring(0, 100),
                    outerHTML: target.outerHTML
                }, '*');
            }
            
            return false;
        };

        // 添加样式
        const style = document.createElement('style');
        style.textContent = \`
            * {
                cursor: crosshair !important;
            }
            .xpath-highlight {
                outline: 2px solid #2196F3 !important;
                outline-offset: 1px !important;
                background-color: rgba(33, 150, 243, 0.1) !important;
                position: relative !important;
            }
            .xpath-highlight::after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: rgba(33, 150, 243, 0.1) !important;
                pointer-events: none;
                z-index: 10000;
            }
            .xpath-selection-marker {
                position: absolute !important;
                top: -10px !important;
                left: -10px !important;
                background-color: #FF4081 !important;
                color: white !important;
                border-radius: 50% !important;
                width: 20px !important;
                height: 20px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                font-size: 12px !important;
                font-weight: bold !important;
                pointer-events: none !important;
                z-index: 10001 !important;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2) !important;
            }
            a, button, input, select {
                pointer-events: none !important;
            }
            body {
                pointer-events: auto !important;
            }
        \`;
        document.head.appendChild(style);

        // 初始化选择器
        const initSelector = () => {
            isSelecting = true;
            
            // 禁用所有链接
            document.querySelectorAll('a').forEach(a => {
                a.style.pointerEvents = 'none';
            });
            
            // 添加点击事件监听器
            document.addEventListener('click', handleClick, true);
            document.addEventListener('mousedown', (e) => e.preventDefault(), true);
            document.addEventListener('mouseup', (e) => e.preventDefault(), true);
            document.addEventListener('contextmenu', (e) => e.preventDefault(), true);
        };

        // 监听来自父窗口的消息
        window.addEventListener('message', (event) => {
            if (event.data.type === 'INJECT_SELECTOR') {
                isSelecting = true;
                initSelector();
            } else if (event.data.type === 'STOP_SELECTOR') {
                cleanupSelector();
            }
        });

        // 清理选择器
        const cleanupSelector = () => {
            // 移除所有事件监听器
            document.removeEventListener('click', handleClick, true);
            document.removeEventListener('mousedown', handleMouseDown, true);
            document.removeEventListener('mousemove', handleMouseMove, true);
            document.removeEventListener('mouseup', handleMouseUp, true);
            
            // 移除所有高亮效果和选择标记
            clearHighlights();
            
            // 移除所有选择标记
            const markers = document.querySelectorAll('.xpath-selection-marker');
            markers.forEach(el => el.remove());
            
            // 恢复原始样式
            document.body.style.cursor = '';
            document.querySelectorAll('*').forEach(el => {
                if (el instanceof HTMLElement) {
                    el.style.pointerEvents = 'auto';
                }
            });

            // 移除样式标签
            const injectedStyle = document.querySelector('style');
            if (injectedStyle && injectedStyle.textContent.includes('cursor: crosshair')) {
                injectedStyle.remove();
            }
            
             isSelecting = false;
        };

        // 防止页面跳转
        window.onbeforeunload = (e) => {
            if (isSelecting) {
                e.preventDefault();
                return false;
            }
        };
    })();
</script>
`;

// 处理所有 HTTP 方法
export async function GET(request: Request) {
    return handleProxy(request);
}

export async function POST(request: Request) {
    return handleProxy(request);
}

export async function OPTIONS(request: Request) {
    // 处理预检请求
    return new NextResponse(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400',
        },
    });
}

async function handleProxy(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const targetUrl = searchParams.get('url');

        if (!targetUrl) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        const baseUrl = new URL(targetUrl).origin;
        
        // 复制原始请求的 headers
        const headers = new Headers({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'zh-CN,zh;q=0.9',
            'Origin': baseUrl,
            'Referer': targetUrl,
        });

        const response = await fetch(targetUrl, {
            method: request.method,
            headers: headers,
            body: request.method === 'GET' ? null : await request.text(),
            credentials: 'omit',
        });

        const contentType = response.headers.get('content-type') || '';

        // 如果是 HTML 内容，注入我们的脚本
        if (contentType.includes('text/html')) {
            // 获取原始响应的 buffer
            const buffer = await response.arrayBuffer();
            
            // 提取原始编码
            let charset = 'utf-8';
            // 从 Content-Type 提取
            const contentTypeCharset = contentType.match(/charset=([^;]+)/i)?.[1]?.toLowerCase();
            if (contentTypeCharset) {
                charset = contentTypeCharset;
            }
            // 从 meta 标签提取（需要先用 utf-8 解码看看有没有 meta 标签）
            const tempHtml = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
            const metaCharset = tempHtml.match(/<meta[^>]*charset=["']?([^"'>]+)/i)?.[1]?.toLowerCase();
            if (metaCharset) {
                charset = metaCharset;
            }

            // 根据检测到的编码解码内容
            let html = '';
            if (charset === 'gb2312' || charset === 'gbk' || charset === 'gb18030') {
                html = iconv.decode(Buffer.from(buffer), 'gbk');
            } else if (charset === 'big5') {
                html = iconv.decode(Buffer.from(buffer), 'big5');
            } else {
                html = new TextDecoder(charset, { fatal: false }).decode(buffer);
            }

            // 注入脚本和样式，但保持原始编码
            let modifiedHtml = html;
            if (modifiedHtml.includes('<head>')) {
                modifiedHtml = modifiedHtml.replace('<head>', 
                    `<head>
                    <meta charset="${charset}">
                    <meta http-equiv="Content-Type" content="text/html; charset=${charset}">
                    <base href="${baseUrl}/">`);
            } else {
                modifiedHtml = `<head>
                    <meta charset="${charset}">
                    <meta http-equiv="Content-Type" content="text/html; charset=${charset}">
                    <base href="${baseUrl}/">
                </head>
                ${modifiedHtml}`;
            }

            // 注入其他脚本和样式
            modifiedHtml = modifiedHtml.replace('</head>',
                `${selectorScript}
                <style>
                    .xpath-highlight {
                        outline: 2px solid #4CAF50 !important;
                        outline-offset: 1px !important;
                        background-color: rgba(76, 175, 80, 0.1) !important;
                    }
                    .xpath-highlight * {
                        background-color: rgba(76, 175, 80, 0.1) !important;
                    }
                </style>
                </head>`
            );

            // 如果是非 UTF-8 编码，需要将修改后的内容转换回原始编码
            let finalContent: Buffer | string = modifiedHtml;
            if (charset !== 'utf-8') {
                finalContent = iconv.encode(modifiedHtml, charset);
            }

            return new NextResponse(finalContent, {
                headers: {
                    'Content-Type': `text/html; charset=${charset}`,
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'Content-Security-Policy': "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;",
                    'X-Frame-Options': 'SAMEORIGIN'
                }
            });
        }

        // 对于非 HTML 内容，直接转发
        const responseData = await response.arrayBuffer();
        const responseHeaders = new Headers({
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Expose-Headers': '*'
        });

        // 复制原始响应的其他重要头
        ['content-disposition', 'content-length'].forEach(header => {
            const value = response.headers.get(header);
            if (value) responseHeaders.set(header, value);
        });

        return new NextResponse(responseData, {
            headers: responseHeaders
        });

    } catch (error) {
        console.error('Proxy error:', error);
        return NextResponse.json({ error: '无法加载页面' }, { status: 500 });
    }
}
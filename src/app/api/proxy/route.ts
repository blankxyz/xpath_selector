import { NextResponse } from 'next/server';
import iconv from 'iconv-lite';

// 首先定义 selectorScript
const selectorScript = `
<script>
    (function() {
        let isMouseDown = false;
        let selectedElements = new Set();
        let lastHighlighted = null;

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

        // 获取两个元素的共同父元素
        const findCommonAncestor = (el1, el2) => {
            if (!el1 || !el2) return null;
            
            const path1 = [];
            let parent = el1;
            while (parent) {
                path1.push(parent);
                parent = parent.parentElement;
            }
            
            parent = el2;
            while (parent) {
                if (path1.includes(parent)) {
                    return parent;
                }
                parent = parent.parentElement;
            }
            
            return null;
        };

        // 获取多个元素的共同父元素
        const findCommonAncestorForAll = (elements) => {
            if (!elements || elements.size === 0) return null;
            if (elements.size === 1) return elements.values().next().value;
            
            const elementsArray = Array.from(elements);
            let commonAncestor = elementsArray[0];
            
            for (let i = 1; i < elementsArray.length; i++) {
                commonAncestor = findCommonAncestor(commonAncestor, elementsArray[i]);
                if (!commonAncestor) break;
            }
            
            return commonAncestor;
        };

        // 高亮元素
        const highlightElement = (element) => {
            if (element && element instanceof HTMLElement) {
                element.classList.add('xpath-highlight');
                selectedElements.add(element);
            }
        };

        // 处理鼠标移动
        const handleMouseMove = (e) => {
            if (!isMouseDown) return;
            
            const target = e.target;
            if (target instanceof HTMLElement && !selectedElements.has(target)) {
                highlightElement(target);
            }
        };

        // 处理鼠标按下
        const handleMouseDown = (e) => {
            e.preventDefault();
            isMouseDown = true;
            selectedElements.clear();
            const target = e.target;
            if (target instanceof HTMLElement) {
                highlightElement(target);
            }
        };

        // 处理鼠标松开
        const handleMouseUp = (e) => {
            e.preventDefault();
            isMouseDown = false;
            
            if (selectedElements.size > 0) {
                const commonAncestor = findCommonAncestorForAll(selectedElements);
                if (commonAncestor instanceof HTMLElement) {
                    const xpath = getXPath(commonAncestor);
                    window.parent.postMessage({ 
                        type: 'XPATH_SELECTED', 
                        xpath,
                        innerHTML: commonAncestor.innerHTML.substring(0, 100),
                        outerHTML: commonAncestor.outerHTML
                    }, '*');
                }
            }
            
            // 清除所有高亮
            selectedElements.forEach(element => {
                element.classList.remove('xpath-highlight');
            });
            selectedElements.clear();
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
            document.addEventListener('mousedown', handleMouseDown, true);
            document.addEventListener('mousemove', handleMouseMove, true);
            document.addEventListener('mouseup', handleMouseUp, true);
            document.addEventListener('contextmenu', (e) => e.preventDefault(), true);
            
            // 禁用默认行为
            document.addEventListener('dragstart', (e) => e.preventDefault(), true);
            document.addEventListener('selectstart', (e) => e.preventDefault(), true);
        };

        // 监听来自父窗口的消息
        window.addEventListener('message', (event) => {
            if (event.data.type === 'INJECT_SELECTOR') {
                initSelector();
            }
        });
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
                }
            });
        }

        // 对于非 HTML 内容，直接转发
        const responseData = await response.arrayBuffer();
        return new NextResponse(responseData, {
            headers: {
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            }
        });

    } catch (error) {
        console.error('Proxy error:', error);
        return NextResponse.json({ error: '无法加载页面' }, { status: 500 });
    }
}
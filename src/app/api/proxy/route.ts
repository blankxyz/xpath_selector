import { NextResponse } from 'next/server';
import iconv from 'iconv-lite';

// 首先定义 selectorScript
const selectorScript = `
<script>
    (function() {
        const removeHighlight = () => {
            document.querySelectorAll('.xpath-highlight').forEach(el => {
                el.classList.remove('xpath-highlight');
            });
        };

        const getXPath = (element) => {
            if (!element) return '';
            
            // 处理 document 和 document.body 等特殊情况
            if (element.nodeType !== 1) return '';
            
            // 如果元素有 id，直接返回
            if (element.id) {
                return '//*[@id="' + element.id + '"]';
            }
            
            // 获取元素在同类型兄弟节点中的位置
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

            // 递归获取路径
            const path = [];
            while (element && element.nodeType === 1) {
                let selector = element.tagName.toLowerCase();
                const index = getElementIndex(element);
                
                // 只有当同类型元素多于1个时才添加索引
                if (element.parentElement && element.parentElement.getElementsByTagName(selector).length > 1) {
                    selector += '[' + index + ']';
                }
                
                path.unshift(selector);
                element = element.parentElement;
            }
            
            return '/' + path.join('/');
        };

        document.addEventListener('mousemove', (e) => {
            e.stopPropagation();
            removeHighlight();
            const target = e.target;
            if (target instanceof HTMLElement) {
                target.classList.add('xpath-highlight');
            }
        }, true);

        document.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const target = e.target;
            if (target instanceof HTMLElement) {
                const xpath = getXPath(target);
                window.parent.postMessage({
                    type: 'XPATH_SELECTED',
                    xpath: xpath,
                    innerHTML: target.innerHTML,
                    outerHTML: target.outerHTML,
                    tagName: target.tagName.toLowerCase(),
                    className: target.className,
                    id: target.id
                }, '*');
            }
        }, true);

        document.addEventListener('mousedown', (e) => e.preventDefault(), true);
        document.addEventListener('mouseup', (e) => e.preventDefault(), true);
        document.addEventListener('keydown', (e) => e.preventDefault(), true);
        document.addEventListener('keyup', (e) => e.preventDefault(), true);
        
        document.querySelectorAll('a').forEach(a => {
            a.style.cursor = 'pointer';
            a.addEventListener('click', (e) => e.preventDefault(), true);
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
'use client';

import { useState, useEffect, useRef } from 'react';

export default function XPathSelector() {
    const [url, setUrl] = useState('');
    const [proxyUrl, setProxyUrl] = useState('');
    const [selectedXPaths, setSelectedXPaths] = useState<Array<{
        xpath: string;
        sample: string;
    }>>([]);
    const [isSelecting, setIsSelecting] = useState(false);
    const [error, setError] = useState('');
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const [controlPanelWidth, setControlPanelWidth] = useState(320);
    const isDraggingRef = useRef(false);
    const startXRef = useRef(0);
    const startWidthRef = useRef(0);

    // 添加拖动调整宽度的处理函数
    const handleMouseDown = (e: React.MouseEvent) => {
        isDraggingRef.current = true;
        startXRef.current = e.clientX;
        startWidthRef.current = controlPanelWidth;
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDraggingRef.current) return;
        
        const diff = e.clientX - startXRef.current;
        const newWidth = Math.max(280, Math.min(800, startWidthRef.current + diff));
        setControlPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
        isDraggingRef.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };

    // 在组件卸载时清理事件监听
    useEffect(() => {

    }, []);

    const loadUrl = async () => {
        if (!url) {
            setError('请输入URL');
            return;
        }

        try {
            setError('');
            setIsSelecting(false);
            setSelectedXPaths([]);

            // 使用代理URL
            const encodedUrl = encodeURIComponent(url);
            setProxyUrl(`/api/proxy?url=${encodedUrl}`);
        } catch (err) {
            setError('加载页面时出错');
        }
    };

    const startSelection = () => {
        setIsSelecting(true);
        if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage({ 
                type: 'INJECT_SELECTOR' 
            }, '*');
        }
    };

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data.type === 'XPATH_SELECTED') {
                const { xpath, innerHTML } = event.data;
                setSelectedXPaths(prev => [...prev, {
                    xpath,
                    sample: innerHTML.slice(0, 100) + (innerHTML.length > 100 ? '...' : '')
                }]);
            }
        };

        window.addEventListener('message', handleMessage);
        return () =>{
            window.removeEventListener('message', handleMessage);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        } 
    }, []);

    return (
        <div className="selector-container">
            <div className="control-panel">
                <h2>XPath 选择器</h2>
                <div className="input-group">
                    <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="输入网址 (例如: https://example.com)"
                        className="url-input"
                    />
                    <button onClick={loadUrl} className="load-button">
                        加载页面
                    </button>
                    {proxyUrl && (
                        <button 
                            onClick={startSelection}
                            className={`select-button ${isSelecting ? 'active' : ''}`}
                            disabled={!proxyUrl}
                        >
                            {isSelecting ? '正在选择' : '开始选择'}
                        </button>
                    )}
                </div>

                {error && <div className="error-message">{error}</div>}

                <div className="selected-paths">
                    <h3>已选择的 XPath:</h3>
                    {selectedXPaths.map((item, index) => (
                        <div key={index} className="xpath-item">
                            <div className="xpath-content">
                                <code className="xpath-code">{item.xpath}</code>
                                <div className="xpath-sample">{item.sample}</div>
                            </div>
                            <button 
                                onClick={() => {
                                    setSelectedXPaths(prev => 
                                        prev.filter((_, i) => i !== index)
                                    );
                                }}
                                className="remove-button"
                            >
                                删除
                            </button>
                        </div>
                    ))}
                </div>

                {selectedXPaths.length > 0 && (
                    <button 
                        onClick={() => {
                            const data = selectedXPaths.map(item => ({
                                xpath: item.xpath,
                                sample: item.sample
                            }));
                            const blob = new Blob(
                                [JSON.stringify(data, null, 2)], 
                                { type: 'application/json' }
                            );
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'xpath-selections.json';
                            a.click();
                            URL.revokeObjectURL(url);
                        }}
                        className="export-button"
                    >
                        导出选择结果
                    </button>
                )}
            </div>
            
            <div className="preview-panel">
                {proxyUrl ? (
                    <iframe
                        ref={iframeRef}
                        src={proxyUrl}
                        className="target-frame"
                        title="目标网页"
                    />
                ) : (
                    <div className="empty-state">
                        请输入URL并点击加载页面
                    </div>
                )}
            </div>
        </div>
    );
}
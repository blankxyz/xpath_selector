'use client';

import { useState, useEffect, useRef } from 'react';

export default function XPathSelector() {
    const [url, setUrl] = useState('');
    const [proxyUrl, setProxyUrl] = useState('');
    const [selectedXPaths, setSelectedXPaths] = useState<Array<{
        xpath: string;
        sample: string;
        note: string;
    }>>([]);
    const [isSelecting, setIsSelecting] = useState(false);
    const [error, setError] = useState('');
    const [controlPanelWidth, setControlPanelWidth] = useState(400);
    const [loading, setLoading] = useState(false);

    const iframeRef = useRef<HTMLIFrameElement>(null);
    const isDraggingRef = useRef(false);
    const startXRef = useRef(0);
    const startWidthRef = useRef(0);

    // 处理URL加载
    const loadUrl = async () => {
        if (!url) {
            setError('请输入URL');
            return;
        }

        try {
            setLoading(true);
            setError('');
            setIsSelecting(false);
            setSelectedXPaths([]);

            // 使用代理URL
            const encodedUrl = encodeURIComponent(url);
            setProxyUrl(`/api/proxy?url=${encodedUrl}`);
        } catch (err) {
            setError('加载页面时出错');
        } finally {
            setLoading(false);
        }
    };

    // 开始选择模式
    const startSelection = () => {
        setIsSelecting(true);
        if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage({ 
                type: 'INJECT_SELECTOR' 
            }, '*');
        }
    };

    // 处理面板宽度调整
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

    // 导出选择结果
    const exportResults = () => {
        const data = selectedXPaths.map(item => ({
            xpath: item.xpath,
            sample: item.sample,
            note: item.note || '无备注'
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
    };

    // 监听 XPath 选择消息
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data.type === 'XPATH_SELECTED') {
                const { xpath, innerHTML } = event.data;
                setSelectedXPaths(prev => [...prev, {
                    xpath,
                    sample: innerHTML.slice(0, 100) + (innerHTML.length > 100 ? '...' : ''),
                    note: ''
                }]);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // 清理拖动事件监听
    useEffect(() => {
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    // 更新备注
    const updateNote = (index: number, note: string) => {
        setSelectedXPaths(prev => {
            const newPaths = [...prev];
            newPaths[index] = { ...newPaths[index], note };
            return newPaths;
        });
    };

    return (
        <div className="selector-container">
            <div 
                className="control-panel"
                style={{ width: controlPanelWidth }}
            >
                <h2 className="panel-title">XPath 选择器</h2>
                
                <div className="input-group">
                    <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="输入网址 (例如: https://example.com)"
                        className="url-input"
                        disabled={loading}
                    />
                    <button 
                        onClick={loadUrl} 
                        className="load-button"
                        disabled={loading}
                    >
                        {loading ? '加载中...' : '加载页面'}
                    </button>
                    
                    {proxyUrl && (
                        <button 
                            onClick={startSelection}
                            className={`select-button ${isSelecting ? 'active' : ''}`}
                            disabled={!proxyUrl || loading}
                        >
                            {isSelecting ? '正在选择' : '开始选择'}
                        </button>
                    )}
                </div>

                {error && <div className="error-message">{error}</div>}

                <div className="selected-paths">
                    <div className="section-header">
                        <h3>已选择的 XPath</h3>
                        {selectedXPaths.length > 0 && (
                            <span className="count-badge">
                                {selectedXPaths.length}
                            </span>
                        )}
                    </div>

                    {selectedXPaths.map((item, index) => (
                            <div key={index} className="xpath-item">
                            <div className="xpath-content">
                                <code className="xpath-code">{item.xpath}</code>
                                <div className="xpath-sample">{item.sample}</div>
                                <input
                                    type="text"
                                    className="xpath-note"
                                    placeholder="添加备注..."
                                    value={item.note}
                                    onChange={(e) => updateNote(index, e.target.value)}
                                />
                            </div>
                            <button 
                                onClick={() => {
                                    setSelectedXPaths(prev => 
                                        prev.filter((_, i) => i !== index)
                                    );
                                }}
                                className="delete-xpath"
                                title="删除xxx"
                            >
                                ×
                            </button>
                        </div>
                    ))}

                    {selectedXPaths.length === 0 && (
                        <div className="empty-message">
                            尚未选择任何元素
                        </div>
                    )}
                </div>

                {selectedXPaths.length > 0 && (
                    <button 
                        onClick={exportResults}
                        className="export-button"
                    >
                        导出选择结果
                    </button>
                )}
            </div>
            
            <div 
                className="resize-handle"
                onMouseDown={handleMouseDown}
            />
            
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
                        <div className="empty-state-content">
                            <svg className="empty-state-icon" viewBox="0 0 24 24">
                                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/>
                                <path d="M12 17h2v-6h-2v6zm0-8h2V7h-2v2z"/>
                            </svg>
                            <p>请输入URL并点击加载页面</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
} 
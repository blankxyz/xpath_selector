'use client';

import { useState, useEffect, useRef } from 'react';


interface ListPageForm {
    web_name: string;
    account_code: string;
    project_name: string;
    column_name: string;
    xpath: string;
    xpath_type: '1';
    url: string;
}

interface DetailPageForm {
    web_name: string;
    account_code: string;
    project_name: string;
    xpath_type: '2';
    url: string;
    details_title_xpath: string;
    details_content_xpath: string;
    details_publishtime_xpath: string;
}

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
    // 添加当前激活的输入框状态
    const [activeInput, setActiveInput] = useState<string>('');
    // Add loading state for submission
    const [submitting, setSubmitting] = useState(false);

    // 添加表单类型状态
    const [formType, setFormType] = useState<'list' | 'detail'>('list');
    
    // 添加表单数据状态
    const [listForm, setListForm] = useState<ListPageForm>({
        web_name: '',
        account_code: '',
        project_name: '',
        column_name: '',
        xpath: '',
        xpath_type: '1',
        url: ''
    });

    const [detailForm, setDetailForm] = useState<DetailPageForm>({
        web_name: '',
        account_code: '',
        project_name: '',
        xpath_type: '2',
        url: '',
        details_title_xpath: '',
        details_content_xpath: '',
        details_publishtime_xpath: ''
    });


        // Add submit handler function
    const handleSubmit = async () => {
        try {
            setSubmitting(true);
            setError('');

            const formData = formType === 'list' ? {
                ...listForm,
                url: url,
                xpath_type: '1'
            } : {
                ...detailForm,
                url: url,
                xpath_type: '2'
            };

            // 在提交前检查数据
            console.log('Form type:', formType);
            console.log('URL:', url);
            console.log('List form:', listForm);
            console.log('Detail form:', detailForm);
            console.log('Submitting data:', formData);

            const response = await fetch('/api/xpath', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                throw new Error('提交失败');
            }
            console.log('Submitting data:', JSON.stringify(formData, null, 2));
            // Success message or redirect could be added here
            alert('XPath规则提交成功！');
        } catch (err) {
            setError(err instanceof Error ? err.message : '提交失败');
        } finally {
            setSubmitting(false);
        }
    };
    
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
            setProxyUrl(`/api/proxy?url=${encodedUrl}&js=true`);
        } catch (err) {
            setError('加载页面时出错');
        } finally {
            setLoading(false);
        }
    };

    // // 开始选择模式
    // const startSelection = () => {
    //     setIsSelecting(true);
    //     if (iframeRef.current?.contentWindow) {
    //         iframeRef.current.contentWindow.postMessage({ 
    //             type: 'INJECT_SELECTOR' 
    //         }, '*');
    //     }
    // };

    // 修改开始选择函数
    const toggleSelection = () => {
        if (isSelecting) {
            // 结束选择
            setIsSelecting(false);
            if (iframeRef.current?.contentWindow) {
                iframeRef.current.contentWindow.postMessage({ 
                    type: 'STOP_SELECTOR' 
                }, '*');
            }
        } else {
            // 开始选择
            setIsSelecting(true);
            if (iframeRef.current?.contentWindow) {
                iframeRef.current.contentWindow.postMessage({ 
                    type: 'INJECT_SELECTOR' 
                }, '*');
            }
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
        // const handleMessage = (event: MessageEvent) => {
        //     if (event.data.type === 'XPATH_SELECTED') {
        //         const { xpath, innerHTML } = event.data;
        //         setSelectedXPaths(prev => [...prev, {
        //             xpath,
        //             sample: innerHTML.slice(0, 100) + (innerHTML.length > 100 ? '...' : ''),
        //             note: ''
        //         }]);
        //     }
        // };

        const handleMessage = (event: MessageEvent) => {
            if (event.data.type === 'XPATH_SELECTED') {
                const { xpath } = event.data;
                
                // 根据当前表单类型和激活的输入框填入 XPath
                if (formType === 'list') {
                    if (activeInput === 'xpath') {
                        setListForm(prev => ({...prev, xpath}));
                    }
                } else {
                    switch (activeInput) {
                        case 'title':
                            setDetailForm(prev => ({...prev, details_title_xpath: xpath}));
                            break;
                        case 'content':
                            setDetailForm(prev => ({...prev, details_content_xpath: xpath}));
                            break;
                        case 'time':
                            setDetailForm(prev => ({...prev, details_publishtime_xpath: xpath}));
                            break;
                    }
                }
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [formType, activeInput]);

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


    // 添加生成爬虫代码的状态
    const [generatingCode, setGeneratingCode] = useState(false);

    // 添加生成爬虫代码的处理函数
    const handleGenerateSpiderCode = async () => {
        try {
            setGeneratingCode(true);
            setError('');

            // 使用当前表单中的数据
            const data = {
                account_code: formType === 'list' ? listForm.account_code : detailForm.account_code,
                project_name: formType === 'list' ? listForm.project_name : detailForm.project_name,
            };

            console.log('Generating spider code with data:', data);

            const response = await fetch('/api/gencode', {
                method: 'POST',
                headers: {
                    'accept': '*/*',
                    'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
                    'content-type': 'application/x-www-form-urlencoded',
                    'priority': 'u=1, i',
                    'sec-ch-ua': '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Windows"',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-origin',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
                  },
                body: JSON.stringify(data),
            });

            // console.log('Response:', response.ok);
            if (!response.ok) {
                throw new Error('生成爬虫代码失败');
            }


        } catch (err) {
            console.error('Generate Spider Code Error:', err);
            setError(err instanceof Error ? err.message : '生成爬虫代码失败');
        } finally {
            setGeneratingCode(false);
        }
    };

    
    return (

        <div className="selector-container">
            <div className="control-panel" style={{ width: controlPanelWidth }}>
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
                    
                    {/* {proxyUrl && (
                        <button 
                            onClick={startSelection}
                            className={`select-button ${isSelecting ? 'active' : ''}`}
                            disabled={!proxyUrl || loading}
                        >
                            {isSelecting ? '正在选择' : '开始选择'}
                        </button>
                    )} */}
            
                    {proxyUrl && (
                        <button 
                            onClick={toggleSelection}
                            className={`select-button ${isSelecting ? 'active' : ''}`}
                            disabled={!proxyUrl || loading}
                        >
                            {isSelecting ? '结束选择' : '开始选择'}
                        </button>
                    )}
                    
                </div>
                <div className="form-type-selector">
                    <button 
                        className={`form-type-button ${formType === 'list' ? 'active' : ''}`}
                        onClick={() => setFormType('list')}
                    >
                        列表页配置
                    </button>
                    <button 
                        className={`form-type-button ${formType === 'detail' ? 'active' : ''}`}
                        onClick={() => setFormType('detail')}
                    >
                        详情页配置
                    </button>
                </div>

                {formType === 'list' ? (
                    <div className="form-fields">
                        <input
                            type="text"
                            placeholder="网站名称"
                            value={listForm.web_name}
                            onChange={(e) => setListForm({...listForm, web_name: e.target.value})}
                            className="form-input"
                        />
                        <input
                            type="text"
                            placeholder="账号唯一标识"
                            value={listForm.account_code}
                            onChange={(e) => setListForm({...listForm, account_code: e.target.value})}
                            className="form-input"
                        />
                        <input
                            type="text"
                            placeholder="项目名称"
                            value={listForm.project_name}
                            onChange={(e) => setListForm({...listForm, project_name: e.target.value})}
                            className="form-input"
                        />
                        <input
                            type="text"
                            placeholder="栏目名称"
                            value={listForm.column_name}
                            onChange={(e) => setListForm({...listForm, column_name: e.target.value})}
                            className="form-input"
                        />
                        <input
                            type="text"
                            placeholder="列表页xpath规则"
                            value={listForm.xpath}
                            onChange={(e) => setListForm({...listForm, xpath: e.target.value})}
                            onFocus={() => setActiveInput('xpath')}
                            className="form-input xpath-input"
                        />
                    </div>
                ) : (
                    <div className="form-fields">
                        <input
                            type="text"
                            placeholder="网站名称"
                            value={detailForm.web_name}
                            onChange={(e) => setDetailForm({...detailForm, web_name: e.target.value})}
                            className="form-input"
                        />
                        <input
                            type="text"
                            placeholder="账号唯一标识"
                            value={detailForm.account_code}
                            onChange={(e) => setDetailForm({...detailForm, account_code: e.target.value})}
                            className="form-input"
                        />
                        <input
                            type="text"
                            placeholder="项目名称"
                            value={detailForm.project_name}
                            onChange={(e) => setDetailForm({...detailForm, project_name: e.target.value})}
                            className="form-input"
                        />
                        <input
                            type="text"
                            placeholder="标题xpath规则"
                            value={detailForm.details_title_xpath}
                            onChange={(e) => setDetailForm({...detailForm, details_title_xpath: e.target.value})}
                            onFocus={() => setActiveInput('title')}
                            className="form-input xpath-input"
                        />
                        <input
                            type="text"
                            placeholder="内容xpath规则"
                            value={detailForm.details_content_xpath}
                            onChange={(e) => setDetailForm({...detailForm, details_content_xpath: e.target.value})}
                            onFocus={() => setActiveInput('content')}
                            className="form-input xpath-input"
                        />
                        <input
                            type="text"
                            placeholder="发布时间xpath规则"
                            value={detailForm.details_publishtime_xpath}
                            onChange={(e) => setDetailForm({...detailForm, details_publishtime_xpath: e.target.value})}
                            onFocus={() => setActiveInput('time')}
                            className="form-input xpath-input"
                        />
                    </div>
                )}

                {/* Add submit button after the form fields */}
                <div className="form-fields">
                    {/* ... existing form fields ... */}
                    
                    <button 
                        onClick={handleSubmit}
                        className="submit-button"
                        disabled={submitting}
                    >
                        {submitting ? '提交中...' : '提交 XPath 规则'}
                    </button>
                </div>

                {/* 添加生成爬虫代码按钮 */}
                <div className="form-fields">
                    <button 
                        onClick={handleGenerateSpiderCode}
                        className="generate-spider-button"
                        disabled={generatingCode || !listForm.account_code || !listForm.project_name}
                    >
                        {generatingCode ? '生成中...' : '生成爬虫代码'}
                    </button>
                </div>

                {/* ... rest of the existing JSX ... */}
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
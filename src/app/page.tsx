import XPathSelector from './components/XPathSelector';
export default function Home() {
return (
<div className="selector-container">
<XPathSelector />
<div className="preview-panel">
<iframe className="target-frame" />
</div>
</div>
);
}
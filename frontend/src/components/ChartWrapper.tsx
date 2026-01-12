import { useRef, ReactNode } from 'react';
import { ResponsiveContainer } from 'recharts';
import '../App.css';

interface ChartWrapperProps {
  children: ReactNode;
  title?: string;
  height?: number;
  exportable?: boolean;
  onExport?: (format: 'png' | 'svg') => void;
  className?: string;
  actions?: ReactNode;
}

export function ChartWrapper({
  children,
  title,
  height = 400,
  exportable = true,
  onExport,
  className = '',
  actions,
}: ChartWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleExport = async (format: 'png' | 'svg') => {
    if (onExport) {
      onExport(format);
      return;
    }

    // Default export implementation
    if (!containerRef.current) return;

    const svgElement = containerRef.current.querySelector('svg');
    if (!svgElement) return;

    if (format === 'svg') {
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = svgUrl;
      downloadLink.download = `${title || 'chart'}.svg`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(svgUrl);
    } else if (format === 'png') {
      // Convert SVG to PNG
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const pngUrl = URL.createObjectURL(blob);
            const downloadLink = document.createElement('a');
            downloadLink.href = pngUrl;
            downloadLink.download = `${title || 'chart'}.png`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            URL.revokeObjectURL(pngUrl);
          }
          URL.revokeObjectURL(url);
        });
      };
      img.src = url;
    }
  };

  return (
    <div className={`chart-wrapper ${className}`}>
      {(title || exportable || actions) && (
        <div className="chart-header">
          {title && <h3 className="chart-title">{title}</h3>}
          <div className="chart-actions">
            {actions}
            {exportable && (
              <div className="chart-export-menu">
                <button
                  className="button button-tertiary button-sm"
                  onClick={() => handleExport('png')}
                  title="Export as PNG"
                >
                  📥 PNG
                </button>
                <button
                  className="button button-tertiary button-sm"
                  onClick={() => handleExport('svg')}
                  title="Export as SVG"
                >
                  📥 SVG
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      <div ref={containerRef} className="chart-container">
        <ResponsiveContainer width="100%" height={height}>
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Image as ImageIcon, Settings2, Download, Copy } from 'lucide-react';

const DENSITY_CHARS = ' .:-=+*#%@';
const DENSITY_CHARS_REVERSED = '@%#*+=-:. ';

export default function App() {
  const [asciiArt, setAsciiArt] = useState<string>('');
  const [imageSrc, setImageSrc] = useState<string | null>('/adam.jpg');
  const [resolution, setResolution] = useState<number>(120); // Characters wide
  const [invert, setInvert] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImageSrc(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const convertToAscii = useCallback(() => {
    if (!imageSrc || !canvasRef.current) return;
    
    setIsProcessing(true);
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      // Calculate new dimensions keeping aspect ratio
      // ASCII characters are roughly twice as tall as they are wide in standard monospace fonts
      const charWidth = resolution;
      const aspect = img.height / img.width;
      const charHeight = Math.floor(charWidth * aspect * 0.5);

      canvas.width = charWidth;
      canvas.height = charHeight;

      ctx.drawImage(img, 0, 0, charWidth, charHeight);
      
      const imageData = ctx.getImageData(0, 0, charWidth, charHeight);
      const data = imageData.data;
      
      let ascii = '';
      const chars = invert ? DENSITY_CHARS_REVERSED : DENSITY_CHARS;
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Calculate relative luminance
        const brightness = (0.299 * r + 0.587 * g + 0.114 * b);
        
        const charIndex = Math.floor((brightness / 255) * (chars.length - 1));
        
        ascii += chars[charIndex];
        
        // Add newline at the end of each row
        if (((i / 4) + 1) % charWidth === 0) {
          ascii += '\n';
        }
      }
      
      setAsciiArt(ascii);
      setIsProcessing(false);
    };
    img.src = imageSrc;
  }, [imageSrc, resolution, invert]);

  useEffect(() => {
    if (imageSrc) {
      convertToAscii();
    }
  }, [convertToAscii]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(asciiArt);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans selection:bg-zinc-800">
      <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col md:flex-row gap-8">
        
        {/* Sidebar Controls */}
        <div className="w-full md:w-80 flex flex-col gap-6 shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
              <ImageIcon className="w-6 h-6" />
              ASCII Studio
            </h1>
            <p className="text-sm text-zinc-500">
              Convert any image into pure text art. Upload your image to begin.
            </p>
          </div>

          <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 space-y-6 shadow-xl">
            {/* Upload Button */}
            <div>
              <label className="flex items-center justify-center w-full p-4 border-2 border-dashed border-zinc-700 rounded-lg hover:border-zinc-500 hover:bg-zinc-800/50 transition-all cursor-pointer group">
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-6 h-6 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                  <span className="text-sm font-medium text-zinc-400 group-hover:text-zinc-200">
                    Upload Image
                  </span>
                </div>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleImageUpload}
                />
              </label>
            </div>

            {/* Settings */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                <Settings2 className="w-4 h-4" />
                Settings
              </h3>
              
              <div className="space-y-3">
                <label className="flex flex-col gap-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Resolution (Width)</span>
                    <span className="text-zinc-200 font-medium">{resolution}</span>
                  </div>
                  <input 
                    type="range" 
                    min="40" 
                    max="500" 
                    step="10"
                    value={resolution}
                    onChange={(e) => setResolution(Number(e.target.value))}
                    className="w-full accent-zinc-100"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-zinc-950 rounded-lg border border-zinc-800 cursor-pointer hover:border-zinc-700 transition-colors">
                  <span className="text-sm text-zinc-400 select-none">Invert Colors</span>
                  <div className="relative inline-block w-10 h-5">
                    <input 
                      type="checkbox" 
                      className="peer sr-only"
                      checked={invert}
                      onChange={(e) => setInvert(e.target.checked)}
                    />
                    <div className="w-10 h-5 bg-zinc-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-300 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-zinc-600"></div>
                  </div>
                </label>
              </div>
            </div>
            
            {asciiArt && (
               <button 
                onClick={copyToClipboard}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-zinc-100 text-zinc-900 rounded-lg font-medium hover:bg-white transition-colors"
               >
                 <Copy className="w-4 h-4" />
                 Copy ASCII Art
               </button>
            )}
          </div>
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden flex flex-col shadow-xl min-h-[500px]">
          <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
             <div className="flex gap-2">
               <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
               <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
               <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
             </div>
             <span className="text-xs font-mono text-zinc-500">output.txt</span>
          </div>
          
          <div className="flex-1 overflow-auto p-4 md:p-8 flex items-center justify-center bg-black">
            {isProcessing ? (
              <div className="text-zinc-500 animate-pulse font-mono text-sm">Processing image...</div>
            ) : asciiArt ? (
              <pre className="font-mono text-[5px] leading-[5px] md:text-[6px] md:leading-[6px] text-zinc-300 whitespace-pre">
                {asciiArt}
              </pre>
            ) : (
              <div className="text-zinc-600 font-mono text-sm flex flex-col items-center gap-2">
                <span>[ No image loaded ]</span>
                <span className="text-xs text-zinc-700">Upload an image to generate ASCII art</span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Hidden canvas for image processing */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}


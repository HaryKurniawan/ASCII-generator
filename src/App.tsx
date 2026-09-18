import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Image as ImageIcon, Settings2, Download, Copy, RotateCw, Check } from 'lucide-react';
// @ts-ignore
import { parseGIF, decompressFrames } from 'gifuct-js';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

const DENSITY_CHARS = ' .:-=+*#%@';
const DENSITY_CHARS_REVERSED = '@%#*+=-:. ';

export default function App() {
  const [asciiArt, setAsciiArt] = useState<string>('');
  const [imageSrc, setImageSrc] = useState<string | null>('/adam.jpg');
  const [resolution, setResolution] = useState<number>(120); // Characters wide
  const [invert, setInvert] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [rotation, setRotation] = useState<number>(0);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [asciiFrames, setAsciiFrames] = useState<{ascii: string, delay: number}[]>([]);
  const [currentFrameIdx, setCurrentFrameIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
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

  const convertToAscii = useCallback(async () => {
    if (!imageSrc || !canvasRef.current) return;
    
    setIsProcessing(true);
    setAsciiFrames([]);
    setCurrentFrameIdx(0);

    const chars = invert ? DENSITY_CHARS_REVERSED : DENSITY_CHARS;
    const isGif = imageSrc.startsWith('data:image/gif') || imageSrc.toLowerCase().endsWith('.gif');

    if (isGif) {
      try {
        const response = await fetch(imageSrc);
        const buffer = await response.arrayBuffer();
        const gif = parseGIF(buffer);
        const framesData = decompressFrames(gif, true);

        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        const gifCanvas = document.createElement('canvas');
        const gifCtx = gifCanvas.getContext('2d', { willReadFrequently: true });
        const patchCanvas = document.createElement('canvas');
        const patchCtx = patchCanvas.getContext('2d');

        if (!gifCtx || !patchCtx) return;

        const generatedFrames: { ascii: string; delay: number }[] = [];
        let patchImageData: ImageData | null = null;
        let previousCanvasData: ImageData | null = null;

        for (let i = 0; i < framesData.length; i++) {
          const frame = framesData[i];

          if (i === 0) {
            gifCanvas.width = frame.dims.width;
            gifCanvas.height = frame.dims.height;
          }

          if (!patchImageData || patchCanvas.width !== frame.dims.width || patchCanvas.height !== frame.dims.height) {
            patchCanvas.width = frame.dims.width;
            patchCanvas.height = frame.dims.height;
            patchImageData = patchCtx.createImageData(frame.dims.width, frame.dims.height);
          }

          if (frame.disposalType === 3) {
             previousCanvasData = gifCtx.getImageData(0, 0, gifCanvas.width, gifCanvas.height);
          }

          patchImageData.data.set(frame.patch);
          patchCtx.putImageData(patchImageData, 0, 0);

          gifCtx.drawImage(patchCanvas, frame.dims.left, frame.dims.top);

          // Rotate and resize
          const rotatedCanvas = document.createElement('canvas');
          const rCtx = rotatedCanvas.getContext('2d', { willReadFrequently: true });
          if (!rCtx) continue;

          if (rotation === 90 || rotation === 270) {
            rotatedCanvas.width = gifCanvas.height;
            rotatedCanvas.height = gifCanvas.width;
          } else {
            rotatedCanvas.width = gifCanvas.width;
            rotatedCanvas.height = gifCanvas.height;
          }

          rCtx.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
          rCtx.rotate((rotation * Math.PI) / 180);
          rCtx.drawImage(gifCanvas, -gifCanvas.width / 2, -gifCanvas.height / 2);

          const charWidth = resolution;
          const aspect = rotatedCanvas.height / rotatedCanvas.width;
          const charHeight = Math.floor(charWidth * aspect * 0.5);

          canvas.width = charWidth;
          canvas.height = charHeight;

          ctx.drawImage(rotatedCanvas, 0, 0, charWidth, charHeight);
          const imageData = ctx.getImageData(0, 0, charWidth, charHeight);
          const data = imageData.data;
          
          let ascii = '';
          for (let j = 0; j < data.length; j += 4) {
            const r = data[j];
            const g = data[j + 1];
            const b = data[j + 2];
            const brightness = (0.299 * r + 0.587 * g + 0.114 * b);
            const charIndex = Math.floor((brightness / 255) * (chars.length - 1));
            ascii += chars[charIndex];
            if (((j / 4) + 1) % charWidth === 0) {
              ascii += '\n';
            }
          }
          
          generatedFrames.push({ ascii, delay: Math.max(frame.delay || 100, 20) });

          if (frame.disposalType === 2) {
            gifCtx.clearRect(frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height);
          } else if (frame.disposalType === 3 && previousCanvasData) {
            gifCtx.putImageData(previousCanvasData, 0, 0);
          }
        }

        setAsciiFrames(generatedFrames);
        if (generatedFrames.length > 0) {
          setAsciiArt(generatedFrames[0].ascii);
        }
        setIsProcessing(false);
        return;
      } catch (err) {
        console.error("Error processing GIF:", err);
      }
    }

    // Process as static image
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      // Create a temporary canvas to handle rotation
      const tempCanvas = document.createElement('canvas');
      const tCtx = tempCanvas.getContext('2d');
      if (!tCtx) return;

      if (rotation === 90 || rotation === 270) {
        tempCanvas.width = img.height;
        tempCanvas.height = img.width;
      } else {
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
      }

      tCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
      tCtx.rotate((rotation * Math.PI) / 180);
      tCtx.drawImage(img, -img.width / 2, -img.height / 2);

      // Calculate new dimensions keeping aspect ratio
      // ASCII characters are roughly twice as tall as they are wide in standard monospace fonts
      const charWidth = resolution;
      const aspect = tempCanvas.height / tempCanvas.width;
      const charHeight = Math.floor(charWidth * aspect * 0.5);

      canvas.width = charWidth;
      canvas.height = charHeight;

      ctx.drawImage(tempCanvas, 0, 0, charWidth, charHeight);
      
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
      setAsciiFrames([{ ascii, delay: 0 }]);
      setIsProcessing(false);
    };
    img.src = imageSrc;
  }, [imageSrc, resolution, invert, rotation]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (asciiFrames.length > 1 && isPlaying && !isProcessing) {
      const frame = asciiFrames[currentFrameIdx];
      setAsciiArt(frame.ascii);
      
      timeoutId = setTimeout(() => {
        setCurrentFrameIdx((prev) => (prev + 1) % asciiFrames.length);
      }, frame.delay);
    }
    return () => clearTimeout(timeoutId);
  }, [asciiFrames, currentFrameIdx, isPlaying, isProcessing]);

  useEffect(() => {
    if (imageSrc) {
      convertToAscii();
    }
  }, [convertToAscii]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(asciiArt).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const exportAsImage = (format: 'png' | 'jpeg') => {
    if (!asciiArt) return;

    const lines = asciiArt.split('\n');
    const numRows = lines.length;
    if (numRows === 0) return;
    
    const maxCols = lines.reduce((max, line) => Math.max(max, line.length), 0);
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const fontSize = 10;
    const lineHeight = 10;
    ctx.font = `${fontSize}px monospace`;
    
    const charWidth = ctx.measureText('M').width;
    
    const padding = 24;
    canvas.width = (maxCols * charWidth) + (padding * 2);
    canvas.height = (numRows * lineHeight) + (padding * 2);
    
    ctx.font = `${fontSize}px monospace`;
    ctx.textBaseline = 'top';
    
    ctx.fillStyle = '#09090b'; // zinc-950
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#d4d4d8'; // zinc-300
    lines.forEach((line, index) => {
      ctx.fillText(line, padding, padding + (index * lineHeight));
    });
    
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const dataUrl = canvas.toDataURL(mimeType, 0.9);
    
    const link = document.createElement('a');
    link.download = `ascii-art.${format === 'jpeg' ? 'jpg' : 'png'}`;
    link.href = dataUrl;
    link.click();
  };

  const exportAsGif = async () => {
    if (asciiFrames.length === 0) return;
    setIsExporting(true);

    // Yield to allow UI to show "Exporting..." state
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      const lines = asciiFrames[0].ascii.split('\n');
      const numRows = lines.length;
      const maxCols = lines.reduce((max, line) => Math.max(max, line.length), 0);
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      
      const fontSize = 10;
      const lineHeight = 10;
      ctx.font = `${fontSize}px monospace`;
      const charWidth = ctx.measureText('M').width;
      
      const padding = 24;
      const width = Math.ceil((maxCols * charWidth) + (padding * 2));
      const height = (numRows * lineHeight) + (padding * 2);
      
      canvas.width = width;
      canvas.height = height;
      
      const gif = new GIFEncoder();
      
      for (const frame of asciiFrames) {
        ctx.fillStyle = '#09090b';
        ctx.fillRect(0, 0, width, height);
        
        ctx.fillStyle = '#d4d4d8';
        ctx.font = `${fontSize}px monospace`;
        ctx.textBaseline = 'top';
        
        const frameLines = frame.ascii.split('\n');
        frameLines.forEach((line, index) => {
          ctx.fillText(line, padding, padding + (index * lineHeight));
        });
        
        const { data } = ctx.getImageData(0, 0, width, height);
        
        // Quantize colors (since we use solid background and text, 256 colors are enough)
        const palette = quantize(data, 256);
        const index = applyPalette(data, palette);
        
        gif.writeFrame(index, width, height, { palette, delay: frame.delay });
      }
      
      gif.finish();
      const buffer = gif.bytes();
      const blob = new Blob([buffer], { type: 'image/gif' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.download = 'ascii-animated.gif';
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch(e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
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
                <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                  <span className="text-sm text-zinc-400 select-none">Orientation</span>
                  <button 
                    onClick={() => setRotation(r => (r + 90) % 360)}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md flex items-center gap-2 transition-colors text-sm font-medium cursor-pointer"
                  >
                    <RotateCw className="w-4 h-4" />
                    Rotate 90°
                  </button>
                </div>

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

                {asciiFrames.length > 1 && (
                  <label className="flex items-center justify-between p-3 bg-zinc-950 rounded-lg border border-zinc-800 cursor-pointer hover:border-zinc-700 transition-colors">
                    <span className="text-sm text-zinc-400 select-none">Play Animation</span>
                    <div className="relative inline-block w-10 h-5">
                      <input 
                        type="checkbox" 
                        className="peer sr-only"
                        checked={isPlaying}
                        onChange={(e) => setIsPlaying(e.target.checked)}
                      />
                      <div className="w-10 h-5 bg-zinc-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-300 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                    </div>
                  </label>
                )}
              </div>
            </div>
            
            {asciiArt && (
               <div className="space-y-2">
                 <button 
                  onClick={copyToClipboard}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-colors cursor-pointer ${
                    isCopied 
                      ? 'bg-green-500 text-white hover:bg-green-600' 
                      : 'bg-zinc-100 text-zinc-900 hover:bg-white'
                  }`}
                 >
                   {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                   {isCopied ? 'Copied!' : 'Copy ASCII Art'}
                 </button>
                 <div className="flex gap-2">
                   <button 
                    onClick={() => exportAsImage('png')}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 rounded-lg font-medium transition-colors cursor-pointer text-sm"
                   >
                     <Download className="w-4 h-4" />
                     PNG
                   </button>
                   <button 
                    onClick={() => exportAsImage('jpeg')}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 rounded-lg font-medium transition-colors cursor-pointer text-sm"
                   >
                     <Download className="w-4 h-4" />
                     JPG
                   </button>
                   {asciiFrames.length > 1 && (
                     <button 
                      onClick={exportAsGif}
                      disabled={isExporting}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white hover:bg-indigo-500 rounded-lg font-medium transition-colors cursor-pointer text-sm disabled:opacity-50 disabled:cursor-wait"
                     >
                       <Download className="w-4 h-4" />
                       {isExporting ? 'Wait...' : 'GIF'}
                     </button>
                   )}
                 </div>
               </div>
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
          
          <div className="flex-1 overflow-auto bg-black relative">
            {isProcessing ? (
              <div className="absolute inset-0 flex items-center justify-center text-zinc-500 animate-pulse font-mono text-sm">Processing image...</div>
            ) : asciiArt ? (
              <div className="w-fit min-h-full flex items-center p-4 md:p-8 mx-auto">
                <pre className="font-mono text-[5px] leading-[5px] md:text-[6px] md:leading-[6px] text-zinc-300 whitespace-pre">
                  {asciiArt}
                </pre>
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600 font-mono text-sm gap-2">
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


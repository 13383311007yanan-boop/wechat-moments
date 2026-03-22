/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Sparkles, 
  Loader2, 
  Image as ImageIcon,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Trash2,
  Type as TypeIcon,
  Palette,
  GripVertical,
  CheckCircle2,
  Copy,
  Check,
  Layout as LayoutIcon,
  Users,
  Heart,
  Zap,
  Crop,
  Download,
  ArrowUpDown
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { generateChineseCaptions, generateImageShortCaptions, analyzeLayout, suggestImageOrder } from './services/ai';

type Step = 'UPLOAD' | 'EDIT' | 'SORT' | 'COPY' | 'COMMUNITY';

interface ImageItem {
  id: string;
  url: string;
  filter: string;
  caption: string;
  font: string;
  aspectRatio: string;
}

interface LayoutTemplate {
  id: string;
  name: string;
  description: string;
  previewUrl: string;
  layoutType: 'GRID' | 'PANORAMA' | 'CENTER_FOCUS' | 'Z_PATTERN';
}

const FILTERS = [
  { name: 'Original', class: '' },
  { name: 'Grayscale', class: 'filter-grayscale' },
  { name: 'Sepia', class: 'filter-sepia' },
  { name: 'Warm', class: 'filter-warm' },
  { name: 'Cool', class: 'filter-cool' },
  { name: 'Vibrant', class: 'filter-vibrant' },
  { name: 'Vintage', class: 'filter-vintage' },
];

const FONTS = [
  { name: 'Handwriting', class: 'font-handwriting' },
  { name: 'Calligraphy', class: 'font-chinese' },
  { name: 'Brush', class: 'font-brush' },
  { name: 'Cute', class: 'font-cute' },
  { name: 'Serif', class: 'font-serif-sc' },
];

const ASPECT_RATIOS = [
  { name: 'Square', class: 'aspect-square' },
  { name: 'Portrait', class: 'aspect-[3/4]' },
  { name: 'Landscape', class: 'aspect-[4/3]' },
  { name: 'Wide', class: 'aspect-video' },
];

const COMMUNITY_TEMPLATES: LayoutTemplate[] = [
  {
    id: 't1',
    name: 'Classic 9-Grid',
    description: 'Standard 3x3 layout for daily moments.',
    previewUrl: 'https://picsum.photos/seed/grid/400/400',
    layoutType: 'GRID'
  },
  {
    id: 't2',
    name: 'Cinematic Panorama',
    description: 'A wide cinematic feel across the grid.',
    previewUrl: 'https://picsum.photos/seed/pano/400/400',
    layoutType: 'PANORAMA'
  },
  {
    id: 't3',
    name: 'Center Focus',
    description: 'The middle photo is the star.',
    previewUrl: 'https://picsum.photos/seed/focus/400/400',
    layoutType: 'CENTER_FOCUS'
  },
  {
    id: 't4',
    name: 'Z-Flow Story',
    description: 'Follow the natural eye movement.',
    previewUrl: 'https://picsum.photos/seed/zflow/400/400',
    layoutType: 'Z_PATTERN'
  }
];

export default function App() {
  const [step, setStep] = useState<Step>('UPLOAD');
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isGeneratingShort, setIsGeneratingShort] = useState(false);
  const [isAnalyzingLayout, setIsAnalyzingLayout] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [pendingAnalysis, setPendingAnalysis] = useState<{ filter: string; font: string; aspectRatio: string; description: string } | null>(null);
  const [shortOptions, setShortOptions] = useState<string[]>([]);
  const [captions, setCaptions] = useState<string[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeLayout, setActiveLayout] = useState<LayoutTemplate>(COMMUNITY_TEMPLATES[0]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const layoutInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const newItem: ImageItem = {
          id: Math.random().toString(36).substr(2, 9),
          url: event.target?.result as string,
          filter: pendingAnalysis?.filter || '',
          caption: '',
          font: pendingAnalysis?.font || 'font-chinese',
          aspectRatio: pendingAnalysis?.aspectRatio || 'aspect-square'
        };
        setImages(prev => [...prev, newItem]);
      };
      reader.readAsDataURL(file);
    });
    
    if (step === 'UPLOAD' || step === 'COMMUNITY') setStep('EDIT');
    // Clear pending analysis after applying to new uploads
    if (pendingAnalysis) setPendingAnalysis(null);
  };

  const handleLayoutUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setIsAnalyzingLayout(true);
      setError(null);
      setPendingAnalysis(null);
      try {
        const analysis = await analyzeLayout(base64);
        setPendingAnalysis(analysis);
        
        if (images.length > 0) {
          // If images already exist, we can offer to apply now or just store it
          // For now, let's just store it and show the UI to apply
        }
      } catch (err) {
        console.error(err);
        setError("分析布局失败，请重试。");
      } finally {
        setIsAnalyzingLayout(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const applyTemplate = (template: LayoutTemplate) => {
    setActiveLayout(template);
    if (images.length > 0) {
      setStep('EDIT');
    } else {
      fileInputRef.current?.click();
    }
  };

  const applyPendingAnalysis = () => {
    if (!pendingAnalysis) return;
    if (images.length > 0) {
      setImages(prev => prev.map(img => ({
        ...img,
        filter: pendingAnalysis.filter,
        font: pendingAnalysis.font,
        aspectRatio: pendingAnalysis.aspectRatio
      })));
      setStep('EDIT');
      setPendingAnalysis(null);
    } else {
      fileInputRef.current?.click();
    }
  };

  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const updateImageFilter = (id: string, filterClass: string) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, filter: filterClass } : img));
  };

  const updateImageCaption = (id: string, text: string) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, caption: text } : img));
  };

  const updateImageFont = (id: string, fontClass: string) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, font: fontClass } : img));
  };

  const updateImageAspectRatio = (id: string, aspectClass: string) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, aspectRatio: aspectClass } : img));
  };

  const fetchShortCaptions = async () => {
    const activeImg = images.find(img => img.id === selectedId) || images[0];
    if (!activeImg) return;

    setIsGeneratingShort(true);
    setShortOptions([]);
    try {
      const data = await generateImageShortCaptions(activeImg.url);
      setShortOptions(data.options);
    } catch (err) {
      console.error(err);
      setError("生成短文案失败。");
    } finally {
      setIsGeneratingShort(false);
    }
  };

  const fetchCaptions = async () => {
    if (images.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const data = await generateChineseCaptions(images.map(img => img.url));
      setCaptions(data.captions);
      setStep('COPY');
    } catch (err) {
      console.error(err);
      setError("生成文案失败，请重试。");
    } finally {
      setLoading(false);
    }
  };

  const autoReorder = async () => {
    if (images.length < 2) return;
    setIsReordering(true);
    setError(null);
    try {
      const result = await suggestImageOrder(images.map(img => ({ id: img.id, url: img.url })));
      const newOrder = result.orderedIds
        .map(id => images.find(img => img.id === id))
        .filter((img): img is ImageItem => !!img);
      
      // Add any images that AI might have missed
      const missed = images.filter(img => !result.orderedIds.includes(img.id));
      setImages([...newOrder, ...missed]);
      setError(`智能排序完成：${result.reasoning}`);
    } catch (err) {
      console.error(err);
      setError("智能排序失败。");
    } finally {
      setIsReordering(false);
    }
  };

  const saveToAlbum = async () => {
    setLoading(true);
    try {
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        const imageObj = new Image();
        imageObj.crossOrigin = "anonymous";
        await new Promise((resolve, reject) => {
          imageObj.onload = resolve;
          imageObj.onerror = reject;
          imageObj.src = img.url;
        });

        // Set canvas size based on aspect ratio
        let width = imageObj.width;
        let height = imageObj.height;
        
        if (img.aspectRatio === 'aspect-square') {
          const size = Math.min(width, height);
          canvas.width = size;
          canvas.height = size;
          ctx.drawImage(imageObj, (width - size) / 2, (height - size) / 2, size, size, 0, 0, size, size);
        } else if (img.aspectRatio === 'aspect-[3/4]') {
          const targetHeight = width * (4/3);
          if (targetHeight <= height) {
            canvas.width = width;
            canvas.height = targetHeight;
            ctx.drawImage(imageObj, 0, (height - targetHeight) / 2, width, targetHeight, 0, 0, width, targetHeight);
          } else {
            const targetWidth = height * (3/4);
            canvas.width = targetWidth;
            canvas.height = height;
            ctx.drawImage(imageObj, (width - targetWidth) / 2, 0, targetWidth, height, 0, 0, targetWidth, height);
          }
        } else if (img.aspectRatio === 'aspect-[4/3]') {
          const targetWidth = height * (4/3);
          if (targetWidth <= width) {
            canvas.width = targetWidth;
            canvas.height = height;
            ctx.drawImage(imageObj, (width - targetWidth) / 2, 0, targetWidth, height, 0, 0, targetWidth, height);
          } else {
            const targetHeight = width * (3/4);
            canvas.width = width;
            canvas.height = targetHeight;
            ctx.drawImage(imageObj, 0, (height - targetHeight) / 2, width, targetHeight, 0, 0, width, targetHeight);
          }
        } else {
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(imageObj, 0, 0);
        }

        // Apply filter (simplified)
        if (img.filter === 'filter-grayscale') ctx.filter = 'grayscale(100%)';
        if (img.filter === 'filter-sepia') ctx.filter = 'sepia(100%)';
        if (img.filter === 'filter-warm') ctx.filter = 'sepia(30%) saturate(140%) hue-rotate(-10deg)';
        if (img.filter === 'filter-cool') ctx.filter = 'saturate(120%) hue-rotate(180deg) brightness(1.1)';
        
        // Redraw with filter
        const tempImg = new Image();
        tempImg.src = canvas.toDataURL();
        await new Promise(r => tempImg.onload = r);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(tempImg, 0, 0);

        // Add text
        if (img.caption) {
          ctx.fillStyle = 'white';
          ctx.shadowColor = 'rgba(0,0,0,0.8)';
          ctx.shadowBlur = 10;
          ctx.font = `bold ${canvas.width / 15}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(img.caption, canvas.width / 2, canvas.height - (canvas.height / 10));
        }

        const link = document.createElement('a');
        link.download = `glacier-post-${i + 1}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        // Small delay to prevent browser blocking multiple downloads
        await new Promise(r => setTimeout(r, 300));
      }
      setError("所有图片已准备好下载！");
    } catch (err) {
      console.error(err);
      setError("保存图片失败。");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const selectedImage = images.find(img => img.id === selectedId) || images[0];

  useEffect(() => {
    setShortOptions([]);
  }, [selectedId]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-slate-200">
      {/* Header */}
      <header className="bg-black/60 backdrop-blur-xl border-b border-sky-300/10 sticky top-0 z-50 flex justify-between items-center px-6 py-4 w-full">
        <div className="flex items-center gap-3">
          <Sparkles className="text-sky-300 w-6 h-6" />
          <h1 className="text-xl font-black tracking-tighter text-sky-300 uppercase">GLACIER POST</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <nav className="hidden md:flex items-center gap-6 mr-8">
            <button 
              onClick={() => setStep('COMMUNITY')}
              className={`text-[10px] uppercase tracking-widest font-bold flex items-center gap-2 transition-colors ${step === 'COMMUNITY' ? 'text-sky-300' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Users className="w-3 h-3" /> Community
            </button>
            <button 
              onClick={() => images.length > 0 ? setStep('EDIT') : setStep('UPLOAD')}
              className={`text-[10px] uppercase tracking-widest font-bold flex items-center gap-2 transition-colors ${step !== 'COMMUNITY' ? 'text-sky-300' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Zap className="w-3 h-3" /> Editor
            </button>
          </nav>
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="secondary-button"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Add Photos</span>
          </button>
          <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" multiple className="hidden" />
        </div>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <AnimatePresence mode="wait">
          {/* COMMUNITY STEP */}
          {step === 'COMMUNITY' && (
            <motion.div 
              key="community"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 p-6 lg:p-12 overflow-y-auto"
            >
              <div className="max-w-6xl mx-auto space-y-12">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div>
                    <h2 className="text-4xl font-black tracking-tighter text-sky-100 uppercase mb-2">Moments Community</h2>
                    <p className="text-slate-500">Discover creative layouts and trending styles for your WeChat Moments.</p>
                  </div>
                  <div className="flex gap-2">
                    <div className="px-4 py-2 rounded-full glass-panel text-[10px] font-bold uppercase tracking-widest text-sky-300">Trending</div>
                    <div className="px-4 py-2 rounded-full glass-panel text-[10px] font-bold uppercase tracking-widest text-slate-500">Newest</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {COMMUNITY_TEMPLATES.map(template => (
                    <motion.div 
                      key={template.id}
                      whileHover={{ y: -5 }}
                      className="glass-panel rounded-2xl overflow-hidden group cursor-pointer"
                      onClick={() => applyTemplate(template)}
                    >
                      <div className="aspect-square relative overflow-hidden">
                        <img src={template.previewUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                          <button className="w-full primary-button py-2 text-xs">Use Template</button>
                        </div>
                      </div>
                      <div className="p-4 space-y-1">
                        <div className="flex justify-between items-center">
                          <h4 className="text-sm font-bold text-sky-100">{template.name}</h4>
                          <Heart className="w-4 h-4 text-slate-600 hover:text-red-400 transition-colors" />
                        </div>
                        <p className="text-[10px] text-slate-500">{template.description}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="p-12 rounded-3xl glass-panel bg-sky-300/5 border-dashed border-sky-300/20 flex flex-col items-center justify-center text-center gap-6 relative overflow-hidden min-h-[300px]">
                  {isAnalyzingLayout && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-4">
                      <Loader2 className="w-10 h-10 text-sky-300 animate-spin" />
                      <p className="text-sky-300 font-bold animate-pulse">Analyzing Layout Style...</p>
                    </div>
                  )}

                  <AnimatePresence mode="wait">
                    {pendingAnalysis ? (
                      <motion.div 
                        key="analysis-result"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center gap-6 z-10"
                      >
                        <div className="w-16 h-16 rounded-full bg-sky-300/20 flex items-center justify-center">
                          <CheckCircle2 className="w-8 h-8 text-sky-300" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-sky-100">Style Analysis Complete</h3>
                          <p className="text-sm text-slate-400 mt-1 max-w-xs mx-auto">{pendingAnalysis.description}</p>
                          <div className="flex gap-2 justify-center mt-3">
                            <span className="px-2 py-1 rounded bg-white/5 text-[10px] text-sky-300 border border-sky-300/20">{pendingAnalysis.filter || 'Original'}</span>
                            <span className="px-2 py-1 rounded bg-white/5 text-[10px] text-sky-300 border border-sky-300/20">{pendingAnalysis.font.replace('font-', '')}</span>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <button 
                            onClick={() => setPendingAnalysis(null)}
                            className="secondary-button text-xs px-6"
                          >
                            Reset
                          </button>
                          <button 
                            onClick={applyPendingAnalysis}
                            className="primary-button cyber-glow text-xs px-8"
                          >
                            <Zap className="w-4 h-4" /> 一键应用 (One-click Apply)
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div 
                        key="upload-prompt"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center gap-6"
                      >
                        <LayoutIcon className="w-12 h-12 text-sky-300/30" />
                        <div>
                          <h3 className="text-xl font-bold text-sky-100">Upload Your Own Layout</h3>
                          <p className="text-sm text-slate-500">Upload a screenshot of a post you like. AI will analyze the style and apply it to your photos.</p>
                        </div>
                        <button 
                          onClick={() => layoutInputRef.current?.click()}
                          className="secondary-button px-8"
                        >
                          <Upload className="w-4 h-4" /> Upload & Analyze
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  <input 
                    type="file" 
                    ref={layoutInputRef} 
                    onChange={handleLayoutUpload} 
                    accept="image/*" 
                    className="hidden" 
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 1: EDIT */}
          {step === 'EDIT' && (
            <motion.div 
              key="edit"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col lg:flex-row overflow-hidden"
            >
              {/* Left: Preview */}
              <div className="flex-1 p-6 lg:p-12 flex flex-col items-center justify-center gap-8 overflow-y-auto">
                <div className={`relative w-full max-w-xl glass-panel rounded-2xl overflow-hidden group ${selectedImage?.aspectRatio || 'aspect-square'}`}>
                  {selectedImage ? (
                    <>
                      <img 
                        src={selectedImage.url} 
                        className={`w-full h-full object-cover transition-all duration-500 ${selectedImage.filter}`}
                        alt="Preview"
                      />
                      {selectedImage.caption && (
                        <div className="absolute bottom-12 left-0 w-full px-8 text-center">
                          <span className={`${selectedImage.font} text-4xl text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]`}>
                            {selectedImage.caption}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                      Select an image to edit
                    </div>
                  )}
                </div>

                {/* Thumbnails */}
                <div className="flex gap-3 overflow-x-auto pb-2 w-full max-w-xl">
                  {images.map(img => (
                    <button
                      key={img.id}
                      onClick={() => setSelectedId(img.id)}
                      className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                        (selectedId === img.id || (!selectedId && images[0]?.id === img.id)) ? 'border-sky-300 scale-110' : 'border-transparent opacity-60'
                      }`}
                    >
                      <img src={img.url} className={`w-full h-full object-cover ${img.filter}`} />
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}
                        className="absolute top-0 right-0 p-0.5 bg-black/60 text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </button>
                  ))}
                </div>
              </div>

              {/* Right: Controls */}
              <aside className="w-full lg:w-80 glass-elevated border-t lg:border-t-0 lg:border-l border-sky-300/10 p-6 flex flex-col gap-6 overflow-y-auto">
                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold mb-3 flex items-center gap-2">
                    <Palette className="w-3 h-3" /> Filters
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {FILTERS.map(f => (
                      <button
                        key={f.name}
                        onClick={() => selectedImage && updateImageFilter(selectedImage.id, f.class)}
                        className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                          selectedImage?.filter === f.class ? 'bg-sky-300 text-black' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        {f.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold mb-3 flex items-center gap-2">
                    <Crop className="w-3 h-3" /> Crop & Aspect
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {ASPECT_RATIOS.map(a => (
                      <button
                        key={a.name}
                        onClick={() => selectedImage && updateImageAspectRatio(selectedImage.id, a.class)}
                        className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                          selectedImage?.aspectRatio === a.class ? 'bg-sky-300 text-black' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        {a.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold mb-3 flex items-center gap-2">
                    <TypeIcon className="w-3 h-3" /> Handwriting Caption
                  </h3>
                  
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      {FONTS.map(f => (
                        <button
                          key={f.name}
                          onClick={() => selectedImage && updateImageFont(selectedImage.id, f.class)}
                          className={`py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${
                            selectedImage?.font === f.class ? 'bg-sky-300 text-black' : 'bg-white/5 text-slate-400'
                          }`}
                        >
                          {f.name}
                        </button>
                      ))}
                    </div>

                    <div className="relative">
                      <input 
                        type="text"
                        value={selectedImage?.caption || ''}
                        onChange={(e) => selectedImage && updateImageCaption(selectedImage.id, e.target.value)}
                        placeholder="Type or generate..."
                        className="w-full bg-black/40 border border-sky-300/10 rounded-lg px-4 py-3 text-sm focus:ring-1 focus:ring-sky-300 outline-none"
                      />
                      <button 
                        onClick={fetchShortCaptions}
                        disabled={isGeneratingShort || !selectedImage}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-sky-300 hover:bg-sky-300/10 rounded-md disabled:opacity-50"
                        title="AI Generate"
                      >
                        {isGeneratingShort ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      </button>
                    </div>

                    {shortOptions.length > 0 && (
                      <div className="space-y-1 mt-2">
                        <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">AI Options:</p>
                        {shortOptions.map((opt, i) => (
                          <button
                            key={i}
                            onClick={() => selectedImage && updateImageCaption(selectedImage.id, opt)}
                            className="w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 transition-colors truncate"
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-auto pt-6 border-t border-sky-300/10">
                  <button 
                    onClick={() => setStep('SORT')}
                    className="w-full primary-button cyber-glow"
                  >
                    Next: Sort Grid <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </aside>
            </motion.div>
          )}

          {/* STEP 2: SORT */}
          {step === 'SORT' && (
            <motion.div 
              key="sort"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 gap-8"
            >
              <div className="text-center">
                <h2 className="text-2xl font-black tracking-tighter text-sky-300 uppercase mb-2">Sort Your Grid</h2>
                <p className="text-sm text-slate-500">Drag to reorder your photos for the perfect post</p>
                <button 
                  onClick={autoReorder}
                  disabled={isReordering || images.length < 2}
                  className="mt-4 secondary-button text-[10px] px-6 py-2 border-sky-300/30 text-sky-300 hover:bg-sky-300/10"
                >
                  {isReordering ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowUpDown className="w-3 h-3" />}
                  AI 智能排序 (Auto Reorder)
                </button>
              </div>

              <Reorder.Group 
                axis="y" 
                values={images} 
                onReorder={setImages}
                className="w-full max-w-md space-y-3"
              >
                {images.map(img => (
                  <Reorder.Item 
                    key={img.id} 
                    value={img}
                    className="glass-panel p-3 rounded-xl flex items-center gap-4 cursor-grab active:cursor-grabbing"
                  >
                    <GripVertical className="w-5 h-5 text-slate-600" />
                    <img src={img.url} className={`w-12 h-12 rounded-lg object-cover ${img.filter}`} />
                    <div className="flex-1 truncate">
                      <p className="text-xs font-bold text-sky-100 truncate">Image {images.indexOf(img) + 1}</p>
                      <p className={`${img.font} text-sm text-slate-400 truncate`}>{img.caption || 'No caption'}</p>
                    </div>
                  </Reorder.Item>
                ))}
              </Reorder.Group>

              <div className="flex gap-4 w-full max-w-md">
                <button onClick={() => setStep('EDIT')} className="flex-1 secondary-button">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button 
                  onClick={fetchCaptions}
                  disabled={loading}
                  className="flex-[2] primary-button cyber-glow"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Generate Captions
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 3: COPY */}
          {step === 'COPY' && (
            <motion.div 
              key="copy"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col lg:flex-row overflow-hidden"
            >
              {/* Left: Final Preview */}
              <div className="flex-1 p-6 lg:p-12 flex flex-col items-center justify-center gap-8 overflow-y-auto">
                <div className={`grid grid-cols-3 gap-2 p-2 glass-panel rounded-2xl w-full max-w-sm aspect-square ${
                  activeLayout.layoutType === 'PANORAMA' ? 'gap-0' : 
                  activeLayout.layoutType === 'CENTER_FOCUS' ? 'gap-4' : ''
                }`}>
                  {images.slice(0, 9).map((img, idx) => (
                    <div 
                      key={img.id} 
                      className={`relative aspect-square rounded-lg overflow-hidden ${
                        activeLayout.layoutType === 'CENTER_FOCUS' && idx === 4 ? 'scale-110 z-10 shadow-2xl ring-2 ring-sky-300' : ''
                      }`}
                    >
                      <div className={`w-full h-full ${img.aspectRatio} overflow-hidden`}>
                        <img src={img.url} className={`w-full h-full object-cover ${img.filter}`} />
                      </div>
                      {img.caption && (
                        <div className="absolute inset-0 flex items-center justify-center p-1">
                          <span className={`${img.font} text-[10px] text-white text-center leading-tight drop-shadow-md`}>
                            {img.caption}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                  {Array.from({ length: Math.max(0, 9 - images.length) }).map((_, i) => (
                    <div key={i} className="aspect-square rounded-lg bg-white/5 border border-dashed border-white/10 flex items-center justify-center">
                      <ImageIcon className="w-4 h-4 text-slate-800" />
                    </div>
                  ))}
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold uppercase tracking-widest text-sky-300">Layout: {activeLayout.name}</p>
                  <p className="text-[10px] text-slate-500 mt-1">{images.length} Photos Selected</p>
                </div>
              </div>

              {/* Right: Captions */}
              <aside className="w-full lg:w-96 glass-elevated border-t lg:border-t-0 lg:border-l border-sky-300/10 p-6 flex flex-col gap-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">朋友圈文案 (Captions)</h3>
                  <button 
                    onClick={fetchCaptions}
                    disabled={loading}
                    className="p-2 text-sky-300 hover:bg-sky-300/10 rounded-lg transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto">
                  {captions.map((cap, i) => (
                    <div 
                      key={i}
                      className="group relative p-4 bg-white/5 border border-white/5 rounded-xl hover:border-sky-300/30 transition-all"
                    >
                      <p className="text-sm leading-relaxed text-sky-50 pr-8">{cap}</p>
                      <button 
                        onClick={() => copyToClipboard(cap, i)}
                        className="absolute top-4 right-4 text-slate-500 hover:text-sky-300"
                      >
                        {copiedIndex === i ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  ))}
                </div>

                <div className="pt-6 border-t border-sky-300/10 flex flex-col gap-3">
                  <div className="flex gap-3">
                    <button onClick={() => setStep('SORT')} className="flex-1 secondary-button">
                      <ChevronLeft className="w-4 h-4" /> Back
                    </button>
                    <button 
                      onClick={saveToAlbum}
                      disabled={loading}
                      className="flex-[2] primary-button cyber-glow"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      一键保存相册 (Save All)
                    </button>
                  </div>
                  <button className="w-full secondary-button border-green-500/30 text-green-400 hover:bg-green-500/10">
                    <CheckCircle2 className="w-4 h-4" /> Done & Export
                  </button>
                </div>
              </aside>
            </motion.div>
          )}

          {/* UPLOAD STEP (Initial) */}
          {step === 'UPLOAD' && (
            <motion.div 
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-8"
            >
              <div className="p-12 rounded-full bg-sky-300/5 border border-sky-300/10 relative">
                <div className="absolute inset-0 bg-sky-300/10 blur-3xl rounded-full"></div>
                <ImageIcon className="w-24 h-24 text-sky-300 relative z-10" />
              </div>
              <div>
                <h2 className="text-4xl font-black tracking-tighter text-sky-100 uppercase mb-4">Create Your Moment</h2>
                <p className="text-slate-500 max-w-md mx-auto">Upload your photos to start the journey. We'll help you edit, sort, and write the perfect caption.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="primary-button cyber-glow px-12"
                >
                  <Upload className="w-5 h-5" /> Start Uploading
                </button>
                <button 
                  onClick={() => setStep('COMMUNITY')}
                  className="secondary-button px-12"
                >
                  <Users className="w-5 h-5" /> Explore Community
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {error && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-3 bg-red-500/20 border border-red-500/50 backdrop-blur-xl rounded-full text-red-200 text-xs z-[100]">
          {error}
        </div>
      )}
    </div>
  );
}





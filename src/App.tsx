import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Play, 
  Download, 
  Trash2, 
  ChevronRight, 
  Loader2, 
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  FileText,
  Terminal,
  Music,
  Video,
  Layers,
  Square,
  Table as TableIcon,
  FileCode,
  Copy,
  PlusCircle
} from 'lucide-react';
import { Scene } from './types';
import { parseScriptToScenes, generateSceneImage } from './services/gemini';

type ViewMode = 'cards' | 'table' | 'csv';

export default function App() {
  const [script, setScript] = useState('');
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  
  const logEndRef = useRef<HTMLDivElement>(null);
  const stopSignal = useRef<boolean>(false);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleAnalyze = async (continueFrom?: number) => {
    if (!script.trim()) return;
    
    setIsAnalyzing(true);
    stopSignal.current = false;
    const targetCount = 50;
    const currentCount = scenes.length;
    
    addLog(continueFrom ? `Continuing analysis from Scene ${continueFrom}...` : `Starting script analysis (Target: ${targetCount} scenes)...`);
    
    try {
      // If continuing, we might want to pass existing scenes context, 
      // but for now we'll just call the service.
      // In a real app, we'd pass the last scene ID to Gemini.
      const parsedScenes = await parseScriptToScenes(script);
      
      if (continueFrom) {
        setScenes(prev => [...prev, ...parsedScenes.map(s => ({ ...s, id: prev.length + s.id }))]);
      } else {
        setScenes(parsedScenes);
      }
      
      addLog(`Analysis batch complete. Total scenes: ${scenes.length + parsedScenes.length}.`);
    } catch (error) {
      addLog(`Error: Failed to analyze script.`);
      console.error(error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateScene = (id: number, field: keyof Scene, value: string) => {
    setScenes(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const generateOne = async (sceneId: number) => {
    if (stopSignal.current) return;
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;

    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, status: 'generating' } : s));
    addLog(`Generating image for Scene ${sceneId}...`);

    try {
      const imageUrl = await generateSceneImage(scene.prompt);
      setScenes(prev => prev.map(s => s.id === sceneId ? { 
        ...s, 
        status: 'completed', 
        imageUrl 
      } : s));
      addLog(`Scene ${sceneId} completed.`);
    } catch (error) {
      setScenes(prev => prev.map(s => s.id === sceneId ? { 
        ...s, 
        status: 'failed', 
        error: 'Generation failed' 
      } : s));
      addLog(`Error: Scene ${sceneId} failed.`);
    }
  };

  const generateAll = async () => {
    if (scenes.length === 0) return;
    setIsGeneratingAll(true);
    stopSignal.current = false;
    addLog(`Starting sequential generation for ${scenes.length} scenes...`);
    
    for (const scene of scenes) {
      if (stopSignal.current) {
        addLog("Generation process stopped by user.");
        break;
      }
      if (scene.status === 'completed') continue;
      await generateOne(scene.id);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    setIsGeneratingAll(false);
    addLog("Generation queue finished.");
  };

  const handleFullStart = async () => {
    if (!script.trim()) return;
    setIsAnalyzing(true);
    stopSignal.current = false;
    addLog("FULL AUTOMATION STARTED: Analyzing script...");
    try {
      const parsedScenes = await parseScriptToScenes(script);
      setScenes(parsedScenes);
      addLog(`Analysis complete. ${parsedScenes.length} scenes queued.`);
      setIsAnalyzing(false);
      
      if (stopSignal.current) {
        addLog("Process stopped after analysis.");
        return;
      }

      setIsGeneratingAll(true);
      addLog("Auto-starting generation queue...");
      for (const scene of parsedScenes) {
        if (stopSignal.current) {
          addLog("Generation process stopped by user.");
          break;
        }
        await generateOne(scene.id);
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      setIsGeneratingAll(false);
      addLog("Full automation process complete.");
    } catch (error) {
      addLog(`Error during full automation.`);
      setIsAnalyzing(false);
      setIsGeneratingAll(false);
    }
  };

  const stopProcess = () => {
    stopSignal.current = true;
    addLog("Stopping process... (Wait for current task to finish)");
  };

  const downloadImage = (scene: Scene) => {
    if (!scene.imageUrl) return;
    const link = document.createElement('a');
    link.href = scene.imageUrl;
    const subject = scene.prompt.split(',')[0].replace(/\s+/g, '_').substring(0, 20);
    link.download = `TBS_Scene_${scene.id}_${subject}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAll = async () => {
    const completedScenes = scenes.filter(s => s.status === 'completed' && s.imageUrl);
    if (completedScenes.length === 0) {
      addLog("No completed images to download.");
      return;
    }
    
    addLog(`Starting batch download of ${completedScenes.length} images...`);
    for (const scene of completedScenes) {
      downloadImage(scene);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    addLog("Batch download complete.");
  };

  const copyCSV = () => {
    const csv = scenes.map(s => `${s.id}|${s.originalText.replace(/\|/g, ' ')}|${s.prompt.replace(/\|/g, ' ')}`).join('\n');
    navigator.clipboard.writeText(csv);
    addLog("CSV copied to clipboard.");
  };

  const clearAll = () => {
    setScript('');
    setScenes([]);
    setLogs([]);
    stopSignal.current = false;
  };

  return (
    <div className="min-h-screen bg-noir-bg text-noir-ink selection:bg-noir-accent/30">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] bg-[radial-gradient(circle_at_50%_50%,#fff,transparent)]" />
        <div className="scanline" />
      </div>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-12 lg:py-24">
        {/* Header Section */}
        <header className="mb-16 space-y-4">
          <div className="flex items-center gap-3 text-noir-accent mb-2">
            <Layers size={20} />
            <span className="text-xs font-mono tracking-[0.3em] uppercase">The Black Studio</span>
          </div>
          <h1 className="text-7xl md:text-9xl font-serif font-light tracking-tighter leading-[0.85]">
            STORYBOARDER <br />
            <span className="italic opacity-50">Automater</span>
          </h1>
          <p className="max-w-xl text-noir-muted text-lg font-light leading-relaxed">
            High-density cinematic storyboarding. Generate 50+ Noir Minimalism scenes with automated animation and sound design directions.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Left Column: Input & Controls */}
          <div className="lg:col-span-4 space-y-8">
            <section className="space-y-4 sticky top-12">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono uppercase tracking-widest text-noir-muted flex items-center gap-2">
                  <FileText size={14} /> Narrative Script
                </label>
                <button 
                  onClick={clearAll}
                  className="text-xs font-mono uppercase tracking-widest text-noir-muted hover:text-white transition-colors flex items-center gap-2"
                >
                  <Trash2 size={14} /> Clear
                </button>
              </div>
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="Paste your long narrative script here for a 50+ scene storyboard..."
                className="w-full h-80 bg-white/[0.02] border border-noir-border rounded-lg p-6 font-light text-lg focus:outline-none focus:border-white/30 transition-all resize-none placeholder:text-white/10"
              />
              
              <div className="grid grid-cols-1 gap-3">
                {(isAnalyzing || isGeneratingAll) ? (
                  <button
                    onClick={stopProcess}
                    className="w-full py-5 bg-red-900/50 border border-red-500/50 text-white font-mono uppercase tracking-[0.2em] text-sm hover:bg-red-800 transition-all flex items-center justify-center gap-3 shadow-2xl"
                  >
                    <Square size={20} fill="currentColor" />
                    <span>Stop Process</span>
                  </button>
                ) : (
                  <button
                    onClick={handleFullStart}
                    disabled={!script.trim()}
                    className="w-full py-5 bg-noir-accent text-white font-mono uppercase tracking-[0.2em] text-sm hover:brightness-110 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1 shadow-2xl shadow-noir-accent/20"
                  >
                    <div className="flex items-center gap-3">
                      <Play size={20} fill="currentColor" />
                      <span>Start Full Automation</span>
                    </div>
                    <span className="text-[9px] opacity-60">Analyze + Generate 50+ Scenes</span>
                  </button>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleAnalyze()}
                    disabled={isAnalyzing || isGeneratingAll || !script.trim()}
                    className="py-3 border border-white/10 text-white/60 font-mono uppercase tracking-widest text-[10px] hover:bg-white/5 transition-all disabled:opacity-30"
                  >
                    Analyze Only
                  </button>
                  <button
                    onClick={generateAll}
                    disabled={isAnalyzing || isGeneratingAll || scenes.length === 0}
                    className="py-3 border border-white/10 text-white/60 font-mono uppercase tracking-widest text-[10px] hover:bg-white/5 transition-all disabled:opacity-30"
                  >
                    Generate Queue
                  </button>
                </div>

                {scenes.length > 0 && scenes.length < 50 && (
                  <button
                    onClick={() => handleAnalyze(scenes.length + 1)}
                    disabled={isAnalyzing || isGeneratingAll}
                    className="w-full py-3 border border-dashed border-white/20 text-white/40 font-mono uppercase tracking-widest text-[10px] hover:text-white hover:border-white/40 transition-all flex items-center justify-center gap-2"
                  >
                    <PlusCircle size={14} />
                    Continue from Scene {scenes.length + 1}
                  </button>
                )}

                {scenes.some(s => s.status === 'completed') && (
                  <button
                    onClick={downloadAll}
                    className="w-full py-3 bg-white/10 border border-white/20 text-white font-mono uppercase tracking-widest text-[10px] hover:bg-white hover:text-black transition-all flex items-center justify-center gap-2"
                  >
                    <Download size={14} />
                    Download All Images
                  </button>
                )}
              </div>

              {/* Console */}
              <div className="space-y-2 pt-4">
                <label className="text-xs font-mono uppercase tracking-widest text-noir-muted flex items-center gap-2">
                  <Terminal size={14} /> System Console
                </label>
                <div className="h-40 bg-black border border-noir-border rounded-lg p-4 font-mono text-[9px] overflow-y-auto scrollbar-hide space-y-1 opacity-60">
                  {logs.length === 0 && <div className="text-white/20 italic">System ready...</div>}
                  {logs.map((log, i) => (
                    <div key={i} className="text-white/50 border-l border-white/10 pl-2">
                      {log}
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              </div>
            </section>
          </div>

          {/* Right Column: Storyboard List */}
          <div className="lg:col-span-8 space-y-8">
            <div className="flex items-center justify-between border-b border-noir-border pb-4">
              <div className="flex items-center gap-6">
                <h2 className="text-xs font-mono uppercase tracking-widest text-noir-muted">
                  Pipeline {scenes.length > 0 && `// ${scenes.length} Scenes`}
                </h2>
                <div className="flex bg-white/5 rounded-full p-1 border border-white/10">
                  <button 
                    onClick={() => setViewMode('cards')}
                    className={`px-3 py-1 rounded-full text-[9px] font-mono uppercase tracking-widest transition-all ${viewMode === 'cards' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
                  >
                    Cards
                  </button>
                  <button 
                    onClick={() => setViewMode('table')}
                    className={`px-3 py-1 rounded-full text-[9px] font-mono uppercase tracking-widest transition-all ${viewMode === 'table' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
                  >
                    Table
                  </button>
                  <button 
                    onClick={() => setViewMode('csv')}
                    className={`px-3 py-1 rounded-full text-[9px] font-mono uppercase tracking-widest transition-all ${viewMode === 'csv' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
                  >
                    CSV
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-4 text-[10px] font-mono uppercase tracking-widest text-noir-muted">
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-noir-accent animate-pulse" /> Live</span>
              </div>
            </div>

            <div className="space-y-12">
              <AnimatePresence mode="wait">
                {scenes.length === 0 ? (
                  <motion.div 
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-[60vh] border border-dashed border-noir-border rounded-lg flex flex-col items-center justify-center text-noir-muted space-y-4"
                  >
                    <Layers size={48} strokeWidth={1} className="opacity-20" />
                    <p className="font-light italic text-center max-w-xs">Enter your script and click "Start Full Automation" to populate the storyboard.</p>
                  </motion.div>
                ) : viewMode === 'cards' ? (
                  <motion.div key="cards" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-12">
                    {scenes.map((scene, index) => (
                      <motion.div
                        key={scene.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(index * 0.05, 1) }}
                        className="relative grid grid-cols-1 md:grid-cols-12 gap-8 group"
                      >
                        {/* Scene Numbering */}
                        <div className="md:col-span-1 flex flex-col items-center">
                          <span className="text-5xl font-serif italic opacity-10 group-hover:opacity-30 transition-opacity">
                            {String(scene.id).padStart(2, '0')}
                          </span>
                          <div className="w-px flex-1 bg-gradient-to-b from-white/20 to-transparent mt-4" />
                        </div>

                        {/* Content Area */}
                        <div className="md:col-span-11 space-y-6">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Visuals & Prompt */}
                            <div className="space-y-4">
                              <div className="aspect-video bg-black border border-noir-border rounded-lg overflow-hidden relative shadow-2xl">
                                {scene.imageUrl ? (
                                  <img 
                                    src={scene.imageUrl} 
                                    alt={`Scene ${scene.id}`} 
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-zinc-950">
                                    {scene.status === 'generating' ? (
                                      <div className="flex flex-col items-center gap-3">
                                        <Loader2 className="animate-spin text-noir-accent" size={32} />
                                        <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-noir-accent">Synthesizing Frame...</span>
                                      </div>
                                    ) : (
                                      <ImageIcon size={32} className="opacity-5" />
                                    )}
                                  </div>
                                )}
                                
                                <div className="absolute top-4 right-4 flex gap-2">
                                  {scene.status === 'completed' && (
                                    <button 
                                      onClick={() => downloadImage(scene)}
                                      className="p-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-full hover:bg-white hover:text-black transition-all"
                                    >
                                      <Download size={14} />
                                    </button>
                                  )}
                                  {scene.status === 'failed' && <AlertCircle size={20} className="text-red-500" />}
                                </div>
                              </div>

                              <div className="space-y-2">
                                <label className="text-[9px] font-mono uppercase tracking-widest text-noir-muted flex items-center gap-2">
                                  <ImageIcon size={10} /> Image Prompt
                                </label>
                                <textarea
                                  value={scene.prompt}
                                  onChange={(e) => updateScene(scene.id, 'prompt', e.target.value)}
                                  className="w-full bg-white/[0.02] border border-white/5 rounded p-3 text-[11px] font-mono text-white/60 focus:outline-none focus:border-noir-accent/30 transition-all resize-none h-20"
                                />
                              </div>
                            </div>

                            {/* Storyboard Details */}
                            <div className="space-y-6">
                              <div className="space-y-2">
                                <label className="text-[9px] font-mono uppercase tracking-widest text-noir-muted flex items-center gap-2">
                                  <Video size={10} /> Animation & Motion
                                </label>
                                <textarea
                                  value={scene.animation}
                                  onChange={(e) => updateScene(scene.id, 'animation', e.target.value)}
                                  placeholder="Camera movement, subject motion..."
                                  className="w-full bg-white/[0.02] border border-white/5 rounded p-4 text-xs font-light text-white/80 focus:outline-none focus:border-noir-accent/30 transition-all resize-none h-24"
                                />
                              </div>

                              <div className="space-y-2">
                                <label className="text-[9px] font-mono uppercase tracking-widest text-noir-muted flex items-center gap-2">
                                  <Music size={10} /> Sound Effects (SFX)
                                </label>
                                <textarea
                                  value={scene.soundEffects}
                                  onChange={(e) => updateScene(scene.id, 'soundEffects', e.target.value)}
                                  placeholder="rise, drone, whoosh, swoosh..."
                                  className="w-full bg-white/[0.02] border border-white/5 rounded p-4 text-xs font-mono text-noir-accent focus:outline-none focus:border-noir-accent/30 transition-all resize-none h-24"
                                />
                              </div>

                              <div className="flex items-center justify-between pt-2">
                                <div className="text-[10px] font-mono text-noir-muted italic truncate max-w-[200px]">
                                  "{scene.originalText.substring(0, 40)}..."
                                </div>
                                <button
                                  onClick={() => generateOne(scene.id)}
                                  disabled={scene.status === 'generating' || isGeneratingAll}
                                  className="px-4 py-2 bg-white/5 border border-white/10 rounded font-mono text-[9px] uppercase tracking-widest hover:bg-white hover:text-black transition-all disabled:opacity-30"
                                >
                                  {scene.status === 'completed' ? 'Regenerate' : 'Generate Frame'}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                ) : viewMode === 'table' ? (
                  <motion.div key="table" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="border-b border-white/10 text-[10px] font-mono uppercase tracking-widest text-noir-muted">
                          <th className="py-4 px-4 w-16">Scene #</th>
                          <th className="py-4 px-4 w-1/3">Script Context</th>
                          <th className="py-4 px-4">Visual Prompt</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs font-light">
                        {scenes.map((scene) => (
                          <tr key={scene.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                            <td className="py-4 px-4 font-mono opacity-40">{scene.id}</td>
                            <td className="py-4 px-4 text-white/60 italic leading-relaxed">{scene.originalText}</td>
                            <td className="py-4 px-4 font-mono text-[10px] text-noir-accent/80">{scene.prompt}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </motion.div>
                ) : (
                  <motion.div key="csv" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-mono uppercase tracking-widest text-noir-muted">Raw CSV Backup (Delimiter: |)</label>
                      <button 
                        onClick={copyCSV}
                        className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-noir-accent hover:underline"
                      >
                        <Copy size={12} /> Copy to Clipboard
                      </button>
                    </div>
                    <div className="bg-black border border-white/10 rounded-lg p-6 font-mono text-[11px] text-white/40 overflow-x-auto whitespace-pre leading-relaxed">
                      {scenes.map(s => `${s.id}|${s.originalText.replace(/\|/g, ' ')}|${s.prompt.replace(/\|/g, ' ')}`).join('\n')}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-noir-border py-12 mt-24">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8 opacity-30">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full border border-white flex items-center justify-center font-serif italic">T</div>
            <span className="text-xs font-mono uppercase tracking-[0.4em]">The Black Studio</span>
          </div>
          <div className="text-[10px] font-mono uppercase tracking-widest">
            &copy; 2026 Storyboarder v2.2.0 // High-Density Automation
          </div>
        </div>
      </footer>
    </div>
  );
}

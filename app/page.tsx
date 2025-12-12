"use client";

import { useState, useRef } from "react";
import { Loader2, AlertCircle, Download, RefreshCw } from "lucide-react";
import html2canvas from 'html2canvas';

interface Panel {
  panel_number: number;
  image_prompt: string;
  dialogue: string;
  caption: string;
  image_url?: string;
  status?: 'pending' | 'generating' | 'completed' | 'failed';
}

interface ComicStory {
  title: string;
  style_description?: string;
  panels: Panel[];
}

function ComicImagePanel({ panel }: { panel: Panel }) {
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [imageHasError, setImageHasError] = useState(false);

  // Determine effective state
  const isGenerating = panel.status === 'generating';
  const isPending = panel.status === 'pending';
  const isFailed = panel.status === 'failed';
  const isCompleted = panel.status === 'completed';

  // We are "loading" if generating OR (completed but image still loading)
  // However, we only show the skeleton if we are actively working on it.
  const showLoading = isGenerating || (isCompleted && isImageLoading && !imageHasError);
  
  // Show error if API failed OR image load failed
  const showError = isFailed || (isCompleted && imageHasError);

  // Reset loading state when url changes (if multiple generations were possible, but here it's linear)
  // We don't need an effect because the key={idx} in the parent loop ensures a fresh component if we re-render list? 
  // No, key is index. If we regenerate, we might reuse component. 
  // But here we generate once.

  return (
    <div className="flex-grow relative w-full h-full overflow-hidden bg-gray-100">
      
      {/* 1. Loaded Image */}
      {isCompleted && panel.image_url && !imageHasError && (
        <img 
          src={panel.image_url} 
          alt={panel.image_prompt} 
          className={`w-full h-full object-cover transition-opacity duration-500 ${isImageLoading ? 'opacity-0' : 'opacity-100'}`}
          onLoad={() => setIsImageLoading(false)}
          onError={() => {
            setImageHasError(true);
            setIsImageLoading(false);
          }}
        />
      )}

      {/* 2. Loading State (Skeleton) */}
      {showLoading && (
        <div className="absolute inset-0 bg-gray-300 animate-pulse flex flex-col items-center justify-center text-center p-4">
          <p className="font-comic font-bold text-gray-500 text-xl tracking-widest animate-bounce">
            DRAWING...
          </p>
          <p className="font-comic text-xs text-gray-400 mt-2 px-4 line-clamp-2 max-w-full">
            {panel.image_prompt}
          </p>
        </div>
      )}

      {/* 3. Error State */}
      {showError && (
        <div className="absolute inset-0 bg-red-900 flex flex-col items-center justify-center p-4 border-4 border-red-950">
           <AlertCircle className="w-12 h-12 text-red-500 mb-2" />
           <p className="font-comic font-bold text-red-500 uppercase text-lg tracking-widest">
             TRANSMISSION FAILED!
           </p>
        </div>
      )}

      {/* 4. Pending State (Waiting) */}
      {isPending && (
         <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 p-4">
            <p className="font-comic text-gray-400 text-sm mb-2">WAITING...</p>
         </div>
      )}

      {/* Overlays: Caption & Dialogue (Always visible unless failed? User said "overlay correctly on top of the loaded image") */}
      {!showError && !isPending && (
        <>
          {panel.caption && (
            <div className="caption-box">
              {panel.caption}
            </div>
          )}
          {panel.dialogue && (
            <div className="speech-bubble bottom-4 right-4 max-w-[80%]">
              {panel.dialogue}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function Home() {
  const [step, setStep] = useState<"input" | "generating-story" | "generating-images" | "completed">("input");
  const [inputs, setInputs] = useState({
    hero: "",
    villain: "",
    location: "",
  });
  const [story, setStory] = useState<ComicStory | null>(null);
  const [currentPanelIndex, setCurrentPanelIndex] = useState(0);
  const comicRef = useRef<HTMLDivElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputs({ ...inputs, [e.target.name]: e.target.value });
  };

  const handleDownload = async () => {
    if (!comicRef.current) return;
    
    try {
      const canvas = await html2canvas(comicRef.current, {
        useCORS: true, // Important for external images (Pollinations)
        scale: 2, // Better quality
        backgroundColor: '#ffffff',
      });
      
      const link = document.createElement('a');
      link.download = `${story?.title.replace(/\s+/g, '-').toLowerCase() || 'comic'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error("Failed to download comic:", err);
      alert("Failed to download comic. Please try again.");
    }
  };

  const handleReset = () => {
    setStory(null);
    setInputs({ hero: "", villain: "", location: "" });
    setStep("input");
    setCurrentPanelIndex(0);
  };

  const generateComic = async () => {
    if (!inputs.hero || !inputs.villain || !inputs.location) return;

    setStep("generating-story");
    try {
      // Step 1: Generate Story
      const storyRes = await fetch("/api/generate-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inputs),
      });

      if (!storyRes.ok) throw new Error("Failed to generate story");
      const storyData: ComicStory = await storyRes.json();
      setStory(storyData);
      
      // Step 2: Generate Images (Client-side orchestration)
      setStep("generating-images");
      const newPanels = storyData.panels.map(p => ({ ...p, status: 'pending' as const }));
      setStory({ ...storyData, panels: newPanels });

      // Process panels sequentially
      for (let i = 0; i < newPanels.length; i++) {
        setCurrentPanelIndex(i + 1);
        
        // Update status to generating
        newPanels[i].status = 'generating';
        setStory({ ...storyData, panels: [...newPanels] });

        try {
          const imageRes = await fetch("/api/generate-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: newPanels[i].image_prompt }),
          });
          
          if (imageRes.ok) {
            const imageData = await imageRes.json();
            newPanels[i].image_url = imageData.url;
            newPanels[i].status = 'completed';
          } else {
             console.error(`Failed to generate image for panel ${i+1}`);
             newPanels[i].status = 'failed';
          }
        } catch (err) {
          console.error(err);
          newPanels[i].status = 'failed';
        }
        
        // Update state with result
        setStory({ ...storyData, panels: [...newPanels] });
      }
      
      setStep("completed");

    } catch (error) {
      console.error(error);
      alert("Something went wrong. Please try again.");
      setStep("input");
    }
  };

    const getPanelClassName = (index: number) => {
    const baseClasses = "comic-panel relative overflow-hidden flex flex-col transition-all duration-300 hover:scale-[1.01] bg-white";
    
    // Default mobile layout (all square/standard) overridden by md: styles for the bento layout
    switch(index) {
      case 0: // Hero: Top Left (2x2)
        return `${baseClasses} md:col-span-2 md:row-span-2 min-h-[400px]`;
      case 1: // Stack 1: Top Right
        return `${baseClasses} md:col-span-1 md:row-span-1 min-h-[200px]`;
      case 2: // Stack 2: Middle Right
        return `${baseClasses} md:col-span-1 md:row-span-1 min-h-[200px]`;
      case 3: // Panoramic: Full Width
        return `${baseClasses} md:col-span-3 md:row-span-1 aspect-[2.5/1]`;
      case 4: 
        return `${baseClasses} md:col-span-1 md:row-span-1 aspect-square`;
      case 5:
        return `${baseClasses} md:col-span-1 md:row-span-1 aspect-square`;
      case 6:
        return `${baseClasses} md:col-span-1 md:row-span-1 aspect-square`;
      case 7: // Wide
        return `${baseClasses} md:col-span-2 md:row-span-1 aspect-[2/1]`;
      case 8:
        return `${baseClasses} md:col-span-1 md:row-span-1 aspect-square`;
      case 9: // Footer
        return `${baseClasses} md:col-span-3 md:row-span-1 aspect-[3/1]`;
      default:
        return `${baseClasses} md:col-span-1 md:row-span-1 aspect-square`;
    }
  };

  return (
    <main className="min-h-screen p-4 md:p-8 bg-gray-100 flex flex-col items-center">
      <h1 className="text-4xl font-bold mb-8 font-comic uppercase tracking-wider text-gray-900 drop-shadow-[2px_2px_0_rgba(255,255,255,1)]">
        Comic Generator
      </h1>

      {step === "input" && (
        <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-xl border-2 border-black">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-2">Hero Name</label>
              <input
                name="hero"
                value={inputs.hero}
                onChange={handleInputChange}
                className="w-full p-2 border-2 border-black rounded focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-gray-700 text-white placeholder-gray-400"
                placeholder="e.g. Captain Code"
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">Villain Name</label>
              <input
                name="villain"
                value={inputs.villain}
                onChange={handleInputChange}
                className="w-full p-2 border-2 border-black rounded focus:outline-none focus:ring-2 focus:ring-red-400 bg-gray-700 text-white placeholder-gray-400"
                placeholder="e.g. The Bug"
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">Fight Location</label>
              <input
                name="location"
                value={inputs.location}
                onChange={handleInputChange}
                className="w-full p-2 border-2 border-black rounded focus:outline-none focus:ring-2 focus:ring-gray-400 bg-gray-700 text-white placeholder-gray-400"
                placeholder="e.g. Silicon Valley Server Room"
              />
            </div>
            <button
              onClick={generateComic}
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-3 px-4 rounded border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-none transition-all"
            >
              GENERATE COMIC
            </button>
          </div>
        </div>
      )}

      {step === "generating-story" && (
        <div className="text-center mt-20">
          <Loader2 className="h-16 w-16 animate-spin mx-auto mb-4 text-black" />
          <h2 className="text-2xl font-bold font-comic">
            Writing the script...
          </h2>
        </div>
      )}

      {(step === "generating-images" || step === "completed") && story && (
        <div className="w-full max-w-5xl mt-8">
          <div ref={comicRef} className="p-6 md:p-12 bg-white border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
             <h2 className="text-4xl font-bold text-center mb-12 font-comic uppercase tracking-widest underline decoration-wavy decoration-yellow-400">
               {story.title}
             </h2>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-fr">
               {story.panels.map((panel, idx) => (
                 <div key={idx} className={getPanelClassName(idx)}>
                   <ComicImagePanel panel={panel} />
                   
                   {/* Status Footer for clarity during generation */}
                   {step === 'generating-images' && (
                      <div className="bg-black text-white text-xs p-1 text-center font-mono">
                        {panel.status?.toUpperCase() || 'PENDING'}
                      </div>
                   )}
                 </div>
               ))}
             </div>
          </div>
          
          {step === "completed" && (
            <div className="mt-8 flex flex-col md:flex-row gap-4 justify-center">
               <button
                 onClick={handleDownload}
                 className="flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-3 px-8 rounded border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-none transition-all"
               >
                 <Download className="w-5 h-5" />
                 DOWNLOAD COMIC
               </button>
               
               <button
                 onClick={handleReset}
                 className="flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-black font-bold py-3 px-8 rounded border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-none transition-all"
               >
                 <RefreshCw className="w-5 h-5" />
                 GENERATE NEW COMIC
               </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}


"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

interface Panel {
  panel_number: number;
  image_prompt: string;
  dialogue: string;
  caption: string;
  image_url?: string;
}

interface ComicStory {
  title: string;
  style_description?: string;
  panels: Panel[];
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputs({ ...inputs, [e.target.name]: e.target.value });
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
      const newPanels = [...storyData.panels];
      
      for (let i = 0; i < newPanels.length; i++) {
        setCurrentPanelIndex(i + 1);
        const panel = newPanels[i];
        
        try {
          const imageRes = await fetch("/api/generate-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: panel.image_prompt }),
          });
          
          if (imageRes.ok) {
            const imageData = await imageRes.json();
            newPanels[i].image_url = imageData.url;
            // Update state incrementally to show progress
            setStory({ ...storyData, panels: [...newPanels] });
          } else {
             console.error(`Failed to generate image for panel ${i+1}`);
          }
        } catch (err) {
          console.error(err);
        }
      }
      
      setStep("completed");

    } catch (error) {
      console.error(error);
      alert("Something went wrong. Please try again.");
      setStep("input");
    }
  };

  return (
    <main className="min-h-screen p-8 bg-gray-50 flex flex-col items-center">
      <h1 className="text-4xl font-bold mb-8 font-comic uppercase tracking-wider text-gray-900">
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
                className="w-full p-2 border-2 border-black rounded focus:outline-none focus:ring-2 focus:ring-yellow-400"
                placeholder="e.g. Captain Code"
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">Villain Name</label>
              <input
                name="villain"
                value={inputs.villain}
                onChange={handleInputChange}
                className="w-full p-2 border-2 border-black rounded focus:outline-none focus:ring-2 focus:ring-red-400"
                placeholder="e.g. The Bug"
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">Fight Location</label>
              <input
                name="location"
                value={inputs.location}
                onChange={handleInputChange}
                className="w-full p-2 border-2 border-black rounded focus:outline-none focus:ring-2 focus:ring-gray-400"
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

      {(step === "generating-story" || step === "generating-images") && (
        <div className="text-center mt-20">
          <Loader2 className="h-16 w-16 animate-spin mx-auto mb-4 text-black" />
          <h2 className="text-2xl font-bold font-comic">
            {step === "generating-story" ? "Writing the script..." : `Drawing Panel ${currentPanelIndex} of 10...`}
          </h2>
          {story && (
             <div className="mt-8 grid grid-cols-2 md:grid-cols-5 gap-4 opacity-50">
               {story.panels.map((p, i) => (
                 <div key={i} className={`aspect-square border-2 border-black bg-gray-200 ${p.image_url ? 'bg-green-200' : ''}`}>
                 </div>
               ))}
             </div>
          )}
        </div>
      )}

      {(step === "completed" || (step === "generating-images" && story)) && (
        <div className="w-full max-w-6xl mt-8">
          {story && (
             <>
               <h2 className="text-3xl font-bold text-center mb-8 font-comic uppercase underline decoration-wavy decoration-yellow-400">
                 {story.title}
               </h2>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                 {story.panels.map((panel, idx) => (
                   <div key={idx} className="comic-panel relative aspect-[2/3] bg-white overflow-hidden">
                     {panel.image_url ? (
                       <img src={panel.image_url} alt={panel.image_prompt} className="w-full h-full object-cover" />
                     ) : (
                       <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                         Pending...
                       </div>
                     )}
                     
                     {/* Caption */}
                     {panel.caption && (
                       <div className="caption-box">
                         {panel.caption}
                       </div>
                     )}
                     
                     {/* Dialogue - Naive positioning for now */}
                     {panel.dialogue && (
                       <div className="speech-bubble bottom-4 right-4 max-w-[80%]">
                         {panel.dialogue}
                       </div>
                     )}
                   </div>
                 ))}
               </div>
             </>
          )}
        </div>
      )}
    </main>
  );
}


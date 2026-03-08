
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Scene } from "../types";

const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyDXi9FXJZ0R9kFhn2j_UsVrt9iLEc3P0Ac";
const ai = new GoogleGenAI({ apiKey: API_KEY });

export const parseScriptToScenes = async (script: string): Promise<Scene[]> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `STRICT TASK: Analyze the provided script and break it down into EXACTLY 50 sequential scenes (or as close as possible for high density). 
    
    For each scene, generate a detailed image generation prompt following the 'Noir Minimalism' style.
    
    STYLE GUIDE (Noir Minimalism):
    - Subject: Roman Marble Statues (Augustus, David, Marble fragments, busts).
    - Lighting: Cinematic Chiaroscuro, dramatic side-lighting, deep shadows.
    - Background: Pitch black, void-like, zero distractions.
    - Composition: Rule of Thirds, heavy use of negative space.
    - Quality: Hyper-realistic marble texture, 8k, cinematic.
    
    IMAGE PROMPT FORMULA: "[Specific Subject Action/Pose], Roman Marble Statue, Noir Minimalism, Pitch Black Background, Rule of Thirds, Cinematic Chiaroscuro, 8k resolution --ar 16:9"
    
    ANIMATION GUIDE: Focus on slow camera pans, tilts, and subtle marble cracks or dust particles.
    
    SFX GUIDE: Use ONLY widely used cinematic keywords (e.g., rise, drone, whoosh, swoosh, impact, cinematic hit, ambient).
    
    Script: ${script}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.INTEGER },
            originalText: { type: Type.STRING, description: "The part of the script this scene covers" },
            prompt: { type: Type.STRING, description: "The generated image prompt following the Noir Minimalism formula" },
            animation: { type: Type.STRING, description: "Detailed animation/camera movement directions" },
            soundEffects: { type: Type.STRING, description: "Sound effects keywords (e.g., rise, drone)" }
          },
          required: ["id", "originalText", "prompt", "animation", "soundEffects"]
        }
      }
    }
  });

  try {
    const scenes = JSON.parse(response.text || "[]");
    return scenes.map((s: any) => ({
      ...s,
      status: 'pending'
    }));
  } catch (e) {
    console.error("Failed to parse scenes", e);
    return [];
  }
};

export const generateSceneImage = async (prompt: string): Promise<string> => {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          text: prompt,
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: "16:9",
      },
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  
  throw new Error("No image data returned from Gemini");
};

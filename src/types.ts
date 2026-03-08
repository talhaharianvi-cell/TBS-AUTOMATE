
export interface Scene {
  id: number;
  originalText: string;
  prompt: string;
  animation: string;
  soundEffects: string;
  imageUrl?: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  error?: string;
}

export interface AppState {
  script: string;
  scenes: Scene[];
  isAnalyzing: boolean;
  isGeneratingAll: boolean;
}

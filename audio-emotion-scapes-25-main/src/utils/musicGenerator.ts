import * as Tone from 'tone';
import { type Mood } from '@/components/MoodSelector';
import { type AudioFeatures } from './audioAnalyzer';
import type { MusicSettings } from '@/components/MusicCustomizer';

// Configure scales for different moods
const scales: Record<Mood, string[]> = {
  happy: ['C4', 'D4', 'E4', 'G4', 'A4', 'C5'],     // Major pentatonic
  calm: ['D4', 'F4', 'G4', 'A4', 'C5', 'D5'],      // D minor pentatonic
  energetic: ['E4', 'F#4', 'G#4', 'B4', 'C#5', 'E5'], // E major pentatonic
  sad: ['A3', 'C4', 'D4', 'E4', 'G4', 'A4'],       // A minor pentatonic
  angry: ['E4', 'F4', 'G#4', 'B4', 'D5', 'E5'],    // E phrygian dominant
};

// Extended scales for more complexity
const extendedScales: Record<Mood, string[]> = {
  happy: ['C3', 'D3', 'E3', 'G3', 'A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5'],
  calm: ['D3', 'F3', 'G3', 'A3', 'C4', 'D4', 'F4', 'G4', 'A4', 'C5', 'D5', 'F5'],
  energetic: ['E3', 'F#3', 'G#3', 'B3', 'C#4', 'E4', 'F#4', 'G#4', 'B4', 'C#5', 'E5', 'F#5'],
  sad: ['A2', 'C3', 'D3', 'E3', 'G3', 'A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5'],
  angry: ['E3', 'F3', 'G#3', 'B3', 'D4', 'E4', 'F4', 'G#4', 'B4', 'D5', 'E5', 'F5'],
};

// Genre-specific chord progressions
const chordProgressions: Record<string, string[][]> = {
  ambient: [
    ['Dmaj7', 'Amaj9', 'Em7', 'Cmaj7'],
    ['Am7', 'Fmaj7', 'G6', 'Em7']
  ],
  electronic: [
    ['Cm7', 'Ab', 'Eb', 'Bb'],
    ['F#m7', 'E', 'D', 'A']
  ],
  classical: [
    ['C', 'G', 'Am', 'F'],
    ['Dm', 'G7', 'C', 'Am']
  ],
  jazz: [
    ['Dm7', 'G7', 'Cmaj7', 'A7'],
    ['Bm7b5', 'E7', 'Am', 'D7']
  ],
  pop: [
    ['C', 'G', 'Am', 'F'],
    ['F', 'Bb', 'C', 'F']
  ]
};

// Tone settings for different moods
interface ToneSettings {
  waveform: Tone.ToneOscillatorType;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  filterFreq: number;
  filterRes: number;
  effectsLevel: number;
}

// Define tone settings for each mood
const toneSettings: Record<Mood, ToneSettings> = {
  happy: {
    waveform: 'triangle',
    attack: 0.05,
    decay: 0.2,
    sustain: 0.5,
    release: 1.5,
    filterFreq: 2000,
    filterRes: 1,
    effectsLevel: 0.3
  },
  calm: {
    waveform: 'sine',
    attack: 0.1,
    decay: 0.3,
    sustain: 0.7,
    release: 3,
    filterFreq: 1000,
    filterRes: 0.5,
    effectsLevel: 0.5
  },
  energetic: {
    waveform: 'sawtooth',
    attack: 0.02,
    decay: 0.1,
    sustain: 0.4,
    release: 0.8,
    filterFreq: 3000,
    filterRes: 2,
    effectsLevel: 0.6
  },
  sad: {
    waveform: 'sine',
    attack: 0.2,
    decay: 0.5,
    sustain: 0.6,
    release: 4,
    filterFreq: 800,
    filterRes: 1,
    effectsLevel: 0.7
  },
  angry: {
    waveform: 'square',
    attack: 0.01,
    decay: 0.1,
    sustain: 0.3,
    release: 0.6,
    filterFreq: 4000,
    filterRes: 4,
    effectsLevel: 0.8
  }
};

// Rhythm patterns for different moods
const rhythmPatterns: Record<Mood, number[]> = {
  happy: [1, 0, 0.7, 0, 1, 0, 0.7, 0],
  calm: [1, 0, 0, 0.5, 0, 0.7, 0, 0],
  energetic: [1, 0.5, 1, 0.5, 1, 0.7, 1, 0.5],
  sad: [1, 0, 0, 0, 0.7, 0, 0, 0],
  angry: [1, 0.8, 0.4, 0.8, 1, 0.6, 0.4, 0.8]
};

// Complex rhythms for various genres and complexity levels
const complexRhythms: Record<string, number[][]> = {
  ambient: [
    [1, 0, 0, 0, 0.7, 0, 0, 0, 1, 0, 0, 0, 0.5, 0, 0, 0], // more sparse
    [1, 0, 0.3, 0, 0.7, 0, 0.4, 0, 0.8, 0, 0.3, 0, 0.6, 0, 0.2, 0] // more notes
  ],
  electronic: [
    [1, 0, 0.6, 0, 1, 0, 0.6, 0, 0.8, 0, 0.6, 0, 1, 0, 0.7, 0],
    [1, 0.5, 0.7, 0.5, 1, 0.6, 0.8, 0.4, 0.9, 0.5, 0.7, 0.6, 1, 0.5, 0.8, 0.7]
  ],
  classical: [
    [1, 0, 0.8, 0, 0.6, 0, 0.8, 0, 0.7, 0, 0.6, 0, 0.9, 0, 0.7, 0],
    [1, 0.5, 0.8, 0.3, 0.7, 0.4, 0.9, 0.2, 0.8, 0.6, 0.7, 0.4, 1, 0.5, 0.8, 0.3]
  ],
  jazz: [
    [0.9, 0, 0.7, 0.3, 0.8, 0, 0.6, 0.4, 1, 0, 0.7, 0.3, 0.8, 0, 0.5, 0],
    [0.9, 0.4, 0.7, 0.5, 0.8, 0.3, 0.6, 0.7, 1, 0.5, 0.7, 0.6, 0.8, 0.4, 0.5, 0.7]
  ],
  pop: [
    [1, 0, 0.7, 0, 1, 0, 0.7, 0, 1, 0, 0.7, 0, 1, 0, 0.8, 0],
    [1, 0.5, 0.7, 0.3, 1, 0.6, 0.7, 0.4, 1, 0.5, 0.7, 0.3, 1, 0.6, 0.8, 0.5]
  ]
};

// Main instruments and effects
let synth: Tone.PolySynth | null = null;
let piano: Tone.Sampler | null = null;
let guitar: Tone.Sampler | null = null;
let filter: Tone.Filter | null = null;
let delay: Tone.FeedbackDelay | null = null;
let reverb: Tone.Reverb | null = null;
let bassline: Tone.MonoSynth | null = null;
let drums: Tone.Sampler | null = null;
let melodicSequence: Tone.Sequence | null = null;
let bassSequence: Tone.Sequence | null = null;
let chordSequence: Tone.Sequence | null = null;
let drumSequence: Tone.Sequence | null = null;
// Fix the type to use specific Tone.js instrument types instead of generic Instrument
let activeInstruments: (Tone.PolySynth | Tone.Sampler | Tone.MonoSynth)[] = [];
let playing = false;

/**
 * Initialize the Tone.js audio environment
 */
export const initializeTone = async (): Promise<void> => {
  try {
    await Tone.start();
    console.log("Tone.js initialized");
    
    // Create main synth
    synth = new Tone.PolySynth(Tone.Synth).toDestination();
    
    // Create piano sampler
    piano = new Tone.Sampler({
      urls: {
        C4: "C4.mp3",
        G4: "G4.mp3",
      },
      baseUrl: "https://tonejs.github.io/audio/salamander/",
      onload: () => console.log("Piano samples loaded")
    }).toDestination();
    
    // Create guitar sampler
    guitar = new Tone.Sampler({
      urls: {
        A3: "A3.mp3",
        D4: "D4.mp3",
      },
      baseUrl: "https://tonejs.github.io/audio/guitar-acoustic/",
      onload: () => console.log("Guitar samples loaded")
    }).toDestination();
    
    // Create drums sampler
    drums = new Tone.Sampler({
      urls: {
        C2: "kick.mp3",
        E2: "snare.mp3",
        G2: "hihat.mp3"
      },
      baseUrl: "https://tonejs.github.io/audio/drum-samples/CR78/",
      onload: () => console.log("Drum samples loaded")
    }).toDestination();
    
    // Create effects chain
    filter = new Tone.Filter({
      frequency: 2000,
      type: 'lowpass',
      rolloff: -12
    });
    
    delay = new Tone.FeedbackDelay({
      delayTime: 0.25,
      feedback: 0.3,
      wet: 0.2
    });
    
    reverb = new Tone.Reverb({
      decay: 3,
      preDelay: 0.01,
      wet: 0.3
    });
    
    // Create bass synth
    bassline = new Tone.MonoSynth({
      oscillator: {
        type: 'sine' as const
      },
      envelope: {
        attack: 0.1,
        decay: 0.3,
        sustain: 0.7,
        release: 0.8
      },
      filterEnvelope: {
        attack: 0.1,
        decay: 0.2,
        sustain: 0.6,
        release: 0.5,
        baseFrequency: 200,
        octaves: 2.5
      }
    }).toDestination();
    
    // Setup effects chain
    synth.connect(filter);
    filter.connect(delay);
    delay.connect(reverb);
    reverb.toDestination();
    
    console.log("Audio chain set up");
    
  } catch (error) {
    console.error("Failed to initialize Tone.js:", error);
    throw new Error("Could not initialize audio engine");
  }
};

/**
 * Stop all currently playing sequences
 */
export const stopMusic = (): void => {
  // Stop and dispose all sequences
  [melodicSequence, bassSequence, chordSequence, drumSequence].forEach(seq => {
    if (seq) {
      seq.stop();
      seq.dispose();
    }
  });
  
  melodicSequence = null;
  bassSequence = null;
  chordSequence = null;
  drumSequence = null;
  
  Tone.Transport.stop();
  playing = false;
  console.log("Music stopped");
};

/**
 * Generate music based on mood, audio features, and custom settings
 */
export const generateMusic = async (
  mood: Mood,
  audioFeatures: AudioFeatures,
  customSettings?: MusicSettings
): Promise<void> => {
  try {
    // Make sure Tone is initialized
    if (!synth || !filter || !delay || !reverb || !bassline) {
      await initializeTone();
    }
    
    // Stop any playing music
    stopMusic();
    
    // Set BPM based on tempo settings or detected tempo
    const tempo = customSettings?.tempo 
      ? customSettings.tempo > 0 
        ? customSettings.tempo 
        : (audioFeatures.tempo || 120)
      : (audioFeatures.tempo || 120);
    
    Tone.Transport.bpm.value = tempo;
    console.log(`Setting tempo to ${tempo} BPM`);
    
    // Apply the settings for the current mood
    const settings = toneSettings[mood];
    
    // Apply reverb from custom settings if available
    const reverbLevel = customSettings?.reverb !== undefined 
      ? customSettings.reverb 
      : settings.effectsLevel;
    
    // Determine complexity level
    const complexityLevel = customSettings?.complexity !== undefined 
      ? customSettings.complexity 
      : 0.5;
    
    // Select genre or default to ambient
    const genre = customSettings?.genre || 'ambient';
    
    // Set up active instruments based on custom settings
    activeInstruments = [];
    
    // Always ensure we have at least one instrument
    const instrumentsToUse = customSettings?.instruments || ['synth'];
    
    if (synth && (instrumentsToUse.includes('synth'))) {
      synth.set({
        oscillator: {
          type: settings.waveform as any
        },
        envelope: {
          attack: settings.attack,
          decay: settings.decay,
          sustain: settings.sustain,
          release: settings.release
        }
      });
      activeInstruments.push(synth);
    }
    
    if (piano && instrumentsToUse.includes('piano')) {
      activeInstruments.push(piano);
    }
    
    if (guitar && instrumentsToUse.includes('guitar')) {
      activeInstruments.push(guitar);
    }
    
    if (bassline && instrumentsToUse.includes('bass')) {
      activeInstruments.push(bassline);
    }
    
    // If no instruments were selected or available, default to synth
    if (activeInstruments.length === 0 && synth) {
      activeInstruments.push(synth);
    }
    
    if (filter) {
      // Adjust filter based on spectral content
      const filterFreq = settings.filterFreq * (1 + audioFeatures.spectralCentroid * complexityLevel);
      filter.frequency.value = filterFreq;
      filter.Q.value = settings.filterRes;
    }
    
    if (delay) {
      // Adjust delay based on energy
      delay.wet.value = settings.effectsLevel * 0.4;
      delay.feedback.value = 0.1 + (audioFeatures.energy * 0.3);
    }
    
    if (reverb) {
      // Adjust reverb based on mood and flatness
      reverb.wet.value = reverbLevel;
      reverb.decay = 1 + (audioFeatures.spectralFlatness * 4 * reverbLevel);
    }
    
    // Select scale based on complexity
    const useScale = complexityLevel > 0.6 ? extendedScales[mood] : scales[mood];
    const bassNotes = useScale
      .filter(note => parseInt(note.slice(-1)) < 4) // Get lower octave notes for bass
      .map(note => note.replace(/[0-9]/, '2')); // Drop bass notes to octave 2
    
    // Use more complex rhythm patterns based on complexity level
    let rhythmBase: number[];
    if (complexityLevel > 0.7) {
      // Use more complex rhythm from genre
      rhythmBase = complexRhythms[genre][1] || rhythmPatterns[mood];
    } else if (complexityLevel > 0.4) {
      // Use simpler complex rhythm from genre
      rhythmBase = complexRhythms[genre][0] || rhythmPatterns[mood];
    } else {
      // Use basic mood rhythm
      rhythmBase = rhythmPatterns[mood];
    }
    
    // Adjust rhythm pattern based on energy and complexity
    const rhythm = rhythmBase.map(val => 
      val > 0 ? Math.min(1, val * (1 + audioFeatures.energy * complexityLevel)) : 0
    );
    
    // Create melodic sequence
    const steps = rhythm.length;
    const melodicPattern: (string | null | string[])[] = Array(steps).fill(null);
    
    // Select chord progression based on genre
    const chordProgression = chordProgressions[genre] 
      ? chordProgressions[genre][Math.floor(Math.random() * chordProgressions[genre].length)]
      : ['C', 'G', 'Am', 'F'];
    
    // Fill pattern based on rhythm and complexity
    for (let i = 0; i < steps; i++) {
      if (rhythm[i] > 0) {
        // Determine probability of chord vs single note based on complexity
        const chordProbability = complexityLevel * audioFeatures.energy;
        
        if (Math.random() < chordProbability && complexityLevel > 0.5) {
          // Create chord (more likely with higher complexity)
          const rootIndex = Math.floor(Math.random() * useScale.length);
          const thirdIndex = (rootIndex + 2) % useScale.length;
          const fifthIndex = (rootIndex + 4) % useScale.length;
          
          if (complexityLevel > 0.8) {
            // Create more complex 4-note chord
            const seventhIndex = (rootIndex + 6) % useScale.length;
            melodicPattern[i] = [
              useScale[rootIndex], 
              useScale[thirdIndex], 
              useScale[fifthIndex], 
              useScale[seventhIndex]
            ];
          } else {
            // Create triad
            melodicPattern[i] = [
              useScale[rootIndex], 
              useScale[thirdIndex], 
              useScale[fifthIndex]
            ];
          }
        } else {
          // Single note
          melodicPattern[i] = useScale[Math.floor(Math.random() * useScale.length)];
        }
      }
    }
    
    // Create bass sequence - simpler than melody
    const bassPattern = Array(steps).fill(null);
    const bassDensity = 0.3 + (complexityLevel * 0.4); // Higher complexity = more bass notes
    
    for (let i = 0; i < steps; i += 2) {
      if (Math.random() < bassDensity) {
        bassPattern[i] = bassNotes[Math.floor(Math.random() * bassNotes.length)];
      }
    }
    
    // Create chord sequence if complexity is high enough
    let chordPattern: any[] = [];
    if (complexityLevel > 0.4) {
      const chordDensity = Math.ceil(steps / chordProgression.length);
      chordPattern = Array(steps).fill(null);
      
      for (let i = 0; i < steps; i++) {
        if (i % chordDensity === 0) {
          const chordIndex = Math.floor(i / chordDensity) % chordProgression.length;
          chordPattern[i] = chordProgression[chordIndex];
        }
      }
    }
    
    // Create drum pattern if drums selected and complexity is sufficient
    let drumPattern: any[] = [];
    if (drums && instrumentsToUse.includes('drums') && complexityLevel > 0.3) {
      drumPattern = Array(steps).fill(null);
      
      // Kick on quarter notes
      for (let i = 0; i < steps; i += 4) {
        drumPattern[i] = 'C2';
      }
      
      // Snare on backbeat
      for (let i = 2; i < steps; i += 4) {
        drumPattern[i] = 'E2';
      }
      
      // Hi-hat pattern depends on complexity and energy
      const hihatDensity = 0.3 + (complexityLevel * audioFeatures.energy * 0.7);
      for (let i = 0; i < steps; i++) {
        if (Math.random() < hihatDensity) {
          // If already has a drum, make a combo
          drumPattern[i] = drumPattern[i] 
            ? [drumPattern[i], 'G2'] 
            : 'G2';
        }
      }
    }
    
    console.log("Creating sequences with patterns:", { 
      melodicPattern, 
      bassPattern,
      chordPattern: chordPattern.length,
      drumPattern: drumPattern.length
    });
    
    // Create Tone.js sequences
    if (activeInstruments.length > 0) {
      const mainInstrument = activeInstruments[0]; // Use first instrument for melody
      
      melodicSequence = new Tone.Sequence(
        (time, note) => {
          if (note && mainInstrument) {
            // Velocity based on rhythm strength
            const index = melodicSequence?.events.indexOf(note) || 0;
            const velocity = rhythm[index % rhythm.length];
            
            if (velocity > 0) {
              mainInstrument.triggerAttackRelease(note as any, "8n", time, velocity * 0.7);
            }
          }
        },
        melodicPattern as any[],
        "8n"
      );
    }
    
    // Add bass sequence if available
    if (bassline && instrumentsToUse.includes('bass')) {
      bassSequence = new Tone.Sequence(
        (time, note) => {
          if (note && bassline) {
            bassline.triggerAttackRelease(note, "4n", time, 0.7);
          }
        },
        bassPattern as any[],
        "4n"
      );
    }
    
    // Add chord sequence if complexity warrants it
    if (chordPattern.length > 0 && piano && instrumentsToUse.includes('piano')) {
      chordSequence = new Tone.Sequence(
        (time, chord) => {
          if (chord && piano) {
            // Translate chord name to actual notes
            let notes: string[] = [];
            switch(chord) {
              case 'C': notes = ['C3', 'E3', 'G3']; break;
              case 'G': notes = ['G2', 'B2', 'D3']; break;
              case 'Am': notes = ['A2', 'C3', 'E3']; break;
              case 'F': notes = ['F2', 'A2', 'C3']; break;
              case 'Dm': notes = ['D3', 'F3', 'A3']; break;
              case 'G7': notes = ['G2', 'B2', 'D3', 'F3']; break;
              case 'Cmaj7': notes = ['C3', 'E3', 'G3', 'B3']; break;
              case 'Fmaj7': notes = ['F2', 'A2', 'C3', 'E3']; break;
              case 'Dmaj7': notes = ['D3', 'F#3', 'A3', 'C#4']; break;
              case 'Em7': notes = ['E2', 'G2', 'B2', 'D3']; break;
              case 'A7': notes = ['A2', 'C#3', 'E3', 'G3']; break;
              case 'Dm7': notes = ['D3', 'F3', 'A3', 'C4']; break;
              case 'Bm7b5': notes = ['B2', 'D3', 'F3', 'A3']; break;
              case 'E7': notes = ['E2', 'G#2', 'B2', 'D3']; break;
              case 'Amaj9': notes = ['A2', 'C#3', 'E3', 'G#3', 'B3']; break;
              case 'Ab': notes = ['Ab2', 'C3', 'Eb3']; break;
              case 'Eb': notes = ['Eb3', 'G3', 'Bb3']; break;
              case 'Bb': notes = ['Bb2', 'D3', 'F3']; break;
              case 'F#m7': notes = ['F#2', 'A2', 'C#3', 'E3']; break;
              case 'E': notes = ['E2', 'G#2', 'B2']; break;
              case 'D': notes = ['D3', 'F#3', 'A3']; break;
              case 'A': notes = ['A2', 'C#3', 'E3']; break;
              case 'G6': notes = ['G2', 'B2', 'D3', 'E3']; break;
              default: notes = [];
            }
            
            if (notes.length > 0) {
              piano.triggerAttackRelease(notes, "2n", time, 0.5);
            }
          }
        },
        chordPattern,
        "2n"
      );
    }
    
    // Add drum sequence if available
    if (drums && drumPattern.length > 0) {
      drumSequence = new Tone.Sequence(
        (time, note) => {
          if (note && drums) {
            drums.triggerAttackRelease(note, "16n", time, 0.7);
          }
        },
        drumPattern as any[],
        "16n"
      );
    }
    
    // Start the sequences
    if (melodicSequence) melodicSequence.start(0);
    if (bassSequence) bassSequence.start(0);
    if (chordSequence) chordSequence.start(0);
    if (drumSequence) drumSequence.start(0);
    
    Tone.Transport.start();
    
    playing = true;
    console.log(`Music generation started with ${mood} mood`);
    return Promise.resolve();
    
  } catch (error) {
    console.error("Error generating music:", error);
    return Promise.reject(error);
  }
};

/**
 * Check if music is currently playing
 */
export const isMusicPlaying = (): boolean => {
  return playing;
};

/**
 * Create an audio file from the current synth settings
 */
export const renderToAudioFile = async (duration: number = 30): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    try {
      console.log(`Rendering ${duration} seconds of audio to file...`);
      
      // Create a recorder to capture audio output
      const recorder = new Tone.Recorder();
      
      // Connect main output to recorder
      Tone.getDestination().connect(recorder);
      
      // Start recording
      recorder.start();
      
      // Let it record for the specified duration
      setTimeout(async () => {
        // Stop the recording and get the audio blob
        const recording = await recorder.stop();
        
        // Disconnect recorder
        Tone.getDestination().disconnect(recorder);
        
        // Validate the recording
        if (recording && recording.size > 0) {
          console.log(`Successfully rendered audio: ${recording.size} bytes`);
          resolve(recording);
        } else {
          console.error("Recording failed - empty or invalid blob");
          const emptyBlob = createSilentAudioBlob(1);
          resolve(emptyBlob);
        }
      }, duration * 1000);
      
    } catch (error) {
      console.error("Error rendering audio:", error);
      // Return empty audio in case of failure (1 second of silence)
      const emptyBlob = createSilentAudioBlob(1);
      resolve(emptyBlob);
    }
  });
};

/**
 * Create a silent audio blob (fallback if rendering fails)
 */
const createSilentAudioBlob = (duration: number): Blob => {
  // Create an audio context
  const AudioContextClass = window.AudioContext || window.AudioContext;
  const audioContext = new AudioContextClass();
  const sampleRate = audioContext.sampleRate;
  const numChannels = 2;
  const numSamples = Math.ceil(duration * sampleRate);
  
  // Create a buffer with silence
  const buffer = audioContext.createBuffer(
    numChannels,
    numSamples,
    sampleRate
  );
  
  // Create WAV from silent buffer
  const wavData = audioBufferToWav(buffer);
  return new Blob([wavData], { type: "audio/wav" });
};

/**
 * Convert AudioBuffer to WAV format
 * Based on https://github.com/Jam3/audiobuffer-to-wav
 */
const audioBufferToWav = (buffer: AudioBuffer): ArrayBuffer => {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2;
  const result = new ArrayBuffer(44 + length);
  const view = new DataView(result);
  const sampleRate = buffer.sampleRate;
  const channels = [];
  let pos = 0;
  let offset = 0;

  // Extract channels
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  // RIFF identifier
  writeString(view, pos, "RIFF");
  pos += 4;

  // file length
  view.setUint32(pos, 36 + length, true);
  pos += 4;

  // RIFF type
  writeString(view, pos, "WAVE");
  pos += 4;

  // format chunk identifier
  writeString(view, pos, "fmt ");
  pos += 4;

  // format chunk length
  view.setUint32(pos, 16, true);
  pos += 4;

  // sample format (raw)
  view.setUint16(pos, 1, true);
  pos += 2;

  // channel count
  view.setUint16(pos, numOfChan, true);
  pos += 2;

  // sample rate
  view.setUint32(pos, sampleRate, true);
  pos += 4;

  // byte rate (sample rate * block align)
  view.setUint32(pos, sampleRate * 2 * numOfChan, true);
  pos += 4;

  // block align (channel count * bytes per sample)
  view.setUint16(pos, numOfChan * 2, true);
  pos += 2;

  // bits per sample
  view.setUint16(pos, 16, true);
  pos += 2;

  // data chunk identifier
  writeString(view, pos, "data");
  pos += 4;

  // data chunk length
  view.setUint32(pos, length, true);
  pos += 4;

  // Write interleaved data
  offset = pos;
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numOfChan; c++) {
      // Convert float32 to int16
      let sample = Math.max(-1, Math.min(1, channels[c][i]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }

  return result;
};

const writeString = (view: DataView, offset: number, str: string): void => {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
};

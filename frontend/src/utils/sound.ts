class SoundManager {
  private audioCtx: AudioContext | null = null;
  private bgmInterval: number | null = null;
  public isMuted: boolean = false;
  private currentNote: number = 0;

  private init() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  public toggleMute() {
    this.isMuted = !this.isMuted;
    if (!this.isMuted) {
      this.startBGM();
    } else {
      this.stopBGM();
    }
    return this.isMuted;
  }

  private startBGM() {
    this.init();
    if (this.bgmInterval) return;

    // A simple upbeat pentatonic sequence
    const sequence = [261.63, 293.66, 329.63, 392.00, 440.00, 392.00, 329.63, 293.66];
    
    this.bgmInterval = window.setInterval(() => {
      if (this.isMuted || !this.audioCtx) return;
      
      const osc = this.audioCtx.createOscillator();
      const gainNode = this.audioCtx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.value = sequence[this.currentNote % sequence.length] / 2; // Bass octave
      
      gainNode.gain.setValueAtTime(0.05, this.audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.2);
      
      osc.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);
      
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.2);
      
      this.currentNote++;
    }, 250); // 16th notes at 120bpm
  }

  private stopBGM() {
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }

  public playClick() {
    if (this.isMuted) return;
    this.init();
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, this.audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, this.audioCtx.currentTime + 0.05);
    
    gainNode.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.05);
    
    osc.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);
    
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.05);
  }

  public playCorrect() {
    if (this.isMuted) return;
    this.init();
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, this.audioCtx.currentTime); // C5
    osc.frequency.setValueAtTime(659.25, this.audioCtx.currentTime + 0.1); // E5
    
    gainNode.gain.setValueAtTime(0.4, this.audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.5);
    
    osc.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);
    
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.5);
  }

  public playWrong() {
    if (this.isMuted) return;
    this.init();
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, this.audioCtx.currentTime); 
    osc.frequency.exponentialRampToValueAtTime(100, this.audioCtx.currentTime + 0.3);
    
    gainNode.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.3);
    
    osc.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);
    
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.3);
  }

  public playFinished() {
    if (this.isMuted) return;
    this.init();
    if (!this.audioCtx) return;
    
    const notes = [261.63, 329.63, 392.00, 523.25];
    const duration = 0.15;

    notes.forEach((freq, index) => {
      const osc = this.audioCtx!.createOscillator();
      const gainNode = this.audioCtx!.createGain();
      
      osc.type = 'square';
      osc.frequency.value = freq;
      
      const startTime = this.audioCtx!.currentTime + (index * duration);
      
      gainNode.gain.setValueAtTime(0.15, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      
      osc.connect(gainNode);
      gainNode.connect(this.audioCtx!.destination);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  }
}

export const sound = new SoundManager();

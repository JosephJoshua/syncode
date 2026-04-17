import type { Track, TrackProcessor } from 'livekit-client';

export interface VideoFilterSettings {
  brightness: number;
  contrast: number;
}

// biome-ignore lint/suspicious/noExplicitAny: LiveKit's TrackProcessor generic requires ProcessorOptions<Kind> which widens the kind param
type AnyProcessorOpts = any;

export class VideoFilterProcessor implements TrackProcessor<Track.Kind.Video> {
  name = 'video-filter';
  processedTrack?: MediaStreamTrack;

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private sourceTrack: MediaStreamTrack | null = null;
  private video: HTMLVideoElement | null = null;
  private animFrame = 0;
  private running = false;
  private settings: VideoFilterSettings = { brightness: 1, contrast: 1 };

  async init(opts: AnyProcessorOpts): Promise<void> {
    this.sourceTrack = opts.track as MediaStreamTrack;
    await this.setup();
  }

  async restart(opts: AnyProcessorOpts): Promise<void> {
    this.stopLoop();
    this.sourceTrack = opts.track as MediaStreamTrack;
    await this.setup();
  }

  async destroy(): Promise<void> {
    this.stopLoop();
    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }
    if (this.processedTrack) {
      this.processedTrack.stop();
      this.processedTrack = undefined;
    }
    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
    }
    this.ctx = null;
    this.sourceTrack = null;
  }

  updateSettings(settings: VideoFilterSettings): void {
    this.settings = { ...settings };
  }

  private async setup(): Promise<void> {
    if (!this.sourceTrack) return;

    if (this.processedTrack) {
      this.processedTrack.stop();
      this.processedTrack = undefined;
    }

    const trackSettings = this.sourceTrack.getSettings();
    const width = trackSettings.width ?? 640;
    const height = trackSettings.height ?? 480;

    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.style.display = 'none';
      document.body.appendChild(this.canvas);
    }
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');

    if (!this.video) {
      this.video = document.createElement('video');
      this.video.muted = true;
      this.video.playsInline = true;
    }
    this.video.srcObject = new MediaStream([this.sourceTrack]);
    await this.video.play();

    const stream = this.canvas.captureStream(30);
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      this.processedTrack = videoTrack;
    }

    this.startLoop();
  }

  private startLoop(): void {
    this.running = true;
    const draw = () => {
      if (!this.running) return;
      this.drawFrame();
      this.animFrame = requestAnimationFrame(draw);
    };
    draw();
  }

  private stopLoop(): void {
    this.running = false;
    cancelAnimationFrame(this.animFrame);
  }

  private drawFrame(): void {
    if (!this.ctx || !this.canvas || !this.video) return;
    if (this.video.readyState < 2) return;

    const { width, height } = this.canvas;
    this.ctx.filter = `brightness(${this.settings.brightness}) contrast(${this.settings.contrast})`;
    this.ctx.drawImage(this.video, 0, 0, width, height);
  }
}

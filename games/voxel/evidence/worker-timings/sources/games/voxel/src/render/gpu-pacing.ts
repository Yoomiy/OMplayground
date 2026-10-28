/** One submitted GPU frame at a time. Zero-timeout polls never wait for a slow device. */
export class GpuFramePacer {
  private fence: WebGLSync | null = null;
  private disposed = false;
  readonly stats = { submitted: 0, skipped: 0, pending: 0, failures: 0 };
  private gl: WebGL2RenderingContext;
  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
  }
  begin(): boolean {
    if (this.disposed) return false;
    if (this.gl.isContextLost()) {
      this.reset();
      this.stats.skipped++;
      return false;
    }
    if (!this.fence) return true;
    const status = this.gl.clientWaitSync(this.fence, 0, 0);
    if (status === this.gl.TIMEOUT_EXPIRED) {
      this.stats.skipped++;
      return false;
    }
    this.reset();
    if (status !== this.gl.ALREADY_SIGNALED && status !== this.gl.CONDITION_SATISFIED) {
      this.stats.failures++;
      throw new Error('GPU completion poll failed');
    }
    return true;
  }
  finish(): void {
    if (this.disposed || this.gl.isContextLost()) {
      this.reset();
      return;
    }
    if (this.fence) throw new Error('GPU frame is already pending');
    const fence = this.gl.fenceSync(this.gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (!fence) {
      this.stats.failures++;
      throw new Error('GPU completion fence unavailable');
    }
    this.fence = fence;
    this.stats.pending = 1;
    this.stats.submitted++;
    this.gl.flush();
  }
  reset(): void {
    if (this.fence) this.gl.deleteSync(this.fence);
    this.fence = null;
    this.stats.pending = 0;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.reset();
  }
}

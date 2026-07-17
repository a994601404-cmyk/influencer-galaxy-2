// Client-side video compression using Canvas + MediaRecorder
// Guarantees output resolution maintains at least 720p on the short edge

export interface CompressResult {
  dataUrl: string;
  fileName: string;
  originalSize: number;
  compressedSize: number;
  originalW: number;
  originalH: number;
  outputW: number;
  outputH: number;
  duration: number;
}

export interface CompressProgress {
  phase: "loading" | "compressing" | "finalizing";
  percent: number; // 0-100
  message: string;
}

const MIN_SHORT_EDGE = 720;

function getSupportedMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  throw new Error('浏览器不支持视频录制，请使用 Chrome/Edge/Firefox');
}

function calcTargetDimensions(origW: number, origH: number) {
  const origShort = Math.min(origW, origH);
  if (origShort <= MIN_SHORT_EDGE) {
    // Original is already at or below 720p — keep original size
    return { width: origW, height: origH };
  }
  // Scale down so short edge = 720, maintain aspect ratio
  const scale = MIN_SHORT_EDGE / origShort;
  let w = Math.round(origW * scale);
  let h = Math.round(origH * scale);
  // Ensure even dimensions (encoder requirement)
  w = Math.floor(w / 2) * 2;
  h = Math.floor(h / 2) * 2;
  return { width: w, height: h };
}

function calcBitrate(width: number, height: number): number {
  const pixels = width * height;
  const basePixels = 1280 * 720; // 720p baseline
  const baseBitrate = 3 * 1024 * 1024; // 3 Mbps base for 720p
  const scale = Math.min(pixels / basePixels, 2.5); // cap at 2.5x
  return Math.round(baseBitrate * scale);
}

/**
 * Compress a video file client-side.
 * - If source < 720p: keeps original resolution (throws if below 720p)
 * - If source >= 720p: scales short edge to 720p, preserves aspect ratio
 * - Output format: WebM (VP9/VP8)
 */
export function compressVideo(
  file: File,
  onProgress?: (p: CompressProgress) => void
): Promise<CompressResult> {
  return new Promise((resolve, reject) => {
    const report = (phase: CompressProgress["phase"], percent: number, message: string) => {
      onProgress?.({ phase, percent, message });
    };

    report("loading", 0, "正在加载视频...");

    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";

    let recorder: MediaRecorder | null = null;
    let animationId = 0;
    let safetyTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      if (animationId) cancelAnimationFrame(animationId);
      if (safetyTimer) clearTimeout(safetyTimer);
      video.pause();
      video.src = "";
      if (recorder && recorder.state === "recording") {
        try { recorder.stop(); } catch { /* ignore */ }
      }
    };

    video.onloadedmetadata = () => {
      const origW = video.videoWidth;
      const origH = video.videoHeight;
      const origShort = Math.min(origW, origH);
      const duration = video.duration || 0;

      // Check minimum resolution
      if (origShort < MIN_SHORT_EDGE) {
        cleanup();
        reject(
          new Error(
            `原视频分辨率 ${origW}×${origH} 低于720p，无法上传。请提供至少720p的视频。`
          )
        );
        return;
      }

      const { width: targetW, height: targetH } = calcTargetDimensions(origW, origH);
      const bitrate = calcBitrate(targetW, targetH);

      report("compressing", 0, `正在压缩: ${origW}×${origH} → ${targetW}×${targetH}`);

      // Setup canvas
      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) {
        cleanup();
        reject(new Error("无法创建 Canvas 上下文"));
        return;
      }

      // Build output stream: video from canvas + audio from source video
      const canvasStream = canvas.captureStream();
      let outputStream = canvasStream;

      try {
        const videoStream = (video as any).captureStream?.();
        if (videoStream) {
          const audioTracks = videoStream.getAudioTracks?.() || [];
          if (audioTracks.length > 0) {
            outputStream = new MediaStream();
            canvasStream.getVideoTracks().forEach((t) => outputStream.addTrack(t));
            audioTracks.forEach((t: MediaStreamTrack) => outputStream.addTrack(t));
          }
        }
      } catch {
        // No audio — canvas video only
      }

      // Setup MediaRecorder
      const mimeType = getSupportedMimeType();
      try {
        recorder = new MediaRecorder(outputStream, {
          mimeType,
          videoBitsPerSecond: bitrate,
        });
      } catch (e) {
        cleanup();
        reject(new Error(`创建录制器失败: ${e}`));
        return;
      }

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        report("finalizing", 95, "正在生成文件...");
        const blob = new Blob(chunks, { type: mimeType });
        const reader = new FileReader();
        reader.onload = () => {
          report("finalizing", 100, "完成!");
          resolve({
            dataUrl: reader.result as string,
            fileName: file.name.replace(/\.[^.]+$/, "") + "_720p.webm",
            originalSize: file.size,
            compressedSize: blob.size,
            originalW: origW,
            originalH: origH,
            outputW: targetW,
            outputH: targetH,
            duration,
          });
          cleanup();
        };
        reader.onerror = () => {
          cleanup();
          reject(new Error("读取压缩后文件失败"));
        };
        reader.readAsDataURL(blob);
      };

      // Start playing + recording
      const startRecording = () => {
        recorder!.start(100); // collect every 100ms

        // Draw loop
        const draw = () => {
          if (video.ended || video.paused) return;
          ctx.drawImage(video, 0, 0, targetW, targetH);

          // Progress
          if (duration > 0) {
            const pct = Math.min(95, Math.round((video.currentTime / duration) * 90));
            report("compressing", pct, `压缩中 ${Math.round(video.currentTime)}s / ${Math.round(duration)}s`);
          }

          animationId = requestAnimationFrame(draw);
        };

        video.onplay = () => {
          animationId = requestAnimationFrame(draw);
        };

        video.onended = () => {
          if (recorder && recorder.state === "recording") {
            recorder.stop();
          }
        };

        video.play().catch((e) => {
          cleanup();
          reject(new Error(`播放失败: ${e.message}`));
        });

        // Safety timeout
        safetyTimer = setTimeout(() => {
          if (recorder && recorder.state === "recording") {
            recorder.stop();
          }
        }, Math.max((duration + 10) * 1000, 30000));
      };

      // Wait for video to be ready
      if (video.readyState >= 3) {
        startRecording();
      } else {
        video.oncanplay = () => {
          video.oncanplay = null;
          startRecording();
        };
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("视频文件加载失败，格式可能不受支持"));
    };

    // Overall timeout
    setTimeout(() => {
      cleanup();
      reject(new Error("压缩超时，请尝试较小的文件或使用链接方式"));
    }, 300000); // 5min max
  });
}

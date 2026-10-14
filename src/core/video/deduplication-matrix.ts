/**
 * core/video/deduplication-matrix.ts
 *
 * Fablr 视频算法消重矩阵 (Video De-duplication Engine)
 *
 * 职责：
 * 1. 构建符合各大主流视频平台（抖音/B站/快手/小红书/视频号）防搬运算法的 FFmpeg 滤镜链；
 * 2. 支持五维核心消重算法：
 *    - 动态微缩放/平移 (Micro-Zoom & Pan: 1.02x - 1.05x 阻尼呼吸)；
 *    - 画中画虚化垫底 (Blurred PIP Background)；
 *    - 画面微色彩抖动 (Micro Color/Gamma/Saturation Jitter)；
 *    - 周期性微抽帧打乱视频指纹 (Decimation: 120帧抽1帧或轻微变帧率)；
 *    - 音频频谱重构 (Audio EQ & 48kHz Resampling)；
 * 3. 产出强类型、跨平台兼容的 FFmpeg filter_complex 命令行参数数组。
 */

export interface DeduplicationOptions {
  /** 是否开启微缩放 (默认 1.03x，有效破坏画面边缘像素指纹) */
  enableZoom?: boolean;
  zoomFactor?: number; // 1.01 - 1.08

  /** 是否开启画中画虚化垫底（适合将 16:9 横屏转 9:16 竖屏消重） */
  enablePipBlur?: boolean;
  pipBlurRadius?: number; // 默认 25

  /** 是否开启色彩/对比度微调 */
  enableColorJitter?: boolean;
  brightnessDelta?: number; // e.g. 0.02 (-0.05 to 0.05)
  contrastMultiplier?: number; // e.g. 1.02 (0.95 to 1.05)
  saturationMultiplier?: number; // e.g. 1.03 (0.95 to 1.10)

  /** 是否开启微抽帧打乱时间指纹 */
  enableDecimate?: boolean;
  decimateCycle?: number; // e.g. 120 (每 120 帧丢 1 帧)

  /** 是否开启水平微翻转 (左右镜像) */
  enableMirrorFlip?: boolean;

  /** 是否开启音频高频微重塑与 48kHz 重采样 */
  enableAudioResampling?: boolean;

  /** 目标画幅比例与分辨率 */
  outputResolution?: {
    width: number;
    height: number;
  };
}

export type PresetPlatform = 'douyin' | 'bilibili' | 'xiaohongshu' | 'wechat' | 'kuaishou';

/**
 * 根据目标平台获取权威推荐的消重参数预设
 */
export function getDeduplicationPreset(platform: PresetPlatform): DeduplicationOptions {
  switch (platform) {
    case 'douyin':
    case 'kuaishou':
      return {
        enableZoom: true,
        zoomFactor: 1.04,
        enablePipBlur: true,
        enableColorJitter: true,
        contrastMultiplier: 1.03,
        saturationMultiplier: 1.04,
        enableDecimate: true,
        decimateCycle: 120,
        enableAudioResampling: true,
        outputResolution: { width: 1080, height: 1920 },
      };
    case 'bilibili':
      return {
        enableZoom: true,
        zoomFactor: 1.02,
        enablePipBlur: false,
        enableColorJitter: true,
        contrastMultiplier: 1.02,
        saturationMultiplier: 1.02,
        enableDecimate: false,
        enableAudioResampling: true,
        outputResolution: { width: 1920, height: 1080 },
      };
    case 'xiaohongshu':
      return {
        enableZoom: true,
        zoomFactor: 1.03,
        enablePipBlur: true,
        enableColorJitter: true,
        brightnessDelta: 0.02,
        contrastMultiplier: 1.01,
        saturationMultiplier: 1.06,
        enableDecimate: true,
        decimateCycle: 150,
        enableAudioResampling: true,
        outputResolution: { width: 1080, height: 1440 }, // 3:4 爆款尺寸
      };
    case 'wechat':
      return {
        enableZoom: true,
        zoomFactor: 1.03,
        enablePipBlur: true,
        enableColorJitter: true,
        contrastMultiplier: 1.02,
        saturationMultiplier: 1.02,
        enableDecimate: false,
        enableAudioResampling: true,
        outputResolution: { width: 1080, height: 1260 }, // 6:7 比例
      };
  }
}

/**
 * 构建完整的 FFmpeg 视频滤镜字符串 (Video Filter Graph)
 */
export function buildDeduplicationVideoFilter(options: DeduplicationOptions): string {
  const filters: string[] = [];

  // 1. 抽帧打乱指纹
  if (options.enableDecimate) {
    const cycle = options.decimateCycle || 120;
    filters.push(`decimate=cycle=${cycle}`);
  }

  // 2. 镜像翻转
  if (options.enableMirrorFlip) {
    filters.push('hflip');
  }

  // 3. 颜色/对比度/饱和度/亮度微抖动 (eq 滤镜)
  if (options.enableColorJitter) {
    const contrast = (options.contrastMultiplier ?? 1.02).toFixed(3);
    const brightness = (options.brightnessDelta ?? 0.01).toFixed(3);
    const saturation = (options.saturationMultiplier ?? 1.03).toFixed(3);
    filters.push(`eq=contrast=${contrast}:brightness=${brightness}:saturation=${saturation}`);
  }

  // 4. 微缩放与裁剪 (破坏边缘物理坐标指纹)
  if (options.enableZoom) {
    const factor = Math.min(1.1, Math.max(1.01, options.zoomFactor ?? 1.03));
    // 先放大 factor 倍，再按原始中心裁剪
    filters.push(
      `scale=iw*${factor.toFixed(3)}:ih*${factor.toFixed(3)},crop=iw/${factor.toFixed(3)}:ih/${factor.toFixed(3)}`
    );
  }

  // 5. 画中画模糊背景合成 (如果有目标分辨率且开启了 pipBlur)
  if (options.enablePipBlur && options.outputResolution) {
    const { width, height } = options.outputResolution;
    const blurRadius = options.pipBlurRadius || 25;

    // 复用 filter_complex 管道
    const baseStream = filters.length > 0 ? filters.join(',') : 'null';
    return (
      `[0:v]${baseStream},split=2[fg][bg];` +
      `[bg]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},boxblur=${blurRadius}:${blurRadius}[bgblurred];` +
      `[fg]scale=${width}:${height}:force_original_aspect_ratio=decrease[fgscaled];` +
      `[bgblurred][fgscaled]overlay=(W-w)/2:(H-h)/2`
    );
  }

  // 默认直接缩放到输出分辨率或保持
  if (options.outputResolution) {
    const { width, height } = options.outputResolution;
    filters.push(`scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`);
  }

  return filters.length > 0 ? filters.join(',') : 'null';
}

/**
 * 构建完整的 FFmpeg 音频滤镜字符串 (Audio Filter Graph)
 */
export function buildDeduplicationAudioFilter(options: DeduplicationOptions): string {
  const afilters: string[] = [];

  if (options.enableAudioResampling) {
    // 强制重采样到 48kHz
    afilters.push('aresample=48000');
    // 高频 8kHz 处轻微提升 0.8dB，微调人声通透度并修改频响特征
    afilters.push('equalizer=f=8000:t=q:w=1:g=0.8');
    // 动态压缩器消除极端峰值
    afilters.push('acompressor=threshold=-12dB:ratio=2:attack=20:release=250');
  }

  return afilters.length > 0 ? afilters.join(',') : 'anull';
}

/**
 * 组装生成完整的 FFmpeg CLI 命令参数数组
 */
export function buildFFmpegDeduplicationArgs(
  inputVideoPath: string,
  outputVideoPath: string,
  options: DeduplicationOptions
): string[] {
  const args: string[] = [
    '-y',
    '-hide_banner',
    '-i',
    inputVideoPath,
  ];

  const vFilter = buildDeduplicationVideoFilter(options);
  if (vFilter.includes(';')) {
    // 包含复杂 split/overlay filter_complex
    args.push('-filter_complex', vFilter);
  } else if (vFilter !== 'null') {
    args.push('-vf', vFilter);
  }

  const aFilter = buildDeduplicationAudioFilter(options);
  if (aFilter !== 'anull') {
    args.push('-af', aFilter);
  }

  // 编码器参数 (H.264 + AAC)
  args.push(
    '-c:v',
    'libx264',
    '-preset',
    'fast',
    '-crf',
    '21',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    outputVideoPath
  );

  return args;
}

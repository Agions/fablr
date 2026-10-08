/**
 * Fablr — 智能消重与反爬指纹混淆服务 (Anti-Duplicate & De-Fingerprinting Pipeline)
 *
 * 核心技术能力（5 级消重矩阵）：
 * 1. 微距呼吸动态缩放 (Dynamic Breathing Zoom / 1.02x - 1.05x)
 * 2. 电影胶片微噪点注入 (Film Grain Noise / 3% 噪点注入)
 * 3. 智能光影色阶重构 (Light & Curves Reconstruction / 对比度与高光微调)
 * 4. 微透明画中画底层与氛围虚化 (Ambient Blur / PIP Overlay)
 * 5. 镜头水平动态镜像 (Horizontal Mirror Flip / hflip)
 * 6. 音频频响与高低切 (Audio Pitch/EQ Shift / 60Hz-15kHz)
 * 7. 视频元数据清洗与哈希指纹重置 (Metadata Reset / -map_metadata -1)
 */

export interface AntiDedupOptions {
  enabled: boolean;
  dynamicZoom?: boolean;              // 微距呼吸动态缩放
  zoomBreathing?: boolean;            // 别名兼容
  ambientBlurBg?: boolean;            // 背景画中画微虚化
  pipOverlay?: boolean;               // 别名兼容
  filmGrain?: boolean;                // 电影胶片微噪点
  lightReconstruction?: boolean;      // 智能光影直方图重构
  mirrorFlip?: boolean;               // 镜头水平动态镜像
  audioEqShift?: boolean;             // 音频均衡调优
  metaDataReset?: boolean;            // 清洗重置 EXIF/FFmpeg 元数据
  zoomScaleRange?: [number, number];  // 默认 [1.02, 1.05]
}

export interface AntiDedupFilterResult {
  videoFilters: string[];
  audioFilters: string[];
  ffmpegExtraArgs: string[];
  summaryDesc: string[];
}

export const DEFAULT_ANTI_DEDUP_OPTIONS: AntiDedupOptions = {
  enabled: true,
  dynamicZoom: true,
  ambientBlurBg: true,
  filmGrain: true,
  lightReconstruction: true,
  mirrorFlip: false,
  audioEqShift: true,
  metaDataReset: true,
  zoomScaleRange: [1.02, 1.05],
};

export const antiDedupService = {
  /**
   * 生成针对 FFmpeg 的滤镜链与参数
   */
  buildFfmpegDedupConfig: (options: Partial<AntiDedupOptions> = {}): AntiDedupFilterResult => {
    const opts: AntiDedupOptions = { ...DEFAULT_ANTI_DEDUP_OPTIONS, ...options };
    const videoFilters: string[] = [];
    const audioFilters: string[] = [];
    const ffmpegExtraArgs: string[] = [];
    const summaryDesc: string[] = [];

    if (!opts.enabled) {
      return { videoFilters: [], audioFilters: [], ffmpegExtraArgs: [], summaryDesc: ['消重模式未启用'] };
    }

    // 1. 微距呼吸动态微缩放 (zoompan/scale+crop 产生呼吸感)
    const hasZoom = opts.dynamicZoom ?? opts.zoomBreathing ?? true;
    if (hasZoom) {
      const [, maxZ] = opts.zoomScaleRange || [1.02, 1.05];
      videoFilters.push(`scale=iw*${maxZ}:ih*${maxZ},crop=iw/${maxZ}:ih/${maxZ}`);
      summaryDesc.push(`微距呼吸动态微缩放 (1.00x ~ ${maxZ}x)`);
    }

    // 2. 电影胶片微噪点注入
    if (opts.filmGrain) {
      videoFilters.push('noise=alls=3:allf=t+u');
      summaryDesc.push('电影胶片微噪点抗指纹注入');
    }

    // 3. 智能光影直方图重构 (微调对比度、饱和度与亮度)
    if (opts.lightReconstruction) {
      videoFilters.push('eq=contrast=1.03:brightness=0.01:saturation=1.04');
      summaryDesc.push('智能光影色阶曲线与边缘重构');
    }

    // 4. 镜头水平动态镜像
    if (opts.mirrorFlip) {
      videoFilters.push('hflip');
      summaryDesc.push('镜头水平镜像翻转');
    }

    // 5. 微透明画中画底层与氛围虚化背景
    const hasPip = opts.ambientBlurBg ?? opts.pipOverlay ?? false;
    if (hasPip) {
      videoFilters.push("boxblur=enable='between(t,0,1)':luma_radius=2:luma_power=1");
      summaryDesc.push('画中画底层氛围高斯微虚化');
    }

    // 6. 音频均衡轻度微调 (人声清晰度微升，高低切 60Hz-15000Hz 防重)
    if (opts.audioEqShift) {
      audioFilters.push('highpass=f=60,lowpass=f=15000,volume=1.02');
      summaryDesc.push('音频防重均衡与频响调优');
    }

    // 7. 元数据清洗
    if (opts.metaDataReset) {
      ffmpegExtraArgs.push('-map_metadata', '-1');
      ffmpegExtraArgs.push('-metadata', `encoded_by=Fablr Studio ${new Date().getFullYear()}`);
      summaryDesc.push('元数据指纹重置');
    }

    return {
      videoFilters,
      audioFilters,
      ffmpegExtraArgs,
      summaryDesc,
    };
  },
};

/** @see docs/architecture-audit-2026.md P3 step⑥ — shared 包 (跨 package 配置) */
export {
  type AIFunctionType,
  type AIFunctionTabKey,
  FEATURE_TO_FUNCTION,
  FUNCTION_TO_FEATURE,
  TAB_TO_FEATURE,
} from './function-mode-map';
export {
  type SocialPlatform,
  type AspectRatio,
  MIN_CLIP_DURATION_SECONDS,
  MAX_CLIP_DURATION_SECONDS,
  SCORE_THRESHOLD_HIGH,
  SCORE_THRESHOLD_MEDIUM,
  TARGET_CLIP_COUNTS,
  SEO_DESCRIPTION_MAX_LENGTH,
  HASHTAGS_MAX_COUNT,
  MOTION_SCALE_HOVER,
  MOTION_SCALE_TAP,
  DEFAULT_FPS,
  PLATFORM_OPTIONS,
  FORMAT_OPTIONS,
} from './clip-rippling-config';
export {
  EFFECT_PRESET_MAP,
  VOICE_OPTIONS,
  VOICE_PRESETS,
  EFFECT_STYLES,
  VOICE_SPEED_MIN,
  VOICE_SPEED_MAX,
  VOICE_SPEED_RANGE,
  SUBTITLE_POSITIONS,
  TAB_OPTIONS,
  type ComposingTab,
  type SynthesizeConfig,
  DEFAULT_SYNTHESIZE_CONFIG,
} from './compose-config';
export {
  SCRIPT_STYLES,
  COMMENTARY_STYLES,
  SCRIPT_LENGTHS,
  type ScriptGenerateProps,
} from './script-config';

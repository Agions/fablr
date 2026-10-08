/**
 * core/models/script 测试
 * 覆盖解说脚本的创建、段落编辑、时间轴绑定与配音回填
 */
import { describe, it, expect } from 'vitest';
import {
  createCommentaryScript,
  estimateSpeakSecs,
  countWords,
  updateParagraphText,
  bindParagraphScene,
  attachParagraphAudio,
  isFullyVoiced,
  totalVoicedDurationSecs,
  approveScript,
  parseCommentaryScript,
  DEFAULT_SPEAK_CPS,
} from './script';
import type { CommentaryScript } from './script';

const makeScript = (overrides?: Partial<CommentaryScript>): CommentaryScript => ({
  ...createCommentaryScript({
    style: 'suspense',
    angle: '悬疑角度',
    paragraphs: [{ text: '第一段解说词。', emotion: 'suspense' }, { text: '第二段解说词。' }],
    modelUsed: 'gpt-4o',
    provider: 'openai',
  }),
  ...overrides,
});

describe('createCommentaryScript', () => {
  it('创建 draft 状态脚本，段落带估算时长与唯一 ID', () => {
    const s = createCommentaryScript({
      style: 'warm',
      angle: '温情角度',
      paragraphs: [{ text: '这是一个测试段落。' }],
      modelUsed: 'qwen-max',
      provider: 'alibaba',
    });
    expect(s.status).toBe('draft');
    expect(s.paragraphs).toHaveLength(1);
    expect(s.paragraphs[0].id).toMatch(/^paragraph_/);
    expect(s.paragraphs[0].targetSceneId).toBeNull();
    expect(s.paragraphs[0].timeRange).toBeNull();
    expect(s.paragraphs[0].audio).toBeNull();
    expect(s.paragraphs[0].estimatedSpeakSecs).toBeGreaterThan(0);
    expect(s.wordCount).toBe(countWords('这是一个测试段落。'));
    expect(s.estimatedDurationSecs).toBe(s.paragraphs[0].estimatedSpeakSecs);
  });

  it('统计全脚本字数与总时长', () => {
    const s = makeScript();
    expect(s.wordCount).toBe(countWords('第一段解说词。') + countWords('第二段解说词。'));
    expect(s.estimatedDurationSecs).toBeCloseTo(
      s.paragraphs[0].estimatedSpeakSecs + s.paragraphs[1].estimatedSpeakSecs
    );
  });
});

describe('estimateSpeakSecs', () => {
  it('按默认语速估算时长，含最小时长保护', () => {
    expect(estimateSpeakSecs('')).toBe(0);
    expect(estimateSpeakSecs('短')).toBeGreaterThanOrEqual(0.8);
    expect(estimateSpeakSecs('一二三四五六')).toBeGreaterThan(0.8);
    expect(estimateSpeakSecs('一二三四五六')).toBeCloseTo(6 / DEFAULT_SPEAK_CPS, 1);
  });

  it('支持自定义语速', () => {
    const text = '一二三四五六七八九十';
    expect(estimateSpeakSecs(text, 5)).toBeCloseTo(10 / 5, 1);
  });

  it('非法语速回退默认值', () => {
    expect(estimateSpeakSecs('一二三', 0)).toBe(estimateSpeakSecs('一二三'));
    expect(estimateSpeakSecs('一二三', -1)).toBe(estimateSpeakSecs('一二三'));
  });
});

describe('countWords', () => {
  it('去除空白与标点后统计字数', () => {
    expect(countWords('你好，世界！')).toBe(4);
    expect(countWords('Hello World')).toBe(10);
    expect(countWords('   ')).toBe(0);
  });
});

describe('updateParagraphText', () => {
  it('更新段落文本并重算时长与总字数，状态变为 reviewing', () => {
    const s = makeScript();
    const next = updateParagraphText(s, s.paragraphs[0].id, '更新后的长文本解说词内容');
    expect(next.paragraphs[0].text).toBe('更新后的长文本解说词内容');
    expect(next.paragraphs[0].estimatedSpeakSecs).toBe(
      estimateSpeakSecs('更新后的长文本解说词内容')
    );
    expect(next.status).toBe('reviewing');
    expect(next.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // 其他段落不受影响
    expect(next.paragraphs[1].text).toBe(s.paragraphs[1].text);
  });

  it('段落 ID 不存在时返回新实例但内容不变', () => {
    const s = makeScript();
    const next = updateParagraphText(s, 'not_exist', '新文本');
    expect(next.paragraphs).toEqual(s.paragraphs);
  });
});

describe('bindParagraphScene', () => {
  it('绑定段落与场景时间区间', () => {
    const s = makeScript();
    const next = bindParagraphScene(s, s.paragraphs[0].id, 'scene_2', 10_000, 20_000);
    expect(next.paragraphs[0].targetSceneId).toBe('scene_2');
    expect(next.paragraphs[0].timeRange).toEqual({ startMs: 10_000, endMs: 20_000 });
    expect(s.paragraphs[0].targetSceneId).toBeNull(); // 原实例不变
  });
});

describe('attachParagraphAudio', () => {
  it('回填段落配音产物', () => {
    const s = makeScript();
    const next = attachParagraphAudio(s, s.paragraphs[0].id, {
      path: '/tmp/audio/0.mp3',
      durationSecs: 3.2,
    });
    expect(next.paragraphs[0].audio).toEqual({ path: '/tmp/audio/0.mp3', durationSecs: 3.2 });
  });
});

describe('isFullyVoiced / totalVoicedDurationSecs', () => {
  it('全部段落配音后才视为完成', () => {
    const s = makeScript();
    expect(isFullyVoiced(s)).toBe(false);
    const one = attachParagraphAudio(s, s.paragraphs[0].id, { path: 'a.mp3', durationSecs: 1 });
    expect(isFullyVoiced(one)).toBe(false);
    const two = attachParagraphAudio(one, s.paragraphs[1].id, { path: 'b.mp3', durationSecs: 2 });
    expect(isFullyVoiced(two)).toBe(true);
    expect(totalVoicedDurationSecs(two)).toBe(3);
  });

  it('无段落时视为未完成，时长为 0', () => {
    const empty = makeScript({ paragraphs: [] });
    expect(isFullyVoiced(empty)).toBe(false);
    expect(totalVoicedDurationSecs(empty)).toBe(0);
  });
});

describe('approveScript', () => {
  it('draft → approved', () => {
    const s = makeScript();
    const approved = approveScript(s);
    expect(approved.status).toBe('approved');
    expect(approved).not.toBe(s);
  });

  it('已批准时原样返回（幂等）', () => {
    const s = approveScript(makeScript());
    expect(approveScript(s)).toBe(s);
  });
});

describe('parseCommentaryScript', () => {
  it('完整脚本原样归一化', () => {
    const s = makeScript();
    const parsed = parseCommentaryScript(s);
    expect(parsed?.id).toBe(s.id);
    expect(parsed?.paragraphs).toHaveLength(2);
    expect(parsed?.status).toBe('draft');
  });

  it('段落字段兜底（缺失 id / 非法 timeRange）', () => {
    const parsed = parseCommentaryScript({
      paragraphs: [{ text: '文本' }, { text: 'x', timeRange: 'bad', audio: 42 }],
    });
    expect(parsed?.paragraphs).toHaveLength(2);
    expect(parsed?.paragraphs[0].id).toBe('paragraph_0');
    expect(parsed?.paragraphs[0].estimatedSpeakSecs).toBe(0);
    expect(parsed?.paragraphs[1].timeRange).toBeNull();
    expect(parsed?.paragraphs[1].audio).toBeNull();
  });

  it('过滤非对象段落元素', () => {
    const parsed = parseCommentaryScript({ paragraphs: [{ text: 'a' }, null, 'str', 5] });
    expect(parsed?.paragraphs).toHaveLength(1);
  });

  it('缺失字段兜底（style / status）', () => {
    const parsed = parseCommentaryScript({ paragraphs: [] });
    expect(parsed).not.toBeNull();
    expect(parsed?.style).toBe('neutral');
    expect(parsed?.status).toBe('draft');
  });

  it('无 paragraphs 数组或非对象输入返回 null', () => {
    expect(parseCommentaryScript({})).toBeNull();
    expect(parseCommentaryScript(null)).toBeNull();
    expect(parseCommentaryScript([1])).toBeNull();
  });
});

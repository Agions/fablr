/**
 * SSML domain 单元测试
 *
 * 覆盖：节点构造、序列化、XML 转义、多角色拼装
 */

import { describe, expect, it } from 'vitest';
import {
  SSML,
  serializeSsml,
  buildMultiVoiceSsml,
  type SsmlDocument,
} from './ssml';

describe('SSML.text', () => {
  it('produces text node', () => {
    expect(SSML.text('hello')).toEqual({ type: 'text', text: 'hello' });
  });
});

describe('SSML.pause / pauseSec', () => {
  it('ms break', () => {
    expect(SSML.pause(500)).toEqual({ type: 'break', duration: { value: 500, unit: 'ms' } });
  });
  it('s break', () => {
    expect(SSML.pauseSec(1.5)).toEqual({ type: 'break', duration: { value: 1.5, unit: 's' } });
  });
});

describe('SSML.emphasis', () => {
  it('default level is moderate', () => {
    const node = SSML.emphasis(undefined, [SSML.text('wow')]);
    expect(node.level).toBe('moderate');
  });
  it('strong level', () => {
    const node = SSML.emphasis('strong', [SSML.text('wow')]);
    expect(node.level).toBe('strong');
  });
});

describe('SSML.voice', () => {
  it('preserves voice name', () => {
    const node = SSML.voice('zh-CN-YunxiNeural', [SSML.text('旁白')]);
    expect(node.name).toBe('zh-CN-YunxiNeural');
  });
  it('optional xmlLang', () => {
    const node = SSML.voice('en-US-GuyNeural', [SSML.text('hi')], 'en-US');
    expect(node.xmlLang).toBe('en-US');
  });
});

describe('serializeSsml', () => {
  it('emits speak root with xml:lang', () => {
    const doc: SsmlDocument = { xmlLang: 'zh-CN', children: [SSML.text('你好')] };
    expect(serializeSsml(doc)).toBe(
      '<speak version="1.1" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN">你好</speak>'
    );
  });

  it('escapes xml special chars in text', () => {
    const doc: SsmlDocument = {
      xmlLang: 'zh-CN',
      children: [SSML.text('<script>alert("x")</script> & 1<2')],
    };
    const out = serializeSsml(doc);
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;');
    expect(out).toContain('&amp;');
    expect(out).toContain('&quot;');
  });

  it('renders break with time attribute', () => {
    const doc: SsmlDocument = {
      xmlLang: 'zh-CN',
      children: [SSML.text('前'), SSML.pause(500), SSML.text('后')],
    };
    expect(serializeSsml(doc)).toBe(
      '<speak version="1.1" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN">前<break time="500ms"/>后</speak>'
    );
  });

  it('renders emphasis with level', () => {
    const doc: SsmlDocument = {
      xmlLang: 'zh-CN',
      children: [SSML.emphasis('strong', [SSML.text('重点')])],
    };
    expect(serializeSsml(doc)).toContain('<emphasis level="strong">重点</emphasis>');
  });

  it('renders prosody with rate/pitch/volume', () => {
    const doc: SsmlDocument = {
      xmlLang: 'zh-CN',
      children: [
        SSML.prosody({ rate: 1.2, pitch: '+10%', volume: 0.8 }, [SSML.text('快一点')]),
      ],
    };
    const out = serializeSsml(doc);
    expect(out).toContain('rate="1.2"');
    expect(out).toContain('pitch="+10%"');
    expect(out).toContain('volume="0.8"');
  });

  it('renders say-as with interpret-as', () => {
    const doc: SsmlDocument = {
      xmlLang: 'zh-CN',
      children: [SSML.sayAs('date', [SSML.text('2026-08-10')], 'ymd')],
    };
    const out = serializeSsml(doc);
    expect(out).toContain('interpret-as="date"');
    expect(out).toContain('format="ymd"');
  });

  it('renders voice (role switch)', () => {
    const doc: SsmlDocument = {
      xmlLang: 'zh-CN',
      children: [SSML.voice('zh-CN-YunxiNeural', [SSML.text('你好')])],
    };
    expect(serializeSsml(doc)).toContain('<voice name="zh-CN-YunxiNeural">你好</voice>');
  });

  it('nests prosody inside emphasis', () => {
    const doc: SsmlDocument = {
      xmlLang: 'zh-CN',
      children: [
        SSML.emphasis('strong', [
          SSML.prosody({ rate: 0.8 }, [SSML.text('慢速强调')]),
        ]),
      ],
    };
    const out = serializeSsml(doc);
    expect(out).toContain('<emphasis level="strong"><prosody rate="0.8">慢速强调</prosody></emphasis>');
  });
});

describe('buildMultiVoiceSsml', () => {
  it('wraps each segment in voice tag with 300ms inter-segment pause', () => {
    const doc = buildMultiVoiceSsml(
      [
        { voice: 'zh-CN-YunxiNeural', content: [SSML.text('旁白')] },
        { voice: 'zh-CN-XiaoxiaoNeural', content: [SSML.text('角色 A')] },
      ],
      { xmlLang: 'zh-CN' }
    );
    const out = serializeSsml(doc);
    expect(out).toContain('<voice name="zh-CN-YunxiNeural">旁白</voice>');
    expect(out).toContain('<voice name="zh-CN-XiaoxiaoNeural">角色 A</voice>');
    // 两段之间 300ms 停顿
    expect(out.match(/<break time="300ms"\/>/g)?.length).toBe(2);
  });

  it('preserves per-segment language override', () => {
    const doc = buildMultiVoiceSsml([
      { voice: 'zh-CN-YunxiNeural', content: [SSML.text('旁白')] },
      { voice: 'en-US-GuyNeural', language: 'en-US', content: [SSML.text('Hello')] },
    ]);
    const out = serializeSsml(doc);
    expect(out).toContain('xml:lang="en-US"');
  });
});

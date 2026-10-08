import { describe, it, expect } from 'vitest';
import {
  createAssembly,
  isAssemblyRenderable,
  assemblyKitToTimelineTracks,
  timelineTracksToAssemblyKit,
  type AssemblyKit,
} from './assembly';

describe('Assembly Model & Timeline Adapters', () => {
  it('creates an empty initial AssemblyKit', () => {
    const kit = createAssembly('prod_123', 'douyin');
    expect(kit.productionId).toBe('prod_123');
    expect(kit.platformId).toBe('douyin');
    expect(kit.videoTracks.length).toBe(1);
    expect(kit.audioTracks.length).toBe(1);
    expect(isAssemblyRenderable(kit)).toBe(false);
  });

  it('converts AssemblyKit to TimelineTracks and back with high fidelity', () => {
    const kit: AssemblyKit = {
      id: 'assembly_1',
      productionId: 'prod_1',
      videoTracks: [
        {
          id: 'v_track_1',
          clips: [
            {
              id: 'c1',
              sourcePath: '/path/video.mp4',
              sourceInSecs: 1.5,
              sourceOutSecs: 6.5,
              outputStartSecs: 0,
              burnSubtitle: false,
            },
          ],
        },
      ],
      audioTracks: [
        {
          id: 'a_track_1',
          type: 'narration',
          voiceId: 'zh-CN-Yunxi',
          volume: 0.8,
          segments: [
            {
              id: 's1',
              startSecs: 0.5,
              endSecs: 4.5,
              text: '这是第一句解说',
              ssml: null,
              audioPath: '/path/voice.wav',
              roleId: null,
            },
          ],
        },
      ],
      subtitleTrack: {
        cues: [
          {
            id: 'sub1',
            startSecs: 0.5,
            endSecs: 4.5,
            text: '这是第一句解说',
            styleId: 'default',
          },
        ],
        styles: [],
      },
      coverPath: null,
      platformId: 'douyin',
      totalDurationSecs: 5.0,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };

    expect(isAssemblyRenderable(kit)).toBe(true);

    const tracks = assemblyKitToTimelineTracks(kit);
    expect(tracks.length).toBe(3); // 1 video + 1 audio + 1 subtitle
    expect(tracks[0].type).toBe('video');
    expect(tracks[0].clips[0].startMs).toBe(0);
    expect(tracks[0].clips[0].endMs).toBe(5000);
    expect(tracks[1].type).toBe('audio');
    expect(tracks[1].clips[0].startMs).toBe(500);
    expect(tracks[1].clips[0].endMs).toBe(4500);

    const restoredKit = timelineTracksToAssemblyKit(tracks, kit);
    expect(restoredKit.videoTracks[0].clips[0].sourceInSecs).toBe(1.5);
    expect(restoredKit.videoTracks[0].clips[0].sourceOutSecs).toBe(6.5);
    expect(restoredKit.audioTracks[0].segments[0].startSecs).toBe(0.5);
    expect(restoredKit.subtitleTrack.cues[0].text).toBe('这是第一句解说');
    expect(restoredKit.totalDurationSecs).toBe(5);
  });
});

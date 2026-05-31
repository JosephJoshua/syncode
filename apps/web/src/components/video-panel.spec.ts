import { describe, expect, it } from 'vitest';
import {
  shouldClearZoomTarget,
  type VideoPanelParticipant,
  type ZoomTarget,
} from './video-panel.js';

function makeTile(overrides: Partial<VideoPanelParticipant> = {}): VideoPanelParticipant {
  return {
    identity: 'alice',
    displayName: 'Alice',
    avatarUrl: null,
    isAiInterviewer: false,
    hasVideo: false,
    videoTrack: null,
    hasScreenShare: false,
    screenShareTrack: null,
    isSpeaking: false,
    isLocal: false,
    ...overrides,
  };
}

describe('shouldClearZoomTarget', () => {
  it('GIVEN zoomTarget is null THEN returns false', () => {
    const tiles = [makeTile({ identity: 'alice' })];
    expect(shouldClearZoomTarget(null, tiles)).toBe(false);
  });

  it('GIVEN camera zoomTarget points to a participant still in tiles THEN returns false', () => {
    const zoomTarget: ZoomTarget = { identity: 'alice', kind: 'camera' };
    const tiles = [makeTile({ identity: 'alice' }), makeTile({ identity: 'bob' })];
    expect(shouldClearZoomTarget(zoomTarget, tiles)).toBe(false);
  });

  it('GIVEN camera zoomTarget participant leaves the tiles list THEN returns true', () => {
    const zoomTarget: ZoomTarget = { identity: 'alice', kind: 'camera' };
    const tiles = [makeTile({ identity: 'bob' })];
    expect(shouldClearZoomTarget(zoomTarget, tiles)).toBe(true);
  });

  it('GIVEN camera zoomTarget and tiles list is empty THEN returns true', () => {
    const zoomTarget: ZoomTarget = { identity: 'alice', kind: 'camera' };
    expect(shouldClearZoomTarget(zoomTarget, [])).toBe(true);
  });

  it('GIVEN screen zoomTarget and participant is sharing screen THEN returns false', () => {
    const zoomTarget: ZoomTarget = { identity: 'alice', kind: 'screen' };
    const track = {} as MediaStreamTrack;
    const tiles = [makeTile({ identity: 'alice', hasScreenShare: true, screenShareTrack: track })];
    expect(shouldClearZoomTarget(zoomTarget, tiles)).toBe(false);
  });

  it('GIVEN screen zoomTarget and participant stopped sharing THEN returns true', () => {
    const zoomTarget: ZoomTarget = { identity: 'alice', kind: 'screen' };
    const tiles = [makeTile({ identity: 'alice', hasScreenShare: false, screenShareTrack: null })];
    expect(shouldClearZoomTarget(zoomTarget, tiles)).toBe(true);
  });

  it('GIVEN screen zoomTarget and participant has hasScreenShare flag but no track THEN returns true', () => {
    const zoomTarget: ZoomTarget = { identity: 'alice', kind: 'screen' };
    const tiles = [makeTile({ identity: 'alice', hasScreenShare: true, screenShareTrack: null })];
    expect(shouldClearZoomTarget(zoomTarget, tiles)).toBe(true);
  });

  it('GIVEN screen zoomTarget participant left the tiles list THEN returns true', () => {
    const zoomTarget: ZoomTarget = { identity: 'alice', kind: 'screen' };
    const tiles = [makeTile({ identity: 'bob' })];
    expect(shouldClearZoomTarget(zoomTarget, tiles)).toBe(true);
  });
});

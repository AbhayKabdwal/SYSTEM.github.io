import { describe, expect, it } from 'vitest';
import { cueFor, play, setSoundOn, setUiSoundOn, soundOn, uiSoundOn } from './sound';

describe('sounds', () => {
  it('picks a System cue from the notice headline', () => {
    expect(cueFor('LEVEL UP\nLVL 12')).toBe('fanfare');
    expect(cueFor('⚠ PENALTY ZONE')).toBe('warning');
    expect(cueFor('CHECK YOUR EMAIL')).toBe('chime');
  });

  it('never throws, even without audio or storage', () => {
    setSoundOn(true);
    setUiSoundOn(true);
    expect(soundOn()).toBe(true);
    expect(uiSoundOn()).toBe(true);
    expect(() => {
      play('tap');
      play('tick');
      play('fanfare');
    }).not.toThrow();
  });
});

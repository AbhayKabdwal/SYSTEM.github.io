import { describe, expect, it } from 'vitest';
import { dismissSystemAlert, systemAlert, useNotify } from './notify';

describe('system alerts', () => {
  it('queue instead of overwriting, and show in order', () => {
    systemAlert('LEVEL UP');
    systemAlert('NEW FEATURE');
    systemAlert('NEW FEATURE');
    expect(useNotify.getState().sys).toBe('LEVEL UP');
    dismissSystemAlert();
    expect(useNotify.getState().sys).toBe('NEW FEATURE');
    dismissSystemAlert();
    expect(useNotify.getState().sys).toBeNull();
  });
});

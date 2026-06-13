import { afterEach, describe, expect, it } from 'vitest';
import {
  checkGovernedToolAllowed,
  enforceGovernedToolIfActive,
  getRoleToolPolicy,
  isFinalNrtMode,
  parseGovernedRole,
} from '../../src/harness/role-policies.js';

describe('role policies', () => {
  const originalRole = process.env.SCCTL_GOVERNED_ROLE;
  const originalFinalNrt = process.env.SCCTL_FINAL_NRT;

  afterEach(() => {
    if (originalRole === undefined) {
      delete process.env.SCCTL_GOVERNED_ROLE;
    } else {
      process.env.SCCTL_GOVERNED_ROLE = originalRole;
    }
    if (originalFinalNrt === undefined) {
      delete process.env.SCCTL_FINAL_NRT;
    } else {
      process.env.SCCTL_FINAL_NRT = originalFinalNrt;
    }
  });

  it('parses governed roles from env', () => {
    process.env.SCCTL_GOVERNED_ROLE = 'builder';
    expect(parseGovernedRole()).toBe('builder');
    process.env.SCCTL_GOVERNED_ROLE = 'INVALID';
    expect(parseGovernedRole()).toBeUndefined();
  });

  it('detects final_nrt mode from env', () => {
    process.env.SCCTL_FINAL_NRT = '1';
    expect(isFinalNrtMode()).toBe(true);
    delete process.env.SCCTL_FINAL_NRT;
    expect(isFinalNrtMode()).toBe(false);
  });

  it('allows builder to use sc_run_probe but not sc_eval', () => {
    expect(checkGovernedToolAllowed('builder', 'sc_run_probe')).toBeNull();
    expect(checkGovernedToolAllowed('builder', 'sc_eval')).not.toBeNull();
  });

  it('allows manager workflow tools and blocks raw runtime tools', () => {
    expect(checkGovernedToolAllowed('manager', 'sc_prepare_handoff')).toBeNull();
    expect(checkGovernedToolAllowed('manager', 'sc_render')).not.toBeNull();
  });

  it('allows critic audit tools and blocks probe execution', () => {
    expect(checkGovernedToolAllowed('critic', 'sc_audit_session')).toBeNull();
    expect(checkGovernedToolAllowed('critic', 'sc_run_probe')).not.toBeNull();
  });

  it('allows builder sc_render_nrt only in final_nrt mode', () => {
    const defaultPolicy = getRoleToolPolicy('builder');
    const finalPolicy = getRoleToolPolicy('builder', { finalNrtRequested: true });

    expect(defaultPolicy.allowed_tools).toEqual(['sc_run_probe']);
    expect(finalPolicy.allowed_tools).toEqual(['sc_run_probe', 'sc_render_nrt']);
    expect(checkGovernedToolAllowed('builder', 'sc_render_nrt', { finalNrt: false })).not.toBeNull();
    expect(checkGovernedToolAllowed('builder', 'sc_render_nrt', { finalNrt: true })).toBeNull();
  });

  it('blocks sc_render for all roles when final_nrt env is active', () => {
    process.env.SCCTL_GOVERNED_ROLE = 'builder';
    process.env.SCCTL_FINAL_NRT = '1';
    expect(enforceGovernedToolIfActive('sc_render')).not.toBeNull();
    expect(enforceGovernedToolIfActive('sc_render_nrt')).toBeNull();
  });

  it('does not enforce when governed role env is unset', () => {
    delete process.env.SCCTL_GOVERNED_ROLE;
    expect(enforceGovernedToolIfActive('sc_eval')).toBeNull();
  });

  it('always allows universal diagnostic tools for governed roles', () => {
    expect(checkGovernedToolAllowed('manager', 'sc_status')).toBeNull();
    expect(checkGovernedToolAllowed('critic', 'sc_health')).toBeNull();
  });
});

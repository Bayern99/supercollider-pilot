import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import type { RoleName } from '../orchestration/orchestration-types.js';

const require = createRequire(import.meta.url);

export type GovernedRole = RoleName;

export interface RoleToolPolicy {
  allowed_tools: string[];
  forbidden_paths: string[];
}

export interface RoleToolPoliciesDocument {
  version: number;
  universal_diagnostic_tools: string[];
  governed_workflow_tools: string[];
  roles: {
    manager: RoleToolPolicy;
    builder: {
      default: RoleToolPolicy;
      final_nrt: RoleToolPolicy;
    };
    critic: RoleToolPolicy;
  };
  final_nrt_global_forbidden: string[];
}

const POLICIES_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../docs/superpowers/kb/role-tool-policies.json',
);

export const ROLE_TOOL_POLICIES: RoleToolPoliciesDocument = require(
  POLICIES_PATH,
) as RoleToolPoliciesDocument;

export interface GovernanceViolation {
  role: GovernedRole;
  tool: string;
  allowed_tools: string[];
  forbidden_paths: string[];
  summary: string;
}

export interface GovernedToolCheckOptions {
  finalNrt?: boolean;
  env?: NodeJS.ProcessEnv;
}

export function parseGovernedRole(
  env: NodeJS.ProcessEnv = process.env,
): GovernedRole | undefined {
  const raw = env.SCCTL_GOVERNED_ROLE?.trim().toLowerCase();
  if (raw === 'manager' || raw === 'builder' || raw === 'critic') {
    return raw;
  }
  return undefined;
}

export function isFinalNrtMode(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.SCCTL_FINAL_NRT?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

export function getRoleToolPolicy(
  role: GovernedRole,
  options: { finalNrtRequested?: boolean } = {},
): RoleToolPolicy {
  if (role === 'builder') {
    return options.finalNrtRequested
      ? ROLE_TOOL_POLICIES.roles.builder.final_nrt
      : ROLE_TOOL_POLICIES.roles.builder.default;
  }

  return ROLE_TOOL_POLICIES.roles[role];
}

export function isUniversalDiagnosticTool(toolName: string): boolean {
  return ROLE_TOOL_POLICIES.universal_diagnostic_tools.includes(toolName);
}

export function isGovernedWorkflowTool(toolName: string): boolean {
  return ROLE_TOOL_POLICIES.governed_workflow_tools.includes(toolName);
}

export function normalizeGovernedToolName(toolName: string): string {
  const normalized = toolName.trim();
  if (normalized.startsWith('sc_candidate_action')) {
    return 'sc_candidate_action';
  }
  return normalized;
}

export function checkGovernedToolAllowed(
  role: GovernedRole,
  toolName: string,
  options: GovernedToolCheckOptions = {},
): GovernanceViolation | null {
  const env = options.env ?? process.env;
  const normalizedTool = normalizeGovernedToolName(toolName);
  const finalNrt = options.finalNrt ?? isFinalNrtMode(env);
  const policy = getRoleToolPolicy(role, { finalNrtRequested: finalNrt });

  if (isUniversalDiagnosticTool(normalizedTool)) {
    return null;
  }

  if (finalNrt && ROLE_TOOL_POLICIES.final_nrt_global_forbidden.includes(normalizedTool)) {
    return buildViolation(role, normalizedTool, policy, finalNrt);
  }

  if (policy.forbidden_paths.includes(normalizedTool)) {
    return buildViolation(role, normalizedTool, policy, finalNrt);
  }

  if (!policy.allowed_tools.includes(normalizedTool)) {
    return buildViolation(role, normalizedTool, policy, finalNrt);
  }

  return null;
}

export function assertGovernedToolAllowed(
  role: GovernedRole,
  toolName: string,
  options: GovernedToolCheckOptions = {},
): void {
  const violation = checkGovernedToolAllowed(role, toolName, options);
  if (violation) {
    throw new Error(violation.summary);
  }
}

export function enforceGovernedToolIfActive(
  toolName: string,
  options: GovernedToolCheckOptions = {},
): GovernanceViolation | null {
  const env = options.env ?? process.env;
  const role = parseGovernedRole(env);
  if (!role) {
    return null;
  }

  return checkGovernedToolAllowed(role, toolName, options);
}

function buildViolation(
  role: GovernedRole,
  tool: string,
  policy: RoleToolPolicy,
  finalNrt: boolean,
): GovernanceViolation {
  const modeHint = finalNrt ? ' (final_nrt mode)' : '';
  return {
    role,
    tool,
    allowed_tools: [...policy.allowed_tools],
    forbidden_paths: [...policy.forbidden_paths],
    summary:
      `Governed role "${role}"${modeHint} may not use "${tool}". `
      + `Use governed workflow tools instead. Allowed tools: ${policy.allowed_tools.join(', ')}.`,
  };
}

export function getRoleToolPoliciesPath(): string {
  return POLICIES_PATH;
}

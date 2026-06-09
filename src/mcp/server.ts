import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { discoverSclangPath } from '../runtime/discover.js';
import { readScdFile } from '../runtime/sc-file.js';
import { renderSession } from '../runtime/render.js';
import { SclangController } from '../runtime/sclang.js';

const AGENT_SC_RULE =
  ' Do not encode formation, oracle, or casting logic in SuperCollider code.';

let activeController: SclangController | null = null;

export function getActiveController(): SclangController | null {
  return activeController;
}

export function setActiveController(controller: SclangController | null): void {
  activeController = controller;
}

async function ensureController(): Promise<SclangController> {
  if (activeController) {
    return activeController;
  }
  const path = discoverSclangPath();
  if (!path) {
    throw new Error('sclang binary not found');
  }
  activeController = new SclangController(path);
  await activeController.boot();
  return activeController;
}

async function stopAndClearController(): Promise<void> {
  if (!activeController) {
    return;
  }
  try {
    await activeController.stop();
  } catch {
    // Ignore stop errors during cleanup
  }
  activeController = null;
}

const handleSignal = async () => {
  await stopAndClearController();
  process.exit(0);
};

process.on('SIGINT', handleSignal);
process.on('SIGTERM', handleSignal);

export const server = new Server(
  {
    name: 'scctl-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'sc_check',
        description: 'Check if SuperCollider sclang path is available',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'sc_eval',
        description:
          'Evaluate SuperCollider code using a persistent sclang controller.' + AGENT_SC_RULE,
        inputSchema: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'SuperCollider code block to evaluate',
            },
          },
          required: ['code'],
        },
      },
      {
        name: 'sc_run_file',
        description:
          'Read and evaluate a .scd file in the active sclang session.' + AGENT_SC_RULE,
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Absolute or relative path to a .scd file',
            },
          },
          required: ['path'],
        },
      },
      {
        name: 'sc_logs',
        description: 'Return recent sclang post output from the active session. Use after sc_eval errors.',
        inputSchema: {
          type: 'object',
          properties: {
            tail: {
              type: 'number',
              description: 'Optional max characters from end of buffer',
            },
          },
        },
      },
      {
        name: 'sc_render',
        description:
          'Record user SuperCollider code to a WAV file (R1 wrapper: boot, record, wait, stop). Do not call s.record in user code.' +
          AGENT_SC_RULE,
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to a .scd file (use path or code, not both)',
            },
            code: {
              type: 'string',
              description: 'Inline SuperCollider code (use path or code, not both)',
            },
            out: {
              type: 'string',
              description: 'Output WAV file path',
            },
            duration: {
              type: 'number',
              description: 'Record duration in seconds (default 5)',
            },
          },
          required: ['out'],
        },
      },
      {
        name: 'sc_stop',
        description: 'Stop the active SuperCollider sclang controller',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'sc_check') {
    const path = discoverSclangPath();
    if (path) {
      return {
        content: [
          {
            type: 'text',
            text: `sclang found at: ${path}`,
          },
        ],
      };
    }
    return {
      content: [
        {
          type: 'text',
          text: 'sclang binary not found in standard paths or system PATH',
        },
      ],
      isError: true,
    };
  }

  if (name === 'sc_eval') {
    const code = args?.code;
    if (code === undefined || code === null || code === '') {
      return {
        content: [{ type: 'text', text: 'Missing required argument: code' }],
        isError: true,
      };
    }
    if (typeof code !== 'string') {
      return {
        content: [{ type: 'text', text: 'Argument "code" must be a string.' }],
        isError: true,
      };
    }

    try {
      const controller = await ensureController();
      const result = await controller.execute(code);
      return {
        content: [{ type: 'text', text: result.output }],
        isError: !result.success,
      };
    } catch (err: any) {
      await stopAndClearController();
      return {
        content: [{ type: 'text', text: `Execution failed: ${err.message}` }],
        isError: true,
      };
    }
  }

  if (name === 'sc_run_file') {
    const filePath = args?.path;
    if (filePath === undefined || filePath === null || filePath === '') {
      return {
        content: [{ type: 'text', text: 'Missing required argument: path' }],
        isError: true,
      };
    }
    if (typeof filePath !== 'string') {
      return {
        content: [{ type: 'text', text: 'Argument "path" must be a string.' }],
        isError: true,
      };
    }

    try {
      const code = readScdFile(filePath);
      const controller = await ensureController();
      const result = await controller.execute(code);
      return {
        content: [{ type: 'text', text: result.output }],
        isError: !result.success,
      };
    } catch (err: any) {
      await stopAndClearController();
      return {
        content: [{ type: 'text', text: `Execution failed: ${err.message}` }],
        isError: true,
      };
    }
  }

  if (name === 'sc_logs') {
    if (!activeController) {
      return {
        content: [{ type: 'text', text: 'No active sclang session' }],
        isError: true,
      };
    }
    let text = activeController.getLogs();
    const tail = args?.tail;
    if (typeof tail === 'number' && tail > 0 && text.length > tail) {
      text = text.slice(-tail);
    }
    return {
      content: [{ type: 'text', text }],
    };
  }

  if (name === 'sc_render') {
    const out = args?.out;
    const filePath = args?.path;
    const code = args?.code;
    const hasPath = typeof filePath === 'string' && filePath !== '';
    const hasCode = typeof code === 'string' && code !== '';

    if (out === undefined || out === null || typeof out !== 'string' || out === '') {
      return {
        content: [{ type: 'text', text: 'Missing required argument: out' }],
        isError: true,
      };
    }
    if (hasPath === hasCode) {
      return {
        content: [{ type: 'text', text: 'Provide exactly one of path or code' }],
        isError: true,
      };
    }

    let userCode: string;
    try {
      userCode = hasPath ? readScdFile(filePath as string) : (code as string);
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: `Execution failed: ${err.message}` }],
        isError: true,
      };
    }

    const sclangPath = discoverSclangPath();
    if (!sclangPath) {
      return {
        content: [{ type: 'text', text: 'sclang binary not found' }],
        isError: true,
      };
    }

    await stopAndClearController();
    const controller = new SclangController(sclangPath);
    activeController = controller;

    const duration =
      typeof args?.duration === 'number' && args.duration > 0 ? args.duration : 5;

    try {
      const result = await renderSession(controller, {
        userCode,
        outPath: out,
        durationSec: duration,
      });
      activeController = null;

      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Render failed.\n${result.output}\nWAV: ${result.outPath} (${result.bytes} bytes)`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `WAV: ${result.outPath} (${result.bytes} bytes)\n${result.output}`,
          },
        ],
      };
    } catch (err: any) {
      await stopAndClearController();
      return {
        content: [{ type: 'text', text: `Execution failed: ${err.message}` }],
        isError: true,
      };
    }
  }

  if (name === 'sc_stop') {
    if (activeController) {
      try {
        await activeController.stop();
      } catch (err: any) {
        activeController = null;
        return {
          content: [{ type: 'text', text: `Failed to stop: ${err.message}` }],
          isError: true,
        };
      }
      activeController = null;
      return {
        content: [{ type: 'text', text: 'sclang controller stopped successfully' }],
      };
    }
    return {
      content: [{ type: 'text', text: 'No active sclang controller running' }],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

export async function startMcpServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

import { fileURLToPath } from 'url';
const nodePath = process.argv[1];
if (nodePath && import.meta.url) {
  try {
    const modulePath = fileURLToPath(import.meta.url);
    if (nodePath === modulePath || nodePath.endsWith('server.ts') || nodePath.endsWith('server.js')) {
      startMcpServer().catch(console.error);
    }
  } catch {
    // Ignore
  }
}

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawn } from 'child_process';
import { SclangController } from '../../src/runtime/sclang.js';
import { EventEmitter } from 'events';

class MockStdin extends EventEmitter {
  write = vi.fn();
  end = vi.fn();
}

class MockProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  stdin = new MockStdin();
  kill = vi.fn();
}

let mockProcess: MockProcess;

vi.mock('child_process', () => {
  return {
    spawn: vi.fn().mockImplementation(() => {
      return mockProcess;
    })
  };
});

describe('Sclang Process Controller', () => {
  beforeEach(() => {
    mockProcess = new MockProcess();
    vi.mocked(spawn).mockClear();
  });

  it('should instantiate and execute a simple code block', async () => {
    const controller = new SclangController('/mock/path/sclang');
    expect(controller).toBeDefined();
    expect(typeof controller.execute).toBe('function');
  });

  it('should boot and execute code successfully', async () => {
    const controller = new SclangController('/mock/path/sclang');
    
    vi.useFakeTimers();
    const bootPromise = controller.boot();
    
    await vi.advanceTimersByTimeAsync(1500);
    await bootPromise;

    const execPromise = controller.execute('1 + 1');

    setTimeout(() => {
      const lastWrite = mockProcess.stdin.write.mock.calls[0][0] as string;
      const delimMatch = lastWrite.match(/SC_EVAL_DONE_\d+_\d+/);
      const delim = delimMatch ? delimMatch[0] : '';
      mockProcess.stdout.emit('data', Buffer.from(`\n2\n${delim}_OK\n`));
    }, 100);

    await vi.advanceTimersByTimeAsync(200);
    const result = await execPromise;

    expect(result.success).toBe(true);
    expect(result.output).toContain('2');
    expect(controller.getLogs()).toContain('2');
    vi.useRealTimers();
  });

  it('should boot and handle execution error', async () => {
    const controller = new SclangController('/mock/path/sclang');
    
    vi.useFakeTimers();
    const bootPromise = controller.boot();
    
    await vi.advanceTimersByTimeAsync(1500);
    await bootPromise;

    const execPromise = controller.execute('invalid_code');

    setTimeout(() => {
      const lastWrite = mockProcess.stdin.write.mock.calls[0][0] as string;
      const delimMatch = lastWrite.match(/SC_EVAL_DONE_\d+_\d+/);
      const delim = delimMatch ? delimMatch[0] : '';
      mockProcess.stdout.emit('data', Buffer.from(`\nERROR: Class not defined\n${delim}_ERR\n`));
    }, 100);

    await vi.advanceTimersByTimeAsync(200);
    const result = await execPromise;

    expect(result.success).toBe(false);
    expect(result.output).toContain('ERROR: Class not defined');
    expect(controller.getLogs()).toContain('ERROR: Class not defined');
    vi.useRealTimers();
  });

  it('should stop the process and send stop commands', async () => {
    const controller = new SclangController('/mock/path/sclang');
    
    vi.useFakeTimers();
    const bootPromise = controller.boot();
    await vi.advanceTimersByTimeAsync(1500);
    await bootPromise;

    const stopPromise = controller.stop();
    
    expect(mockProcess.stdin.write).toHaveBeenCalledWith('CmdPeriod.run; Server.killAll;\n\x0c');
    expect(mockProcess.stdin.end).toHaveBeenCalled();
    
    await vi.advanceTimersByTimeAsync(500);
    await stopPromise;
    expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL');
    vi.useRealTimers();
  });

  it('should reject boot on spawn error', async () => {
    const controller = new SclangController('/mock/path/sclang');

    const bootPromise = controller.boot();
    const rejection = expect(bootPromise).rejects.toThrow('Spawn failed');

    const testError = new Error('Spawn failed');
    mockProcess.emit('error', testError);

    await rejection;
  });

  it('should reject execute on process exit', async () => {
    const controller = new SclangController('/mock/path/sclang');
    
    vi.useFakeTimers();
    const bootPromise = controller.boot();
    await vi.advanceTimersByTimeAsync(1500);
    await bootPromise;

    const execPromise = controller.execute('1 + 1');

    mockProcess.emit('exit', 1, 'SIGKILL');

    await expect(execPromise).rejects.toThrow('sclang process exited unexpectedly with code 1 and signal SIGKILL');
    vi.useRealTimers();
  });

  it('should reject concurrent execution calls', async () => {
    const controller = new SclangController('/mock/path/sclang');
    
    vi.useFakeTimers();
    const bootPromise = controller.boot();
    await vi.advanceTimersByTimeAsync(1500);
    await bootPromise;

    const execPromise1 = controller.execute('1 + 1');
    const execPromise2 = controller.execute('2 + 2');

    await expect(execPromise2).rejects.toThrow('Concurrent execution is not supported');

    const lastWrite = mockProcess.stdin.write.mock.calls[0][0] as string;
    const delimMatch = lastWrite.match(/SC_EVAL_DONE_\d+_\d+/);
    const delim = delimMatch ? delimMatch[0] : '';
    mockProcess.stdout.emit('data', Buffer.from(`${delim}_OK`));

    await execPromise1;
    vi.useRealTimers();
  });

  it('should pass user code literally without JS template interpolation', async () => {
    const controller = new SclangController('/mock/path/sclang');

    vi.useFakeTimers();
    const bootPromise = controller.boot();
    await vi.advanceTimersByTimeAsync(1500);
    await bootPromise;

    const literal = '"${Date.now()}"';
    const execPromise = controller.execute(literal);

    setTimeout(() => {
      const written = mockProcess.stdin.write.mock.calls[0][0] as string;
      expect(written).toContain('${Date.now()}');
      const delimMatch = written.match(/SC_EVAL_DONE_\d+_\d+/);
      const delim = delimMatch ? delimMatch[0] : '';
      mockProcess.stdout.emit('data', Buffer.from(`${delim}_OK\n`));
    }, 100);

    await vi.advanceTimersByTimeAsync(200);
    await execPromise;
    vi.useRealTimers();
  });

  it('should reject execute when timeout expires', async () => {
    const controller = new SclangController('/mock/path/sclang', { executeTimeoutMs: 1000 });

    vi.useFakeTimers();
    const bootPromise = controller.boot();
    await vi.advanceTimersByTimeAsync(1500);
    await bootPromise;

    const execPromise = controller.execute('slow_code');
    const rejection = expect(execPromise).rejects.toThrow('Execution timed out after 1000ms');
    await vi.advanceTimersByTimeAsync(1001);
    await rejection;
    vi.useRealTimers();
  });

  it('should detect delimiter on stderr', async () => {
    const controller = new SclangController('/mock/path/sclang');

    vi.useFakeTimers();
    const bootPromise = controller.boot();
    await vi.advanceTimersByTimeAsync(1500);
    await bootPromise;

    const execPromise = controller.execute('1 + 1');

    setTimeout(() => {
      const lastWrite = mockProcess.stdin.write.mock.calls[0][0] as string;
      const delimMatch = lastWrite.match(/SC_EVAL_DONE_\d+_\d+/);
      const delim = delimMatch ? delimMatch[0] : '';
      mockProcess.stderr.emit('data', Buffer.from(`\n2\n${delim}_OK\n`));
    }, 100);

    await vi.advanceTimersByTimeAsync(200);
    const result = await execPromise;

    expect(result.success).toBe(true);
    expect(result.output).toContain('2');
    vi.useRealTimers();
  });

  it('should reject execute when stop is called during execution', async () => {
    const controller = new SclangController('/mock/path/sclang');

    vi.useFakeTimers();
    const bootPromise = controller.boot();
    await vi.advanceTimersByTimeAsync(1500);
    await bootPromise;

    const execPromise = controller.execute('1 + 1');
    const stopPromise = controller.stop();

    await expect(execPromise).rejects.toThrow('Controller stopped');
    await vi.advanceTimersByTimeAsync(500);
    await stopPromise;
    vi.useRealTimers();
  });

  it('should deduplicate concurrent boot calls', async () => {
    const controller = new SclangController('/mock/path/sclang');

    vi.useFakeTimers();
    const boot1 = controller.boot();
    const boot2 = controller.boot();

    expect(boot1).toBe(boot2);
    expect(vi.mocked(spawn)).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1500);
    await boot1;
    await boot2;
    vi.useRealTimers();
  });

  it('should cap output buffer size', async () => {
    const controller = new SclangController('/mock/path/sclang', { maxLogBytes: 100 });

    vi.useFakeTimers();
    const bootPromise = controller.boot();
    await vi.advanceTimersByTimeAsync(1500);
    await bootPromise;

    mockProcess.stdout.emit('data', Buffer.from('x'.repeat(150)));
    expect(controller.getLogs().length).toBeLessThanOrEqual(100);
    vi.useRealTimers();
  });
});

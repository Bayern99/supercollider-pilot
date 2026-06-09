# SuperCollider × Coding Agent 控制方案讨论总结

## 0. 本文目的

本 thread 的核心问题不是“如何重新发明一个音乐软件”，而是：

> 如何让 Coding Agent 更好地控制、调用、运行、调试 SuperCollider？

结论非常明确：

> 不要一开始做大平台、不要先做 IDE、不要先做复杂音乐语言。
> 最合理方向是：让 Agent 稳定地执行原生 SuperCollider / sclang 代码，并获得可读的状态、日志、报错、停止与渲染能力。

------

## 1. SuperCollider 的基本结构

```text
scsynth  = real-time audio server
sclang   = SuperCollider language interpreter / client
scide    = official editor / IDE
OSC      = sclang / other clients 与 scsynth 通信的底层协议
```

最自然的工作流是：

```text
Coding Agent
  ↓
写 / 修改 .scd
  ↓
通过 CLI / MCP 执行 sclang
  ↓
sclang 控制 scsynth
  ↓
返回日志 / 报错 / 状态 / 音频文件
```

------

## 2. 最终判断

你的需求不是做完整产品，而是：

> 让 Coding Agent 更好地控制 SuperCollider。

因此不要做复杂平台。最小正确方向是：

```text
Agent → 薄控制层 → sclang / scsynth
```

最稳结构：

```text
CLI 作为底座
MCP 作为 Agent 接口
```

------

## 3. 最小可行工具：`scctl`

建议做一个极薄控制器：

```bash
scctl check
scctl run file.scd
scctl stop
scctl logs
scctl render file.scd --out out.wav
```

它解决的是 Agent 的真实痛点：

```text
1. 找不到 sclang / scsynth
2. 不知道 SuperCollider 有没有启动
3. 写了 .scd 但不能运行
4. 运行出错但 Agent 看不到 post window / stderr
5. 声音停不掉
6. 不能稳定渲染 / 录音
7. 无法形成“写 → 跑 → 报错 → 修 → 再跑”的闭环
```

------

## 4. 不建议一开始直接 OSC

直接 OSC 可以，但不适合作为第一入口。

```text
Agent → OSC message → scsynth
```

问题是 Agent 要理解：

```text
/s_new
/n_set
/b_alloc
/b_read
/g_new
SynthDef binary
node id
buffer id
bus routing
UGen graph
```

更好的默认方式：

```text
Agent → sclang code → scsynth
```

OSC 适合作为第二阶段能力，用于实时参数控制：

```bash
scctl set cutoff 1200
scctl set density 0.4
scctl fade drone 8
```

------

## 5. 推荐 Agent 项目结构

```text
my-sc-project/
  AGENTS.md
  main.scd
  logs/
  renders/
  samples/
  README.md
```

`AGENTS.md` 可以写：

```md
You are controlling a SuperCollider project.

Always generate runnable `.scd` files.
Use `scctl run main.scd` to test.
Use `scctl logs` to inspect errors.
Use `scctl stop` before replacing long-running sound processes.
Do not invent UGens.
Prefer native SuperCollider patterns: SynthDef, Pbind, Pdef, Ndef, Routine, Task, Bus, Buffer.
When the result is final, use `scctl render main.scd --out renders/output.wav`.
```

------

# 6. 直接 SuperCollider 相关仓库

## 6.1 `supercollider/supercollider`

官方主仓库。

意义：

```text
SuperCollider 本体
包含 scsynth / sclang / scide
```

Agent bridge 不应该绕开它的 client/server 架构，而应该利用它。

------

## 6.2 `supercollider/sc3-plugins`

官方社区 server plugins。

```text
sc3-plugins = scsynth server 层 UGen 扩展
Quarks      = sclang 语言层扩展 / class library
```

Agent bridge 的 `check` 应该检查：

```text
SuperCollider installed
sclang found
scsynth found
Quarks path
Extensions path
sc3-plugins installed or not
```

------

## 6.3 `davidgranstrom/scnvim`

Neovim 的 SuperCollider 前端插件。

作用：

```text
Neovim 写 .scd
↓
发送当前行 / block / selection 给 sclang
↓
显示 post window 输出
↓
查看 server status
↓
打开 help
↓
hard stop / recompile / start
```

值得借鉴：

```text
find sclang
start sclang
send code
capture post window output
hard stop
server status
help system
```

不建议直接改成 Agent 工具，因为它深度绑定 Neovim / Lua / buffer / window / keymap，并且是 GPL-3.0。

结论：

```text
scnvim = 参考答案
scctl  = 你真正要做的东西
```

------

## 6.4 `jeremyruppel/claude-collider`

定位：

```text
MCP server + SuperCollider live coding suite
```

主要 MCP tools：

```text
cc_execute
cc_status
cc_reboot
cc_control
cc_fx
cc_midi
cc_sample
cc_recording
cc_output
```

优点：

```text
1. 最像“马上能玩起来”的方案
2. MCP 工具完整
3. 能 boot、execute、stop、record
4. 已经考虑 LLM live coding workflow
```

问题：

```text
1. 它不只是 bridge，而是带自己的音乐框架
2. 有 ClaudeCollider Quark
3. 有 built-in synths / effects
4. 有 songwriting skill
5. 有 Tape session 格式
6. 会把 Agent 引向 ClaudeCollider-specific abstraction
```

判断：

```text
适合：快速验证 Agent → SC 控制链路
不适合：作为“纯原生 SuperCollider 工作方式”的长期底座
```

------

## 6.5 `agrathwohl/supercollider-mcp`

定位：

```text
更通用的 SuperCollider MCP server
```

能力：

```text
server lifecycle
Quark package management
SynthDef management
Synth control
Group management
Buffer management
Pdef / Tdef support
Status query
Resource allocation
```

优点：

```text
1. 更接近通用 SuperCollider 控制 API
2. 比 claude-collider 更少音乐 DSL 倾向
3. 架构方向接近 Agent bridge
```

风险：

```text
1. 项目比较早期
2. 工具数量较多，Agent 可能乱用
3. 需要实测稳定性
```

结论：

```text
适合：研究 / fork / 改成更干净的 scctl + MCP
```

------

## 6.6 `Tok/SuperColliderMCP`

定位：

```text
Python + FastMCP + python-osc 的 SuperCollider MCP template
```

优点：

```text
1. 简单
2. 容易读懂
3. 容易改
4. 适合作为 Python MCP 原型
```

问题：

```text
1. 偏 OSC demo
2. 不是成熟控制系统
3. 不一定能很好处理 sclang post window / .scd 文件 / 报错定位
```

结论：

```text
适合看代码结构，不建议当主力
```

------

## 6.7 `Synohara/supercollider-mcp`

定位：

```text
基于 supercolliderjs 的 SuperCollider MCP server
```

优点：

```text
1. 安装方式简单
2. 可接 Claude Desktop / VS Code MCP
3. 思路轻
```

问题：

```text
1. 只明确测试过 macOS Apple Silicon / M1
2. 依赖 supercolliderjs
3. 跨平台稳定性需要实测
```

结论：

```text
Apple Silicon Mac 可以顺手试，但不作为第一底座
```

------

## 6.8 `supriya-project/supriya`

定位：

```text
Python API for SuperCollider
```

适合：

```text
Python users
Jupyter
data sonification
AI / ML / data-driven composition
non-realtime score rendering
```

不适合：

```text
完全替代 sclang 原生生态
```

------

## 6.9 `interactive-sonification/sc3nb`

定位：

```text
Python + Jupyter 的 SuperCollider interface
```

适合：

```text
auditory display
interactive sonification
Jupyter notebooks
Python data → sound
```

不是当前 Agent bridge 的主路线。

------

## 6.10 `crucialfelix/supercolliderjs`

定位：

```text
JavaScript client library for SuperCollider server and language interpreter
```

适合：

```text
Node
Electron
Web UI
JavaScript tooling
```

风险：

```text
生态活跃度和长期维护需要实测，不建议核心底座完全押在它上面
```

------

# 7. 非音乐但值得借鉴的桥接项目

## 7.1 `nrepl/nrepl`

Clojure network REPL。

可借鉴：

```text
eval
load-file
interrupt
describe
session
close
```

对应 SuperCollider：

```text
sc_eval
sc_run_file
sc_hard_stop
sc_describe_environment
sc_session_status
sc_close
```

------

## 7.2 `jupyter/jupyter_client`

Jupyter protocol client APIs + kernel management。

可借鉴：

```text
runtime lifecycle
execution request
stdout / stderr capture
status: busy / idle / error
structured result
kernel shutdown / restart
```

对应 SuperCollider：

```text
Agent
  ↓
sclang manager
  ↓
execute code / capture post window / stderr
  ↓
return structured result
```

------

## 7.3 `ahujasid/blender-mcp`

Claude / MCP 控制 Blender。

结构：

```text
Claude / MCP client
  ↓
MCP server
  ↓
socket
  ↓
Blender addon
  ↓
Blender Python runtime
```

可借鉴：

```text
复杂创作软件不需要重写 UI
外部 MCP server 负责转发工具调用
内部 runtime 执行命令
Agent 读取状态并迭代
```

------

## 7.4 `arduino/arduino-cli`

Arduino 官方 CLI。

可借鉴：

```text
把原来 IDE 中的核心动作变成机器可调用命令
```

对应 SuperCollider：

```text
check
quarks list/install
run
render
stop
logs
status
```

------

## 7.5 `noodledostuff/osc-mcp-server`

通用 OSC MCP server。

适合未来用于：

```text
Max/MSP
TouchOSC
VR / sensors
interactive installation
real-time parameter control
```

但不能替代 sclang bridge。

------

## 7.6 MCP2OSC

自然语言 → OSC 参数控制。

启发：

```text
OSC 适合做实时控制层。
sclang 仍然更适合做代码生成、结构创建和项目逻辑。
```

------

# 8. 推荐优先级

## 8.1 直接试用优先级

```text
1. agrathwohl/supercollider-mcp
   更接近通用原生 SC 控制层。

2. Synohara/supercollider-mcp
   Apple Silicon Mac 可以快速试。

3. claude-collider
   适合验证链路，但要小心它自己的音乐框架。

4. Tok/SuperColliderMCP
   适合看 Python + FastMCP + OSC 代码，不建议当主力。
```

## 8.2 代码借鉴优先级

```text
1. scnvim
   学 sclang 启动、发送代码、post output、hard stop。

2. nREPL
   学 eval / load-file / interrupt / session / describe。

3. Jupyter Client
   学 kernel lifecycle、stdout/stderr、status、structured result。

4. Arduino CLI
   学如何把复杂创作环境压成机器可调用 CLI。

5. Blender MCP
   学 creative software + MCP bridge 的整体结构。

6. OSC MCP / MCP2OSC
   学实时参数控制和 OSC tool schema。
```

------

# 9. 如果自己做，最小代码结构

```text
scctl/
  src/
    cli.ts
    runtime/
      discover.ts
      sclang.ts
      scsynth.ts
      logs.ts
    commands/
      check.ts
      run.ts
      stop.ts
      logs.ts
      render.ts
    mcp/
      server.ts
  sc/
    bootstrap.scd
```

第一版 MCP tools 只保留：

```text
sc_check()
sc_run_file(path)
sc_eval(code)
sc_stop()
sc_logs()
sc_render(path, out)
```

不要一开始暴露 20+ 个 tools。工具太多，Agent 反而容易乱。

------

# 10. 测试清单

任何方案先做这几个测试：

```text
1. boot SuperCollider
2. 播放一个 440Hz sine tone
3. stop all
4. 故意写一个错误 UGen，看 Agent 能否读懂报错
5. 运行一个 Pbind / Pdef
6. 录音或渲染 5 秒 wav
7. 重启 server 后再次执行
8. 检查是否能处理长时间运行的声音
9. 检查是否能 kill 掉 runaway sound
10. 检查 logs 是否能被 Agent 读取
```

------

# 11. 最终路线建议

```text
第一步：试现成 MCP
  - agrathwohl/supercollider-mcp
  - Synohara/supercollider-mcp
  - claude-collider 只作链路验证

第二步：研究 scnvim
  - 不 fork 整个项目
  - 只学它如何启动 sclang、发送代码、读取 post output、hard stop

第三步：做一个极薄 scctl
  - check / run / stop / logs / render

第四步：把 scctl 包成 MCP
  - 只暴露 5–6 个 tools

第五步：必要时加 OSC 实时参数控制
  - set / fade / trigger / stop
```

最终目标：

```text
Coding Agent → 原生 .scd / sclang → SuperCollider
```

而不是：

```text
Coding Agent → 某个新的音乐 DSL → SuperCollider
```

------

# 12. 最终结论

一句话总结：

> 你真正需要的是一个 SuperCollider 的 Agent 控制适配层，不是新的音乐语言，也不是新的 IDE。

最干净的方向：

```text
scnvim 的外部控制思路
+
nREPL/Jupyter 的 runtime protocol 思路
+
Arduino CLI 的机器接口思路
+
MCP 的 Agent 工具接口
=
scctl / supercollider-agent-bridge
```

最终形态：

```text
Agent writes native SuperCollider code.
Bridge runs it through sclang.
Bridge captures logs/errors/status.
Bridge can stop/reboot/render.
Agent fixes and iterates.
```
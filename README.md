# CodexPlugin

Codex 的专属插件库。目前收录 **Codex 头像额度圆环 · 流星与重置卡定制版**，基于 [Codex Usage Badge](https://github.com/jaykinhoo9/codex-usage-badge) 0.9.4 修改。这是社区定制项目，不是 OpenAI 官方插件。

当前版本：`0.9.4-avatar-meteor.3` · renderer `1049`。

## 适用范围

这是 **macOS 上已有 CodexUsageBadge 的定制升级包**。它依赖已经安装的原插件、updater、LaunchAgent、本机调试连接，以及客户端自带的 Codex CLI；仓库不提供这些组件的全新安装流程。

安装前置由 [package.json](outputs/CodexAvatarQuota/package.json) 的 `baseHashes` 严格决定：已安装的 `agent.cjs`、`manage.cjs`、`reset-controller.cjs` 必须全部匹配指定 SHA-256。**仅版本号为 0.9.4 并不足够**；当前清单对应本定制分支的已有文件，不能直接应用于任意原版 0.9.4 或其他定制版本。

当前启用脚本使用 `/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node`，默认插件目录为 `~/Library/Application Support/CodexUsageBadge`。应用名称、路径、原插件部署方式不同，需要先适配，不能跳过哈希检查强行覆盖。

## 功能

- 在原账户头像外围显示额度圆环，默认静止；悬停 1 秒后，圆环拆成流星并汇聚成额度卡片。头像点击仍保留原账户菜单。
- 剩余额度大于 50% 为绿色，10%–50% 为琥珀色，低于 10% 为红色；0% 保留淡红空环，未知或过期数据显示灰色。
- 显示实际剩余额度、已使用比例、重置倒计时和周期进度；数据来自已登录账户的 Codex App Server。
- 显示重置卡数量和服务端提供的到期信息。详情暂缺时补读，日期到达后同步更新已展开的胶囊；列表缺失、截断或日期未知时如实显示，不从卡片数量猜日期。
- 蓝色胶囊持续按住 1.2 秒才提交重置；提前松开、移出或失去焦点会取消。提交会消耗真实重置卡，结果以服务端确认及后续读取为准，不预设恢复到 100%。
- 文档重建、迟到的执行上下文和短暂断线会自动恢复挂载。窗口扫描与目录、Token 读取分开，辅助请求不会阻塞圆环恢复。

重置操作使用账户校验、持久幂等记录和单次操作锁。超时或结果不确定时只核对状态，不自动再次消费。Token 指标与官方额度是不同数据，不能按线性比例换算。

## 升级、启用与恢复

先确认当前环境和 `baseHashes` 匹配，再从仓库根目录运行文件升级脚本：

```bash
"/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node" outputs/CodexAvatarQuota/install-files.cjs
```

脚本验证待安装文件、检查原文件哈希、创建备份，再替换插件文件。它不操作 Codex 窗口，也不重新启动后台进程。插件自动更新会关闭，避免上游更新覆盖定制代码；Codex 自身的更新设置不变。

安装成功后，双击 `outputs/CodexAvatarQuota/启用头像额度.command`，重新加载已安装的后台插件。需要撤回时，双击同目录的 `恢复上一版.command`；它恢复本次升级前的插件文件和更新设置，并保留重置操作记录。恢复也会校验当前文件和备份，检测到后续修改时停止覆盖。

备份目录记录在本机的 `avatar-customization.json` 中。不要删除重置操作记录来绕过待确认状态；进程意外终止留下操作锁时，应先确认插件进程已全部停止，再检查锁和记录。

## 目录与构建

保留现有相对路径，方便复现构建和运行测试：

```text
CodexPlugin/
├── README.md
├── CHANGELOG.md
├── .gitignore
├── outputs/CodexAvatarQuota/       # 可审查的升级包、安装/启用/恢复脚本、清单与许可证
└── work/avatar-quota/             # 源码模板、上游构建基线、预览及测试
    ├── original-agent.cjs         # 上游 0.9.4 基线
    ├── original-manage.cjs
    ├── install-usage-badge.js      # 头像圆环与重置卡界面
    ├── reset-controller.cjs        # 真实账户读取、重置事务与幂等记录
    ├── cdp-action-session.js       # 仅默认主窗口上下文的本机桥接
    ├── renderer-injector.js        # 挂载与重连后的数据回填
    ├── startup-loops.js            # 独立扫描与辅助刷新节拍
    └── build-custom-agent.py
```

Python 3 用于构建；JavaScript 测试使用兼容项目所需内置模块的 Node.js，开发时可使用客户端自带的 Node。以下命令在仓库根目录运行：

```bash
python3 work/avatar-quota/build-custom-agent.py
node --check outputs/CodexAvatarQuota/agent.cjs
node work/avatar-quota/test-data.cjs
node work/avatar-quota/test-reset-controller.cjs
node work/avatar-quota/test-renderer-state.cjs
node work/avatar-quota/test-startup.cjs
```

这些测试使用模拟数据或模拟传输，不调用真实重置接口。`test-installer.cjs` 另依赖本机已有插件文件生成临时测试目录，不属于任意新环境可直接运行的离线测试。`verify-live-data.cjs` 会查询真实已登录账户，仅用于主动进行只读验证；它不是默认测试步骤，输出不应提交仓库。

构建脚本只生成 `agent.cjs`、`manage.cjs` 和 `reset-controller.cjs`，**不会自动更新发布清单的哈希**。修改后发布，需要重新核对 `payloadHashes`；`baseHashes` 必须对应明确支持的已安装基线，不应改成任意值来绕过安装检查。

界面演示可单独启动：

```bash
python3 work/avatar-quota/serve-preview.py
```

然后打开 `http://127.0.0.1:8767/preview-reset.html`。这是独立模拟页面，不消耗真实重置卡。

## 数据与兼容边界

运行时使用原插件已有的本机 `127.0.0.1:39222` 调试连接；本定制包不新增生产监听端口，不修改原应用包，也不读取或保存登录令牌。额度与重置请求通过客户端自带 App Server 发送。

仓库只保存代码、模拟测试和发布清单。真实额度快照、账户查询输出、日志、安装回执、备份、操作记录和凭据不得提交；`.gitignore` 提供常见文件的排除规则，但发布前仍需检查暂存内容。

已覆盖只读账户查询、模拟重置、独立页面交互和启动恢复测试。没有用真实重置卡做消费测试，也不承诺适配任意未来客户端版本；客户端 DOM 或协议变化后可能需要重新适配。

## 来源与许可

上游项目为 [jaykinhoo9/codex-usage-badge](https://github.com/jaykinhoo9/codex-usage-badge)。原始基线用于可复现构建，保留原项目版权声明；许可证见 [MIT LICENSE](outputs/CodexAvatarQuota/LICENSE)。改动记录见 [CHANGELOG.md](CHANGELOG.md)。

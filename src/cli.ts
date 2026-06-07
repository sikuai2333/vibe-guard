#!/usr/bin/env node
import { resolve } from "node:path";
import { installAgent, setupLocalMcp, uninstallAgent, type AgentTarget, type SetupTarget } from "./agents.js";
import { formatClaudeVerify, verifyClaudeProject } from "./claude.js";
import { qualityGate } from "./check.js";
import { doctor, formatDoctor } from "./doctor.js";
import { developmentGuidance, formatDevelopmentGuidance, type GuidanceIntent } from "./guidance.js";
import { formatIntegrations, formatIntegrationsSummary, getIntegrationStatuses, runIntegrationInit, writeIntegrationReport, type IntegrationId } from "./integrations.js";
import { contextPacket, formatStatus, getStatus, initProject, nextTask } from "./project.js";
import { research } from "./research.js";
import { formatSkillCatalog, readSkillCatalog } from "./skills.js";
import { projectPath } from "./util.js";

async function main(): Promise<void> {
  const [, , command, ...args] = process.argv;
  try {
    switch (command) {
      case "doctor": {
        console.log(formatDoctor(await doctor()));
        console.log("");
        console.log(formatIntegrationsSummary(await getIntegrationStatuses(process.cwd())));
        break;
      }
      case "setup": {
        for (const message of setupLocalMcp(parseSetupTarget(args[0]), resolve(import.meta.dirname, ".."))) console.log(message);
        break;
      }
      case "init": {
        const root = projectPath(args[0]);
        for (const message of initProject(root)) console.log(message);
        console.log(`已写入 ${await writeIntegrationReport(root)}`);
        break;
      }
      case "integrations": {
        const root = projectPath(args[0]);
        const json = args.includes("--json");
        const statuses = await getIntegrationStatuses(root);
        console.log(json ? JSON.stringify(statuses, null, 2) : formatIntegrations(statuses));
        break;
      }
      case "integration-run": {
        const id = parseIntegration(args[0]);
        const root = projectPath(firstPathArg(args.slice(1)));
        const result = await runIntegrationInit(root, id, {
          execute: args.includes("--execute"),
          yes: args.includes("--yes")
        });
        console.log(`已写入 ${result.reportPath}`);
        console.log(`${result.integration}: ${result.message}`);
        if (result.dryRun) {
          for (const command of result.commands) console.log(`dry-run：${command}`);
        }
        if (!result.ok) process.exitCode = 1;
        break;
      }
      case "research": {
        const idea = args.join(" ").trim();
        if (!idea) throw new Error('Usage: vguard research "<idea>"');
        const result = await research(process.cwd(), idea);
        console.log(`已写入 ${result.reportPath}`);
        console.log(`建议：${result.recommendation}`);
        break;
      }
      case "skills": {
        console.log(formatSkillCatalog(readSkillCatalog(projectPath(args[0]))));
        break;
      }
      case "status": {
        console.log(formatStatus(getStatus(projectPath(args[0]))));
        break;
      }
      case "guidance": {
        const root = projectPath(firstPathArg(args));
        const intent = parseGuidanceIntent(valueAfter(args, "--intent"));
        console.log(formatDevelopmentGuidance(developmentGuidance(root, intent)));
        break;
      }
      case "start": {
        const status = getStatus(projectPath(args[0]));
        console.log(formatStatus(status));
        const missing = [status.research, status.spec, status.architecture, status.tasks, status.quality].filter((gate) => !gate.ok);
        if (missing.length > 0) {
          process.exitCode = 1;
          console.log("");
          console.log("启动门禁尚未完成：");
          for (const gate of missing) console.log(`- ${gate.label}: ${gate.detail}`);
        }
        break;
      }
      case "next": {
        const task = nextTask(projectPath(args[0]));
        if (!task) {
          console.log("当前没有未阻塞的待处理任务。");
        } else {
          console.log(JSON.stringify(task, null, 2));
        }
        break;
      }
      case "check": {
        const skipIndex = args.indexOf("--skip");
        const skipReason = skipIndex >= 0 ? args.slice(skipIndex + 1).join(" ").trim() : undefined;
        if (skipIndex >= 0 && !skipReason) throw new Error('Usage: vguard check --skip "<reason>"');
        const result = await qualityGate(process.cwd(), skipReason);
        console.log(`已写入 ${result.reportPath}`);
        console.log(result.skipped ? "质量门禁已跳过" : `质量门禁${result.ok ? "通过" : "失败"}`);
        if (!result.ok) process.exitCode = 1;
        break;
      }
      case "context": {
        console.log(contextPacket(projectPath(args[0])));
        break;
      }
      case "install-agent": {
        const target = parseAgent(args[0]);
        for (const message of installAgent(target, resolve(import.meta.dirname, ".."), process.cwd())) console.log(message);
        break;
      }
      case "verify-claude": {
        console.log(formatClaudeVerify(await verifyClaudeProject(projectPath(args[0]))));
        break;
      }
      case "uninstall-agent": {
        const target = parseAgent(args[0]);
        for (const message of uninstallAgent(target)) console.log(message);
        break;
      }
      case undefined:
      case "-h":
      case "--help":
      case "help": {
        console.log(helpText());
        break;
      }
      default:
        throw new Error(`未知命令：${command}\n\n${helpText()}`);
    }
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  }
}

function parseAgent(value?: string): AgentTarget {
  if (value === "claude" || value === "codex" || value === "cursor" || value === "all") return value;
  throw new Error("用法：vguard install-agent claude|codex|cursor|all");
}

function parseSetupTarget(value?: string): SetupTarget {
  if (!value) return "all";
  if (value === "claude" || value === "codex" || value === "all") return value;
  throw new Error("用法：vguard setup [claude|codex|all]");
}

function parseIntegration(value?: string): IntegrationId {
  if (value === "spec-kit" || value === "archcore" || value === "bmad" || value === "task-master" || value === "agent-install") return value;
  throw new Error("用法：vguard integration-run spec-kit|archcore|bmad|task-master|agent-install [path] [--execute --yes]");
}

function firstPathArg(args: string[]): string | undefined {
  return args.find((arg) => !arg.startsWith("--"));
}

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function parseGuidanceIntent(value?: string): GuidanceIntent {
  if (value === "start-development" || value === "implement-feature" || value === "before-commit" || value === "status") return value;
  return "status";
}

function helpText(): string {
  return `vibe-guard CLI

一次性设置：
  vguard setup              注册 Claude Code + Codex 全局 MCP
  vguard setup claude       只注册 Claude Code
  vguard setup codex        只注册 Codex

命令：
  vguard doctor
  vguard init [path]
  vguard integrations [path] [--json]
  vguard integration-run spec-kit|archcore|bmad|task-master|agent-install [path] [--execute --yes]
  vguard skills [path]
  vguard guidance [path] [--intent start-development|implement-feature|before-commit|status]
  vguard research "<idea>"
  vguard status [path]
  vguard start [path]
  vguard next [path]
  vguard check [--skip "<reason>"]
  vguard context [path]
  vguard install-agent claude|codex|cursor|all
  vguard verify-claude [path]
  vguard uninstall-agent claude|codex|cursor|all
`;
}

await main();

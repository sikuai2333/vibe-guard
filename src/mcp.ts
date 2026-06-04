#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { qualityGate } from "./check.js";
import { developmentGuidance, formatDevelopmentGuidance } from "./guidance.js";
import { getIntegrationStatuses, runIntegrationInit } from "./integrations.js";
import { contextPacket, getStatus, nextTask } from "./project.js";
import { research } from "./research.js";
import { formatSkillCatalog, readSkillCatalog } from "./skills.js";

const server = new McpServer({
  name: "vibe-guard",
  version: "0.1.0"
});

server.registerTool(
  "vguard_development_guidance",
  {
    title: "vibe-guard development guidance",
    description: "根据当前项目门禁和意图返回是否适合编码、下一步动作和建议 MCP 工具。",
    inputSchema: {
      root: z.string().optional(),
      intent: z.enum(["start-development", "implement-feature", "before-commit", "status"]).optional()
    }
  },
  async ({ root, intent }) => ({
    content: [{ type: "text", text: formatDevelopmentGuidance(developmentGuidance(root ?? process.cwd(), intent ?? "status")) }]
  })
);

server.registerTool(
  "vguard_skills",
  {
    title: "vibe-guard skills",
    description: "返回按需加载的 skills 索引和使用原则。",
    inputSchema: { root: z.string().optional() }
  },
  async ({ root }) => ({
    content: [{ type: "text", text: formatSkillCatalog(readSkillCatalog(root ?? process.cwd())) }]
  })
);

server.registerTool(
  "vguard_integration_run",
  {
    title: "vibe-guard integration run",
    description: "dry-run 或显式执行支持的集成初始化命令。默认 dry-run。",
    inputSchema: {
      id: z.enum(["spec-kit", "archcore", "bmad", "task-master", "agent-install"]),
      root: z.string().optional(),
      execute: z.boolean().optional(),
      yes: z.boolean().optional()
    }
  },
  async ({ id, root, execute, yes }) => ({
    content: [{ type: "text", text: JSON.stringify(await runIntegrationInit(root ?? process.cwd(), id, { execute, yes }), null, 2) }]
  })
);

server.registerTool(
  "vguard_integrations",
  {
    title: "vibe-guard integrations",
    description: "返回 Spec Kit、Archcore、BMAD、Task Master 和 agent-install 的可用状态。",
    inputSchema: { root: z.string().optional() }
  },
  async ({ root }) => ({
    content: [{ type: "text", text: JSON.stringify(await getIntegrationStatuses(root ?? process.cwd()), null, 2) }]
  })
);

server.registerTool(
  "vguard_project_status",
  {
    title: "vibe-guard project status",
    description: "返回项目当前的 vibe-guard 门禁状态。",
    inputSchema: { root: z.string().optional() }
  },
  async ({ root }) => ({
    content: [{ type: "text", text: JSON.stringify(getStatus(root ?? process.cwd()), null, 2) }]
  })
);

server.registerTool(
  "vguard_prior_art",
  {
    title: "vibe-guard prior-art research",
    description: "执行平衡模式同类项目调研，并写入 .vibe-guard/research.md。",
    inputSchema: { idea: z.string(), root: z.string().optional() }
  },
  async ({ idea, root }) => ({
    content: [{ type: "text", text: JSON.stringify(await research(root ?? process.cwd(), idea), null, 2) }]
  })
);

server.registerTool(
  "vguard_next_task",
  {
    title: "vibe-guard next task",
    description: "从 .vibe-guard/tasks.json 返回下一个未阻塞的待处理任务。",
    inputSchema: { root: z.string().optional() }
  },
  async ({ root }) => ({
    content: [{ type: "text", text: JSON.stringify(nextTask(root ?? process.cwd()) ?? null, null, 2) }]
  })
);

server.registerTool(
  "vguard_quality_gate",
  {
    title: "vibe-guard quality gate",
    description: "运行项目质量检查，或记录显式跳过原因。",
    inputSchema: { root: z.string().optional(), skipReason: z.string().optional() }
  },
  async ({ root, skipReason }) => ({
    content: [{ type: "text", text: JSON.stringify(await qualityGate(root ?? process.cwd(), skipReason), null, 2) }]
  })
);

server.registerTool(
  "vguard_context_packet",
  {
    title: "vibe-guard context packet",
    description: "从 vibe-guard 项目文件返回精简上下文包。",
    inputSchema: { root: z.string().optional() }
  },
  async ({ root }) => ({
    content: [{ type: "text", text: contextPacket(root ?? process.cwd()) }]
  })
);

await server.connect(new StdioServerTransport());

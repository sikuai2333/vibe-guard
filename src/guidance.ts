import { getStatus, nextTask } from "./project.js";

export type GuidanceIntent = "start-development" | "implement-feature" | "before-commit" | "status";

export interface DevelopmentGuidance {
  okToCode: boolean;
  intent: GuidanceIntent;
  summary: string;
  requiredActions: string[];
  recommendedTools: string[];
  qualityGate: string;
}

export function developmentGuidance(root: string, intent: GuidanceIntent = "status"): DevelopmentGuidance {
  const status = getStatus(root);
  const task = nextTask(root);
  const requiredActions: string[] = [];
  const recommendedTools = ["vguard_project_status", "vguard_context_packet"];

  if (!status.research.ok) {
    requiredActions.push("先完成同类项目调研：调用 vguard_prior_art 或运行 vguard research \"项目想法\"。");
    recommendedTools.push("vguard_prior_art");
  }
  if (!status.spec.ok) {
    requiredActions.push("补齐规格门禁：创建 .vibe-guard/spec.md，明确目标、非目标和验收标准。");
  }
  if (!status.tasks.ok) {
    requiredActions.push("补齐任务门禁：创建 .vibe-guard/tasks.json，并把任务拆成带依赖和验收标准的小任务。");
  }
  if (!status.architecture.ok) {
    requiredActions.push("补齐架构记忆：记录模块边界、ADR 或 Archcore 笔记。");
  }
  if ((intent === "implement-feature" || intent === "start-development") && status.tasks.ok && !task) {
    requiredActions.push("当前没有未阻塞的待处理任务；先创建或更新任务列表，再开始实现。");
  }
  if (intent === "before-commit" && !status.quality.ok) {
    requiredActions.push("提交前必须运行质量门禁：调用 vguard_quality_gate 或运行 vguard check。");
    recommendedTools.push("vguard_quality_gate");
  }

  const okToCode = requiredActions.length === 0;
  return {
    okToCode,
    intent,
    summary: okToCode
      ? "当前门禁允许继续开发。实现时保持小步修改，完成后运行质量门禁。"
      : "当前不建议直接编码；请先完成 requiredActions 中的门禁。",
    requiredActions,
    recommendedTools: [...new Set(recommendedTools)],
    qualityGate: "宣称完成或提交前，调用 vguard_quality_gate 或运行 vguard check。"
  };
}

export function formatDevelopmentGuidance(guidance: DevelopmentGuidance): string {
  const lines = [
    "# vibe-guard 开发引导",
    "",
    `意图：${guidance.intent}`,
    `是否可以直接编码：${guidance.okToCode ? "可以" : "不建议"}`,
    `摘要：${guidance.summary}`,
    "",
    "## 必须动作",
    ""
  ];
  if (guidance.requiredActions.length === 0) {
    lines.push("- 无。");
  } else {
    lines.push(...guidance.requiredActions.map((action) => `- ${action}`));
  }
  lines.push("", "## 建议调用的 MCP 工具", "");
  lines.push(...guidance.recommendedTools.map((tool) => `- ${tool}`));
  lines.push("", "## 质量门禁", "", guidance.qualityGate);
  return lines.join("\n");
}

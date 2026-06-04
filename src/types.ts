export interface VibeGuardConfig {
  version: 1;
  projectName: string;
  createdAt: string;
  updatedAt: string;
  researchMode: "balanced";
  qualityGate: "strict-skippable";
  integrations: {
    specKit: "external";
    archcore: "external";
    bmad: "optional-external";
    taskManager: "external";
    agentInstall: "external";
  };
}

export interface VibeGuardLinks {
  specKit?: string;
  archcore?: string;
  bmad?: string;
  taskMaster?: string;
  notes: string[];
}

export interface VibeGuardTask {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed" | "blocked";
  dependencies?: string[];
  acceptance?: string[];
  context?: string[];
}

export interface ProjectStatus {
  root: string;
  initialized: boolean;
  research: GateStatus;
  spec: GateStatus;
  architecture: GateStatus;
  tasks: GateStatus;
  quality: GateStatus;
}

export interface GateStatus {
  ok: boolean;
  label: string;
  detail: string;
}

export interface QualityResult {
  ok: boolean;
  skipped: boolean;
  detected: string[];
  checks: Array<{
    name: string;
    command?: string;
    ok: boolean;
    output: string;
  }>;
  reportPath: string;
}

export interface SkillCatalogItem {
  id: string;
  name: string;
  source: string;
  purpose: string;
  loadWhen: string;
  install: "manual" | "external";
}

import { randomUUID } from "node:crypto";
import { getDb } from "../index";

export type Project = {
  id: string;
  name: string;
  created_at: number;
};

const DEFAULT_PROJECT_NAME = "기본 프로젝트";

export function ensureDefaultProject(): Project {
  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM projects WHERE name = ? LIMIT 1")
    .get(DEFAULT_PROJECT_NAME) as Project | undefined;
  if (existing) return existing;

  const project: Project = {
    id: randomUUID(),
    name: DEFAULT_PROJECT_NAME,
    created_at: Date.now(),
  };
  db.prepare(
    "INSERT INTO projects (id, name, created_at) VALUES (?, ?, ?)",
  ).run(project.id, project.name, project.created_at);
  return project;
}

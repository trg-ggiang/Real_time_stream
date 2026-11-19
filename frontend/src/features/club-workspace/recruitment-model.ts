import type { Department } from "./services/workspace-api";

export interface RecruitmentQuestion {
  id: string;
  text: string;
  hint: string;
  maxLength: number | "";
  required: boolean;
}
export interface RecruitmentDepartment {
  id: string;
  name: string;
  enabled: boolean;
  description: string;
  requirements: string;
  quota: string;
  questions: RecruitmentQuestion[];
}
export interface RecruitmentDraft {
  version: 2;
  title: string;
  description: string;
  opensAt: string;
  closesAt: string;
  cover: { name: string; url: string } | null;
  departments: RecruitmentDepartment[];
}
export const newRecruitmentQuestion = (): RecruitmentQuestion => ({
  id: crypto.randomUUID(), text: "", hint: "", maxLength: "", required: true,
});
export function createRecruitmentDraft(): RecruitmentDraft {
  return {
    version: 2,
    title: "",
    description: "",
    opensAt: "", closesAt: "", cover: null,
    departments: [],
  };
}
/** The current club's API owns department identity and name; drafts only own form edits. */
export function withRecruitmentDepartments(draft: RecruitmentDraft, departments: Department[]): RecruitmentDraft {
  const saved = new Map(draft.departments.map(department => [department.id, department]));
  return { ...draft, departments: departments.filter(department => department.status === "active").map(department => ({
    ...(saved.get(department.department_id) || { enabled: true, quota: "", description: "", requirements: "", questions: [newRecruitmentQuestion()] }),
    id: department.department_id,
    name: department.name,
  })) };
}
/** Restore only this prototype's known shape; never treat browser drafts as server data. */
export function loadRecruitmentDraft(key: string): RecruitmentDraft {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || "null");
    const string = (item: unknown): item is string => typeof item === "string";
    if (value?.version === 2 && [value.title, value.description, value.opensAt, value.closesAt].every(string) &&
      (value.cover === null || (string(value.cover?.name) && string(value.cover?.url) && /^data:image\/(png|jpeg);base64,/.test(value.cover.url))) &&
      Array.isArray(value.departments) &&
      value.departments.every((d: RecruitmentDepartment) => d && string(d.id) && d.id.length > 0 &&
        [d.name, d.description, d.requirements, d.quota].every(string) && typeof d.enabled === "boolean" &&
        Array.isArray(d.questions) && d.questions.length <= 20 && d.questions.every(q => q &&
          [q.id, q.text, q.hint].every(string) && typeof q.required === "boolean" &&
          (q.maxLength === "" || (typeof q.maxLength === "number" && Number.isInteger(q.maxLength) && q.maxLength >= 1 && q.maxLength <= 10000))))) return value;
  } catch { /* Missing, unavailable or invalid storage starts a blank draft. */ }
  return createRecruitmentDraft();
}

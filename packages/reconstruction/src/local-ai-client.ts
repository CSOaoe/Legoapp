export type LocalAiHealth = {
  service: string;
  engine: string;
  ready: boolean;
  reason: string | null;
  gpu: string | null;
  modelCached: boolean;
  authenticated: boolean;
  queueDepth: number;
};

type AiJob = {
  id: string;
  status: "queued" | "running" | "complete" | "failed";
  message: string;
  progress: number;
};

const SERVICE_URL = "http://127.0.0.1:8787";

async function checkedJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(detail?.detail ?? `Local AI service returned ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function getLocalAiHealth(): Promise<LocalAiHealth> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 2500);
  try {
    return await checkedJson<LocalAiHealth>(await fetch(`${SERVICE_URL}/v1/health`, { signal: controller.signal }));
  } catch (problem) {
    if (problem instanceof DOMException && problem.name === "AbortError") throw new Error("Local AI companion did not respond");
    throw problem;
  } finally {
    window.clearTimeout(timeout);
  }
}

const wait = (milliseconds: number) => new Promise(resolve => window.setTimeout(resolve, milliseconds));

export async function generateLocalAiObj(image: File, onProgress: (message: string, progress: number) => void): Promise<string> {
  const form = new FormData();
  form.append("image", image, image.name);
  let job = await checkedJson<AiJob>(await fetch(`${SERVICE_URL}/v1/generate`, { method: "POST", body: form }));
  onProgress(job.message, job.progress);
  const deadline = Date.now() + 12 * 60 * 1000;
  while (job.status === "queued" || job.status === "running") {
    if (Date.now() > deadline) throw new Error("Local AI generation timed out after 12 minutes");
    await wait(1200);
    job = await checkedJson<AiJob>(await fetch(`${SERVICE_URL}/v1/jobs/${job.id}`));
    onProgress(job.message, job.progress);
  }
  if (job.status === "failed") throw new Error(job.message);
  const response = await fetch(`${SERVICE_URL}/v1/jobs/${job.id}/model`);
  if (!response.ok) throw new Error("The local AI mesh could not be downloaded");
  return response.text();
}

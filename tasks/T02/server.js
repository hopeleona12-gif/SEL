"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const voiceService = require("./shared/voice-scoring-service");

const ROOT = __dirname;
const PROJECT_ROOT = path.resolve(ROOT, "..", "..");
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
}
loadEnv(path.join(PROJECT_ROOT, ".env"));
loadEnv(path.join(ROOT, ".env"));
const DATA_DIR = path.join(ROOT, "data");
const AUDIO_DIR = path.join(DATA_DIR, "audio");
const RECORD_DIR = path.join(DATA_DIR, "records");
const PORT = Number(process.env.PORT || 8080);
const MODEL = process.env.QWEN_OMNI_MODEL || "qwen3.5-omni-flash";
const BASE_URL = (process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1").replace(/\/$/, "");
const CONFIDENCE_THRESHOLD = Number(process.env.T02_AI_CONFIDENCE_THRESHOLD || 0.65);
const CATEGORIES = new Set(["missing_required_piece", "vague_difficulty", "request_adult_complete", "irrelevant", "dont_know", "uncertain_audio"]);
const ACTIONS = new Set(["continue", "neutral_followup", "manual_review"]);

for (const dir of [DATA_DIR, AUDIO_DIR, RECORD_DIR]) fs.mkdirSync(dir, { recursive: true });

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function readJson(req, limit = 30 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", chunk => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("request_too_large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); }
      catch { reject(new Error("invalid_request_json")); }
    });
    req.on("error", reject);
  });
}

function safeId(value, fallback) {
  const clean = String(value || "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  return clean || fallback;
}

function parseModelJson(text) {
  return voiceService.parseModelJson(text);
}

const SCORER_PROMPT = `你是特殊儿童社会情绪能力任务T02的测评评分器，不是聊天机器人。
任务：T02。情境：四叶风车缺少必要叶片，儿童被问“发生了什么？你需要什么帮助？”。
你必须直接理解随请求提供的儿童原始语音，不能只做关键词匹配。

正式规则：
1. 明确指出少了叶子、缺一个必要部件，或语义等价表达：category=missing_required_piece，score=2，need_followup=false，next_action=continue。
2. 知道有困难但过于笼统，例如“缺东西了”“我不会”：category=vague_difficulty，score=1，need_followup=true，next_action=neutral_followup。此分数是本次表达的AI原始评分；后续中性追问若明确指出缺叶子，按正式规则处理，不因追问自动降分。
3. 明确要求成人代做，例如“你帮我做吧”：category=request_adult_complete，score=0，need_followup=false，next_action=continue。
4. 与任务无关：category=irrelevant，score=0，need_followup=false，next_action=continue。
5. 明确说不知道：category=dont_know，score=0，need_followup=false，next_action=continue。
6. 没有可辨识语音、音质太差或无法可靠判断：category=uncertain_audio，score=0，need_followup=false，next_action=manual_review。
禁止向儿童提示答案，禁止生成追问，禁止输出分析过程。
仅返回一个JSON对象，不要Markdown，不要额外文字。字段必须完整：
{"transcript":"","semantic_summary":"","category":"missing_required_piece|vague_difficulty|request_adult_complete|irrelevant|dont_know|uncertain_audio","score":0,"need_followup":false,"next_action":"continue|neutral_followup|manual_review","confidence":0.0,"reason":""}`;

async function callQwen(audioBase64, audioFormat, question) {
  if (!process.env.DASHSCOPE_API_KEY) throw new Error("DASHSCOPE_API_KEY_not_configured");
  const payload = {
    model: MODEL,
    messages: [
      { role: "system", content: SCORER_PROMPT },
      { role: "user", content: [
        { type: "text", text: `当前问题：${question || "发生了什么？你需要什么帮助？"}\n请评估这段儿童语音并只返回规定JSON。` },
        { type: "input_audio", input_audio: { data: `data:audio/${audioFormat};base64,${audioBase64}`, format: audioFormat } }
      ] }
    ],
    modalities: ["text"],
    temperature: 0.01
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.DASHSCOPE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`dashscope_${response.status}:${body?.error?.message || "request_failed"}`);
    return parseModelJson(body?.choices?.[0]?.message?.content);
  } finally { clearTimeout(timer); }
}

function manualResult(reason) {
  return voiceService.manualResult(reason);
}

async function scoreAudio(req, res) {
  const input = await readJson(req);
  const id = crypto.randomUUID();
  const participant = safeId(input.participant_id, "anonymous");
  const sessionId = safeId(input.session_id, "session");
  const ext = safeId(input.audio_extension, "webm").toLowerCase();
  const audioName = `${participant}_${sessionId}_T02_B_${Date.now()}_${id.slice(0, 8)}.${ext}`;
  const audioPath = path.join(AUDIO_DIR, audioName);
  const originalBuffer = Buffer.from(String(input.audio_base64 || ""), "base64");
  let apiSuccess = false;
  let apiError = "";
  let result;
  if (originalBuffer.length) fs.writeFileSync(audioPath, originalBuffer);
  if (!originalBuffer.length || Number(input.audio_duration || 0) < 400) {
    apiError = "empty_or_too_short_audio";
    result = manualResult(apiError);
  } else {
    try {
      const apiAudio = String(input.api_audio_base64 || input.audio_base64 || "");
      const apiFormat = safeId(input.api_audio_format || ext, "wav");
      result = await callQwen(apiAudio, apiFormat, input.question);
      apiSuccess = true;
      if (result.category === "uncertain_audio" || result.confidence < CONFIDENCE_THRESHOLD) {
        result.next_action = "manual_review";
      }
    } catch (error) {
      apiError = String(error.message || error);
      result = manualResult(apiError);
    }
  }
  const record = {
    id,
    participant_id: input.participant_id || "anonymous",
    session_id: input.session_id || "",
    task_id: safeId(input.task_id, "T02"),
    scene_id: input.scene_id || "T02_B_MISSING_LEAF",
    question_id: input.question_id || "T02_B_OPEN_VOICE",
    audio_file_path: originalBuffer.length ? `data/audio/${audioName}` : "",
    audio_start_time: input.audio_start_time || "",
    audio_end_time: input.audio_end_time || "",
    audio_duration: Number(input.audio_duration || 0),
    model_name: MODEL,
    model_transcript: result.transcript,
    semantic_summary: result.semantic_summary,
    ai_category: result.category,
    ai_score: result.score,
    ai_confidence: result.confidence,
    ai_reason: result.reason,
    need_followup: result.need_followup,
    next_action: result.next_action,
    prompt_level: Number(input.prompt_level || 0),
    api_success: apiSuccess,
    api_error: apiError,
    human_score: null,
    human_category: "",
    human_note: "",
    human_modified: false,
    created_at: new Date().toISOString()
  };
  const saved = voiceService.saveRecord(DATA_DIR, record, null, ext);
  json(res, 200, saved);
}

function listReviews(res, taskId="") {
  json(res, 200, voiceService.listRecords(DATA_DIR, taskId));
}

async function saveReview(req, res, id) {
  const patch = await readJson(req, 1024 * 1024);
  const record = voiceService.updateReview(DATA_DIR, safeId(id, ""), patch);
  if (!record) return json(res, 404, { error: "record_not_found" });
  json(res, 200, record);
}

function serveFile(res, file) {
  const types = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".png":"image/png", ".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".mp3":"audio/mpeg", ".mp4":"video/mp4", ".webm":"audio/webm", ".wav":"audio/wav" };
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end("Not found"); }
  res.writeHead(200, { "Content-Type": types[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-cache" });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (req.method === "POST" && (url.pathname === "/api/t02/score-audio" || url.pathname === "/api/voice/score-audio")) return await scoreAudio(req, res);
    if (req.method === "GET" && (url.pathname === "/api/t02/reviews" || url.pathname === "/api/voice/reviews")) return listReviews(res, url.searchParams.get("task_id") || "");
    const reviewMatch = url.pathname.match(/^\/api\/(?:t02|voice)\/reviews\/([a-zA-Z0-9_-]+)$/);
    if (req.method === "POST" && reviewMatch) return await saveReview(req, res, reviewMatch[1]);
    const audioMatch = url.pathname.match(/^\/data\/audio\/([a-zA-Z0-9_.-]+)$/);
    if (req.method === "GET" && audioMatch) return serveFile(res, path.join(AUDIO_DIR, path.basename(audioMatch[1])));
    const relative = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
    const file = path.resolve(ROOT, `.${relative}`);
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end("Forbidden"); }
    serveFile(res, file);
  } catch (error) { json(res, 500, { error: String(error.message || error) }); }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`T02 Demo: http://127.0.0.1:${PORT}`);
  console.log(`Qwen model: ${MODEL}; API key configured: ${Boolean(process.env.DASHSCOPE_API_KEY)}`);
});

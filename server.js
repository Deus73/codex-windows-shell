const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const root = __dirname;
const publicDir = path.join(root, "public");
const port = Number(process.env.PORT || 8766);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function safeWorkspace(value) {
  const workspace = path.resolve(value || process.cwd());
  if (!fs.existsSync(workspace) || !fs.statSync(workspace).isDirectory()) {
    throw new Error("Workspace bestaat niet of is geen map.");
  }
  return workspace;
}

async function runCodex(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch (error) {
    send(res, 400, JSON.stringify({ error: "Ongeldige JSON." }));
    return;
  }

  const prompt = String(body.prompt || "").trim();
  const transcript = String(body.transcript || "").trim();
  if (!prompt) {
    send(res, 400, JSON.stringify({ error: "Prompt is leeg." }));
    return;
  }

  let workspace;
  try {
    workspace = safeWorkspace(body.workspace || process.cwd());
  } catch (error) {
    send(res, 400, JSON.stringify({ error: error.message }));
    return;
  }

  const fullPrompt = [
    "Je wordt gebruikt vanuit Codex Windows Shell, een grafische lokale UI.",
    "Antwoord in dezelfde taal als de gebruiker, tenzij die om iets anders vraagt.",
    transcript ? `Gesprekscontext:\n${transcript}` : "",
    `Nieuwe vraag:\n${prompt}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  res.writeHead(200, {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Accel-Buffering": "no",
  });

  const args = [
    "exec",
    "--skip-git-repo-check",
    "-C",
    workspace,
    "--color",
    "never",
    "-",
  ];

  const child = spawn("codex", args, {
    cwd: workspace,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, NO_COLOR: "1" },
  });

  const writeEvent = (event, data) => {
    res.write(JSON.stringify({ event, data }) + "\n");
  };

  let stderr = "";
  child.stdin.end(fullPrompt);
  child.stdout.on("data", (chunk) => writeEvent("stdout", chunk.toString()));
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  child.on("error", (error) => writeEvent("error", error.message));
  child.on("close", (code) => {
    if (code !== 0 && stderr.trim()) {
      writeEvent("stderr", stderr);
    }
    writeEvent("exit", { code });
    res.end();
  });

  req.on("close", () => {
    if (!child.killed) child.kill("SIGTERM");
  });
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.resolve(publicDir, "." + pathname);

  if (!filePath.startsWith(publicDir)) {
    send(res, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      send(res, 404, "Not found", "text/plain; charset=utf-8");
      return;
    }
    send(res, 200, data, mime[path.extname(filePath)] || "application/octet-stream");
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/run") {
    runCodex(req, res);
    return;
  }
  if (req.method === "GET" && req.url === "/api/status") {
    send(res, 200, JSON.stringify({ ok: true, cwd: process.cwd(), port }));
    return;
  }
  if (req.method === "GET") {
    serveStatic(req, res);
    return;
  }
  send(res, 405, "Method not allowed", "text/plain; charset=utf-8");
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Codex Windows Shell: http://127.0.0.1:${port}`);
});

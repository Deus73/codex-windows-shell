const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const conversation = $("#conversation");
const composer = $("#composer");
const promptInput = $("#promptInput");
const workspaceInput = $("#workspaceInput");
const statusDot = $("#statusDot");
const statusTitle = $("#statusTitle");
const statusText = $("#statusText");
const contextMeter = $("#contextMeter");
const historyList = $("#historyList");
const startMenu = $("#startMenu");
const startButton = $("#startButton");

let history = JSON.parse(localStorage.getItem("codexShellHistory") || "[]");
let z = 8;
let busy = false;

function setStatus(kind, title, text) {
  statusDot.className = "status-dot" + (kind === "busy" ? " busy" : kind === "error" ? " error" : "");
  statusTitle.textContent = title;
  statusText.textContent = text;
}

function escapeText(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  })[char]);
}

function addMessage(role, text, live = false) {
  const article = document.createElement("article");
  article.className = `message ${role}`;
  article.innerHTML = `
    <div class="avatar">${role === "user" ? "U" : "C"}</div>
    <div class="bubble">
      <div class="meta">${role === "user" ? "Jij" : "Codex"}</div>
      ${live ? "<pre></pre>" : `<p>${escapeText(text)}</p>`}
    </div>
  `;
  conversation.appendChild(article);
  conversation.scrollTop = conversation.scrollHeight;
  return live ? $("pre", article) : article;
}

function transcript() {
  return $$(".message", conversation)
    .slice(-8)
    .map((message) => {
      const role = message.classList.contains("user") ? "Gebruiker" : "Codex";
      const text = $(".bubble", message).innerText.trim();
      return `${role}: ${text}`;
    })
    .join("\n\n");
}

function updateHistory() {
  historyList.innerHTML = history.length
    ? history.map((item) => `<div class="history-item"><strong>${escapeText(item.prompt)}</strong><br><span>${escapeText(item.date)}</span></div>`).join("")
    : '<div class="history-item">Nog geen opdrachten uitgevoerd.</div>';
  localStorage.setItem("codexShellHistory", JSON.stringify(history.slice(0, 30)));
  contextMeter.style.width = `${Math.min(100, Math.max(8, transcript().length / 45))}%`;
}

async function runPrompt(prompt) {
  if (busy) return;
  busy = true;
  addMessage("user", prompt);
  const output = addMessage("assistant", "", true);
  setStatus("busy", "Bezig", "Codex draait lokaal");
  history.unshift({ prompt, date: new Date().toLocaleString("nl-NL") });
  updateHistory();

  try {
    const response = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        workspace: workspaceInput.value,
        transcript: transcript(),
      }),
    });

    if (!response.ok || !response.body) {
      const error = await response.text();
      throw new Error(error || `HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const msg = JSON.parse(line);
        if (msg.event === "stdout" || msg.event === "stderr") {
          output.textContent += msg.data;
          conversation.scrollTop = conversation.scrollHeight;
        }
        if (msg.event === "error") {
          output.textContent += `\n${msg.data}`;
        }
      }
    }

    if (!output.textContent.trim()) {
      output.textContent = "Codex gaf geen tekst terug.";
    }
    setStatus("ready", "Klaar", "Uitvoer ontvangen");
  } catch (error) {
    output.textContent += `\nFout: ${error.message}`;
    setStatus("error", "Fout", "Bekijk de uitvoer");
  } finally {
    busy = false;
    updateHistory();
  }
}

composer.addEventListener("submit", (event) => {
  event.preventDefault();
  const prompt = promptInput.value.trim();
  if (!prompt) return;
  promptInput.value = "";
  runPrompt(prompt);
});

$("#clearButton").addEventListener("click", () => {
  conversation.innerHTML = "";
  addMessage("assistant", "Nieuw venster gestart. Typ een opdracht om Codex te gebruiken.");
  updateHistory();
});

function focusWindow(id) {
  const win = document.getElementById(id);
  if (!win) return;
  win.classList.add("open", "focused");
  win.style.zIndex = String(++z);
  $$(".window").forEach((item) => {
    if (item !== win) item.classList.remove("focused");
  });
  $$(".task-button").forEach((button) => button.classList.toggle("active", button.dataset.focus === id));
  startMenu.classList.remove("open");
}

$$("[data-focus]").forEach((button) => {
  button.addEventListener("click", () => focusWindow(button.dataset.focus));
});

$$(".window").forEach((win) => {
  win.addEventListener("mousedown", () => focusWindow(win.id));
});

$$(".rail-button").forEach((button) => {
  button.addEventListener("click", () => {
    $$(".rail-button").forEach((item) => item.classList.remove("selected"));
    button.classList.add("selected");
    $$(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === button.dataset.tab));
  });
});

$$(".mode").forEach((button) => {
  button.addEventListener("click", () => {
    $$(".mode").forEach((item) => item.classList.remove("selected"));
    button.classList.add("selected");
  });
});

$$("[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => {
    promptInput.value = button.dataset.prompt;
    promptInput.focus();
    $("[data-tab='chat']").click();
  });
});

startButton.addEventListener("click", () => startMenu.classList.toggle("open"));

document.addEventListener("click", (event) => {
  if (!startMenu.contains(event.target) && !startButton.contains(event.target)) {
    startMenu.classList.remove("open");
  }
});

$("#compactToggle").addEventListener("change", (event) => {
  document.body.classList.toggle("compact", event.target.checked);
});

$("#glassToggle").addEventListener("change", (event) => {
  document.body.classList.toggle("no-glass", !event.target.checked);
});

$("#scaleRange").addEventListener("input", (event) => {
  document.documentElement.style.fontSize = `${event.target.value}%`;
});

function updateClock() {
  $("#clock").textContent = new Date().toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

updateHistory();
updateClock();
setInterval(updateClock, 1000);

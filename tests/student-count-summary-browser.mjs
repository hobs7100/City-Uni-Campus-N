// Real authenticated Chromium verification. No database mutations.
// Usage: node tests/student-count-summary-browser.mjs /tmp/short-lived-state.json
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, execFileSync } from "node:child_process";

const statePath = process.argv[2];
assert(statePath, "Pass a short-lived browser storage-state file.");
const origin = process.env.TEST_APP_ORIGIN || `https://${process.env.REPLIT_DEV_DOMAIN}`;
const dir = mkdtempSync(join(tmpdir(), "student-summary-browser-"));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let browser, socket, captureFailure;
async function until(check, label) {
  const start = Date.now();
  while (Date.now() - start < 90000) {
    if (await check()) return;
    await delay(200);
  }
  throw new Error("Timed out: " + label);
}
try {
  browser = spawn("chromium", ["--headless", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu",
    "--remote-debugging-port=0", `--user-data-dir=${join(dir, "chrome")}`, "--no-first-run", "about:blank"], { stdio: "ignore" });
  await until(() => existsSync(join(dir, "chrome/DevToolsActivePort")), "Chromium startup");
  const port = readFileSync(join(dir, "chrome/DevToolsActivePort"), "utf8").split("\n")[0];
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(pages.find(page => page.type === "page").webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let next = 0;
  const pending = new Map();
  const runtimeErrors = [];
  socket.addEventListener("message", event => {
    const result = JSON.parse(event.data);
    if (result.method === "Runtime.exceptionThrown") {
      runtimeErrors.push(result.params.exceptionDetails.exception?.description || result.params.exceptionDetails.text);
    }
    if (!result.id) return;
    const request = pending.get(result.id);
    pending.delete(result.id);
    if (result.error) request.reject(new Error(result.error.message));
    else request.resolve(result.result);
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++next;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const click = async text => {
    const match = text === "Active Students"
      ? `b.textContent.trim().startsWith('Active')`
      : `b.textContent.trim()===${JSON.stringify(text)}`;
    await until(() => evaluate(`Boolean([...document.querySelectorAll('button')].find(b=>${match}&&!b.disabled&&Object.keys(b).some(k=>k.startsWith('__reactProps$'))))`), "hydrated button " + text);
    await evaluate(`[...document.querySelectorAll('button')].find(b=>${match}&&!b.disabled).click()`);
  };
  const screenshot = async name => writeFileSync(join(dir, name),
    Buffer.from((await call("Page.captureScreenshot", { format: "png" })).data, "base64"));
  captureFailure = () => screenshot("failure.png");
  await call("Page.enable");
  await call("Runtime.enable");
  await call("Network.enable");
  await call("Network.setCookies", { cookies: JSON.parse(readFileSync(statePath, "utf8")).cookies });
  await call("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: dir });
  await call("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await call("Page.navigate", { url: origin + "/dashboard/admin/students" });
  await click("Student Count Summary");
  await click("Export PDF");
  const pdfPath = join(dir, "student-count-summary.pdf");
  await until(() => existsSync(pdfPath) && !existsSync(pdfPath + ".crdownload"), "real PDF download");
  assert.equal(readFileSync(pdfPath).subarray(0, 4).toString(), "%PDF");
  const summary = await evaluate("fetch('/api/admin/students/count-summary',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Summary API failed');return r.json()})");
  const text = execFileSync("pdftotext", ["-layout", pdfPath, "-"], { encoding: "utf8" });
  // Raw draw order keeps wrapped cell text together instead of interleaving columns.
  const rawText = execFileSync("pdftotext", ["-raw", pdfPath, "-"], { encoding: "utf8" });
  const cover = text.split("\f")[0].replace(/\s+/g, " ");
  for (const expected of [`Total Sessions: ${summary.total_sessions}`, `Total Classes: ${summary.total_classes}`, `Total Students: ${summary.total_students}`]) {
    assert(cover.includes(expected), expected);
  }
  for (const session of summary.sessions) assert(cover.includes(session), "cover session: " + session);
  assert(!cover.includes("Department Details"), "class details must follow the overview page");
  const rows = summary.departments.flatMap(department => department.classes);
  assert.equal(rows.length, summary.total_classes);
  assert.equal(rows.reduce((sum, row) => sum + row.total_students, 0), summary.total_students);
  const normalized = text => text.replace(/\s+/g, " ").trim();
  const tableText = normalized(await evaluate("document.body.innerText"));
  for (const department of summary.departments) {
    assert(tableText.includes(normalized(department.department_name)));
    assert.equal(department.classes.reduce((sum, row) => sum + row.total_students, 0), department.total_students);
  }
  for (const row of rows) {
    assert(tableText.includes(normalized(row.class_name)));
    assert(rawText.replace(/\s+/g, "").includes(row.class_name.replace(/\s+/g, "")));
  }
  await screenshot("summary-desktop.png");
  await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await delay(500);
  assert(await evaluate("document.documentElement.scrollWidth<=window.innerWidth+1"), "no outer mobile horizontal overflow");
  await screenshot("summary-mobile.png");

  // Retry/empty fixtures change only this browser's fetch responses.
  await evaluate(`window.__originalFetch=window.fetch.bind(window);window.fetch=(input,init)=>String(input).includes('/students/count-summary')?Promise.resolve(new Response(JSON.stringify({error:'Test summary unavailable'}),{status:500,headers:{'Content-Type':'application/json'}})):window.__originalFetch(input,init)`);
  await click("Active Students");
  await click("Student Count Summary");
  await until(() => evaluate("document.body.innerText.includes('Test summary unavailable')"), "retryable error");
  await evaluate("window.fetch=window.__originalFetch");
  await click("Retry");
  await until(() => evaluate("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Export PDF'&&!b.disabled)"), "retry restored real summary");
  await evaluate(`window.fetch=(input,init)=>String(input).includes('/students/count-summary')?Promise.resolve(new Response(JSON.stringify({total_sessions:0,sessions:[],total_classes:0,total_students:0,departments:[]}),{headers:{'Content-Type':'application/json'}})):window.__originalFetch(input,init)`);
  await click("Active Students");
  await click("Student Count Summary");
  await until(() => evaluate("document.body.innerText.includes('No active classes to summarize.')"), "zero-count state");
  rmSync(pdfPath);
  await click("Export PDF");
  await until(() => existsSync(pdfPath) && !existsSync(pdfPath + ".crdownload"), "zero-count PDF download");
  const emptyText = execFileSync("pdftotext", [pdfPath, "-"], { encoding: "utf8" });
  assert(emptyText.includes("Total Students: 0"));
  assert.deepEqual(runtimeErrors, [], "no uncaught browser exceptions");
  console.log(JSON.stringify({ passed: true, classes: summary.total_classes, students: summary.total_students,
    pdfDownload: true, mobileLayout: true, retry: true, zeroCountExport: true, evidence: dir }));
} catch (error) {
  if (captureFailure) await captureFailure().catch(() => {});
  console.error("Browser evidence:", dir);
  throw error;
} finally {
  socket?.close();
  if (browser && browser.exitCode === null) {
    const exited = new Promise(resolve => browser.once("exit", resolve));
    browser.kill("SIGTERM");
    await exited;
  }
  // Never retain session-bearing browser profiles with screenshot evidence.
  rmSync(join(dir, "chrome"), { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

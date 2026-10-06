// Standalone real Chromium verification using synthetic data; no login or campus DB.
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:http";
import { spawn, execFileSync } from "node:child_process";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { buildExamSlipDocument } = require("../components/studentDashboard/examSlipDocument.ts");
const viteRequire = createRequire(createRequire(require.resolve("vitest")).resolve("vite"));
const { build } = await import(viteRequire.resolve("vite"));
const dir = mkdtempSync(join(tmpdir(), "slip-pdf-browser-"));
const printedDocs = new Map();
const logo = readFileSync(resolve("public/images/logo.png"));
let browser, socket, server;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, label, timeout = 60000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await check();
    if (value) return value;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
}
try {
  const entry = join(dir, "browser-entry.js");
  writeFileSync(entry, `import {downloadHtmlPdf} from ${JSON.stringify(resolve("lib/downloadHtmlPdf.ts"))};
        import {printHtmlDocument} from ${JSON.stringify(resolve("lib/printDocument.ts"))};
        const append=document.body.appendChild.bind(document.body);
        document.body.appendChild=function(element){const result=append(element);
          if(element.tagName==='IFRAME') element.contentWindow.print=()=>{window.printed=element.contentDocument.documentElement.outerHTML;};
          return result;};
        window.run=async(kind)=>{window.done=false;window.failure='';window.printed='';
          try {await downloadHtmlPdf(window.slips[kind],kind,kind+'.pdf');
            await printHtmlDocument(window.slips[kind],kind,{waitForFrameLoad:true,strictImages:true});
          } catch(error){window.failure=error.message;} finally {window.done=true;}};
        window.ready=true;`);
  const bundles = await build({
    configFile: false, logLevel: "error",
    build: { write: false, minify: false,
      lib: { entry, name: "SlipPdfTest", formats: ["iife"] },
    },
  });
  const bundle = (Array.isArray(bundles) ? bundles : [bundles]).flatMap((output) => output.output)
    .find((output) => output.type === "chunk").code;
  let slips;
  server = createServer((request, response) => {
    if (request.url === "/bundle.js") { response.setHeader("Content-Type", "text/javascript"); response.end(bundle); }
    else if (request.url === "/images/logo.png") { response.setHeader("Content-Type", "image/png"); response.end(logo); }
    else if (printedDocs.has(request.url)) { response.setHeader("Content-Type", "text/html; charset=utf-8"); response.end(printedDocs.get(request.url)); }
    else { response.setHeader("Content-Type", "text/html; charset=utf-8"); response.end(`<html><head><meta charset="UTF-8"></head><body><script>window.slips=${JSON.stringify(slips)}</script><script src="/bundle.js"></script></body></html>`); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const fixture = {
    student: { id: "test", name: "Synthetic Student", father_name: "Synthetic Parent", class_name: "Test Class",
      session: "2026", department: "Computing", profile_image_url: `${origin}/images/logo.png` },
    semester: { id: "test-semester", semester_number: 5, term_type: "Regular" }, overall_attendance: 80,
    rows: Array.from({ length: 24 }, (_, index) => ({
      course_id: String(index), course_code: `CS${String(index).padStart(3, "0")}`,
      course_title: `Course ${String(index).padStart(2, "0")} — Extended Course Title`,
      credit_hours: index % 4 === 0 ? "1" : "3", paper_date: "2026-10-12",
      paper_time: "09:00 AM", att_percentage: index % 4 === 0 ? 65 : 85,
    })),
  };
  slips = Object.fromEntries(["rollno", "clearance"].map((kind) => [kind, buildExamSlipDocument(fixture, kind, origin, new Date("2026-10-06"))]));
  browser = spawn("chromium", ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
    "--remote-debugging-port=0", `--user-data-dir=${join(dir, "chrome")}`, "--no-first-run", "about:blank"], { stdio: "ignore" });
  await until(() => existsSync(join(dir, "chrome/DevToolsActivePort")), "Chromium startup");
  const port = readFileSync(join(dir, "chrome/DevToolsActivePort"), "utf8").split("\n")[0];
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(pages.find((page) => page.type === "page").webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const result = JSON.parse(event.data);
    if (!result.id) return;
    const call = pending.get(result.id); pending.delete(result.id);
    if (result.error) call.reject(new Error(result.error.message)); else call.resolve(result.result);
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  await call("Page.enable");
  await call("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: dir });
  const outcomes = [];
  for (const kind of ["rollno", "clearance"]) {
    await call("Page.navigate", { url: origin });
    await until(() => evaluate("Boolean(window.ready)"), "test page readiness");
    await evaluate(`window.run(${JSON.stringify(kind)})`);
    await until(() => evaluate("Boolean(window.done)"), `${kind} PDF and print`);
    assert.equal(await evaluate("window.failure"), "");
    await until(() => existsSync(join(dir, `${kind}.pdf`)), `${kind} PDF download`);
    const downloaded = readFileSync(join(dir, `${kind}.pdf`));
    assert.equal(downloaded.subarray(0, 5).toString(), "%PDF-");
    const info = execFileSync("pdfinfo", [join(dir, `${kind}.pdf`)], { encoding: "utf8" });
    assert.match(info, /Pages:\s+1/);
    const printed = await evaluate("window.printed");
    assert.ok(printed.includes("Account Office Clearance"));
    const path = `/printed-${kind}.html`;
    printedDocs.set(path, printed);
    await call("Page.navigate", { url: origin + path });
    await until(() => evaluate("document.readyState==='complete'"), "print document");
    const pdf = await call("Page.printToPDF", { printBackground: true, preferCSSPageSize: true,
      marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0 });
    const printPath = join(dir, `${kind}-print.pdf`);
    writeFileSync(printPath, Buffer.from(pdf.data, "base64"));
    assert.match(execFileSync("pdfinfo", [printPath], { encoding: "utf8" }), /Pages:\s+1/);
    const text = execFileSync("pdftotext", [printPath, "-"], { encoding: "utf8" });
    for (const value of ["CS023", "Authorized Signature", "Official Stamp", "Original Student ID Card"]) assert.ok(text.includes(value), `Missing ${value} on ${kind} printed PDF`);
    assert.ok(text.includes(kind === "clearance" ? "FINAL TERM EXAMINATION" : "MID TERM EXAMINATION"));
    if (kind === "clearance") assert.ok(text.includes("ENROLLED COURSES LIST"));
    execFileSync("pdftoppm", ["-f", "1", "-singlefile", "-scale-to", "1400", "-png", join(dir, `${kind}.pdf`), join(dir, `${kind}-download`)]);
    outcomes.push({ kind, directPdfBytes: downloaded.length, printPdfBytes: Buffer.from(pdf.data, "base64").length, pages: 1 });
  }
  console.log(JSON.stringify({ passed: true, outcomes, outputDirectory: dir, files: readdirSync(dir).filter((name) => name.endsWith(".pdf") || name.endsWith(".png")) }));
} finally {
  socket?.close();
  if (browser && browser.exitCode === null) {
    const exited = new Promise((resolve) => browser.once("exit", resolve));
    browser.kill("SIGTERM");
    await exited;
  }
  if (server) await new Promise((resolve) => server.close(resolve));
  // Keep fixture PDFs/images temporarily for visual verification, discard Chromium profile.
  if (existsSync(join(dir, "chrome"))) rmSync(join(dir, "chrome"), { recursive: true, force: true });
}

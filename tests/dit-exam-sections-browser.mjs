// Real Chromium verification of the actual authenticated screens.
// Pass short-lived Playwright storage-state files; never print their contents.
// All demo exam mutations are in-memory fetch fixtures, never database writes.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, execFileSync } from "node:child_process";

const [adminState, teacherState] = process.argv.slice(2);
assert(adminState && teacherState, "Pass admin and teacher short-lived storage-state file paths.");
const origin = process.env.TEST_APP_ORIGIN ||
  (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://127.0.0.1:5000");
const dir = mkdtempSync(join(tmpdir(), "dit-exam-browser-"));
let browser, socket;
let diagnose = async () => {};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, label, timeout = Number(process.env.BROWSER_WAIT_MS || 90000)) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await check()) return;
    await pause(150);
  }
  await diagnose();
  throw new Error("Timed out: " + label);
}

// Runs before the app's client scripts. Real server auth remains in place.
function fixtures() {
  const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const cls = uid(30), sem = uid(31), alloc = uid(32), series = uid(33);
  const sections = [{ id: uid(10), name: "Red", date: "2026-10-30" }, { id: uid(11), name: "Green", date: "2026-10-30" }];
  const students = [1, 2].map((n) => ({ id: uid(n), name: `Demo Student ${n}`, father_name: "Demo Parent",
    roll_no: String(n), class_id: cls, class_name: "Registered DIT Demo Class", session: "2026",
    exam_section_id: sections[n - 1].id, exam_section_name: sections[n - 1].name }));
  const history = [];
  const json = (data, status = 200) => Promise.resolve(new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }));
  const fetchReal = window.fetch.bind(window);
  window.__demo = { students, sections, saved: null, printed: "" };
  window.fetch = (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url, location.href);
    const path = url.pathname, method = init.method || "GET";
    if (path === "/api/admin/dit/exam-sections") {
      if (method === "POST") {
        const body = JSON.parse(init.body), section = { id: uid(12), name: body.name, date: body.date };
        sections.push(section); return json({ section }, 201);
      }
      return json({ sections: sections.map((s) => ({ ...s, student_count: students.filter((x) => x.exam_section_id === s.id).length })) });
    }
    if (path === "/api/admin/dit/exam-sections/students") {
      const p = url.searchParams, section = p.get("exam_section_id"), q = (p.get("q") || "").toLowerCase();
      return json({ students: students.filter((s) => (!section || s.exam_section_id === section || (section === "unassigned" && !s.exam_section_id))
        && (!q || s.name.toLowerCase().includes(q) || s.roll_no.includes(q))),
      classes: [{ id: cls, name: "Registered DIT Demo Class", session: "2026" }] });
    }
    if (path === "/api/admin/dit/exam-sections/assign") {
      const body = JSON.parse(init.body), target = sections.find((s) => s.id === body.exam_section_id);
      let changed = 0;
      for (const s of students.filter((s) => body.student_ids.includes(s.id))) {
        if (s.exam_section_id !== target.id) {
          history.unshift({ id: uid(100 + history.length), student_id: s.id, from_section_name: s.exam_section_name,
            to_section_name: target.name, changed_at: new Date().toISOString(), changed_by_name: "Demo Admin" });
          s.exam_section_id = target.id; s.exam_section_name = target.name; changed++;
        }
      }
      return json({ ok: true, changed });
    }
    if (path === "/api/admin/dit/exam-sections/history") {
      const student = students.find((s) => s.id === url.searchParams.get("student_id"));
      return json({ student, history: history.filter((h) => h.student_id === student.id),
        results: [{ id: uid(150), series_name: "Demo Mock", course_title: "Computing", test_date: "2026-10-20",
          obtained_marks: 85, total_marks: 100, is_absent: false, exam_section_name: "Red" }] });
    }
    if (path === "/api/teacher/dit/courses") return json({ courses: [{ allocation_id: alloc, course_id: uid(34),
      course_code: "C1", course_title: "Computing", semester_id: sem, semester_number: 1,
      term_type: "Regular", class_id: cls, class_name: "Registered DIT Demo Class", session: "2026" }] });
    if (path === "/api/teacher/dit/test-series") return json({ series: [{ id: series, name: "Demo Mock", total_marks: 100, passing_marks: 40 }] });
    if (path === "/api/teacher/dit/exam-sections") return json({ sections: sections.map((s) => ({ ...s, student_count: 1 })) });
    if (path === "/api/teacher/dit/results") {
      if (method === "POST") { window.__demo.saved = JSON.parse(init.body); return json({ ok: true }); }
      return json({ students: students.filter((s) => !url.searchParams.get("exam_section_id") || s.exam_section_id === url.searchParams.get("exam_section_id"))
        .map((s) => ({ student_id: s.id, name: s.name, father_name: s.father_name, roll_no: s.roll_no,
          obtained_marks: null, is_absent: true, remarks: "", result_id: null, attendance_pct: 100 })) });
    }
    if (method !== "GET") throw new Error("Blocked non-fixture API mutation: " + path);
    return fetchReal(input, init);
  };
  // Install when the body exists, before any print interaction.
  document.addEventListener("DOMContentLoaded", () => {
    const appendNode = document.body.appendChild.bind(document.body);
    document.body.appendChild = (element) => {
      const result = appendNode(element);
      if (element.tagName === "IFRAME") element.contentWindow.print = () => {
        window.__demo.printed = element.contentDocument.documentElement.outerHTML;
      };
      return result;
    };
  }, { once: true });
}

try {
  browser = spawn("chromium", ["--headless", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu",
    "--remote-debugging-port=0", `--user-data-dir=${join(dir, "chrome")}`, "--no-first-run", "about:blank"], { stdio: "ignore" });
  await until(() => existsSync(join(dir, "chrome/DevToolsActivePort")), "Chromium startup");
  const port = readFileSync(join(dir, "chrome/DevToolsActivePort"), "utf8").split("\n")[0];
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(pages.find((p) => p.type === "page").webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let next = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const result = JSON.parse(event.data);
    if (!result.id) return;
    const request = pending.get(result.id); pending.delete(result.id);
    if (result.error) request.reject(new Error(result.error.message)); else request.resolve(result.result);
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++next; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + ": " + (result.exceptionDetails.exception?.description || ""));
    return result.result.value;
  };
  diagnose = async () => {
    writeFileSync(join(dir, "failure.png"), Buffer.from((await call("Page.captureScreenshot", { format: "png" })).data, "base64"));
    console.log(JSON.stringify({ screenshot: join(dir, "failure.png"), diagnostics: await evaluate(
      "({path:location.pathname,title:document.title,hydratedButtons:[...document.querySelectorAll('button')].filter(b=>Object.keys(b).some(k=>k.startsWith('__reactProps$'))).length,fixtureInstalled:!!window.__demo,ready:document.readyState})",
    ) }));
  };
  const click = async (text) => {
    await until(() => evaluate(`Boolean([...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}&&!b.disabled&&Object.keys(b).some(k=>k.startsWith('__reactProps$'))))`), "hydrated button " + text);
    await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}&&!b.disabled).click()`);
  };
  const set = async (selector, value) => {
    await until(() => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`), "field " + selector);
    await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});const proto=e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  };
  const setLabel = async (label, value) => {
    const selector = `label[data-browser-label="${label}"]`;
    await until(() => evaluate(`Boolean([...document.querySelectorAll('label')].find(e=>e.textContent.trim().toLowerCase()===${JSON.stringify(label.toLowerCase())}&&Object.keys(e).some(k=>k.startsWith('__reactProps$'))))`), "hydrated field " + label);
    await evaluate(`(()=>{const e=[...document.querySelectorAll('label')].find(e=>e.textContent.trim().toLowerCase()===${JSON.stringify(label.toLowerCase())});if(!e)throw Error('Missing label ${label}');e.setAttribute('data-browser-label',${JSON.stringify(label)});})()`);
    await set(selector + " ~ select," + selector + " ~ input", value);
  };
  await call("Page.enable"); await call("Network.enable");
  await call("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await call("Page.addScriptToEvaluateOnNewDocument", { source: `(${fixtures.toString()})()` });
  await call("Network.setCookies", { cookies: JSON.parse(readFileSync(adminState, "utf8")).cookies });
  await call("Page.navigate", { url: origin + "/dashboard/admin/dit-mock" });
  await click("Exam Sections");
  await until(() => evaluate("document.body.textContent.includes('Demo Student 1')"), "fixture roster");
  await set("#exam-section-name", "Browser Demo Section");
  await set("#exam-section-date", "2026-10-30");
  await click("Create section");
  await until(() => evaluate("window.__demo.sections.length===3"), "section created");
  // Cards include the date and count, so locate by their name child.
  const card = async (name) => evaluate(`[...document.querySelectorAll('button[aria-pressed]')].find(b=>b.textContent.includes(${JSON.stringify(name)})).click()`);
  await card("Red");
  await until(() => evaluate("document.querySelector('tbody').textContent.includes('Demo Student 1')"), "Red roster");
  await evaluate("document.querySelector('input[aria-label=\"Select Demo Student 1\"]').click()");
  await set('select[aria-label="Destination section"]', "00000000-0000-4000-8000-000000000012");
  await click("Assign / move");
  await until(() => evaluate("!document.querySelector('tbody').textContent.includes('Demo Student 1')"), "old section lost membership");
  await card("Browser Demo Section");
  await until(() => evaluate("document.querySelector('tbody').textContent.includes('Demo Student 1')"), "new roster");
  assert(await evaluate("document.querySelector('tbody').textContent.includes('Registered DIT Demo Class')"));
  await evaluate("document.querySelector('input[aria-label=\"Select Demo Student 1\"]').click()");
  await set('select[aria-label="Destination section"]', "00000000-0000-4000-8000-000000000011");
  await click("Assign / move");
  await until(() => evaluate("!document.querySelector('tbody').textContent.includes('Demo Student 1')"), "moved from demo section");
  await card("Green");
  await until(() => evaluate("document.querySelector('tbody').textContent.includes('Demo Student 1')"), "Green roster");
  await until(() => evaluate("[...document.querySelectorAll('button[aria-pressed]')].find(b=>b.textContent.includes('Green'))?.lastElementChild.textContent==='2'"), "Green counter");
  assert.equal(await evaluate("[...document.querySelectorAll('button[aria-pressed]')].find(b=>b.textContent.includes('Browser Demo Section')).lastElementChild.textContent"), "0");
  await click("History");
  await until(() => evaluate("document.querySelector('[role=dialog]')?.textContent.includes('Demo Mock')"), "history and result");
  const historyText = await evaluate("document.querySelector('[role=dialog]').textContent");
  assert(historyText.includes("Red") && historyText.includes("Green") && historyText.includes("Browser Demo Section"));
  await click("Close");
  await click("Print / PDF");
  await until(() => evaluate("Boolean(window.__demo.printed)"), "isolated print HTML");
  const html = await evaluate("window.__demo.printed");
  for (const text of ["Green", "Demo Student 1", "Registered DIT Demo Class"]) assert(html.includes(text));
  writeFileSync(join(dir, "admin-roster.png"), Buffer.from((await call("Page.captureScreenshot", { format: "png" })).data, "base64"));
  await click("Analytics & Reports");
  for (const tab of ["Subject Analytics", "Overall Result", "Overall Zones", "Marks Percentage"]) {
    await click(tab);
    await until(() => evaluate("document.body.textContent.toLowerCase().includes('exam section')"), "exam section filter in " + tab);
  }
  // Teacher fixture begins fresh after navigation, so original Red has Student 1.
  await call("Network.setCookies", { cookies: JSON.parse(readFileSync(teacherState, "utf8")).cookies });
  await call("Page.navigate", { url: origin + "/dashboard/teacher?tab=dit-results" });
  await until(() => evaluate("document.body.textContent.includes('Select Class & Test')"), "teacher DIT entry");
  await setLabel("Class + Session", "00000000-0000-4000-8000-000000000030");
  await until(() => evaluate("[...document.querySelectorAll('option')].some(o=>o.textContent.includes('Computing'))"), "teacher course options");
  await setLabel("Course", "00000000-0000-4000-8000-000000000032");
  await setLabel("Test Series", "00000000-0000-4000-8000-000000000033");
  await setLabel("Test Date", "2026-10-30");
  await until(() => evaluate("[...document.querySelectorAll('option')].some(o=>o.textContent.includes('Red'))"), "exam section options");
  await setLabel("Exam Section", "00000000-0000-4000-8000-000000000010");
  await click("Load Students");
  await until(() => evaluate("document.querySelector('tbody')?.textContent.includes('Demo Student 1')"), "filtered teacher roster");
  const teacherText = await evaluate("document.body.textContent");
  assert(!teacherText.includes("Demo Student 2"));
  await click("Save Results");
  await until(() => evaluate("Boolean(window.__demo.saved)"), "teacher fixture submission");
  const saved = await evaluate("window.__demo.saved");
  assert.equal(saved.exam_section_id, "00000000-0000-4000-8000-000000000010");
  assert.equal(saved.rows.length, 1);
  writeFileSync(join(dir, "teacher-entry.png"), Buffer.from((await call("Page.captureScreenshot", { format: "png" })).data, "base64"));
  await call("Page.navigate", { url: "data:text/html;charset=utf-8," + encodeURIComponent(html) });
  await until(() => evaluate("document.readyState==='complete'"), "roster PDF document");
  const pdf = await call("Page.printToPDF", { printBackground: true, preferCSSPageSize: true });
  const pdfPath = join(dir, "exam-section-roster.pdf");
  writeFileSync(pdfPath, Buffer.from(pdf.data, "base64"));
  const text = execFileSync("pdftotext", [pdfPath, "-"], { encoding: "utf8" });
  assert(text.includes("Green") && text.includes("Demo Student 1") && text.includes("Registered DIT Demo Class"));
  console.log(JSON.stringify({ passed: true, checks: ["admin create/move/history/counters", "one current membership", "unchanged parent class",
    "all analytics subtab filters", "teacher filtered entry/save payload", "isolated roster PDF text"], outputDirectory: dir,
    mutations: "in-memory fixtures only; no persisted demo records" }));
} finally {
  socket?.close();
  if (browser && browser.exitCode === null) {
    const exited = new Promise((resolve) => browser.once("exit", resolve));
    browser.kill("SIGTERM"); await exited;
  }
  if (existsSync(join(dir, "chrome"))) rmSync(join(dir, "chrome"), { recursive: true, force: true });
}

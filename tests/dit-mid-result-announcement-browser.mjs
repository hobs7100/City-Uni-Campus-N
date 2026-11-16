// The real admin screen with announcement POST intercepted in this browser only.
// Never announces real results or changes accounts.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

assert(process.argv[2], "Pass a short-lived admin browser storage-state file.");
const origin = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const dir = mkdtempSync(join(tmpdir(), "dit-mid-browser-"));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label) {
  for (let n = 0; n < 450; n++) {
    if (await check()) return;
    await pause(200);
  }
  throw Error("Timed out: " + label);
}
let browser, socket;
try {
  browser = spawn("chromium", ["--headless", "--no-sandbox", "--disable-dev-shm-usage",
    "--remote-debugging-port=0", `--user-data-dir=${join(dir, "chrome")}`, "--no-first-run", "about:blank"], { stdio: "ignore" });
  await until(() => existsSync(join(dir, "chrome/DevToolsActivePort")), "Chromium");
  const port = readFileSync(join(dir, "chrome/DevToolsActivePort"), "utf8").split("\n")[0];
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(pages.find(page => page.type === "page").webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener("open", resolve, { once: true }));
  const pending = new Map();
  const errors = [];
  let counter = 0;
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
    if (!message.id) return;
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) request.reject(Error(message.error.message)); else request.resolve(message.result);
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++counter;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const click = async text => {
    const find = `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}&&!b.disabled&&Object.keys(b).some(k=>k.startsWith('__reactProps$')))`;
    await until(() => evaluate(`Boolean(${find})`), text);
    await evaluate(`${find}.click()`);
  };
  await call("Page.enable");
  await call("Runtime.enable");
  await call("Network.enable");
  await call("Network.setCookies", { cookies: JSON.parse(readFileSync(process.argv[2], "utf8")).cookies });
  await call("Page.addScriptToEvaluateOnNewDocument", { source: `(()=>{
    const realFetch=window.fetch.bind(window);
    window.__midCheck={requests:0,released:false};
    window.fetch=async(input,init={})=>{
      const url=new URL(typeof input==='string'?input:input.url,location.href);
      const method=init.method||'GET';
      if(method==='POST'&&/\\/api\\/admin\\/dit\\/test-series\\/[^/]+\\/announce-mid$/.test(url.pathname)){
        window.__midCheck.requests++;window.__midCheck.released=true;
        return new Response(JSON.stringify({announcement:{mid_result_announced_at:new Date().toISOString()}}),{headers:{'Content-Type':'application/json'}});
      }
      if(method!=='GET')throw Error('Blocked real mutation during browser check');
      const response=await realFetch(input,init);
      if(url.pathname==='/api/admin/dit/test-series'&&response.ok&&window.__midCheck.released){
        const data=await response.json();
        data.series=data.series.map(s=>s.name.trim().toLowerCase()==='mid-term'?{...s,mid_result_announced_at:new Date().toISOString()}:s);
        return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
      }
      return response;
    };
  })();` });
  await call("Page.navigate", { url: origin + "/dashboard/admin/dit-mock" });
  await click("Announce Mid Result");
  await until(() => evaluate("document.body.innerText.includes('Teacher')||document.body.innerText.includes('teacher entries remain editable')"), "confirmation message");
  assert.equal(await evaluate("window.__midCheck.requests"), 0);
  await click("Cancel");
  assert.equal(await evaluate("window.__midCheck.requests"), 0);
  await click("Announce Mid Result");
  const dialogNode = "[...document.querySelectorAll('h3')].find(e=>e.textContent==='Announce Mid-Term Results')?.parentElement.parentElement";
  await until(() => evaluate(`Boolean(${dialogNode})`), "confirmation dialog");
  const dialog = await evaluate(`(${dialogNode}).innerText`);
  assert(dialog.includes("visible to students") && dialog.includes("teacher entries remain editable"));
  await evaluate(`[...(${dialogNode}).querySelectorAll('button')].find(b=>b.textContent.trim()==='Announce Mid Result').click()`);
  await until(() => evaluate(`window.__midCheck.requests===1&&!(${dialogNode})&&document.body.innerText.includes('Announced')&&!([...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Announce Mid Result'))`), "announced status");
  assert(await evaluate("document.body.innerText.includes('Announced')"));
  assert.deepEqual(errors, []);
  writeFileSync(join(dir, "admin-announced.png"), Buffer.from((await call("Page.captureScreenshot", { format: "png" })).data, "base64"));
  console.log(JSON.stringify({ passed: true, adminButton: true, confirmationAndCancel: true,
    singleInterceptedPost: true, announcedStatus: true, realMutations: 0, evidence: dir }));
} finally {
  socket?.close();
  if (browser && browser.exitCode === null) {
    const exited = new Promise(resolve => browser.once("exit", resolve));
    browser.kill("SIGTERM");
    await exited;
  }
  rmSync(join(dir, "chrome"), { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

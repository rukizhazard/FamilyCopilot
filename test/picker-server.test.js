"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const { createServer, files } = require("../scripts/serve-picker.js");
function request(port, url, options={}) {
  return new Promise((resolve,reject) => {
    http.get({ hostname:"127.0.0.1",port,path:url,headers:{ host:"localhost:8001" },...options }, res => {
      let body=""; res.on("data",chunk=>{body+=chunk;}); res.on("end",()=>resolve({ status:res.statusCode,headers:res.headers,body }));
    }).on("error",reject);
  });
}
test("loopback server serves only allowlisted assets, rejects traversal/queries/hosts/methods, omits callback COOP", async t => {
  const server=createServer(path.resolve(__dirname,"../picker"));
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve)); t.after(()=>new Promise(resolve=>server.close(resolve)));
  const port=server.address().port;
  for(const url of ["/","/index.html","/redirect.html","/picker.css"]) {
    const res=await request(port,url); assert.equal(res.status,200);
    assert.equal(res.headers["cache-control"],"no-store"); assert.equal(res.headers["referrer-policy"],"no-referrer");
    assert.equal(res.headers["cross-origin-opener-policy"],undefined);
    assert.match(res.headers["content-security-policy"],/script-src 'self'/);
    assert.doesNotMatch(res.headers["content-security-policy"],/unsafe-inline|unsafe-eval/);
  }
  for(const url of ["/../README.md","/%2e%2e/README.md","/package.json","/.env","/public-config.json","/redirect.html?code=never-log","/index.html?x=1"]) assert.equal((await request(port,url)).status,404);
  assert.equal((await request(port,"/",{headers:{host:"evil.test"}})).status,403);
  assert.equal((await request(port,"/",{method:"POST"})).status,403);
  assert.equal((await request(port,"/",{method:"HEAD"})).body,"");
  assert.equal(Object.keys(files).length,7);
});
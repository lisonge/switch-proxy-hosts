import fetch from 'node-fetch';
import http from 'node:http';
import dns from 'node:dns/promises';
import https from 'node:https';
import type { LookupFunction } from 'node:net';

const record = {
  hostname: '',
  address: '',
};
const lookup: LookupFunction = async (hostname, options, callback) => {
  if (record.hostname === hostname) {
    callback(null, [
      {
        address: record.address,
        family: 4,
      },
    ]);
    return;
  }
  callback(null, [await dns.lookup(hostname)]);
};
const httpAgent = new http.Agent({
  lookup,
});
const httpsAgent = new https.Agent({
  lookup,
});

// 必须剔除 host 字段, 否则请求服务域名是错误的
const removeHeaders = ['host', 'connection', 'referer'];

const server = http.createServer(async (req, res) => {
  const url = (req.url || '/').trimEnd();
  const i = url.indexOf('/', 1);
  const targetUrl = url.substring(i + 1);
  if (!(targetUrl.startsWith('https://') || targetUrl.startsWith('http://'))) {
    res.writeHead(404);
    res.end();
    return;
  }
  record.address = url.substring(1, i);
  record.hostname = new URL(targetUrl).hostname;
  console.log(`${record.address} => ${targetUrl}`);
  const headers = Object.fromEntries(
    Object.entries(req.headers).filter(
      ([k, v]) => typeof v === 'string' && !removeHeaders.includes(k)
    ) as [string, string][]
  );
  const agent = targetUrl.startsWith('https:') ? httpsAgent : httpAgent;
  const method = req.method;
  const body = method === 'GET' || method === 'HEAD' ? undefined : req;
  const response = await fetch(targetUrl, {
    agent,
    method,
    headers,
    body,
  });
  res.writeHead(response.status, response.statusText, response.headers.raw());
  response.body?.pipe(res, { end: true });
});

const port = 9200;
server.listen(port, () => {
  console.log(`switch-proxy-hosts is running on port ${port}\n`);
});

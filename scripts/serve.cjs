const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../web');
const port=Number(process.env.PORT||4173);
if(!Number.isInteger(port)||port<1||port>65535)throw Error('PORT must be an integer between 1 and 65535');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 let filename;
 try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);filename=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));}
 catch{res.writeHead(400);return res.end('Bad request');}
 if(filename!==root&&!filename.startsWith(root+path.sep)){res.writeHead(403);return res.end('Forbidden');}
 fs.readFile(filename,(error,data)=>{
  if(error){res.writeHead(error.code==='ENOENT'?404:500);return res.end('File unavailable');}
  res.writeHead(200,{'Content-Type':mime[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-store'});
  res.end(data);
 });
});
server.listen(port,'127.0.0.1',()=>console.log(`Silver Tide: http://127.0.0.1:${port}/`));

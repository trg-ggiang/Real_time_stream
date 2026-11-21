import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<!doctype html><html><body></body></html>');globalThis.window=dom.window;globalThis.document=dom.window.document;
const{default:mermaid}=await import('./node_modules/mermaid/dist/mermaid.core.mjs');mermaid.initialize({startOnLoad:false,securityLevel:'strict'});
const results=[];for(const file of fs.readdirSync('docs/diagrams').filter(f=>f.endsWith('.mmd'))){await mermaid.parse(fs.readFileSync('docs/diagrams/'+file,'utf8').replace(/^\uFEFF/,''));results.push({file,syntax:'passed'});}fs.writeFileSync('output/mermaid-check/validation.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));

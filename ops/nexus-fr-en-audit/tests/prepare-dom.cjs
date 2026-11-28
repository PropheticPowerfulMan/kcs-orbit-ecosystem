const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const frontend=path.resolve(__dirname,'../../../KCS Nexus/frontend'),ts=createRequire(path.join(frontend,'package.json'))('typescript'),sources={};
for(const name of ['i18n/globalText.ts','i18n/auditText.ts','i18n/interfaceText.ts','components/shared/GlobalTextTranslator.tsx']){
 const source=fs.readFileSync(path.join(frontend,'src',name),'utf8')+(name.endsWith('GlobalTextTranslator.tsx')?'\nexport {translateNode}\n':'');
 sources[name]=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
}
const bundle=`(()=>{const sources=${JSON.stringify(sources)},cache={};const load=id=>{if(id.startsWith('@/'))id=id.slice(2);if(id==='react'||id==='react-i18next'||id==='store/uiStore')return {};if(id==='./globalText')id='i18n/globalText.ts';if(id==='./auditText')id='i18n/auditText.ts';if(!id.endsWith('.ts')&&!id.endsWith('.tsx'))id+='.ts';if(cache[id])return cache[id].exports;const m={exports:{}};cache[id]=m;Function('exports','module','require',sources[id])(m.exports,m,load);return m.exports};window.__localeTest={...load('i18n/interfaceText.ts'),...load('components/shared/GlobalTextTranslator.tsx')};})();`;
const output=process.argv[2]||'/evidence/dom-test-bundle.js';fs.writeFileSync(output,bundle);console.log('Prepared DOM translation regression bundle.');

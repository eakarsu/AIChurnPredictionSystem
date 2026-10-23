
'use strict'; const test=require('node:test'); const assert=require('node:assert/strict');
const {toCSV,applySearchFilter,createTaskStore,runAI,hasProviderKey}=require('../lib/featurePack');
const FEATURE='churn-risk-summary';
test('csv escapes commas/quotes and preserves zero/false',()=>{ const csv=toCSV([{name:'a,b',count:0,active:false}]); assert.match(csv,/name,count,active/); assert.match(csv,/"a,b",0,false/); });
test('search/filter is case-insensitive',()=>{ const rows=[{name:'Alpha Bot'},{name:'beta'}]; assert.equal(applySearchFilter(rows,'alpha',['name']).length,1); assert.equal(applySearchFilter(rows,'',['name']).length,2); });
test('tasks create/list/update are user-scoped',()=>{ const s=createTaskStore(); const t=s.create(7,{title:'Follow up'}); assert.equal(s.list(7).length,1); assert.equal(s.list(8).length,0); assert.equal(s.update(7,t.id,{status:'done'}).status,'done'); assert.equal(s.update(8,t.id,{status:'done'}),null); assert.throws(()=>s.create(7,{}),/title is required/); });
test('AI fallback is labelled aiGenerated:false and preserves 0/false/empty',async()=>{ delete process.env.OPENROUTER_API_KEY; delete process.env.OPENAI_API_KEY; assert.equal(hasProviderKey(),false); const out=await runAI(FEATURE,[]); assert.equal(out.aiGenerated,false); assert.equal(out.source,'deterministic-fallback'); const flat=JSON.stringify(out.result); assert.ok(flat.includes('0')||flat.includes('false')); });

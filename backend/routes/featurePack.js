
'use strict';
const express=require('express');
const {toCSV,applySearchFilter,createTaskStore,runAI,FALLBACKS}=require('../lib/featurePack');
const SEARCH_FIELDS=["name", "email", "company", "plan", "status"];
async function fetchMain(pool,req){ const q=await pool.query('SELECT * FROM customers ORDER BY id DESC LIMIT 500'); return q.rows; }
module.exports=function createFeaturePackRouter(opts={}){ const auth=opts.auth||require('../middleware/auth'); const pool=opts.pool||require('../db'); const store=createTaskStore(); const router=express.Router(); router.use(auth);
 router.get('/tasks',(req,res)=>res.json({tasks:store.list(req.user.id,{status:req.query.status,search:req.query.search})}));
 router.post('/tasks',(req,res)=>{ try{ res.status(201).json(store.create(req.user.id,req.body||{})); }catch(e){ res.status(e.status||400).json({error:e.message}); } });
 router.put('/tasks/:id',(req,res)=>{ try{ const t=store.update(req.user.id,req.params.id,req.body||{}); if(!t) return res.status(404).json({error:'task not found'}); res.json(t); }catch(e){ res.status(e.status||400).json({error:e.message}); } });
 router.get('/records',async(req,res)=>{ try{ const rows=await fetchMain(pool,req); const filtered=applySearchFilter(rows,req.query.search,SEARCH_FIELDS); const f=String(req.query.status||''); const out=f?filtered.filter(r=>String(r.status||r.state||'')===f):filtered; res.json({records:out,total:out.length}); }catch(e){ res.status(503).json({error:'main records unavailable',detail:e.message}); } });
 router.get('/export',async(req,res)=>{ try{ const rows=await fetchMain(pool,req); const filtered=applySearchFilter(rows,req.query.search,SEARCH_FIELDS); const format=String(req.query.format||'json').toLowerCase(); if(format==='csv'){ res.setHeader('Content-Type','text/csv'); res.setHeader('Content-Disposition','attachment; filename="main-records.csv"'); return res.send(toCSV(filtered)); } if(format==='json'){ res.setHeader('Content-Disposition','attachment; filename="main-records.json"'); return res.json({records:filtered}); } res.status(400).json({error:'format must be csv or json'}); }catch(e){ res.status(503).json({error:'export unavailable',detail:e.message}); } });
 router.get('/ai/features',(req,res)=>res.json({features:Object.keys(FALLBACKS)}));
 router.post('/ai/:feature',async(req,res)=>{ try{ const records=Array.isArray(req.body&&req.body.records)?req.body.records:[]; res.json(await runAI(req.params.feature,records)); }catch(e){ res.status(e.status||500).json({error:e.message}); } });
 return router; };

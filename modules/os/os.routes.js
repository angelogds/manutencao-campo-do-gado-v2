
const r=require('express').Router(); const db=require('../../database/db');
r.get('/',(q,s)=>s.render('os/index',{rows:db.prepare('SELECT * FROM os').all()}));
r.get('/nova',(q,s)=>s.render('os/nova'));
r.post('/nova',(q,s)=>{db.prepare('INSERT INTO os(equipamento,descricao,tipo,status,opened_by,opened_at) VALUES(?,?,?,?,?,datetime(\'now\'))').run(q.body.equipamento,q.body.descricao,q.body.tipo,'ABERTA',q.session.user.id); s.redirect('/os');});
module.exports=r;

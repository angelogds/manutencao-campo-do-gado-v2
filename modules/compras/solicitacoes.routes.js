
const r=require('express').Router(); const db=require('../../database/db');
r.get('/',(q,s)=>s.render('compras/solicitacoes',{rows:db.prepare('SELECT * FROM solicitacoes').all()}));
r.get('/nova',(q,s)=>s.render('compras/solicitacao_nova'));
r.post('/nova',(q,s)=>{db.prepare('INSERT INTO solicitacoes(titulo,descricao,status,created_by,created_at) VALUES(?,?,?,?,datetime(\'now\'))').run(q.body.titulo,q.body.descricao,'ABERTA',q.session.user.id); s.redirect('/solicitacoes');});
module.exports=r;

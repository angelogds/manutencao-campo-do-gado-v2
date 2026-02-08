
const r=require('express').Router(); const db=require('../../database/db'); const bcrypt=require('bcryptjs');
r.get('/',(q,s)=>s.render('admin/users',{rows:db.prepare('SELECT id,name,email,role FROM users').all()}));
r.post('/novo',(q,s)=>{db.prepare('INSERT INTO users(name,email,password_hash,role,created_at) VALUES(?,?,?,?,datetime(\'now\'))').run(q.body.name,q.body.email,bcrypt.hashSync(q.body.password,10),q.body.role); s.redirect('/admin/users');});
module.exports=r;

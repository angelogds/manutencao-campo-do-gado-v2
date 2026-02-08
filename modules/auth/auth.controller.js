
const s=require('./auth.service');
exports.loginForm=(req,res)=>res.render('auth/login');
exports.login=(req,res)=>{const u=s.authenticate(req.body.email,req.body.password); if(!u){req.flash('error','Inválido');return res.redirect('/login');} req.session.user={id:u.id,name:u.name,role:u.role}; res.redirect('/dashboard');};
exports.logout=(req,res)=>req.session.destroy(()=>res.redirect('/login'));

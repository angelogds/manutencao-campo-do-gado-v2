
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');

const { requireLogin } = require('./modules/auth/auth.middleware');

const app = express();
app.set('view engine','ejs');
app.set('views', path.join(__dirname,'views'));
app.use(express.urlencoded({extended:true}));
app.use('/public', express.static(path.join(__dirname,'public')));
app.use(session({ secret: process.env.SESSION_SECRET||'dev', resave:false, saveUninitialized:false }));
app.use(flash());
app.use((req,res,next)=>{ res.locals.user=req.session.user||null; res.locals.messages=req.flash(); next(); });

app.use('/', require('./modules/auth/auth.routes'));
app.use('/dashboard', requireLogin, require('./modules/dashboard/dashboard.routes'));
app.use('/solicitacoes', requireLogin, require('./modules/compras/solicitacoes.routes'));
app.use('/compras', requireLogin, require('./modules/compras/compras.routes'));
app.use('/os', requireLogin, require('./modules/os/os.routes'));
app.use('/admin/users', requireLogin, require('./modules/usuarios/usuarios.routes'));

app.get('/', (req,res)=>res.redirect('/dashboard'));
app.listen(process.env.PORT||3000, ()=>console.log('Running'));

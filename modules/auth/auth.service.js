
const db=require('../../database/db'); const bcrypt=require('bcryptjs');
exports.authenticate=(e,p)=>{const u=db.prepare('SELECT * FROM users WHERE email=?').get(e); if(!u) return null; if(!bcrypt.compareSync(p,u.password_hash)) return null; return u;};

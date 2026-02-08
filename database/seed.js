
const db=require('./db'); const bcrypt=require('bcryptjs');
if(!db.prepare('SELECT 1 FROM users WHERE email=?').get('admin@campodogado.local')){
  db.prepare('INSERT INTO users(name,email,password_hash,role,created_at) VALUES(?,?,?,?,datetime(\'now\'))')
    .run('Admin','admin@campodogado.local',bcrypt.hashSync('admin123',10),'ADMIN');
}

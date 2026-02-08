
const fs=require('fs'), path=require('path');
const db=require('./db');
db.exec('CREATE TABLE IF NOT EXISTS migrations(filename TEXT PRIMARY KEY)');
const dir=path.join(__dirname,'migrations');
fs.readdirSync(dir).filter(f=>f.endsWith('.sql')).sort().forEach(f=>{
  if(!db.prepare('SELECT 1 FROM migrations WHERE filename=?').get(f)){
    db.exec(fs.readFileSync(path.join(dir,f),'utf8'));
    db.prepare('INSERT INTO migrations VALUES(?)').run(f);
  }
});

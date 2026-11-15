require('dotenv').config();
const { pool } = require('./src/db/pool');

const sql = `
CREATE SEQUENCE IF NOT EXISTS attendance_id_seq START 1; 

CREATE TABLE attendance ( 
  id TEXT PRIMARY KEY DEFAULT ('ATT-' || nextval('attendance_id_seq')), 
  class_name TEXT NOT NULL, 
  attendance_date DATE NOT NULL, 
  records JSONB NOT NULL DEFAULT '{}'::jsonb, 
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), 
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), 
  UNIQUE(class_name, attendance_date) 
); 

CREATE INDEX idx_attendance_class_date ON attendance(class_name, attendance_date); 

CREATE TRIGGER attendance_set_updated_at BEFORE UPDATE ON attendance 
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
`;

pool.query(sql).then(() => {
  console.log('Attendance table created');
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});

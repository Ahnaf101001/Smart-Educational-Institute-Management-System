const { pool } = require("../src/db/pool");

const createFunctionSql = `
CREATE OR REPLACE FUNCTION auto_generate_student_invoices()
RETURNS TRIGGER AS $$
DECLARE
  fs RECORD;
  inv_due_date DATE;
  inv_billing_month DATE;
  fs_due_day INT;
  target_class_id TEXT;
BEGIN
  -- First day of the current month
  inv_billing_month := date_trunc('month', CURRENT_DATE)::DATE;

  -- Try to resolve class_id if not present
  target_class_id := NEW.class_id;
  IF target_class_id IS NULL AND NEW.class_name IS NOT NULL THEN
    SELECT id INTO target_class_id FROM classes WHERE name = split_part(NEW.class_name, '-', 1);
  END IF;
  
  -- Loop through active fee structures that match the student's class
  FOR fs IN
    SELECT * FROM fee_structures
    WHERE status = 'Active'
      AND (
        class_id = target_class_id
        OR class_id IS NULL
      )
  LOOP
    -- Calculate due date based on due_day of structure or default to 10th of current month
    fs_due_day := COALESCE(fs.due_day, 10);
    inv_due_date := make_date(
      date_part('year', CURRENT_DATE)::int,
      date_part('month', CURRENT_DATE)::int,
      fs_due_day
    );
    
    -- Insert the invoice
    INSERT INTO fee_invoices (student_id, fee_structure_id, billing_month, due_date, amount, status)
    VALUES (NEW.id, fs.id, inv_billing_month, inv_due_date, fs.amount, 'Due');
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
`;

const createTriggerSql = `
DROP TRIGGER IF EXISTS trigger_auto_generate_student_invoices ON students;
CREATE TRIGGER trigger_auto_generate_student_invoices
AFTER INSERT ON students
FOR EACH ROW
EXECUTE FUNCTION auto_generate_student_invoices();
`;

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    console.log("Creating function...");
    await client.query(createFunctionSql);
    console.log("Creating trigger...");
    await client.query(createTriggerSql);
    await client.query("COMMIT");
    console.log("Trigger applied successfully!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error applying trigger:", err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();

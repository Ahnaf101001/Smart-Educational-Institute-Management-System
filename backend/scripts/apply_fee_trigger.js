const { pool } = require("../src/db/pool");

const createFunctionSql = `
CREATE OR REPLACE FUNCTION auto_generate_invoices_for_new_structure()
RETURNS TRIGGER AS $$
DECLARE
  st RECORD;
  inv_due_date DATE;
  inv_billing_month DATE;
  fs_due_day INT;
  target_class_name TEXT;
BEGIN
  -- We only run if status is Active
  IF NEW.status = 'Active' THEN
    -- First day of the current month
    inv_billing_month := date_trunc('month', CURRENT_DATE)::DATE;
    
    fs_due_day := COALESCE(NEW.due_day, 10);
    inv_due_date := make_date(
      date_part('year', CURRENT_DATE)::int,
      date_part('month', CURRENT_DATE)::int,
      fs_due_day
    );

    -- Loop through all students whose class matches the structure class
    FOR st IN
      SELECT * FROM students
      WHERE status = 'Active'
        AND (
          class_id = NEW.class_id
          OR (NEW.class_id IS NOT NULL AND class_name LIKE (SELECT name || '%' FROM classes WHERE id = NEW.class_id))
          OR NEW.class_id IS NULL -- All Classes
        )
    LOOP
      -- Check if invoice already exists to avoid duplicates
      IF NOT EXISTS (
        SELECT 1 FROM fee_invoices
        WHERE student_id = st.id
          AND fee_structure_id = NEW.id
          AND billing_month = inv_billing_month
      ) THEN
        INSERT INTO fee_invoices (student_id, fee_structure_id, billing_month, due_date, amount, status)
        VALUES (st.id, NEW.id, inv_billing_month, inv_due_date, NEW.amount, 'Due');
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
`;

const createTriggerSql = `
DROP TRIGGER IF EXISTS trigger_auto_generate_invoices_for_new_structure ON fee_structures;
CREATE TRIGGER trigger_auto_generate_invoices_for_new_structure
AFTER INSERT OR UPDATE OF status, amount, class_id ON fee_structures
FOR EACH ROW
EXECUTE FUNCTION auto_generate_invoices_for_new_structure();
`;

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    console.log("Creating function for structure trigger...");
    await client.query(createFunctionSql);
    console.log("Creating trigger for structure trigger...");
    await client.query(createTriggerSql);
    await client.query("COMMIT");
    console.log("Structure trigger applied successfully!");
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

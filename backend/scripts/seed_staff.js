const { query, transaction } = require("../src/db/pool");

const seedStaff = [
  { id: "STF-001", firstName: "Kabir", lastName: "Hossain", name: "Mr. Kabir Hossain", designation: "Office Manager", department: "Administration", phone: "01711-234567", email: "kabir@school.edu", joinDate: "2018-01-10", shift: "Morning", salary: 32000, gender: "Male", address: "House 12, Dhaka", status: "Active" },
  { id: "STF-002", firstName: "Rashida", lastName: "Begum", name: "Ms. Rashida Begum", designation: "Accountant", department: "Accounts", phone: "01812-345678", email: "rashida@school.edu", joinDate: "2017-03-18", shift: "Morning", salary: 30000, gender: "Female", address: "Mirpur, Dhaka", status: "Active" },
  { id: "STF-003", firstName: "Jahangir", lastName: "Alam", name: "Mr. Jahangir Alam", designation: "IT Technician", department: "IT & Library", phone: "01913-456789", email: "jahangir@school.edu", joinDate: "2019-05-20", shift: "Morning", salary: 26000, gender: "Male", address: "Uttara, Dhaka", status: "Active" },
  { id: "STF-004", firstName: "Rafiqul", lastName: "Islam", name: "Mr. Rafiqul Islam", designation: "Security Guard", department: "Security", phone: "01611-567890", email: "rafiqul@school.edu", joinDate: "2016-08-11", shift: "Night", salary: 18000, gender: "Male", address: "Savar, Dhaka", status: "Active" },
  { id: "STF-005", firstName: "Selina", lastName: "Akter", name: "Ms. Selina Akter", designation: "Cleaner", department: "Cleaning & Maintenance", phone: "01514-678901", email: "selina@school.edu", joinDate: "2020-02-14", shift: "Day", salary: 15000, gender: "Female", address: "Badda, Dhaka", status: "Active" },
  { id: "STF-006", firstName: "Abul", lastName: "Hasan", name: "Mr. Abul Hasan", designation: "Data Entry Operator", department: "Administration", phone: "01715-789012", email: "abul@school.edu", joinDate: "2021-01-08", shift: "Morning", salary: 22000, gender: "Male", address: "Farmgate, Dhaka", status: "Active" },
  { id: "STF-007", firstName: "Fatema", lastName: "Khatun", name: "Ms. Fatema Khatun", designation: "Librarian", department: "IT & Library", phone: "01816-890123", email: "fatema@school.edu", joinDate: "2018-10-25", shift: "Morning", salary: 24000, gender: "Female", address: "Dhanmondi, Dhaka", status: "On Leave" },
  { id: "STF-008", firstName: "Sumon", lastName: "Mia", name: "Mr. Sumon Mia", designation: "Maintenance Technician", department: "Cleaning & Maintenance", phone: "01917-901234", email: "sumon@school.edu", joinDate: "2015-04-02", shift: "Morning", salary: 21000, gender: "Male", address: "Mohakhali, Dhaka", status: "Active" },
  { id: "STF-009", firstName: "Akter", lastName: "Hossain", name: "Mr. Akter Hossain", designation: "Security Guard", department: "Security", phone: "01618-012345", email: "akter@school.edu", joinDate: "2019-09-19", shift: "Day", salary: 18000, gender: "Male", address: "Gazipur", status: "Active" },
  { id: "STF-010", firstName: "Nasrin", lastName: "Sultana", name: "Ms. Nasrin Sultana", designation: "Receptionist", department: "Administration", phone: "01519-123456", email: "nasrin@school.edu", joinDate: "2022-07-07", shift: "Morning", salary: 23000, gender: "Female", address: "Banani, Dhaka", status: "Active" },
  { id: "STF-011", firstName: "Belal", lastName: "Ahmed", name: "Mr. Belal Ahmed", designation: "Canteen Manager", department: "Canteen", phone: "01720-234567", email: "belal@school.edu", joinDate: "2016-12-12", shift: "Morning", salary: 28000, gender: "Male", address: "Khilgaon, Dhaka", status: "Active" },
  { id: "STF-012", firstName: "Ranu", lastName: "Begum", name: "Ms. Ranu Begum", designation: "Canteen Staff", department: "Canteen", phone: "01821-345678", email: "ranu@school.edu", joinDate: "2020-11-21", shift: "Morning", salary: 19000, gender: "Female", address: "Rampura, Dhaka", status: "Inactive" },
];

async function seed() {
  try {
    const existingCount = await query("SELECT COUNT(*)::int AS count FROM staff");
    if (existingCount.rows[0].count > 0) {
      console.log("Staff table already has records. Skipping seed.");
      return;
    }

    console.log("Seeding staff records into PostgreSQL...");
    await transaction(async (client) => {
      for (const s of seedStaff) {
        await client.query(
          `INSERT INTO staff (id, first_name, last_name, name, designation, department, phone, email, join_date, shift, salary, gender, address, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [s.id, s.firstName, s.lastName, s.name, s.designation, s.department, s.phone, s.email, s.joinDate, s.shift, s.salary, s.gender, s.address, s.status]
        );
      }
      await client.query("SELECT SETVAL('staff_id_seq', 12)");
    });
    console.log("Seeding completed successfully.");
  } catch (err) {
    console.error("Failed to seed staff:", err);
  } finally {
    process.exit();
  }
}

seed();

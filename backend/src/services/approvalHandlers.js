// Side effects executed when an approval request is approved (SRS APR-02).
const httpError = require("../utils/httpError");
const { registerHandler, registerRejectHandler } = require("./approvals");
const { applyDiscounts, cancelReceipt } = require("./fees");
const { dispatchNotice } = require("./notices");
const { confirmAdmission } = require("./admissions");
const { changeStatus, upsertEnrollment } = require("./students");
const { notifyStudentGuardians } = require("./notifications");
const { renderTemplate, defaultLanguage } = require("./templates");

registerHandler("fee_waiver", async (client, approval, req) => {
  const { discountId } = approval.payload;
  const d = (await client.query("UPDATE fee_discounts SET status = 'Approved', approved_by = $1 WHERE id = $2 RETURNING *", [req.user.name, discountId])).rows[0];
  if (!d) throw httpError(404, "Discount not found.");
  const updated = await applyDiscounts(client, d.student_id);
  return { discountId, invoicesUpdated: updated };
});

registerHandler("receipt_cancel", async (client, approval, req) => {
  const { paymentId, reason } = approval.payload;
  const pay = await cancelReceipt(client, req, paymentId, reason || approval.reason || "Approved cancellation");
  return { receipt: pay.receipt_no };
});

registerHandler("refund", async (client, approval, req) => {
  const { refundId } = approval.payload;
  const r = (await client.query("UPDATE refunds SET status = 'Paid', approved_by = $1 WHERE id = $2 RETURNING *", [req.user.name, refundId])).rows[0];
  if (!r) throw httpError(404, "Refund not found.");
  await client.query(
    `INSERT INTO financial_transactions (type, transaction_date, description, category, payment_method, amount, status, reference_no, details)
     VALUES ('Expense', CURRENT_DATE, $1, 'Fee Refund', $2, $3, 'Completed', $4, $5)`,
    [`Refund ${r.id} – ${r.student_id || ""}: ${r.reason}`, r.method || "Cash", r.amount, r.id, JSON.stringify({ refundId: r.id, paymentId: r.payment_id })],
  );
  return { refundId: r.id };
});

registerHandler("expense", async (client, approval) => {
  const { transactionId } = approval.payload;
  await client.query("UPDATE financial_transactions SET approval_status = 'Approved', status = 'Completed' WHERE id = $1", [transactionId]);
  return { transactionId };
});

registerHandler("marks_unlock", async (client, approval) => {
  const { examId, classId, subjectId } = approval.payload;
  await client.query(
    "UPDATE marks_entry_status SET status = 'Open', locked_at = NULL WHERE exam_id = $1 AND class_id = $2 AND subject_id = $3",
    [examId, classId, subjectId],
  );
  return { unlocked: true };
});

registerHandler("result_publish", async (client, approval) => {
  const { examId } = approval.payload;
  const exam = (await client.query(
    "UPDATE exams SET result_status = 'Published', published_at = NOW(), publish_version = publish_version + 1 WHERE id = $1 RETURNING *",
    [examId],
  )).rows[0];
  if (!exam) throw httpError(404, "Exam not found.");
  const results = (await client.query(
    "UPDATE results SET published = TRUE, published_at = NOW() WHERE exam_id = $1 RETURNING student_id, gpa, grade",
    [examId],
  )).rows;
  const settings = (await client.query("SELECT notify_result FROM system_settings WHERE id = 1")).rows[0] || {};
  if (settings.notify_result !== false) {
    const lang = await defaultLanguage();
    for (const r of results) {
      const student = (await client.query("SELECT name FROM students WHERE id = $1", [r.student_id])).rows[0];
      const body = await renderTemplate("result", lang, { exam: exam.name, student: student?.name, gpa: r.gpa, grade: r.grade });
      await notifyStudentGuardians(r.student_id, { eventType: "Result", body, subject: `${exam.name} result`, channels: ["SMS", "Portal"], relatedType: "exams", relatedId: examId });
    }
  }
  return { published: results.length };
});

async function applyMarkChange(client, req, payload, reason) {
  const { examId, studentId, subjectId, marksObtained, componentMarks, graceMarks, isAbsent } = payload;
  const exam = (await client.query("SELECT * FROM exams WHERE id = $1", [examId])).rows[0];
  if (!exam) throw httpError(404, "Exam not found.");
  const existing = (await client.query("SELECT * FROM marks WHERE exam = $1 AND student_id = $2 AND subject_id = $3", [exam.name, studentId, subjectId])).rows[0];
  if (!existing) throw httpError(404, "Marks record not found.");
  await client.query(
    `UPDATE marks SET marks_obtained = COALESCE($1, marks_obtained), component_marks = COALESCE($2, component_marks),
       grace_marks = COALESCE($3, grace_marks), is_absent = COALESCE($4, is_absent) WHERE id = $5`,
    [marksObtained ?? null, componentMarks ? JSON.stringify(componentMarks) : null, graceMarks ?? null, isAbsent ?? null, existing.id],
  );
  return exam;
}

async function reprocessAfterCorrection(client, exam, studentId, reason, req) {
  // Recalculate inside a fresh transaction after commit, keeping version history.
  setImmediate(async () => {
    try {
      const { processExamResults } = require("./grading");
      await processExamResults(exam.id, { allowPublished: true, reason, userId: req.user.id });
      if (exam.result_status === "Published") {
        await notifyStudentGuardians(studentId, {
          eventType: "ResultCorrection", subject: `${exam.name} result revised`,
          body: `${exam.name}: the result has been revised after review. Please check the portal.`,
          channels: ["SMS", "Portal"], relatedType: "exams", relatedId: exam.id,
        });
      }
    } catch (error) {
      console.error("Result reprocess failed:", error.message);
    }
  });
}

registerHandler("result_correction", async (client, approval, req) => {
  const exam = await applyMarkChange(client, req, approval.payload, approval.payload.reason);
  await reprocessAfterCorrection(client, exam, approval.payload.studentId, approval.payload.reason, req);
  return { corrected: true };
});

registerHandler("grace_marks", async (client, approval, req) => {
  const exam = await applyMarkChange(client, req, approval.payload, approval.payload.reason);
  await reprocessAfterCorrection(client, exam, approval.payload.studentId, approval.payload.reason || "Grace marks", req);
  return { graceApplied: true };
});

registerHandler("attendance_correction", async (client, approval, req) => {
  const { studentId, date, newStatus, className } = approval.payload;
  await client.query(
    `INSERT INTO attendance (student_id, class_name, attendance_date, status, note, marked_by, source)
     VALUES ($1, $2, $3, $4, $5, $6, 'Correction')
     ON CONFLICT (student_id, attendance_date) DO UPDATE SET status = EXCLUDED.status, note = EXCLUDED.note, marked_by = EXCLUDED.marked_by, source = 'Correction'`,
    [studentId, className || "", date, newStatus, `Corrected: ${approval.payload.reason || ""}`, req.user.id],
  );
  return { corrected: true };
});

registerHandler("bulk_sms", async (client, approval) => {
  const result = await dispatchNotice(approval.payload.noticeId, client);
  return result;
});

registerHandler("admission_confirm", async (client, approval, req) => {
  const result = await confirmAdmission(client, req, approval.payload.admissionId, approval.payload);
  return { studentId: result.student.id };
});

registerHandler("duplicate_override", async (client, approval) => {
  await client.query("UPDATE admissions SET override_reason = $1 WHERE id = $2", [approval.payload.reason || approval.title, approval.payload.admissionId]);
  return { overridden: true };
});

registerHandler("certificate_issue", async (client, approval, req) => {
  const cert = (await client.query(
    "UPDATE certificates SET status = 'Issued', issued_at = NOW(), approved_by = $1 WHERE id = $2 RETURNING *",
    [req.user.name, approval.payload.certificateId],
  )).rows[0];
  if (cert?.certificate_type === "Transfer Certificate" && cert.holder_type === "Student") {
    await changeStatus(client, req, cert.holder_id, "Transferred", "Transfer certificate issued");
  }
  return { certificateId: cert?.id };
});

registerHandler("id_card_print", async (client, approval) => {
  await client.query("UPDATE id_card_print_jobs SET status = 'Queued', error = NULL WHERE id = $1", [approval.payload.jobId]);
  return { jobId: approval.payload.jobId };
});

registerHandler("leave", async (client, approval, req) => {
  const leave = (await client.query(
    "UPDATE leave_requests SET status = 'Approved', decided_by = $1, decided_at = NOW() WHERE id = $2 RETURNING *",
    [req.user.name, approval.payload.leaveId],
  )).rows[0];
  if (leave?.applicant_type === "Student") {
    const student = (await client.query("SELECT class_name FROM students WHERE id = $1", [leave.applicant_id])).rows[0];
    await client.query(
      `INSERT INTO attendance (student_id, class_name, attendance_date, status, note, source)
       SELECT $1, $2, d::date, 'Leave', $3, 'Leave' FROM generate_series($4::date, $5::date, '1 day') d
       ON CONFLICT (student_id, attendance_date) DO UPDATE SET status = 'Leave', note = EXCLUDED.note`,
      [leave.applicant_id, student?.class_name || "", `Leave ${leave.id}`, leave.from_date, leave.to_date],
    );
  } else if (leave) {
    await client.query(
      `INSERT INTO staff_attendance (employee_type, employee_id, employee_name, attendance_date, status, note, source)
       SELECT $1, $2, $3, d::date, 'Leave', $4, 'Leave' FROM generate_series($5::date, $6::date, '1 day') d
       ON CONFLICT (employee_type, employee_id, attendance_date) DO UPDATE SET status = 'Leave', note = EXCLUDED.note`,
      [leave.applicant_type, leave.applicant_id, leave.applicant_name, `Leave ${leave.id}`, leave.from_date, leave.to_date],
    );
  }
  return { leaveId: leave?.id };
});

registerHandler("student_promotion", async (client, approval, req) => {
  const { promotions = [], targetYearId } = approval.payload;
  let promoted = 0;
  for (const p of promotions) {
    const student = (await client.query("SELECT * FROM students WHERE id = $1 FOR UPDATE", [p.studentId])).rows[0];
    if (!student) continue;
    await client.query(
      "UPDATE enrollments SET status = $1, result_summary = $2 WHERE student_id = $3 AND status = 'Active'",
      [p.decision === "Detain" ? "Detained" : p.decision === "Pass Out" ? "Passed Out" : "Promoted", JSON.stringify(p.result || {}), p.studentId],
    );
    if (p.decision === "Pass Out") {
      await changeStatus(client, req, p.studentId, "Passed Out", "Completed final class");
      continue;
    }
    const targetClass = p.decision === "Detain"
      ? { id: student.class_id, name: String(student.class_name || "").split("-")[0] }
      : (await client.query("SELECT id, name FROM classes WHERE id = $1", [p.nextClassId])).rows[0];
    const section = p.section || student.section;
    const className = targetClass ? `${targetClass.name}${section ? `-${section}` : ""}` : student.class_name;
    await client.query(
      "UPDATE students SET class_id = $1, class_name = $2, section = $3, roll = $4, academic_year_id = COALESCE($5, academic_year_id) WHERE id = $6",
      [targetClass?.id || student.class_id, className, section, p.roll || null, targetYearId || null, p.studentId],
    );
    await upsertEnrollment(client, { ...student, class_id: targetClass?.id || student.class_id, class_name: className, section, roll: p.roll || null },
      { academicYearId: targetYearId, classId: targetClass?.id, className, section, roll: p.roll || null });
    promoted += 1;
  }
  return { promoted };
});

registerHandler("payroll", async (client, approval) => {
  const { month } = approval.payload;
  await client.query("UPDATE payroll_records SET details = details || '{\"approved\": true}'::jsonb WHERE payroll_month = $1", [month]);
  return { month };
});

registerHandler("lillah_boarding", async (client, approval) => {
  const { allocationId } = approval.payload;
  await client.query("UPDATE hostel_allocations SET status = 'Active', is_lillah = TRUE WHERE id = $1", [allocationId]);
  return { allocationId };
});

// ------------------------------------------------------------ reject hooks
registerRejectHandler("leave", async (client, approval, req, note) => {
  await client.query(
    "UPDATE leave_requests SET status = 'Rejected', decided_by = $1, decided_at = NOW(), decision_note = $2 WHERE id = $3",
    [req.user.name, note, approval.payload.leaveId],
  );
  return { rejected: true };
});
registerRejectHandler("fee_waiver", async (client, approval) => {
  await client.query("UPDATE fee_discounts SET status = 'Rejected' WHERE id = $1", [approval.payload.discountId]);
  return { rejected: true };
});
registerRejectHandler("refund", async (client, approval) => {
  await client.query("UPDATE refunds SET status = 'Rejected' WHERE id = $1", [approval.payload.refundId]);
  return { rejected: true };
});
registerRejectHandler("expense", async (client, approval) => {
  await client.query("UPDATE financial_transactions SET approval_status = 'Rejected', status = 'Rejected' WHERE id = $1", [approval.payload.transactionId]);
  return { rejected: true };
});
registerRejectHandler("marks_unlock", async (client, approval) => {
  const { examId, classId, subjectId } = approval.payload;
  await client.query("UPDATE marks_entry_status SET status = 'Locked' WHERE exam_id = $1 AND class_id = $2 AND subject_id = $3", [examId, classId, subjectId]);
  return { rejected: true };
});
registerRejectHandler("certificate_issue", async (client, approval) => {
  await client.query("UPDATE certificates SET status = 'Rejected' WHERE id = $1", [approval.payload.certificateId]);
  return { rejected: true };
});
registerRejectHandler("bulk_sms", async (client, approval) => {
  await client.query("UPDATE notices SET approval_status = 'Rejected', status = 'Draft' WHERE id = $1", [approval.payload.noticeId]);
  return { rejected: true };
});
registerRejectHandler("id_card_print", async (client, approval, req, note) => {
  await client.query("UPDATE id_card_print_jobs SET status = 'Failed', error = $1 WHERE id = $2", [`Rejected: ${note}`, approval.payload.jobId]);
  return { rejected: true };
});
registerRejectHandler("result_publish", async (client, approval) => {
  await client.query("UPDATE exams SET result_status = 'Reviewed' WHERE id = $1", [approval.payload.examId]);
  return { rejected: true };
});

module.exports = {};

// Maker–Checker approval engine (SRS §26 APR-01..08, v1 RP-14..19).
// A maker submits a request; a different authorised user (checker) approves,
// rejects (reason mandatory) or asks for clarification. On approval the
// registered handler applies the change inside the same DB transaction.
const { query, transaction } = require("../db/pool");
const httpError = require("../utils/httpError");
const { writeAudit } = require("./audit");
const { queueMessage } = require("./notifications");

// request_type -> { module: permission module whose 'approve' right is needed, label }
const REQUEST_TYPES = {
  fee_waiver: { module: "fees", label: "Fee waiver / discount" },
  receipt_cancel: { module: "fees", label: "Receipt cancellation" },
  refund: { module: "fees", label: "Refund" },
  expense: { module: "accounts", label: "Expense approval" },
  marks_unlock: { module: "marks", label: "Marks unlock" },
  result_publish: { module: "results", label: "Result publication" },
  result_correction: { module: "results", label: "Published result correction" },
  grace_marks: { module: "results", label: "Grace marks" },
  attendance_correction: { module: "attendance", label: "Attendance correction" },
  bulk_sms: { module: "communication", label: "Bulk SMS / notice" },
  admission_confirm: { module: "admission", label: "Admission confirmation" },
  certificate_issue: { module: "certificates", label: "Certificate / TC issue" },
  id_card_print: { module: "idcards", label: "ID card print" },
  leave: { module: "leave", label: "Leave request" },
  student_promotion: { module: "students", label: "Student promotion / transfer" },
  payroll: { module: "payroll", label: "Payroll approval" },
  duplicate_override: { module: "admission", label: "Duplicate admission override" },
  lillah_boarding: { module: "hostel", label: "Lillah boarding admission" },
};

const handlers = {};
const rejectHandlers = {};
function registerHandler(type, fn) {
  handlers[type] = fn;
}
function registerRejectHandler(type, fn) {
  rejectHandlers[type] = fn;
}

// Multi-level / amount-based chain (RP-15, RP-16, APR-03). The rule with the highest
// min_amount that the request amount reaches wins; no rule = single level.
async function resolveChain(run, type, amount) {
  const rules = (await run(
    "SELECT * FROM approval_rules WHERE request_type = $1 AND status = 'Active' AND min_amount <= $2 ORDER BY min_amount DESC LIMIT 1",
    [type, Number(amount || 0)],
  )).rows;
  const levels = Array.isArray(rules[0]?.levels) ? rules[0].levels.filter((l) => l && (l.module || l.role || l.label)) : [];
  return levels.length ? levels : [{ label: "Approver", module: REQUEST_TYPES[type].module }];
}

function levelPermitted(req, level, fallbackModule) {
  const { hasPermission } = require("../middleware/auth");
  if (req.user.isAdmin) return true;
  if (level?.role) return (req.user.roles || []).some((r) => r.toLowerCase() === String(level.role).toLowerCase());
  const module = level?.module || fallbackModule;
  return hasPermission(req.user, module, "approve") || hasPermission(req.user, "approvals", "approve");
}

async function createApproval(req, { type, title, referenceTable, referenceId, payload = {}, amount = null, urgency = "Normal" }, executor) {
  if (!REQUEST_TYPES[type]) throw httpError(422, `Unknown approval type: ${type}`);
  const run = executor ? executor.query.bind(executor) : query;

  // Prevent duplicate pending requests for the same record and type.
  if (referenceId) {
    const dup = await run(
      "SELECT id FROM approval_requests WHERE request_type = $1 AND reference_id = $2 AND status IN ('Pending', 'Clarification')",
      [type, String(referenceId)],
    );
    if (dup.rowCount) throw httpError(409, `A pending ${REQUEST_TYPES[type].label} request already exists (${dup.rows[0].id}).`);
  }

  const history = [{ at: new Date().toISOString(), by: req?.user?.name || "System", action: "Submitted" }];
  const chain = await resolveChain(run, type, amount);
  const result = await run(
    `INSERT INTO approval_requests (request_type, title, reference_table, reference_id, payload, amount, urgency,
       maker_id, maker_name, required_role, history, level, total_levels, level_chain)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,1,$12,$13) RETURNING *`,
    [
      type, title, referenceTable || null, referenceId ? String(referenceId) : null,
      JSON.stringify(payload), amount, urgency, req?.user?.id || null, req?.user?.name || "System",
      chain[0].role || chain[0].module || REQUEST_TYPES[type].module, JSON.stringify(history), chain.length, JSON.stringify(chain),
    ],
  );
  const approval = result.rows[0];
  await writeAudit(req, { entity: "approval_requests", entityId: approval.id, action: "SUBMIT", newValue: approval }, executor);
  await queueMessage({
    channel: "Portal",
    eventType: "ApprovalPending",
    recipientType: "Role",
    recipientId: REQUEST_TYPES[type].module,
    subject: "Approval required",
    body: `${REQUEST_TYPES[type].label}: ${title} (by ${req?.user?.name || "System"})`,
    relatedType: "approval_requests",
    relatedId: approval.id,
  }, executor);
  return approval;
}

async function isDelegateFor(userId, type) {
  const result = await query(
    `SELECT 1 FROM approval_delegations
     WHERE to_user_id = $1 AND status = 'Active' AND CURRENT_DATE BETWEEN start_date AND end_date
       AND (request_types = '[]'::jsonb OR request_types ? $2) LIMIT 1`,
    [userId, type],
  );
  return result.rowCount > 0;
}

/** Super Admins may decide their own requests; others only when the self-approval exception is on. */
function canSelfDecide(req, settings) {
  return Boolean(req.user?.isAdmin || settings?.allow_self_approval);
}

// The record behind a leave approval mirrors its lifecycle, so the guardian app (which reads
// leave_requests) sees withdrawals immediately.
async function syncLeaveRecord(run, approval, status, note) {
  if (approval.request_type !== "leave" || !approval.payload?.leaveId) return;
  await run(
    "UPDATE leave_requests SET status = $1, decision_note = COALESCE($2, decision_note), updated_at = NOW() WHERE id = $3 AND status = 'Pending'",
    [status, note || null, approval.payload.leaveId],
  );
}

/** Withdraw a pending request (the maker, or a Super Admin for any request). Audit-logged. */
async function cancelApproval(req, id, note) {
  return transaction(async (client) => {
    const row = (await client.query("SELECT * FROM approval_requests WHERE id = $1 FOR UPDATE", [id])).rows[0];
    if (!row) throw httpError(404, "Request not found.");
    if (row.maker_id !== req.user.id && !req.user.isAdmin) throw httpError(403, "Only the maker or a Super Admin can withdraw this request.");
    if (!["Pending", "Clarification"].includes(row.status)) throw httpError(409, `This request is already ${row.status}.`);
    const history = [...(row.history || []), { at: new Date().toISOString(), by: req.user.name, byId: req.user.id, action: "Withdrawn", note: note || null }];
    const updated = (await client.query(
      `UPDATE approval_requests SET status = 'Cancelled', decided_at = NOW(), checker_id = $1, checker_name = $2,
         decision_note = COALESCE($3, decision_note), history = $4 WHERE id = $5 RETURNING *`,
      [req.user.id, req.user.name, note || null, JSON.stringify(history), id],
    )).rows[0];
    await syncLeaveRecord(client.query.bind(client), row, "Cancelled", note || "Withdrawn");
    await writeAudit(req, { entity: "approval_requests", entityId: id, action: "WITHDRAW", oldValue: { status: row.status }, newValue: { status: "Cancelled" }, reason: note || null }, client);
    if (row.maker_id && row.maker_id !== req.user.id) {
      await queueMessage({
        channel: "Portal", eventType: "ApprovalDecision", recipientType: "User", recipientId: row.maker_id,
        subject: "Request withdrawn", body: `${row.title}: withdrawn by ${req.user.name}${note ? ` – ${note}` : ""}`,
        relatedType: "approval_requests", relatedId: id,
      }, client);
    }
    return updated;
  });
}

/** The maker answers a clarification request; the request goes back to Pending. Audit-logged. */
async function resubmitApproval(req, id, note, payload = {}) {
  if (!String(note || "").trim()) throw httpError(422, "Please write a response.");
  return transaction(async (client) => {
    const row = (await client.query("SELECT * FROM approval_requests WHERE id = $1 FOR UPDATE", [id])).rows[0];
    if (!row) throw httpError(404, "Request not found.");
    if (row.maker_id !== req.user.id) throw httpError(403, "Only the maker can resubmit.");
    if (row.status !== "Clarification") throw httpError(409, "Only requests awaiting clarification can be resubmitted.");
    const history = [...(row.history || []), { at: new Date().toISOString(), by: req.user.name, byId: req.user.id, action: "Resubmitted", note }];
    const updated = (await client.query(
      "UPDATE approval_requests SET status = 'Pending', payload = payload || $1::jsonb, history = $2 WHERE id = $3 RETURNING *",
      [JSON.stringify(payload || {}), JSON.stringify(history), id],
    )).rows[0];
    await writeAudit(req, { entity: "approval_requests", entityId: id, action: "RESUBMIT", oldValue: { status: row.status }, newValue: { status: "Pending" }, reason: note }, client);
    const meta = REQUEST_TYPES[row.request_type] || {};
    await queueMessage({
      channel: "Portal", eventType: "ApprovalPending", recipientType: "Role", recipientId: row.required_role || meta.module,
      subject: "Clarification received", body: `${meta.label || row.request_type}: ${row.title} – ${note}`,
      relatedType: "approval_requests", relatedId: id,
    }, client);
    return updated;
  });
}

async function decide(req, id, decision, note) {
  if (!["Approved", "Rejected", "Clarification"].includes(decision)) {
    throw httpError(422, "Decision must be Approved, Rejected or Clarification.");
  }
  if ((decision === "Rejected" || decision === "Clarification") && !String(note || "").trim()) {
    throw httpError(422, "A reason is mandatory when rejecting or asking for clarification.");
  }

  const settings = (await query("SELECT allow_self_approval FROM system_settings WHERE id = 1")).rows[0] || {};

  return transaction(async (client) => {
    const result = await client.query("SELECT * FROM approval_requests WHERE id = $1 FOR UPDATE", [id]);
    if (!result.rowCount) throw httpError(404, "Approval request not found.");
    const approval = result.rows[0];
    if (!["Pending", "Clarification"].includes(approval.status)) {
      throw httpError(409, `This request is already ${approval.status}.`);
    }

    const meta = REQUEST_TYPES[approval.request_type] || {};
    const chain = Array.isArray(approval.level_chain) && approval.level_chain.length ? approval.level_chain : [{ module: meta.module }];
    const currentLevel = chain[Math.min(chain.length, Number(approval.level || 1)) - 1];
    const allowed = levelPermitted(req, currentLevel, meta.module) || (await isDelegateFor(req.user.id, approval.request_type));
    // The same person may not sign two levels of one request.
    if ((approval.history || []).some((h) => h.action === "Approved (level)" && h.byId === req.user.id) && !req.user.isAdmin) {
      throw httpError(403, "You already approved an earlier level of this request.");
    }
    if (!allowed) throw httpError(403, "You are not an authorised approver for this request.");
    // Maker–checker: a maker may not decide their own request, except a Super Admin (who can override
    // any request) or when the institution has switched on the self-approval exception. Such
    // decisions are flagged in the history and the audit log.
    const selfDecision = Boolean(approval.maker_id && approval.maker_id === req.user.id);
    if (selfDecision && !canSelfDecide(req, settings)) {
      throw httpError(403, "Maker cannot approve their own request (maker–checker policy).");
    }

    // Intermediate level approved: move to the next level, handler runs only at the final level.
    if (decision === "Approved" && Number(approval.level || 1) < Number(approval.total_levels || 1)) {
      const nextLevel = Number(approval.level) + 1;
      const next = chain[nextLevel - 1] || {};
      const history = [...(approval.history || []), {
        at: new Date().toISOString(), by: req.user.name, byId: req.user.id, action: "Approved (level)",
        level: approval.level, levelLabel: currentLevel?.label || null, note: note || null, ...(selfDecision ? { selfDecision: true } : {}),
      }];
      const updated = await client.query(
        `UPDATE approval_requests SET level = $1, status = 'Pending', required_role = $2, history = $3, last_reminded_at = NULL
         WHERE id = $4 RETURNING *`,
        [nextLevel, next.role || next.module || meta.module, JSON.stringify(history), id],
      );
      await writeAudit(req, { entity: "approval_requests", entityId: id, action: "APPROVE_LEVEL", newValue: { level: approval.level, next: nextLevel, selfDecision }, reason: note }, client);
      await queueMessage({
        channel: "Portal", eventType: "ApprovalPending", recipientType: "Role", recipientId: next.role || next.module || meta.module,
        subject: "Approval required (next level)", body: `${meta.label}: ${approval.title} – level ${nextLevel}/${approval.total_levels} (${next.label || ""})`,
        relatedType: "approval_requests", relatedId: id,
      }, client);
      return { approval: updated.rows[0], outcome: { advancedTo: nextLevel } };
    }

    let outcome = null;
    if (decision === "Approved") {
      const handler = handlers[approval.request_type];
      if (handler) outcome = await handler(client, approval, req);
    } else if (decision === "Rejected") {
      const handler = rejectHandlers[approval.request_type];
      if (handler) outcome = await handler(client, approval, req, note);
    }

    const history = [...(approval.history || []), {
      at: new Date().toISOString(), by: req.user.name, byId: req.user.id, action: decision, note: note || null,
      ...(selfDecision ? { selfDecision: true } : {}),
    }];
    const updated = await client.query(
      `UPDATE approval_requests SET status = $1, checker_id = $2, checker_name = $3, decision_note = $4,
         reason = COALESCE($4, reason), decided_at = CASE WHEN $1 = 'Clarification' THEN NULL ELSE NOW() END,
         history = $5
       WHERE id = $6 RETURNING *`,
      [decision, req.user.id, req.user.name, note || null, JSON.stringify(history), id],
    );
    await writeAudit(req, {
      entity: "approval_requests", entityId: id, action: decision.toUpperCase(),
      oldValue: { status: approval.status }, newValue: { status: decision, outcome, selfDecision }, reason: note,
    }, client);

    if (approval.maker_id) {
      await queueMessage({
        channel: "Portal", eventType: "ApprovalDecision", recipientType: "User", recipientId: approval.maker_id,
        subject: `Request ${decision}`, body: `${approval.title}: ${decision}${note ? ` – ${note}` : ""}`,
        relatedType: "approval_requests", relatedId: id,
      }, client);
    }
    return { approval: updated.rows[0], outcome };
  });
}

module.exports = {
  REQUEST_TYPES, registerHandler, registerRejectHandler, createApproval, decide, resolveChain,
  cancelApproval, resubmitApproval, canSelfDecide,
};

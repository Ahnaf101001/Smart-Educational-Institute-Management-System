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
    if (approval.maker_id && approval.maker_id === req.user.id && !settings.allow_self_approval) {
      throw httpError(403, "Maker cannot approve their own request (maker–checker policy).");
    }

    // Intermediate level approved: move to the next level, handler runs only at the final level.
    if (decision === "Approved" && Number(approval.level || 1) < Number(approval.total_levels || 1)) {
      const nextLevel = Number(approval.level) + 1;
      const next = chain[nextLevel - 1] || {};
      const history = [...(approval.history || []), {
        at: new Date().toISOString(), by: req.user.name, byId: req.user.id, action: "Approved (level)",
        level: approval.level, levelLabel: currentLevel?.label || null, note: note || null,
      }];
      const updated = await client.query(
        `UPDATE approval_requests SET level = $1, status = 'Pending', required_role = $2, history = $3, last_reminded_at = NULL
         WHERE id = $4 RETURNING *`,
        [nextLevel, next.role || next.module || meta.module, JSON.stringify(history), id],
      );
      await writeAudit(req, { entity: "approval_requests", entityId: id, action: "APPROVE_LEVEL", newValue: { level: approval.level, next: nextLevel }, reason: note }, client);
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
      at: new Date().toISOString(), by: req.user.name, action: decision, note: note || null,
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
      oldValue: { status: approval.status }, newValue: { status: decision, outcome }, reason: note,
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

module.exports = { REQUEST_TYPES, registerHandler, registerRejectHandler, createApproval, decide, resolveChain };

import '../core/format.dart';

class FeeInvoice {
  FeeInvoice({
    required this.id,
    required this.feeHead,
    required this.amount,
    required this.discount,
    required this.lateFine,
    required this.paidAmount,
    required this.due,
    required this.status,
    this.billingMonth,
    this.dueDate,
  });

  final String id;
  final String feeHead;
  final num amount;
  final num discount;
  final num lateFine;
  final num paidAmount;
  final num due;
  final String status;
  final DateTime? billingMonth;
  final DateTime? dueDate;

  bool get isOpen => due > 0;
  bool get isOverdue {
    if (!isOpen || dueDate == null) return false;
    final now = DateTime.now();
    return dueDate!.isBefore(DateTime(now.year, now.month, now.day));
  }

  /// Fee categories from the specification (Monthly Tuition, Admission, Examination, Transport, Other).
  String get category {
    final h = feeHead.toLowerCase();
    if (h.contains('tuition') ||
        h.contains('monthly') ||
        h.contains('salary') ||
        h.contains('বেতন')) {
      return 'Monthly Tuition';
    }
    if (h.contains('admission') ||
        h.contains('readmission') ||
        h.contains('session')) {
      return 'Admission';
    }
    if (h.contains('exam') || h.contains('test')) return 'Examination';
    if (h.contains('transport') || h.contains('bus')) return 'Transport';
    return 'Other';
  }

  factory FeeInvoice.fromJson(Map<String, dynamic> j) => FeeInvoice(
    id: J.str(j['id']),
    feeHead: J.str(j['feeHead'], 'Fee'),
    amount: J.numOf(j['amount']),
    discount: J.numOf(j['discount']),
    lateFine: J.numOf(j['lateFine']),
    paidAmount: J.numOf(j['paidAmount']),
    due: J.numOf(j['due']),
    status: J.str(j['status'], 'Due'),
    billingMonth: J.date(j['billingMonth']),
    dueDate: J.date(j['dueDate']),
  );
}

class FeePayment {
  FeePayment({
    required this.id,
    required this.amount,
    required this.status,
    this.receiptNo,
    this.method,
    this.paidAt,
    this.feeHead,
    this.billingMonth,
  });

  final String id;
  final String? receiptNo;
  final num amount;
  final String? method;
  final DateTime? paidAt;
  final String status;
  final String? feeHead;
  final DateTime? billingMonth;

  bool get isValid => status == 'Valid';

  factory FeePayment.fromJson(Map<String, dynamic> j) => FeePayment(
    id: J.str(j['id']),
    receiptNo: J.strOrNull(j['receiptNo']),
    amount: J.numOf(j['amount']),
    method: J.strOrNull(j['paymentMethod']),
    paidAt: J.date(j['paidAt']),
    status: J.str(j['status'], 'Valid'),
    feeHead: J.strOrNull(j['feeHead']),
    billingMonth: J.date(j['billingMonth']),
  );
}

class FeeDiscount {
  FeeDiscount({
    required this.type,
    required this.mode,
    required this.value,
    this.reason,
    this.feeHead,
    this.validFrom,
    this.validTo,
  });

  final String type;
  final String mode;
  final num value;
  final String? reason;
  final String? feeHead;
  final DateTime? validFrom;
  final DateTime? validTo;

  String get valueLabel => mode.toLowerCase().startsWith('percent')
      ? '${value.toStringAsFixed(value % 1 == 0 ? 0 : 1)}%'
      : Fmt.money(value);

  factory FeeDiscount.fromJson(Map<String, dynamic> j) => FeeDiscount(
    type: J.str(j['discountType'], 'Discount'),
    mode: J.str(j['mode'], 'Percent'),
    value: J.numOf(j['value']),
    reason: J.strOrNull(j['reason']),
    feeHead: J.strOrNull(j['feeHead']),
    validFrom: J.date(j['validFrom']),
    validTo: J.date(j['validTo']),
  );
}

/// `/portal/guardian/students/:id/fees` – one student's fees only.
class FeeOverview {
  FeeOverview({
    required this.invoices,
    required this.payments,
    required this.discounts,
    required this.gateways,
    required this.totalPayable,
    required this.previousDue,
    required this.currentMonthDue,
    required this.totalPaid,
    this.hidden = false,
    this.message,
  });

  final List<FeeInvoice> invoices;
  final List<FeePayment> payments;
  final List<FeeDiscount> discounts;
  final List<String> gateways;
  final num totalPayable;
  final num previousDue;
  final num currentMonthDue;
  final num totalPaid;
  final bool hidden;
  final String? message;

  List<FeeInvoice> get openInvoices => invoices.where((i) => i.isOpen).toList();

  factory FeeOverview.fromJson(Map<String, dynamic> j, {String? message}) {
    final s = J.map(j['summary']);
    final g = J.map(j['gateways']);
    return FeeOverview(
      invoices: J.list(j['invoices']).map(FeeInvoice.fromJson).toList(),
      payments: J.list(j['payments']).map(FeePayment.fromJson).toList(),
      discounts: J.list(j['discounts']).map(FeeDiscount.fromJson).toList(),
      gateways: g.entries
          .where((e) => J.boolOf(e.value))
          .map((e) => e.key)
          .toList(),
      totalPayable: J.numOf(s['totalPayable']),
      previousDue: J.numOf(s['previousDue']),
      currentMonthDue: J.numOf(s['currentMonthDue']),
      totalPaid: J.numOf(s['totalPaid']),
      hidden: J.boolOf(j['hidden']),
      message: message,
    );
  }
}

class ReceiptLine {
  ReceiptLine({
    required this.feeHead,
    required this.amount,
    required this.status,
    this.billingMonth,
    this.receiptNo,
  });

  final String feeHead;
  final num amount;
  final String status;
  final DateTime? billingMonth;
  final String? receiptNo;

  factory ReceiptLine.fromJson(Map<String, dynamic> j) => ReceiptLine(
    feeHead: J.str(j['feeHead'], 'Fee'),
    amount: J.numOf(j['amount']),
    status: J.str(j['status'], 'Valid'),
    billingMonth: J.date(j['billingMonth']),
    receiptNo: J.strOrNull(j['receiptNo']),
  );
}

/// Digital payment receipt (`/portal/guardian/receipts/:receiptNo`).
class Receipt {
  Receipt({
    required this.receiptNo,
    required this.lines,
    required this.total,
    required this.studentName,
    required this.studentId,
    this.status,
    this.paidAt,
    this.method,
    this.reference,
    this.className,
    this.section,
    this.roll,
    this.schoolName,
    this.schoolAddress,
    this.schoolPhone,
  });

  final String receiptNo;
  final DateTime? paidAt;
  final String? method;
  final String? reference;
  final String? status;
  final List<ReceiptLine> lines;
  final num total;
  final String studentName;
  final String studentId;
  final String? className;
  final String? section;
  final String? roll;
  final String? schoolName;
  final String? schoolAddress;
  final String? schoolPhone;

  factory Receipt.fromJson(Map<String, dynamic> j) {
    final s = J.map(j['student']);
    final i = J.map(j['institute']);
    return Receipt(
      receiptNo: J.str(j['receiptNo']),
      paidAt: J.date(j['paidAt']),
      method: J.strOrNull(j['method']),
      reference: J.strOrNull(j['reference']),
      status: J.strOrNull(j['status']),
      lines: J.list(j['lines']).map(ReceiptLine.fromJson).toList(),
      total: J.numOf(j['total']),
      studentName: J.str(s['name']),
      studentId: J.str(s['id']),
      className: J.strOrNull(s['className']),
      section: J.strOrNull(s['section']),
      roll: J.strOrNull(s['roll']),
      schoolName: J.strOrNull(i['name']),
      schoolAddress: J.strOrNull(i['address']),
      schoolPhone: J.strOrNull(i['phone']),
    );
  }
}

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:material_ui/material_ui.dart';

import '../../l10n/l10n_ext.dart';

import 'package:provider/provider.dart';

import '../../config/app_config.dart';
import '../../core/format.dart';
import '../../core/theme.dart';
import '../../models/child.dart';
import '../../models/fees.dart';
import '../../providers/family_provider.dart';
import '../../services/api_exception.dart';
import '../../services/deep_link_service.dart';
import '../../services/file_service.dart';
import '../../services/guardian_service.dart';
import '../../widgets/async_view.dart';
import '../../widgets/common.dart';
import 'receipt_screen.dart';

/// Fees & payment (spec §G, workflow §7) for ONE student: tuition,
/// admission, exam, transport and other fees, total payable, previous due,
/// payment history, online payment, digital receipts and discounts.
class FeesScreen extends StatefulWidget {
  const FeesScreen({super.key, required this.child});

  final ChildSummary child;

  @override
  State<FeesScreen> createState() => _FeesScreenState();
}

class _FeesScreenState extends State<FeesScreen> {
  int _version = 0;

  @override
  Widget build(BuildContext context) {
    final service = context.read<GuardianService>();
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: Text(
            context.l10n.titleForChild(context.l10n.modFees, widget.child.name),
          ),
          bottom: TabBar(
            tabs: [
              Tab(text: context.l10n.duesAndPay),
              Tab(text: context.l10n.paymentHistory),
            ],
          ),
        ),
        body: AsyncView<FeeOverview>(
          key: ValueKey(_version),
          load: () => service.fees(widget.child.id),
          builder: (context, fees, reload) {
            if (fees.hidden) {
              return Padding(
                padding: const EdgeInsets.all(16),
                child: AccessNotice(
                  message: fees.message ?? context.l10n.feeInfoNotShared,
                ),
              );
            }
            return TabBarView(
              children: [
                _DuesTab(
                  child: widget.child,
                  fees: fees,
                  onRefresh: reload,
                  onPaid: () {
                    setState(() => _version++);
                    context.read<FamilyProvider>().load(silent: true);
                  },
                ),
                _HistoryTab(fees: fees, onRefresh: reload),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _DuesTab extends StatefulWidget {
  const _DuesTab({
    required this.child,
    required this.fees,
    required this.onRefresh,
    required this.onPaid,
  });

  final ChildSummary child;
  final FeeOverview fees;
  final Future<void> Function() onRefresh;
  final VoidCallback onPaid;

  @override
  State<_DuesTab> createState() => _DuesTabState();
}

class _DuesTabState extends State<_DuesTab> {
  late Set<String> _selected = widget.fees.openInvoices
      .map((i) => i.id)
      .toSet();

  @override
  void didUpdateWidget(covariant _DuesTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.fees != widget.fees) {
      _selected = widget.fees.openInvoices.map((i) => i.id).toSet();
    }
  }

  num get _selectedTotal => widget.fees.openInvoices
      .where((i) => _selected.contains(i.id))
      .fold<num>(0, (s, i) => s + i.due);

  Future<void> _pay() async {
    final fees = widget.fees;
    if (_selected.isEmpty) return;
    if (fees.gateways.isEmpty) {
      showSnack(context, context.l10n.onlinePaymentNotEnabled, error: true);
      return;
    }
    final gateway = fees.gateways.length == 1
        ? fees.gateways.first
        : await _pickGateway(fees.gateways);
    if (gateway == null || !mounted) return;
    final service = context.read<GuardianService>();
    final files = context.read<FileService>();
    try {
      final start = await service.startPayment(
        _selected.toList(),
        gateway,
        returnUrl: kIsWeb ? null : DeepLinkService.paymentReturnUrl,
      );
      final url = start.paymentUrl.startsWith('http')
          ? start.paymentUrl
          : '${AppConfig.webAppUrl}${start.paymentUrl}';
      final opened = await files.openUrl(url);
      if (!mounted) return;
      if (!opened) {
        showSnack(context, context.l10n.couldNotOpenPaymentPage, error: true);
        return;
      }
      await _awaitConfirmation(start.transactionId, start.amount);
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message, error: true);
    }
  }

  Future<String?> _pickGateway(List<String> gateways) =>
      showModalBottomSheet<String>(
        context: context,
        showDragHandle: true,
        builder: (ctx) => SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  context.l10n.choosePaymentMethod,
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
              ),
              for (final g in gateways)
                ListTile(
                  leading: const Icon(Icons.account_balance_wallet_outlined),
                  title: Text(context.l10n.word(_gatewayLabel(g))),
                  onTap: () => Navigator.pop(ctx, g),
                ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      );

  static String _gatewayLabel(String g) => switch (g.toLowerCase()) {
    'bkash' => 'bKash',
    'nagad' => 'Nagad',
    'rocket' => 'Rocket',
    'sslcommerz' => 'Card / Mobile banking (SSLCommerz)',
    _ => g,
  };

  /// After the gateway page, verify the transaction on the server before
  /// showing the fee as paid (workflow §7 steps 6–8). Verification starts by itself
  /// when the gateway redirects back to the app (deep link) and is also polled.
  Future<void> _awaitConfirmation(String transactionId, num amount) async {
    final service = context.read<GuardianService>();
    final deepLinks = context.read<DeepLinkService>();
    final paid = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) => _PaymentConfirmDialog(
        service: service,
        deepLinks: deepLinks,
        transactionId: transactionId,
        amount: amount,
      ),
    );
    if (paid == true) {
      widget.onPaid();
      if (mounted) {
        showSnack(context, context.l10n.paymentSuccessful);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final fees = widget.fees;
    final open = fees.openInvoices;
    final categories = <String, num>{};
    for (final i in open) {
      categories[i.category] = (categories[i.category] ?? 0) + i.due;
    }
    return Column(
      children: [
        Expanded(
          child: RefreshIndicator(
            onRefresh: widget.onRefresh,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                StatGrid(
                  children: [
                    StatTile(
                      label: context.l10n.totalPayable,
                      value: Fmt.money(fees.totalPayable),
                      icon: Icons.account_balance_wallet_outlined,
                      color: fees.totalPayable > 0
                          ? AppColors.danger
                          : AppColors.success,
                    ),
                    StatTile(
                      label: context.l10n.previousDue,
                      value: Fmt.money(fees.previousDue),
                      icon: Icons.history_rounded,
                      color: AppColors.warning,
                    ),
                    StatTile(
                      label: context.l10n.thisMonth2,
                      value: Fmt.money(fees.currentMonthDue),
                      icon: Icons.calendar_month_outlined,
                    ),
                    StatTile(
                      label: context.l10n.totalPaid,
                      value: Fmt.money(fees.totalPaid),
                      icon: Icons.verified_outlined,
                      color: AppColors.success,
                    ),
                  ],
                ),
                if (open.any((i) => i.isOverdue)) ...[
                  const SizedBox(height: 12),
                  AccessNotice(
                    icon: Icons.notifications_active_outlined,
                    message: context.l10n.feeReminderSomeFeesAre,
                  ),
                ],
                if (categories.isNotEmpty) ...[
                  SectionTitle(context.l10n.dueByFeeType),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 6,
                      ),
                      child: Column(
                        children: [
                          for (final e in categories.entries)
                            InfoRow(label: e.key, value: Fmt.money(e.value)),
                        ],
                      ),
                    ),
                  ),
                ],
                SectionTitle(context.l10n.unpaidFeesCount('${open.length}')),
                if (open.isEmpty)
                  Card(
                    child: EmptyView(
                      title: context.l10n.allFeesArePaid,
                      subtitle: context.l10n.thankYou,
                      icon: Icons.verified_rounded,
                    ),
                  )
                else
                  Card(
                    child: Column(
                      children: [
                        for (final i in open)
                          CheckboxListTile(
                            value: _selected.contains(i.id),
                            onChanged: (v) => setState(
                              () => v == true
                                  ? _selected.add(i.id)
                                  : _selected.remove(i.id),
                            ),
                            title: Text(
                              i.feeHead,
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            subtitle: Text(
                              [
                                if (i.billingMonth != null)
                                  Fmt.monthLabel(Fmt.month(i.billingMonth!)),
                                if (i.dueDate != null)
                                  context.l10n.dueOn(Fmt.date(i.dueDate)),
                                if (i.lateFine > 0)
                                  context.l10n.lateFine(Fmt.money(i.lateFine)),
                                if (i.discount > 0)
                                  context.l10n.discountAmount(
                                    Fmt.money(i.discount),
                                  ),
                              ].join(' • '),
                            ),
                            secondary: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  Fmt.money(i.due),
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                if (i.isOverdue)
                                  Text(
                                    context.l10n.overdue,
                                    style: const TextStyle(
                                      color: AppColors.danger,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),
                if (fees.discounts.isNotEmpty) ...[
                  SectionTitle(context.l10n.discountScholarship),
                  Card(
                    child: Column(
                      children: [
                        for (final d in fees.discounts)
                          ListTile(
                            leading: const Icon(
                              Icons.card_giftcard_rounded,
                              color: AppColors.success,
                            ),
                            title: Text(
                              '${d.type} – ${d.valueLabel}',
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            subtitle: Text(
                              [
                                d.feeHead ?? context.l10n.allFees,
                                if (d.validTo != null)
                                  'until ${Fmt.date(d.validTo)}',
                                ?d.reason,
                              ].join(' • '),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
        if (open.isNotEmpty)
          SafeArea(
            top: false,
            child: Container(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(top: BorderSide(color: AppColors.border)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          context.l10n.selectedCount('${_selected.length}'),
                          style: const TextStyle(
                            color: AppColors.muted,
                            fontSize: 12,
                          ),
                        ),
                        Text(
                          Fmt.money(_selectedTotal),
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 18,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Flexible(
                    child: FilledButton.icon(
                      onPressed: _selected.isEmpty ? null : _pay,
                      icon: const Icon(Icons.lock_outline),
                      label: Text(
                        context.l10n.payNow2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

/// Waits for payment confirmation: reacts to the `aeroschool://payment-return` deep link,
/// polls the server every few seconds (also covers returning to the app manually) and
/// keeps a manual "Check status" button as fallback. Pops `true` once the payment is posted.
class _PaymentConfirmDialog extends StatefulWidget {
  const _PaymentConfirmDialog({
    required this.service,
    required this.deepLinks,
    required this.transactionId,
    required this.amount,
  });

  final GuardianService service;
  final DeepLinkService deepLinks;
  final String transactionId;
  final num amount;

  @override
  State<_PaymentConfirmDialog> createState() => _PaymentConfirmDialogState();
}

class _PaymentConfirmDialogState extends State<_PaymentConfirmDialog> {
  static const _pollEvery = Duration(seconds: 4);
  static const _pollFor = Duration(minutes: 5);

  Timer? _timer;
  final _started = DateTime.now();
  bool _checking = false;
  String? _status;
  String? _note;

  @override
  void initState() {
    super.initState();
    widget.deepLinks.addListener(_onDeepLink);
    _timer = Timer.periodic(_pollEvery, (_) {
      if (DateTime.now().difference(_started) > _pollFor) {
        _timer?.cancel();
        if (mounted) {
          setState(() => _note = context.l10n.stillWaiting);
        }
        return;
      }
      _check(silent: true);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    widget.deepLinks.removeListener(_onDeepLink);
    super.dispose();
  }

  void _onDeepLink() {
    final link = widget.deepLinks.paymentReturn;
    if (link == null) return;
    final id = link.queryParameters['id'];
    if (id != null && id.isNotEmpty && id != widget.transactionId) {
      return; // another payment
    }
    widget.deepLinks.takePaymentReturn();
    final s = link.queryParameters['status'];
    if (s == 'failed' || s == 'cancelled') {
      setState(
        () => _note = s == 'failed'
            ? context.l10n.gatewayFailed
            : context.l10n.paymentCancelled,
      );
    }
    _check();
  }

  Future<void> _check({bool silent = false}) async {
    if (_checking) return;
    if (!silent) setState(() => _checking = true);
    _checking = true;
    try {
      final s = await widget.service.paymentStatus(widget.transactionId);
      if (!mounted) return;
      setState(() => _status = s.status);
      if (s.status == 'Success' && s.posted) {
        _timer?.cancel();
        Navigator.pop(context, true);
      } else if (s.status == 'Failed' || s.status == 'Cancelled') {
        _timer?.cancel();
      }
    } on ApiException catch (e) {
      if (mounted && !silent) setState(() => _status = e.message);
    } finally {
      _checking = false;
      if (mounted && !silent) setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(context.l10n.completeYourPayment),
    content: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(context.l10n.amountLabel(Fmt.money(widget.amount))),
        const SizedBox(height: 8),
        Text(context.l10n.finishThePaymentOnThe),
        const SizedBox(height: 12),
        Row(
          children: [
            if (_status == null || _status == 'Pending') ...[
              const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
              const SizedBox(width: 8),
              Flexible(child: Text(context.l10n.waitingForConfirmation)),
            ] else ...[
              Text(context.l10n.status),
              Flexible(child: StatusChip(_status!)),
            ],
          ],
        ),
        if (_note != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              _note!,
              style: const TextStyle(color: AppColors.muted, fontSize: 13),
            ),
          ),
      ],
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context, false),
        child: Text(context.l10n.close),
      ),
      FilledButton(
        onPressed: _checking ? null : () => _check(),
        child: Text(
          _checking ? context.l10n.checking : context.l10n.checkStatus,
        ),
      ),
    ],
  );
}

class _HistoryTab extends StatelessWidget {
  const _HistoryTab({required this.fees, required this.onRefresh});

  final FeeOverview fees;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final paid = fees.invoices.where((i) => !i.isOpen).toList();
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          SectionTitle(context.l10n.paymentsReceipts),
          Card(
            child: fees.payments.isEmpty
                ? EmptyView(
                    title: context.l10n.noPaymentsYet,
                    icon: Icons.receipt_long_outlined,
                  )
                : Column(
                    children: [
                      for (final p in fees.payments)
                        ListTile(
                          leading: const Icon(
                            Icons.receipt_long_rounded,
                            color: AppColors.navy,
                          ),
                          title: Text(
                            Fmt.money(p.amount),
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                          subtitle: Text(
                            [
                              p.feeHead,
                              p.method,
                              Fmt.date(p.paidAt),
                            ].whereType<String>().join(' • '),
                          ),
                          trailing: p.receiptNo == null
                              ? StatusChip(p.status)
                              : Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    if (!p.isValid) StatusChip(p.status),
                                    const Icon(Icons.chevron_right),
                                  ],
                                ),
                          onTap: p.receiptNo == null
                              ? null
                              : () => Navigator.push(
                                  context,
                                  MaterialPageRoute<void>(
                                    builder: (_) =>
                                        ReceiptScreen(receiptNo: p.receiptNo!),
                                  ),
                                ),
                        ),
                    ],
                  ),
          ),
          if (paid.isNotEmpty) ...[
            SectionTitle(context.l10n.paidFees),
            Card(
              child: Column(
                children: [
                  for (final i in paid)
                    ListTile(
                      title: Text(i.feeHead),
                      subtitle: Text(
                        i.billingMonth == null
                            ? i.category
                            : Fmt.monthLabel(Fmt.month(i.billingMonth!)),
                      ),
                      trailing: Text(
                        Fmt.money(i.amount + i.lateFine - i.discount),
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

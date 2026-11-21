import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../../config/app_config.dart';
import '../../core/format.dart';
import '../../core/theme.dart';
import '../../models/child.dart';
import '../../models/fees.dart';
import '../../providers/family_provider.dart';
import '../../services/api_exception.dart';
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
          title: Text('Fees – ${widget.child.name}'),
          bottom: const TabBar(tabs: [Tab(text: 'Dues & Pay'), Tab(text: 'Payment History')]),
        ),
        body: AsyncView<FeeOverview>(
          key: ValueKey(_version),
          load: () => service.fees(widget.child.id),
          builder: (context, fees, reload) {
            if (fees.hidden) {
              return Padding(
                padding: const EdgeInsets.all(16),
                child: AccessNotice(message: fees.message ?? 'Fee information is not shared with your account.'),
              );
            }
            return TabBarView(children: [
              _DuesTab(child: widget.child, fees: fees, onRefresh: reload, onPaid: () {
                setState(() => _version++);
                context.read<FamilyProvider>().load(silent: true);
              }),
              _HistoryTab(fees: fees, onRefresh: reload),
            ]);
          },
        ),
      ),
    );
  }
}

class _DuesTab extends StatefulWidget {
  const _DuesTab({required this.child, required this.fees, required this.onRefresh, required this.onPaid});

  final ChildSummary child;
  final FeeOverview fees;
  final Future<void> Function() onRefresh;
  final VoidCallback onPaid;

  @override
  State<_DuesTab> createState() => _DuesTabState();
}

class _DuesTabState extends State<_DuesTab> {
  late Set<String> _selected = widget.fees.openInvoices.map((i) => i.id).toSet();

  @override
  void didUpdateWidget(covariant _DuesTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.fees != widget.fees) _selected = widget.fees.openInvoices.map((i) => i.id).toSet();
  }

  num get _selectedTotal => widget.fees.openInvoices.where((i) => _selected.contains(i.id)).fold<num>(0, (s, i) => s + i.due);

  Future<void> _pay() async {
    final fees = widget.fees;
    if (_selected.isEmpty) return;
    if (fees.gateways.isEmpty) {
      showSnack(context, 'Online payment is not enabled by the school yet. Please pay at the school office.', error: true);
      return;
    }
    final gateway = fees.gateways.length == 1 ? fees.gateways.first : await _pickGateway(fees.gateways);
    if (gateway == null || !mounted) return;
    final service = context.read<GuardianService>();
    final files = context.read<FileService>();
    try {
      final start = await service.startPayment(_selected.toList(), gateway);
      final url = start.paymentUrl.startsWith('http') ? start.paymentUrl : '${AppConfig.webAppUrl}${start.paymentUrl}';
      final opened = await files.openUrl(url);
      if (!mounted) return;
      if (!opened) {
        showSnack(context, 'Could not open the payment page.', error: true);
        return;
      }
      await _awaitConfirmation(start.transactionId, start.amount);
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message, error: true);
    }
  }

  Future<String?> _pickGateway(List<String> gateways) => showModalBottomSheet<String>(
        context: context,
        showDragHandle: true,
        builder: (ctx) => SafeArea(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Padding(padding: EdgeInsets.only(bottom: 8), child: Text('Choose payment method', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16))),
            for (final g in gateways)
              ListTile(
                leading: const Icon(Icons.account_balance_wallet_outlined),
                title: Text(_gatewayLabel(g)),
                onTap: () => Navigator.pop(ctx, g),
              ),
            const SizedBox(height: 8),
          ]),
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
  /// showing the fee as paid (workflow §7 steps 6–8).
  Future<void> _awaitConfirmation(String transactionId, num amount) async {
    final service = context.read<GuardianService>();
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        var checking = false;
        String? status;
        return StatefulBuilder(builder: (ctx, setLocal) {
          Future<void> check() async {
            setLocal(() => checking = true);
            try {
              final s = await service.paymentStatus(transactionId);
              setLocal(() => status = s.status);
              if (s.status == 'Success' && s.posted && ctx.mounted) {
                Navigator.pop(ctx);
                widget.onPaid();
                if (mounted) showSnack(context, 'Payment successful. Your receipt is in Payment History.');
              }
            } on ApiException catch (e) {
              setLocal(() => status = e.message);
            } finally {
              setLocal(() => checking = false);
            }
          }

          return AlertDialog(
            title: const Text('Complete your payment'),
            content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Amount: ${Fmt.money(amount)}'),
              const SizedBox(height: 8),
              const Text('Finish the payment on the gateway page, then come back and tap "Check status".'),
              if (status != null) ...[
                const SizedBox(height: 12),
                Row(children: [const Text('Status: '), StatusChip(status!)]),
              ],
            ]),
            actions: [
              TextButton(onPressed: checking ? null : () => Navigator.pop(ctx), child: const Text('Close')),
              FilledButton(onPressed: checking ? null : check, child: Text(checking ? 'Checking…' : 'Check status')),
            ],
          );
        });
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final fees = widget.fees;
    final open = fees.openInvoices;
    final categories = <String, num>{};
    for (final i in open) {
      categories[i.category] = (categories[i.category] ?? 0) + i.due;
    }
    return Column(children: [
      Expanded(
        child: RefreshIndicator(
          onRefresh: widget.onRefresh,
          child: ListView(padding: const EdgeInsets.all(16), children: [
            StatGrid(children: [
              StatTile(label: 'Total Payable', value: Fmt.money(fees.totalPayable), icon: Icons.account_balance_wallet_outlined, color: fees.totalPayable > 0 ? AppColors.danger : AppColors.success),
              StatTile(label: 'Previous Due', value: Fmt.money(fees.previousDue), icon: Icons.history_rounded, color: AppColors.warning),
              StatTile(label: 'This Month', value: Fmt.money(fees.currentMonthDue), icon: Icons.calendar_month_outlined),
              StatTile(label: 'Total Paid', value: Fmt.money(fees.totalPaid), icon: Icons.verified_outlined, color: AppColors.success),
            ]),
            if (open.any((i) => i.isOverdue)) ...[
              const SizedBox(height: 12),
              const AccessNotice(icon: Icons.notifications_active_outlined, message: 'Fee reminder: some fees are past their due date. Please pay to avoid late fines.'),
            ],
            if (categories.isNotEmpty) ...[
              const SectionTitle('Due by Fee Type'),
              Card(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  child: Column(children: [for (final e in categories.entries) InfoRow(label: e.key, value: Fmt.money(e.value))]),
                ),
              ),
            ],
            SectionTitle('Unpaid Fees (${open.length})'),
            if (open.isEmpty)
              const Card(child: EmptyView(title: 'All fees are paid', subtitle: 'Thank you!', icon: Icons.verified_rounded))
            else
              Card(
                child: Column(children: [
                  for (final i in open)
                    CheckboxListTile(
                      value: _selected.contains(i.id),
                      onChanged: (v) => setState(() => v == true ? _selected.add(i.id) : _selected.remove(i.id)),
                      title: Text(i.feeHead, style: const TextStyle(fontWeight: FontWeight.w700)),
                      subtitle: Text([
                        if (i.billingMonth != null) Fmt.monthLabel(Fmt.month(i.billingMonth!)),
                        if (i.dueDate != null) 'Due ${Fmt.date(i.dueDate)}',
                        if (i.lateFine > 0) 'Late fine ${Fmt.money(i.lateFine)}',
                        if (i.discount > 0) 'Discount ${Fmt.money(i.discount)}',
                      ].join(' • ')),
                      secondary: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
                        Text(Fmt.money(i.due), style: const TextStyle(fontWeight: FontWeight.w800)),
                        if (i.isOverdue) const Text('Overdue', style: TextStyle(color: AppColors.danger, fontSize: 11, fontWeight: FontWeight.w700)),
                      ]),
                    ),
                ]),
              ),
            if (fees.discounts.isNotEmpty) ...[
              const SectionTitle('Discount / Scholarship'),
              Card(
                child: Column(children: [
                  for (final d in fees.discounts)
                    ListTile(
                      leading: const Icon(Icons.card_giftcard_rounded, color: AppColors.success),
                      title: Text('${d.type} – ${d.valueLabel}', style: const TextStyle(fontWeight: FontWeight.w700)),
                      subtitle: Text([
                        d.feeHead ?? 'All fees',
                        if (d.validTo != null) 'until ${Fmt.date(d.validTo)}',
                        ?d.reason,
                      ].join(' • ')),
                    ),
                ]),
              ),
            ],
          ]),
        ),
      ),
      if (open.isNotEmpty)
        SafeArea(
          top: false,
          child: Container(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
            decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: AppColors.border))),
            child: Row(children: [
              Expanded(
                child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${_selected.length} selected', style: const TextStyle(color: AppColors.muted, fontSize: 12)),
                  Text(Fmt.money(_selectedTotal), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
                ]),
              ),
              FilledButton.icon(onPressed: _selected.isEmpty ? null : _pay, icon: const Icon(Icons.lock_outline), label: const Text('Pay Now')),
            ]),
          ),
        ),
    ]);
  }
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
      child: ListView(padding: const EdgeInsets.all(16), children: [
        const SectionTitle('Payments & Receipts'),
        Card(
          child: fees.payments.isEmpty
              ? const EmptyView(title: 'No payments yet', icon: Icons.receipt_long_outlined)
              : Column(children: [
                  for (final p in fees.payments)
                    ListTile(
                      leading: const Icon(Icons.receipt_long_rounded, color: AppColors.navy),
                      title: Text(Fmt.money(p.amount), style: const TextStyle(fontWeight: FontWeight.w800)),
                      subtitle: Text([p.feeHead, p.method, Fmt.date(p.paidAt)].whereType<String>().join(' • ')),
                      trailing: p.receiptNo == null
                          ? StatusChip(p.status)
                          : Row(mainAxisSize: MainAxisSize.min, children: [
                              if (!p.isValid) StatusChip(p.status),
                              const Icon(Icons.chevron_right),
                            ]),
                      onTap: p.receiptNo == null
                          ? null
                          : () => Navigator.push(context, MaterialPageRoute<void>(builder: (_) => ReceiptScreen(receiptNo: p.receiptNo!))),
                    ),
                ]),
        ),
        if (paid.isNotEmpty) ...[
          const SectionTitle('Paid Fees'),
          Card(
            child: Column(children: [
              for (final i in paid)
                ListTile(
                  title: Text(i.feeHead),
                  subtitle: Text(i.billingMonth == null ? i.category : Fmt.monthLabel(Fmt.month(i.billingMonth!))),
                  trailing: Text(Fmt.money(i.amount + i.lateFine - i.discount), style: const TextStyle(fontWeight: FontWeight.w700)),
                ),
            ]),
          ),
        ],
      ]),
    );
  }
}

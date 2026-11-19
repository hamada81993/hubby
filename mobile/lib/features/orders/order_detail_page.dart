import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../core/format.dart';
import '../../core/network/api_client.dart';
import '../../core/platforms.dart';
import '../../core/theme/app_palette.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/strings.dart';
import '../../shared/widgets/app_widgets.dart';
import '../../shared/widgets/async_builder.dart';
import '../../shared/widgets/money_text.dart';
import '../../shared/widgets/platform_logo.dart';
import '../customers/customer_detail_page.dart';

class OrderDetailPage extends StatefulWidget {
  const OrderDetailPage({super.key, required this.orderId});
  final int orderId;
  @override
  State<OrderDetailPage> createState() => _OrderDetailPageState();
}

class _OrderDetailPageState extends State<OrderDetailPage> {
  late Future<Map<String, dynamic>> _future = _load();
  bool _busy = false;

  Future<Map<String, dynamic>> _load() async {
    final res = await context.read<ApiClient>().dio.get('/orders/${widget.orderId}');
    return (res.data as Map).cast<String, dynamic>();
  }

  Future<void> _updateStatus(String status, {bool confirm = false}) async {
    if (confirm) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Cancel order?'),
          content: const Text('This marks the order cancelled and syncs it back to the platform.'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('No')),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: AppPalette.destructive),
              onPressed: () => Navigator.pop(ctx, true),
              child: Text(context.t('orders.cancelOrder')),
            ),
          ],
        ),
      );
      if (ok != true) return;
    }
    setState(() => _busy = true);
    try {
      await context.read<ApiClient>().dio.put('/orders/${widget.orderId}', data: {'status': status});
      if (mounted) {
        showToast(context, 'Order marked $status.', ToastKind.success);
        setState(() => _future = _load());
      }
    } catch (e) {
      if (mounted) showToast(context, ApiClient.messageFrom(e), ToastKind.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    const steps = ['paid', 'processing', 'shipped', 'delivered'];
    return Scaffold(
      appBar: AppBar(title: const Text('Order')),
      body: AsyncView<Map<String, dynamic>>(
        future: _future,
        onRetry: () => setState(() => _future = _load()),
        builder: (context, o) {
          final status = (o['status'] ?? '').toString().toLowerCase();
          final currency = o['currency']?.toString();
          final items = (o['items'] as List?) ?? [];
          final meta = platformFor(o['store']?['platform']);
          final cancelled = status == 'cancelled';
          final currentStep = steps.indexOf(status);
          final subtotal = items.fold<double>(
              0, (a, it) => a + asNum(it['price']) * ((it['quantity'] ?? 1) as num).toDouble());
          final total = asNum(o['total']);
          final placed = DateTime.tryParse(o['created_at']?.toString() ?? '');
          final statusCard =               AppCard(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(context.t('common.status'), style: const TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  if (cancelled)
                    Row(children: [
                      Icon(LucideIcons.xCircle, color: AppPalette.destructive, size: 18),
                      SizedBox(width: 8),
                      Text('Cancelled', style: TextStyle(color: AppPalette.destructive, fontWeight: FontWeight.w600)),
                    ])
                  else
                    ...List.generate(steps.length, (i) {
                      final done = i <= currentStep;
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 5),
                        child: Row(children: [
                          Icon(done ? LucideIcons.checkCircle2 : LucideIcons.circle,
                              size: 18, color: done ? AppPalette.secondary : AppPalette.border),
                          const SizedBox(width: 10),
                          Text(steps[i][0].toUpperCase() + steps[i].substring(1),
                              style: TextStyle(
                                  color: done ? AppPalette.foreground : AppPalette.mutedForeground,
                                  fontWeight: i == currentStep ? FontWeight.bold : FontWeight.normal)),
                        ]),
                      );
                    }),
                ]),
              );
          final actions = _statusActions(status, cancelled);
          return Column(children: [
            Expanded(
              child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // The order at a glance: who sold it, what it is worth, where it stands.
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('#${(o['external_id'] ?? '').toString().toUpperCase()}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 22, letterSpacing: -0.4)),
                    const SizedBox(height: 4),
                    Row(children: [
                      PlatformLogo(platformId: meta.id, size: 14),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          [
                            o['store']?['name']?.toString() ?? meta.name,
                            if (placed != null) DateFormat.MMMd().add_jm().format(placed),
                          ].join(' · '),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(color: AppPalette.mutedForeground, fontSize: 12.5),
                        ),
                      ),
                    ]),
                  ]),
                ),
                const SizedBox(width: 12),
                MoneyText(total, code: currency, style: AppText.number(size: 22, weight: FontWeight.w900)),
              ]),
              const SizedBox(height: 16),
              _customerCard(o),
              const SizedBox(height: 12),
              AppCard(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Text(context.t('orders.items'), style: const TextStyle(fontWeight: FontWeight.bold)),
                    const Spacer(),
                    Text('${items.length} product(s)',
                        style: TextStyle(color: AppPalette.mutedForeground, fontSize: 12)),
                  ]),
                  const SizedBox(height: 8),
                  ...items.map((it) {
                    final qty = (it['quantity'] ?? 1) as num;
                    final price = asNum(it['price']);
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 7),
                      child: Row(children: [
                        Container(
                          width: 34,
                          height: 34,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(color: AppPalette.surfaceAlt, borderRadius: BorderRadius.circular(10)),
                          child: Text('×$qty', style: AppText.number(size: 13)),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(it['product_name']?.toString() ?? it['name']?.toString() ?? '',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontWeight: FontWeight.w700)),
                            Text('${it['sku']?.toString() ?? '—'} · ${formatMoney(price, currency)}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(color: AppPalette.mutedForeground, fontSize: 12)),
                          ]),
                        ),
                        const SizedBox(width: 10),
                        MoneyText(price * qty.toDouble(), code: currency, style: AppText.number(size: 14)),
                      ]),
                    );
                  }),
                  const Divider(height: 20),
                  _totalRow(context.t('common.subtotal'), subtotal, currency, bold: false),
                  const SizedBox(height: 4),
                  _totalRow(context.t('common.total'), total, currency, bold: true),
                ]),
              ),
              const SizedBox(height: 12),
              statusCard,
              const SizedBox(height: 12),
              _storeCard(o, meta, currency),
            ],
              ),
            ),
            // What to do next stays within thumb reach.
            if (actions != null)
              Container(
                padding: EdgeInsets.fromLTRB(16, 10, 16, 10 + MediaQuery.of(context).padding.bottom),
                decoration: BoxDecoration(
                  color: AppPalette.background,
                  border: Border(top: BorderSide(color: AppPalette.border)),
                ),
                child: actions,
              ),
          ]);
        },
      ),
    );
  }

  Widget? _statusActions(String status, bool cancelled) {
    final buttons = <Widget>[];
    if (status == 'pending') {
      buttons.add(FilledButton.icon(
        onPressed: _busy ? null : () => _updateStatus('Paid'),
        icon: const Icon(LucideIcons.checkCircle2, size: 16),
        label: Text(context.t('orders.markPaid')),
      ));
    }
    if (status == 'paid' || status == 'processing') {
      buttons.add(FilledButton.icon(
        onPressed: _busy ? null : () => _updateStatus('Shipped'),
        icon: const Icon(LucideIcons.truck, size: 16),
        label: Text(context.t('orders.fulfill')),
      ));
    }
    if (!cancelled && status != 'shipped' && status != 'delivered') {
      buttons.add(OutlinedButton.icon(
        onPressed: _busy ? null : () => _updateStatus('Cancelled', confirm: true),
        style: OutlinedButton.styleFrom(foregroundColor: AppPalette.destructive),
        icon: const Icon(LucideIcons.xCircle, size: 16),
        label: Text(context.t('orders.cancelOrder')),
      ));
    }
    if (buttons.isEmpty) return null;
    return Row(children: [
      for (var i = 0; i < buttons.length; i++) ...[
        if (i > 0) const SizedBox(width: 10),
        Expanded(flex: i == 0 ? 3 : 2, child: buttons[i]),
      ],
    ]);
  }

  Widget _customerCard(Map o) {
    final email = o['customer_email']?.toString() ?? '';
    final df = DateFormat.yMMMd().add_jm();
    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(context.t('orders.customer'), style: const TextStyle(fontWeight: FontWeight.bold)),
        const SizedBox(height: 10),
        Row(children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: AppPalette.primary.withValues(alpha: 0.12),
            child: Text((o['customer_name']?.toString() ?? 'G').characters.first.toUpperCase(),
                style: TextStyle(color: AppPalette.primary, fontWeight: FontWeight.bold)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(o['customer_name']?.toString() ?? 'Guest', style: const TextStyle(fontWeight: FontWeight.w600)),
              if (email.isNotEmpty)
                Text(email, style: TextStyle(color: AppPalette.mutedForeground, fontSize: 12)),
            ]),
          ),
        ]),
        const SizedBox(height: 6),
        Text('Placed ${df.format(DateTime.tryParse(o['created_at']?.toString() ?? '') ?? DateTime(2020))}',
            style: TextStyle(color: AppPalette.mutedForeground, fontSize: 12)),
        if (email.isNotEmpty) ...[
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => CustomerDetailPage(email: email))),
            icon: const Icon(LucideIcons.user, size: 16),
            label: Text(context.t('orders.viewProfile')),
          ),
        ],
      ]),
    );
  }

  Widget _storeCard(Map o, PlatformMeta meta, String? currency) {
    final store = o['store'];
    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(context.t('orders.store'), style: const TextStyle(fontWeight: FontWeight.bold)),
        const SizedBox(height: 10),
        Row(children: [
          PlatformLogo(platformId: meta.id, size: 20),
          const SizedBox(width: 10),
          Expanded(child: Text(store?['name']?.toString() ?? meta.name,
              style: const TextStyle(fontWeight: FontWeight.w600))),
          Text(meta.name, style: TextStyle(color: AppPalette.mutedForeground, fontSize: 12)),
        ]),
        const SizedBox(height: 8),
        _kv('Original order ID', o['external_id']?.toString() ?? '—'),
        _kv('Currency', currency ?? 'SAR'),
      ]),
    );
  }

  Widget _kv(String k, String v) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(children: [
          Text(k, style: TextStyle(color: AppPalette.mutedForeground, fontSize: 12)),
          const Spacer(),
          Text(v, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
        ]),
      );

  Widget _totalRow(String label, double amount, String? code, {required bool bold}) => Row(children: [
        Text(label,
            style: TextStyle(
                color: bold ? AppPalette.foreground : AppPalette.mutedForeground,
                fontWeight: bold ? FontWeight.bold : FontWeight.normal)),
        const Spacer(),
        MoneyText(amount, code: code,
            style: TextStyle(fontWeight: bold ? FontWeight.bold : FontWeight.w500, fontSize: bold ? 16 : 14)),
      ]);
}

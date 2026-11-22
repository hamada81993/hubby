import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../core/network/api_client.dart';
import '../../core/platforms.dart';
import '../../core/theme/app_palette.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/strings.dart';
import '../../shared/widgets/app_widgets.dart';
import '../../shared/widgets/async_builder.dart';
import '../../shared/widgets/money_text.dart';
import '../../shared/widgets/platform_logo.dart';
import '../orders/order_detail_page.dart';
import '../stores/cubit/stores_cubit.dart';
import 'live_hub.dart';

class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key});
  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  int _days = 30;
  bool _syncing = false;
  late Future<Map<String, dynamic>> _future = _load();

  Future<Map<String, dynamic>> _load() async {
    final api = context.read<ApiClient>();
    final r = await Future.wait([
      api.dio.get('/analytics/dashboard', queryParameters: {'days': _days}),
      api.dio.get('/orders', queryParameters: {'per_page': 6}),
      api.dio.get('/analytics/orders-timeline', queryParameters: {'days': _days}),
    ]);
    // The hub's extras are optional: finance reports can be restricted by role,
    // and the screen still works without them.
    Future<dynamic> optional(String path, [Map<String, dynamic>? query]) async {
      try {
        return (await api.dio.get(path, queryParameters: query)).data;
      } catch (_) {
        return null;
      }
    }

    final end = DateTime.now();
    final start = end.subtract(Duration(days: _days - 1));
    String day(DateTime d) => DateFormat('yyyy-MM-dd').format(d);
    final extra = await Future.wait([
      optional('/operations/health'),
      optional('/analytics/profit/by-channel', {'start_date': day(start), 'end_date': day(end)}),
      optional('/operations'),
    ]);
    return {
      'health': extra[0] is List ? extra[0] : const [],
      'channels': extra[1] is List ? extra[1] : null,
      'queues': extra[2] is Map ? (extra[2]['queues'] as List? ?? const []) : const [],
      'summary': (r[0].data as Map).cast<String, dynamic>(),
      'recent': (r[1].data['data'] as List?) ?? [],
      'timeline': (r[2].data as List?) ?? [],
    };
  }

  Future<void> _syncAll() async {
    final stores = context.read<StoresCubit>().state;
    if (!stores.hasConnectedStore) {
      showToast(context, 'Connect a store first to sync.', ToastKind.info);
      return;
    }
    setState(() => _syncing = true);
    try {
      await context.read<ApiClient>().dio.post('/stores/sync-all');
      if (mounted) showToast(context, 'Global sync started across your connected stores.', ToastKind.success);
    } catch (e) {
      if (mounted) showToast(context, ApiClient.messageFrom(e), ToastKind.error);
    } finally {
      if (mounted) setState(() => _syncing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () async => setState(() => _future = _load()),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          PageHeader(
            title: context.t('nav.dashboard'),
            subtitle: context.t('dashboard.subtitle'),
            trailing: OutlinedButton.icon(
              onPressed: _syncing ? null : _syncAll,
              icon: _syncing
                  ? const SizedBox(height: 14, width: 14, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(LucideIcons.refreshCw, size: 16),
              label: Text(context.t('common.syncAll')),
            ),
          ),
          const SizedBox(height: 16),
          BlocBuilder<StoresCubit, StoresState>(
            builder: (context, s) => (!s.loading && !s.hasConnectedStore)
                ? Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: ConnectPrompt(description: context.t('dashboard.connectPrompt')))
                : const SizedBox.shrink(),
          ),
          AsyncView<Map<String, dynamic>>(
            future: _future,
            onRetry: () => setState(() => _future = _load()),
            builder: (context, data) {
              final s = (data['summary'] as Map).cast<String, dynamic>();
              final recent = (data['recent'] as List?) ?? [];
              final timeline = (data['timeline'] as List?) ?? [];
              final health = (data['health'] as List?) ?? const [];
              final channels = data['channels'] as List?;
              final revenue = <int, double>{
                for (final c in channels ?? const []) (c['store_id'] as num).toInt(): _num(c['net_revenue']),
              };
              final total = revenue.values.fold<double>(0, (a, b) => a + b);
              final hubStores = [
                // Odoo is a product source, not a place orders come from, so it stays off the hub.
                for (final h in health)
                  if (h['platform'] != 'odoo')
                  HubStore(
                    id: (h['id'] as num).toInt(),
                    name: '${h['name'] ?? ''}',
                    platform: '${h['platform'] ?? ''}',
                    healthy: h['state'] != 'failed' && h['state'] != 'stalled',
                    share: channels == null || total <= 0 ? null : (revenue[(h['id'] as num).toInt()] ?? 0) / total,
                  ),
              ];
              final ar = Localizations.localeOf(context).languageCode == 'ar';
              var waiting = 0;
              for (final q in (data['queues'] as List?) ?? const []) {
                if (q['key'] == 'fulfillment') waiting = (q['count'] as num?)?.toInt() ?? 0;
              }
              return Column(
                children: [
                  if (hubStores.isNotEmpty) ...[
                    LiveHub(
                      stores: hubStores,
                      centreValue: '${s['total_orders'] ?? 0}',
                      centreLabel: ar ? 'طلب في $_days يوماً' : 'orders in $_days days',
                    ),
                    const SizedBox(height: 12),
                  ],
                  if (waiting > 0) ...[
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
                      decoration: BoxDecoration(color: AppPalette.action, borderRadius: BorderRadius.circular(24)),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
                        Text('$waiting',
                            style: AppText.number(size: 44, weight: FontWeight.w900, color: AppPalette.onAction)),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(ar ? 'طلب في انتظار التجهيز' : 'orders waiting to be packed',
                              style: const TextStyle(
                                  fontSize: 15, height: 1.2, fontWeight: FontWeight.w700, color: AppPalette.onAction)),
                        ),
                      ]),
                    ),
                    const SizedBox(height: 12),
                  ],
                  GridView.count(
                    crossAxisCount: 2, shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    mainAxisSpacing: 12, crossAxisSpacing: 12, childAspectRatio: 1.45,
                    children: [
                      _kpi(context.t('dashboard.revenue'),
                          MoneyText(s['total_revenue'], compact: true, style: AppText.number(size: 21)),
                          LucideIcons.dollarSign, AppPalette.secondary, s['revenue_change']),
                      _kpi(context.t('dashboard.orders'),
                          Text('${s['total_orders'] ?? 0}', style: AppText.number(size: 21)),
                          LucideIcons.shoppingCart, AppPalette.primary, s['orders_change']),
                      _kpi(context.t('dashboard.avgOrder'),
                          MoneyText(s['avg_order_value'], compact: true, style: AppText.number(size: 21)),
                          LucideIcons.trendingUp, AppPalette.warning, null),
                      _kpi(context.t('dashboard.products'),
                          Text('${s['active_products'] ?? 0}', style: AppText.number(size: 21)),
                          LucideIcons.package, AppPalette.foreground, null),
                    ],
                  ),
                  const SizedBox(height: 16),
                  if (timeline.length > 1) _chart(context, timeline),
                  const SizedBox(height: 16),
                  if (recent.isNotEmpty) _recentOrders(context, recent),
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  double _num(dynamic v) => double.tryParse('${v ?? 0}') ?? 0;

  Widget _kpi(String label, Widget value, IconData icon, Color color, dynamic change) {
    final hasDelta = change != null;
    final up = hasDelta && (change as num) >= 0;
    final deltaColor = up ? AppPalette.secondary : AppPalette.destructive;
    return AppCard(
      padding: const EdgeInsets.all(14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            height: 34, width: 34,
            decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(AppPalette.rSm)),
            child: Icon(icon, color: color, size: 18),
          ),
          const Spacer(),
          if (hasDelta)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
              decoration: BoxDecoration(
                  color: deltaColor.withValues(alpha: 0.10), borderRadius: BorderRadius.circular(AppPalette.rPill)),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(up ? LucideIcons.trendingUp : LucideIcons.trendingDown, size: 11, color: deltaColor),
                const SizedBox(width: 3),
                Text('${up ? '+' : ''}$change%',
                    style: TextStyle(fontSize: 10.5, color: deltaColor, fontWeight: FontWeight.w700)),
              ]),
            ),
        ]),
        const Spacer(),
        value,
        const SizedBox(height: 2),
        Text(label, style: TextStyle(color: AppPalette.mutedForeground, fontSize: 12, fontWeight: FontWeight.w500)),
      ]),
    );
  }

  Widget _chart(BuildContext context, List timeline) {
    final spots = <FlSpot>[];
    for (var i = 0; i < timeline.length; i++) {
      spots.add(FlSpot(i.toDouble(), _num(timeline[i]['orders'])));
    }
    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(context.t('dashboard.ordersOverTime'), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15))),
          for (final d in const [7, 30, 90])
            Padding(
              padding: const EdgeInsetsDirectional.only(start: 6),
              child: GestureDetector(
                onTap: () { setState(() { _days = d; _future = _load(); }); },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: _days == d ? AppPalette.primary : AppPalette.card,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: _days == d ? AppPalette.primary : AppPalette.border),
                  ),
                  child: Text('${d}d',
                      style: TextStyle(
                          fontSize: 11,
                          color: _days == d ? AppPalette.onPrimary : AppPalette.mutedForeground,
                          fontWeight: FontWeight.w600)),
                ),
              ),
            ),
        ]),
        const SizedBox(height: 16),
        SizedBox(
          height: 140,
          child: LineChart(LineChartData(
            gridData: const FlGridData(show: false),
            titlesData: const FlTitlesData(show: false),
            borderData: FlBorderData(show: false),
            lineBarsData: [
              LineChartBarData(
                spots: spots,
                isCurved: true,
                color: AppPalette.primary,
                barWidth: 3,
                dotData: const FlDotData(show: false),
                belowBarData: BarAreaData(show: true, color: AppPalette.primary.withValues(alpha: 0.1)),
              ),
            ],
          )),
        ),
      ]),
    );
  }

  Widget _recentOrders(BuildContext context, List recent) {
    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(context.t('dashboard.recentOrders'), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
        const SizedBox(height: 8),
        ...recent.take(6).map((o) {
          final meta = platformFor(o['store']?['platform']);
          final date = DateTime.tryParse(o['created_at']?.toString() ?? '');
          return InkWell(
              onTap: () => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => OrderDetailPage(orderId: o['id'] as int))),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Row(children: [
                  PlatformLogo(platformId: meta.id, size: 18),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(o['customer_name']?.toString() ?? 'Guest',
                          maxLines: 1, overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 13)),
                      if (date != null)
                        Text('${meta.name} · ${DateFormat.MMMd().format(date)}',
                            style: TextStyle(color: AppPalette.mutedForeground, fontSize: 11)),
                    ]),
                  ),
                  MoneyText(o['total'], compact: true, style: const TextStyle(fontWeight: FontWeight.w600)),
                ]),
              ),
            );
        }),
      ]),
    );
  }
}

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../l10n/strings.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_palette.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/app_widgets.dart';
import '../../shared/widgets/async_builder.dart';
import '../../shared/widgets/money_text.dart';
import '../stores/cubit/stores_cubit.dart';
import 'product_detail_page.dart';
import 'product_form_page.dart';

enum _Sort { newest, priceHigh, priceLow, stockLow, nameAz }

class ProductsPage extends StatefulWidget {
  const ProductsPage({super.key});
  @override
  State<ProductsPage> createState() => _ProductsPageState();
}

class _ProductsPageState extends State<ProductsPage> {
  String _search = '';
  Timer? _debounce;
  bool _selecting = false;
  final Set<int> _selected = {};
  bool _bulkBusy = false;
  _Sort _sort = _Sort.newest;
  String _stockFilter = 'all'; // all | low | out
  List<int> _visibleIds = const [];
  late Future<List<dynamic>> _future = _load();

  Future<List<dynamic>> _load() async {
    final res = await context.read<ApiClient>().dio.get('/products', queryParameters: {
      'per_page': 50,
      if (_search.isNotEmpty) 'search': _search,
    });
    return (res.data['data'] as List?) ?? [];
  }

  void _reload() => setState(() => _future = _load());

  void _onSearch(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () { _search = v; _reload(); });
  }

  int _stockOf(dynamic p) => ((p['stock'] ?? 0) as num).toInt();

  List<dynamic> _shape(List<dynamic> items) {
    final list = items.where((p) {
      final s = _stockOf(p);
      if (_stockFilter == 'low') return s > 0 && s < 10;
      if (_stockFilter == 'out') return s == 0;
      return true;
    }).toList();
    double price(p) => double.tryParse('${p['price'] ?? 0}') ?? 0;
    switch (_sort) {
      case _Sort.priceHigh:
        list.sort((a, b) => price(b).compareTo(price(a)));
      case _Sort.priceLow:
        list.sort((a, b) => price(a).compareTo(price(b)));
      case _Sort.stockLow:
        list.sort((a, b) => _stockOf(a).compareTo(_stockOf(b)));
      case _Sort.nameAz:
        list.sort((a, b) => '${a['name']}'.toLowerCase().compareTo('${b['name']}'.toLowerCase()));
      case _Sort.newest:
        break;
    }
    return list;
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _openForm([Map<String, dynamic>? product]) async {
    final changed = await Navigator.of(context).push<bool>(
        MaterialPageRoute(builder: (_) => ProductFormPage(product: product)));
    if (changed == true) _reload();
  }

  Future<void> _sync({List<int>? ids}) async {
    final stores = context.read<StoresCubit>().state;
    if (!stores.hasConnectedStore) {
      showToast(context, 'Connect a store first to sync products.', ToastKind.info);
      return;
    }
    try {
      await context.read<ApiClient>().dio.post('/products/sync',
          data: (ids != null && ids.isNotEmpty) ? {'product_ids': ids} : {});
      if (mounted) {
        showToast(context,
            ids == null ? 'Sync started — products will update shortly.' : 'Syncing ${ids.length} product(s).',
            ToastKind.success);
      }
    } catch (e) {
      if (mounted) showToast(context, ApiClient.messageFrom(e), ToastKind.error);
    }
  }

  Future<void> _bulkDelete() async {
    final ids = _selected.toList();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete products'),
        content: Text('Delete ${ids.length} selected product(s)? This cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(context.t('common.cancel'))),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppPalette.destructive),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(context.t('common.delete')),
          ),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _bulkBusy = true);
    final api = context.read<ApiClient>();
    try {
      await Future.wait(ids.map((id) => api.dio.delete('/products/$id')));
      if (mounted) {
        showToast(context, 'Deleted ${ids.length} product(s).', ToastKind.success);
        _exitSelection();
        _reload();
      }
    } catch (e) {
      if (mounted) showToast(context, ApiClient.messageFrom(e), ToastKind.error);
    } finally {
      if (mounted) setState(() => _bulkBusy = false);
    }
  }

  void _exitSelection() => setState(() {
        _selecting = false;
        _selected.clear();
      });

  void _toggle(int id) => setState(() {
        if (_selected.contains(id)) {
          _selected.remove(id);
          if (_selected.isEmpty) _selecting = false;
        } else {
          _selected.add(id);
        }
      });

  bool get _allSelected => _visibleIds.isNotEmpty && _selected.length >= _visibleIds.length;

  void _toggleSelectAll() => setState(() {
        if (_allSelected) {
          _selected.clear();
        } else {
          _selected.addAll(_visibleIds);
        }
      });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: PageHeader(
            title: _selecting ? '${_selected.length} ${context.t('products.selected')}' : context.t('nav.products'),
            subtitle: _selecting ? null : context.t('products.subtitle'),
            trailing: _selecting
                ? Row(mainAxisSize: MainAxisSize.min, children: [
                    TextButton(onPressed: _toggleSelectAll, child: Text(_allSelected ? context.t('common.clear') : context.t('common.all'))),
                    TextButton(onPressed: _exitSelection, child: Text(context.t('common.cancel'))),
                  ])
                : Row(mainAxisSize: MainAxisSize.min, children: [
                    _iconAction(LucideIcons.refreshCw, context.t('common.syncAll'), () => _sync()),
                    const SizedBox(width: 8),
                    FilledButton.icon(
                      onPressed: () => _openForm(),
                      icon: const Icon(LucideIcons.plus, size: 16),
                      label: Text(context.t('common.new')),
                    ),
                  ]),
          ),
        ),
        if (!_selecting)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Row(children: [
              Expanded(
                child: TextField(
                  onChanged: _onSearch,
                  decoration: InputDecoration(
                    hintText: context.t('products.searchHint'),
                    prefixIcon: const Icon(LucideIcons.search, size: 18),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              _toolMenu(context),
            ]),
          ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: () async => _reload(),
            child: AsyncView<List<dynamic>>(
              future: _future,
              onRetry: _reload,
              builder: (context, raw) {
                if (raw.isEmpty) {
                  return ListView(children: [
                    Padding(padding: const EdgeInsets.all(16),
                        child: ConnectPrompt(description: context.t('products.connectOrAdd'))),
                  ]);
                }
                final items = _shape(raw);
                _visibleIds = items.map((e) => e['id'] as int).toList();
                return CustomScrollView(slivers: [
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                    sliver: SliverToBoxAdapter(child: _resultBar(context, raw.length, items.length)),
                  ),
                  if (items.isEmpty)
                    SliverFillRemaining(
                      hasScrollBody: false,
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Center(
                          child: Text(context.t('products.noMatch'),
                              style: TextStyle(color: AppPalette.mutedForeground)),
                        ),
                      ),
                    )
                  else
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                      // One card, one row per product: a list reads faster on a phone than tall tiles.
                      sliver: SliverToBoxAdapter(
                        child: Container(
                          clipBehavior: Clip.antiAlias,
                          decoration: BoxDecoration(
                            color: AppPalette.card,
                            borderRadius: BorderRadius.circular(22),
                            border: Border.all(color: AppPalette.border),
                          ),
                          child: Column(children: [
                            for (var i = 0; i < items.length; i++) _productCard(items[i], last: i == items.length - 1),
                          ]),
                        ),
                      ),
                    ),
                ]);
              },
            ),
          ),
        ),
        if (_selecting && _selected.isNotEmpty) _bulkBar(),
      ],
    );
  }

  Widget _iconAction(IconData icon, String tooltip, VoidCallback onTap) => Tooltip(
        message: tooltip,
        child: OutlinedButton(
          onPressed: onTap,
          style: OutlinedButton.styleFrom(
            minimumSize: const Size(44, 44),
            padding: EdgeInsets.zero,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppPalette.rMd)),
          ),
          child: Icon(icon, size: 18),
        ),
      );

  Widget _toolMenu(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppPalette.card,
        borderRadius: BorderRadius.circular(AppPalette.rMd),
        border: Border.all(color: AppPalette.borderStrong),
      ),
      child: PopupMenuButton<String>(
        tooltip: 'Sort & filter',
        icon: Icon(LucideIcons.slidersHorizontal, size: 18, color: AppPalette.foregroundSoft),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppPalette.rMd)),
        onSelected: (v) => setState(() {
          switch (v) {
            case 'all' || 'low' || 'out':
              _stockFilter = v;
            case 'newest':
              _sort = _Sort.newest;
            case 'priceHigh':
              _sort = _Sort.priceHigh;
            case 'priceLow':
              _sort = _Sort.priceLow;
            case 'stockLow':
              _sort = _Sort.stockLow;
            case 'nameAz':
              _sort = _Sort.nameAz;
          }
        }),
        itemBuilder: (_) => [
          PopupMenuItem(enabled: false, child: Text(context.t('products.sortBy'), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppPalette.mutedForeground))),
          _menuItem('newest', context.t('products.newest'), _sort == _Sort.newest),
          _menuItem('priceHigh', context.t('products.priceHigh'), _sort == _Sort.priceHigh),
          _menuItem('priceLow', context.t('products.priceLow'), _sort == _Sort.priceLow),
          _menuItem('stockLow', context.t('products.stockLow'), _sort == _Sort.stockLow),
          _menuItem('nameAz', context.t('products.nameAz'), _sort == _Sort.nameAz),
          const PopupMenuDivider(),
          PopupMenuItem(enabled: false, child: Text(context.t('common.stock'), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppPalette.mutedForeground))),
          _menuItem('all', context.t('products.allProducts'), _stockFilter == 'all'),
          _menuItem('low', context.t('products.lowStock'), _stockFilter == 'low'),
          _menuItem('out', context.t('products.outOfStock'), _stockFilter == 'out'),
        ],
      ),
    );
  }

  PopupMenuItem<String> _menuItem(String value, String label, bool active) => PopupMenuItem(
        value: value,
        child: Row(children: [
          Icon(active ? LucideIcons.check : LucideIcons.minus,
              size: 15, color: active ? AppPalette.primary : Colors.transparent),
          const SizedBox(width: 10),
          Text(label, style: TextStyle(fontWeight: active ? FontWeight.w600 : FontWeight.w400)),
        ]),
      );

  Widget _resultBar(BuildContext context, int total, int shown) {
    final filtered = shown != total || _stockFilter != 'all';
    return Row(children: [
      Text(filtered ? '$shown / $total ${context.t('products.count')}' : '$total ${context.t('products.count')}',
          style: TextStyle(color: AppPalette.mutedForeground, fontSize: 12, fontWeight: FontWeight.w500)),
      const Spacer(),
      if (!_selecting)
        TextButton.icon(
          onPressed: () => setState(() { _selecting = true; }),
          icon: const Icon(LucideIcons.checkSquare, size: 14),
          label: Text(context.t('common.select')),
          style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 8), foregroundColor: AppPalette.mutedForeground),
        ),
    ]);
  }

  Widget _productCard(dynamic p, {bool last = false}) {
    final id = p['id'] as int;
    final stock = _stockOf(p);
    final selected = _selected.contains(id);
    final out = stock == 0, low = stock > 0 && stock < 10;
    final stockColor = out ? AppPalette.destructive : low ? AppPalette.warning : AppPalette.foreground;
    return InkWell(
      onTap: () {
        if (_selecting) {
          _toggle(id);
        } else {
          Navigator.of(context).push(MaterialPageRoute(builder: (_) => ProductDetailPage(productId: id)));
        }
      },
      onLongPress: () => setState(() { _selecting = true; _selected.add(id); }),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
        decoration: BoxDecoration(
          color: selected ? AppPalette.primarySoft : null,
          border: last ? null : Border(bottom: BorderSide(color: AppPalette.accent)),
        ),
        child: Row(children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: AppPalette.surfaceAlt,
              borderRadius: BorderRadius.circular(14),
              border: selected ? Border.all(color: AppPalette.primary, width: 2) : null,
              image: p['image_url'] != null
                  ? DecorationImage(image: NetworkImage(p['image_url']), fit: BoxFit.cover)
                  : null,
            ),
            child: selected
                ? Icon(LucideIcons.check, color: AppPalette.primary, size: 22)
                : p['image_url'] == null
                    ? Icon(LucideIcons.image, color: AppPalette.mutedForeground, size: 20)
                    : null,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(p['name']?.toString() ?? '',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5)),
              const SizedBox(height: 2),
              Text(
                [
                  if ((p['sku']?.toString() ?? '').isNotEmpty) p['sku'].toString(),
                  if (out) context.t('products.out') else if (low) context.t('products.low'),
                ].join(' · '),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: out || low ? stockColor : AppPalette.mutedForeground, fontSize: 12),
              ),
            ]),
          ),
          const SizedBox(width: 10),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            MoneyText(p['price'], style: AppText.number(size: 14.5)),
            const SizedBox(height: 2),
            Text('$stock', style: AppText.number(size: 13, weight: FontWeight.w700, color: stockColor)),
          ]),
        ]),
      ),
    );
  }

  Widget _bulkBar() => Container(
        decoration: BoxDecoration(
          color: AppPalette.card,
          border: Border(top: BorderSide(color: AppPalette.border)),
          boxShadow: [BoxShadow(color: Color(0x141E293B), blurRadius: 20, offset: Offset(0, -8))],
        ),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Row(children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _bulkBusy ? null : () => _sync(ids: _selected.toList()),
                  icon: const Icon(LucideIcons.refreshCw, size: 16),
                  label: Text('${context.t('common.sync')} (${_selected.length})'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(backgroundColor: AppPalette.destructive),
                  onPressed: _bulkBusy ? null : _bulkDelete,
                  icon: _bulkBusy
                      ? SizedBox(height: 16, width: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: AppPalette.primary))
                      : const Icon(LucideIcons.trash2, size: 16),
                  label: Text(context.t('common.delete')),
                ),
              ),
            ]),
          ),
        ),
      );
}

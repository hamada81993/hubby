import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_palette.dart';
import '../../shared/widgets/app_widgets.dart';
import '../../shared/widgets/platform_logo.dart';
import '../stores/connect_sheet.dart';
import '../stores/cubit/stores_cubit.dart';

/// Systems connected beside the sales channels. Odoo is available; the rest can be
/// requested, and each request is recorded so the next one is chosen by demand.
class IntegrationsPage extends StatefulWidget {
  const IntegrationsPage({super.key});
  @override
  State<IntegrationsPage> createState() => _IntegrationsPageState();
}

class _IntegrationsPageState extends State<IntegrationsPage> {
  static const _coming = <(String, String, String, String)>[
    ('zoho_books', 'Zoho Books', 'Invoices and stock with Zoho Books', 'الفواتير والمخزون مع Zoho Books'),
    ('qoyod', 'Qoyod · قيود', 'Invoices and journals with Qoyod', 'الفواتير والقيود مع قيود'),
    ('daftra', 'Daftra · دفترة', 'Products, invoices and stock with Daftra', 'المنتجات والفواتير والمخزون مع دفترة'),
    ('wafeq', 'Wafeq · وافق', 'Invoices and accounts with Wafeq', 'الفواتير والحسابات مع وافق'),
    ('meta_ads', 'Meta Ads', 'Facebook and Instagram spend, every day', 'مصروف فيسبوك وإنستجرام يومياً'),
    ('google_ads', 'Google Ads', 'Search and Shopping spend, every day', 'مصروف البحث والتسوق يومياً'),
    ('tiktok_ads', 'TikTok Ads', 'TikTok spend, every day', 'مصروف تيك توك يومياً'),
    ('snapchat_ads', 'Snapchat Ads', 'Snapchat spend, every day', 'مصروف سناب شات يومياً'),
  ];

  Set<String> _requested = {};
  String? _asking;

  // Stock sharing
  String _mode = 'shared';
  String _basis = 'percent';
  bool _oversell = false;
  List<dynamic> _channels = [];
  final Map<int, TextEditingController> _fields = {};
  bool _saving = false;

  bool get _ar => Localizations.localeOf(context).languageCode == 'ar';
  String _l(String en, String ar) => _ar ? ar : en;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final c in _fields.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    final dio = context.read<ApiClient>().dio;
    try {
      final r = await dio.get('/integration-requests');
      if (mounted && r.data is List) setState(() => _requested = {for (final k in r.data as List) '$k'});
    } catch (_) {/* the list simply stays empty */}
    try {
      final r = await dio.get('/stock-allocation');
      if (!mounted) return;
      setState(() {
        _mode = '${r.data['mode'] ?? 'shared'}';
        _basis = '${r.data['basis'] ?? 'percent'}';
        _oversell = r.data['allow_oversell'] == true;
        _channels = (r.data['channels'] as List?) ?? [];
        _fillFields();
      });
    } catch (_) {/* stock sharing stays on its default */}
  }

  void _fillFields() {
    for (final c in _channels) {
      final id = (c['id'] as num).toInt();
      final value = _basis == 'units' ? c['allocation_units'] : c['allocation_percent'];
      (_fields[id] ??= TextEditingController()).text = value == null ? '' : '$value';
    }
  }

  Future<void> _request(String key) async {
    setState(() => _asking = key);
    try {
      await context.read<ApiClient>().dio.post('/integration-requests', data: {'integration': key});
      if (mounted) setState(() => _requested = {..._requested, key});
    } catch (e) {
      if (mounted) showToast(context, ApiClient.messageFrom(e), ToastKind.error);
    } finally {
      if (mounted) setState(() => _asking = null);
    }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    final values = {
      for (final c in _channels)
        '${c['id']}': int.tryParse(_fields[(c['id'] as num).toInt()]?.text.trim() ?? ''),
    };
    try {
      final r = await context.read<ApiClient>().dio.put('/stock-allocation', data: {
        'mode': _mode,
        'basis': _basis,
        'allow_oversell': _oversell,
        if (_basis == 'units') 'units': values else 'percents': values,
      });
      if (!mounted) return;
      setState(() {
        _channels = (r.data['channels'] as List?) ?? _channels;
        _fillFields();
      });
      showToast(context, _l('Saved. Each product follows it from its next stock update.', 'تم الحفظ. يطبق على كل منتج عند تحديث مخزونه القادم.'), ToastKind.success);
    } catch (e) {
      if (mounted) showToast(context, ApiClient.messageFrom(e), ToastKind.error);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final odoo = context.watch<StoresCubit>().state.stores.where((s) => s['platform'] == 'odoo').toList();
    return Scaffold(
      appBar: AppBar(title: Text(_l('Integrations', 'التكاملات'))),
      body: RefreshIndicator(
        onRefresh: () async {
          await context.read<StoresCubit>().refresh();
          await _load();
        },
        child: ListView(padding: const EdgeInsets.all(16), children: [
          _odooCard(odoo),
          const SizedBox(height: 16),
          _stockCard(),
          const SizedBox(height: 20),
          Text(_l('Coming soon', 'قريباً'), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 4),
          Text(_l('Ask for the one you need. We build the most requested first.', 'اطلب ما تحتاجه. نبني الأكثر طلباً أولاً.'),
              style: TextStyle(color: AppPalette.mutedForeground, fontSize: 13)),
          const SizedBox(height: 10),
          Container(
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: AppPalette.card,
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: AppPalette.border),
            ),
            child: Column(children: [
              for (var i = 0; i < _coming.length; i++) _comingRow(_coming[i], last: i == _coming.length - 1),
            ]),
          ),
        ]),
      ),
    );
  }

  Widget _odooCard(List odoo) {
    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14)),
            child: const Icon(LucideIcons.boxes, color: Color(0xFFA24689), size: 24),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                const Text('Odoo', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                      color: AppPalette.success.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(999)),
                  child: Text(_l('Available', 'متاح'),
                      style: TextStyle(color: AppPalette.success, fontSize: 11, fontWeight: FontWeight.w700)),
                ),
              ]),
              Text(_l('Products, prices, stock and cost from your Odoo. Read only.', 'المنتجات والأسعار والمخزون والتكلفة من أودو. قراءة فقط.'),
                  style: TextStyle(color: AppPalette.mutedForeground, fontSize: 12.5)),
            ]),
          ),
        ]),
        for (final s in odoo) ...[
          const SizedBox(height: 12),
          Row(children: [
            Icon(LucideIcons.circle,
                size: 9,
                color: s['status'] == 'error' ? AppPalette.destructive : s['status'] == 'syncing' ? AppPalette.warning : AppPalette.success),
            const SizedBox(width: 8),
            Expanded(
              child: Text('${s['name']}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700)),
            ),
            if (s['is_master'] == true)
              Text(_l('Master', 'الرئيسي'), style: TextStyle(color: AppPalette.primary, fontWeight: FontWeight.w700, fontSize: 12))
            else
              TextButton(
                onPressed: () async {
                  try {
                    await context.read<ApiClient>().dio.post('/stores/${s['id']}/set-master');
                    if (mounted) await context.read<StoresCubit>().refresh();
                  } catch (e) {
                    if (mounted) showToast(context, ApiClient.messageFrom(e), ToastKind.error);
                  }
                },
                child: Text(_l('Set as master', 'اجعله الرئيسي')),
              ),
          ]),
        ],
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: () => openConnectSheet(context, 'odoo'),
            icon: const Icon(LucideIcons.plus, size: 18),
            label: Text(_l('Connect Odoo', 'اربط أودو')),
          ),
        ),
      ]),
    );
  }

  Widget _stockCard() {
    final options = [
      ('shared', _l('Same stock everywhere', 'نفس المخزون في كل مكان'), _l('100 in stock → 100 on each channel', '100 في المخزن ← 100 في كل قناة')),
      ('split', _l('Divide it between channels', 'قسّمه بين القنوات'), _l('100 in stock → 50 / 30 / 20', '100 في المخزن ← 50 / 30 / 20')),
      ('manual', _l('Set each one yourself', 'حدّد كل قناة بنفسك'), _l('A quantity per product and channel', 'كمية لكل منتج وقناة')),
    ];
    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(_l('How stock is shared', 'طريقة توزيع المخزون'), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        const SizedBox(height: 10),
        for (final o in options)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: () => setState(() => _mode = o.$1),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: _mode == o.$1 ? AppPalette.accent : null,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: _mode == o.$1 ? AppPalette.primary : AppPalette.border, width: _mode == o.$1 ? 1.5 : 1),
                ),
                child: Row(children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(o.$2, style: const TextStyle(fontWeight: FontWeight.w700)),
                      Text(o.$3, style: TextStyle(color: AppPalette.mutedForeground, fontSize: 12.5)),
                    ]),
                  ),
                  if (_mode == o.$1) Icon(LucideIcons.checkCircle2, color: AppPalette.primary, size: 20),
                ]),
              ),
            ),
          ),
        if (_mode == 'split') ...[
          const SizedBox(height: 4),
          SegmentedButton<String>(
            segments: [
              ButtonSegment(value: 'percent', label: Text(_l('By percentage', 'بالنسبة'))),
              ButtonSegment(value: 'units', label: Text(_l('By units', 'بعدد القطع'))),
            ],
            selected: {_basis},
            showSelectedIcon: false,
            onSelectionChanged: (v) => setState(() {
              _basis = v.first;
              _fillFields();
            }),
          ),
          const SizedBox(height: 8),
          if (_channels.isEmpty)
            Text(_l('Connect a sales channel to give it a share.', 'اربط قناة بيع لتعطيها نصيباً.'),
                style: TextStyle(color: AppPalette.mutedForeground, fontSize: 13))
          else
            for (final c in _channels)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 5),
                child: Row(children: [
                  PlatformLogo(platformId: '${c['platform']}', size: 16),
                  const SizedBox(width: 10),
                  Expanded(child: Text('${c['name']}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700))),
                  SizedBox(
                    width: 92,
                    child: TextField(
                      controller: _fields[(c['id'] as num).toInt()],
                      keyboardType: TextInputType.number,
                      textAlign: TextAlign.end,
                      decoration: InputDecoration(
                        isDense: true,
                        suffixText: _basis == 'units' ? null : '%',
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                    ),
                  ),
                ]),
              ),
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              _basis == 'units'
                  ? _l('The same number applies to every product. Channels are filled from the top down when stock is short.', 'الرقم نفسه لكل منتج. عند نقص المخزون تُملأ القنوات من الأعلى للأسفل.')
                  : _l('Leave them empty to split evenly. Shares round down.', 'اتركها فارغة للتقسيم بالتساوي. الأنصبة تُقرّب للأسفل.'),
              style: TextStyle(color: AppPalette.mutedForeground, fontSize: 12.5),
            ),
          ),
        ],
        if (_mode == 'manual')
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: _oversell,
            onChanged: (v) => setState(() => _oversell = v),
            title: Text(_l('Allow a quantity above my stock', 'اسمح بكمية أعلى من مخزوني'), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
            subtitle: Text(
              _l('Quantities are set on each product, from the web dashboard.', 'تُحدد الكميات لكل منتج من لوحة الويب.'),
              style: TextStyle(color: AppPalette.mutedForeground, fontSize: 12.5),
            ),
          ),
        const SizedBox(height: 8),
        SizedBox(
          width: double.infinity,
          child: FilledButton(
            onPressed: _saving ? null : _save,
            child: Text(_saving ? _l('Saving…', 'جارٍ الحفظ…') : _l('Save', 'حفظ')),
          ),
        ),
      ]),
    );
  }

  Widget _comingRow((String, String, String, String) item, {required bool last}) {
    final done = _requested.contains(item.$1);
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 10, 10, 10),
      decoration: BoxDecoration(border: last ? null : Border(bottom: BorderSide(color: AppPalette.accent))),
      child: Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(item.$2, style: const TextStyle(fontWeight: FontWeight.w700)),
            Text(_ar ? item.$4 : item.$3, style: TextStyle(color: AppPalette.mutedForeground, fontSize: 12.5)),
          ]),
        ),
        const SizedBox(width: 8),
        done
            ? Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(LucideIcons.check, size: 16, color: AppPalette.success),
                  const SizedBox(width: 4),
                  Text(_l('Requested', 'تم الطلب'), style: TextStyle(color: AppPalette.success, fontWeight: FontWeight.w700, fontSize: 13)),
                ]),
              )
            : OutlinedButton(
                onPressed: _asking == item.$1 ? null : () => _request(item.$1),
                child: Text(_l('Request', 'اطلب')),
              ),
      ]),
    );
  }
}

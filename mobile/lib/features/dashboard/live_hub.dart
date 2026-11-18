import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../core/platforms.dart';
import '../../core/theme/app_palette.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/platform_logo.dart';

/// One store on the hub. [share] is its part of the period's revenue (0–1), or
/// null when the finance report is not available to this user.
class HubStore {
  const HubStore({required this.id, required this.name, required this.platform, required this.healthy, this.share});
  final int id;
  final String name;
  final String platform;
  final bool healthy;
  final double? share;
}

/// The live hub: every connected store around one centre. A line's thickness is
/// that store's share of revenue, pulses travel along it towards the hub, and
/// the store chips float gently — the same picture as the web dashboard.
class LiveHub extends StatefulWidget {
  const LiveHub({super.key, required this.stores, required this.centreValue, required this.centreLabel});
  final List<HubStore> stores;
  final String centreValue;
  final String centreLabel;

  @override
  State<LiveHub> createState() => _LiveHubState();
}

class _LiveHubState extends State<LiveHub> with SingleTickerProviderStateMixin {
  // One long loop; positions are derived from elapsed seconds, so the length
  // only has to be a whole number of every cycle used below.
  late final AnimationController _clock =
      AnimationController(vsync: this, duration: const Duration(seconds: 120))..repeat();

  static const _angles = <int, List<double>>{
    1: [-90],
    2: [-158, 22],
    3: [-150, -30, 90],
    4: [-140, -40, 40, 140],
    5: [-140, -40, 40, 140, 90],
    6: [-150, -90, -30, 30, 90, 150],
  };

  @override
  void dispose() {
    _clock.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ranked = [...widget.stores]..sort((a, b) => (b.share ?? 0).compareTo(a.share ?? 0));
    final shown = ranked.take(6).toList();
    final top = shown.fold<double>(0, (m, s) => math.max(m, s.share ?? 0));
    final still = MediaQuery.of(context).disableAnimations;

    return LayoutBuilder(builder: (context, box) {
      final w = box.maxWidth;
      final h = w * 0.94;
      final centre = Offset(w / 2, h / 2);
      final angles = _angles[shown.length] ?? const <double>[];
      final nodes = [
        for (var i = 0; i < shown.length; i++)
          _Node(
            store: shown[i],
            // The fifth store sits straight below the centre and needs a little more room.
            home: centre +
                Offset(w * 0.355 * math.cos(angles[i] * math.pi / 180),
                    h * 0.36 * (shown.length == 5 && i == 4 ? 1.06 : 1) * math.sin(angles[i] * math.pi / 180)),
            weight: top > 0 ? (shown[i].share ?? 0) / top : 0.4,
            phase: i * 1.3,
          ),
      ];

      return Container(
        height: h,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(28),
          border: Border.all(color: AppPalette.border),
          gradient: RadialGradient(
            radius: 0.72,
            colors: AppPalette.isDark
                ? const [Color(0xFF0E3B38), Color(0xFF082322), Color(0xFF061C1B)]
                : const [Color(0xFFDDF5DB), Color(0xFFF4FAF8), Color(0xFFFFFFFF)],
            stops: const [0, 0.55, 1],
          ),
        ),
        child: AnimatedBuilder(
          animation: _clock,
          builder: (context, _) {
            final t = still ? 0.0 : _clock.value * 120;
            for (final n in nodes) {
              n.at = n.home +
                  (still
                      ? Offset.zero
                      : Offset(math.sin(t * 0.45 + n.phase * 2) * 1.5, math.sin(t * 0.9 + n.phase) * 5));
            }
            return Stack(clipBehavior: Clip.none, children: [
              Positioned.fill(
                child: CustomPaint(painter: _HubPainter(nodes: nodes, centre: centre, t: t, still: still, radius: w * 0.17)),
              ),
              Positioned(
                left: centre.dx - w * 0.17,
                top: centre.dy - w * 0.17,
                width: w * 0.34,
                height: w * 0.34,
                child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  FittedBox(
                    child: Text(widget.centreValue,
                        style: AppText.number(size: 38, weight: FontWeight.w900, color: AppPalette.ink)),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    child: Text(widget.centreLabel,
                        textAlign: TextAlign.center,
                        maxLines: 2,
                        style: const TextStyle(
                            fontSize: 11, height: 1.15, fontWeight: FontWeight.w700, color: AppPalette.ink)),
                  ),
                ]),
              ),
              for (final n in nodes)
                Positioned(
                  left: n.at.dx - 48,
                  top: n.at.dy - 34,
                  width: 96,
                  child: _StoreChip(store: n.store),
                ),
            ]);
          },
        ),
      );
    });
  }
}

class _Node {
  _Node({required this.store, required this.home, required this.weight, required this.phase}) : at = home;
  final HubStore store;
  final Offset home;
  final double weight;
  final double phase;
  Offset at;
}

class _StoreChip extends StatelessWidget {
  const _StoreChip({required this.store});
  final HubStore store;

  @override
  Widget build(BuildContext context) {
    final share = store.share;
    return Container(
      padding: const EdgeInsets.fromLTRB(8, 8, 8, 7),
      decoration: BoxDecoration(
        color: AppPalette.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: store.healthy ? AppPalette.border : AppPalette.destructive),
      ),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        PlatformLogo(platformId: store.platform, size: 18),
        const SizedBox(height: 5),
        Text(store.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700)),
        Text(share == null ? platformFor(store.platform).name : '${(share * 100).round()}%',
            style: TextStyle(fontSize: 10.5, color: AppPalette.mutedForeground, fontWeight: FontWeight.w600)),
      ]),
    );
  }
}

class _HubPainter extends CustomPainter {
  _HubPainter({required this.nodes, required this.centre, required this.t, required this.still, required this.radius});
  final List<_Node> nodes;
  final Offset centre;
  final double t;
  final bool still;
  final double radius;

  @override
  void paint(Canvas canvas, Size size) {
    const green = AppPalette.green;
    final ring = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2
      ..color = green.withValues(alpha: 0.14);
    canvas.drawCircle(centre, radius * 1.65, ring);
    canvas.drawCircle(centre, radius * 2.55, ring..color = green.withValues(alpha: 0.08));

    final pulse = Paint()..color = AppPalette.isDark ? const Color(0xFFC7FF46) : AppPalette.teal;
    for (final n in nodes) {
      // Bend each line a little, always the same way round, so they read as a flow.
      final mid = Offset(
        (n.at.dx + centre.dx) / 2 - (n.at.dy - centre.dy) * 0.16,
        (n.at.dy + centre.dy) / 2 + (n.at.dx - centre.dx) * 0.16,
      );
      final path = Path()
        ..moveTo(n.at.dx, n.at.dy)
        ..quadraticBezierTo(mid.dx, mid.dy, centre.dx, centre.dy);
      canvas.drawPath(
        path,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round
          ..strokeWidth = 2 + n.weight * 5
          ..color = green.withValues(alpha: 0.55),
      );
      if (still) continue;
      final dur = 5 - n.weight * 2.8;
      for (var k = 0; k < (n.weight > 0.6 ? 2 : 1); k++) {
        final u = (t / dur + k * 0.5 + n.phase) % 1;
        final v = 1 - u;
        canvas.drawCircle(
          Offset(v * v * n.at.dx + 2 * v * u * mid.dx + u * u * centre.dx,
              v * v * n.at.dy + 2 * v * u * mid.dy + u * u * centre.dy),
          2.6 + n.weight * 1.2,
          pulse,
        );
      }
    }

    final breath = still ? 0.0 : math.sin(t * 2.6);
    canvas.drawCircle(centre, radius * (1.24 + breath * 0.08), Paint()..color = green.withValues(alpha: 0.16));
    canvas.drawCircle(centre, radius, Paint()..color = green);
  }

  @override
  bool shouldRepaint(_HubPainter old) => old.t != t || old.nodes != nodes;
}

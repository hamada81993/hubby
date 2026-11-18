import 'package:flutter/material.dart';

/// Brand palette + design tokens for the Hubby app.
///
/// The Hubby identity pairs a deep-teal anchor with a vivid brand green, over a
/// clean neutral system (soft grays, elevation, spacing, radii) tuned for a
/// world-class, multinational commerce-SaaS feel.
class AppPalette {
  /// Which surface set is live. Set by the theme cubit before the app builds;
  /// the colours below read it, so they are getters rather than constants.
  static bool isDark = true;

  // ── Brand ──────────────────────────────────────────────────────────────
  static const teal = Color(0xFF0B5A5C); // deep teal
  static const green = Color(0xFF4FD34A); // brand green
  static const ink = Color(0xFF06312F); // the only text colour that sits on green

  /// Filled buttons, in both themes: green with [onAction] text (white on green is 2:1).
  static const action = green;
  static const onAction = ink;

  /// Links, selection and active states: green on dark, deep teal on light.
  static Color get primary => isDark ? green : teal;
  static Color get onPrimary => isDark ? ink : const Color(0xFFFFFFFF);
  static Color get primaryHover => isDark ? const Color(0xFF3DBB39) : const Color(0xFF083F41);
  static Color get primarySoft => isDark ? const Color(0x244FD34A) : const Color(0x140B5A5C);
  static const secondary = green; // accents/highlights
  static const secondarySoft = Color(0x144FD34A);
  static Color get destructive => isDark ? const Color(0xFFFF8A8A) : const Color(0xFFB42323);
  static const destructiveSoft = Color(0x1FF24B4B);
  static Color get warning => isDark ? const Color(0xFFF9C566) : const Color(0xFF8A5A00);
  static const warningSoft = Color(0x1FF6A623);
  static Color get success => isDark ? const Color(0xFF5FE39A) : const Color(0xFF0F7A40);
  static const info = Color(0xFF22D3EE); // AI cyan

  // ── Surfaces ───────────────────────────────────────────────────────────
  static Color get background => isDark ? const Color(0xFF041817) : const Color(0xFFF3F7F6);
  static Color get card => isDark ? const Color(0xFF0A2625) : const Color(0xFFFFFFFF);
  static Color get surfaceAlt => isDark ? const Color(0xFF14403D) : const Color(0xFFE1E9E8);
  static Color get foreground => isDark ? const Color(0xFFF1F7F6) : const Color(0xFF183238);
  static Color get foregroundSoft => isDark ? const Color(0xFFB9D3D0) : const Color(0xFF344A50);
  static Color get mutedForeground => isDark ? const Color(0xFF93B4B1) : const Color(0xFF60727A);
  static Color get border => isDark ? const Color(0xFF1C4F4B) : const Color(0xFFC7D5DA);
  static Color get borderStrong => isDark ? const Color(0xFF28635E) : const Color(0xFFB4C6CC);
  static Color get accent => isDark ? const Color(0xFF0F3331) : const Color(0xFFE1E9E8);

  // ── Elevation ──────────────────────────────────────────────────────────
  /// Soft, layered card shadow on light; dark surfaces separate by colour instead.
  static List<BoxShadow> get shadowCard => isDark
      ? const []
      : const [
          BoxShadow(color: Color(0x0A1E293B), blurRadius: 2, offset: Offset(0, 1)),
          BoxShadow(color: Color(0x0F1E293B), blurRadius: 16, offset: Offset(0, 8), spreadRadius: -6),
        ];

  /// Stronger lift for sheets, popovers and floating bars.
  static List<BoxShadow> get shadowRaised => isDark
      ? const [BoxShadow(color: Color(0x66000000), blurRadius: 28, offset: Offset(0, 14), spreadRadius: -8)]
      : const [BoxShadow(color: Color(0x141E293B), blurRadius: 28, offset: Offset(0, 14), spreadRadius: -8)];

  /// Coloured glow used under primary CTAs / hero stats.
  static List<BoxShadow> get shadowPrimary => isDark
      ? const []
      : const [BoxShadow(color: Color(0x330B5A5C), blurRadius: 20, offset: Offset(0, 10), spreadRadius: -6)];

  // ── Spacing (4 / 8 rhythm) ─────────────────────────────────────────────
  static const double s4 = 4, s8 = 8, s12 = 12, s16 = 16, s20 = 20, s24 = 24, s32 = 32;

  // ── Radii ──────────────────────────────────────────────────────────────
  static const double rSm = 10, rMd = 14, rLg = 18, rXl = 24, rPill = 999;

  /// Brand colour for each connected platform (matches web platform metadata).
  static const Map<String, Color> platform = {
    'shopify': Color(0xFF22C55E),
    'salla': Color(0xFF00C7B1),
    'amazon': Color(0xFFF59E0B),
    'noon': Color(0xFFEAB308),
    'woocommerce': Color(0xFF9333EA),
    'zid': Color(0xFFF97316),
    'trendyol': Color(0xFFF27A1A),
  };
}

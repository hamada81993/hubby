import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../../core/theme/app_palette.dart';

/// The Hubby wordmark, drawn from the brand SVG: the teal-and-green one on
/// light, the white-and-green one on dark.
/// [size] drives the height; width follows the artwork's aspect ratio.
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.size = 40});
  final double size;

  @override
  Widget build(BuildContext context) {
    return SvgPicture.asset(
      AppPalette.isDark ? 'assets/brand/logo-dark.svg' : 'assets/brand/logo.svg',
      height: size,
      fit: BoxFit.contain,
      semanticsLabel: 'Hubby',
    );
  }
}

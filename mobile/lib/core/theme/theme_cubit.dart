import 'package:flutter_bloc/flutter_bloc.dart';
import '../storage/session_store.dart';
import 'app_palette.dart';

/// Holds the dark/light choice and persists it. The state is `true` for dark.
/// [AppPalette.isDark] is kept in step so every colour getter follows.
class ThemeCubit extends Cubit<bool> {
  ThemeCubit(this._session) : super(true);

  final SessionStore _session;

  Future<void> load() async {
    final dark = await _session.darkTheme;
    AppPalette.isDark = dark;
    emit(dark);
  }

  Future<void> toggle() async {
    final next = !state;
    AppPalette.isDark = next;
    await _session.setDarkTheme(next);
    emit(next);
  }
}

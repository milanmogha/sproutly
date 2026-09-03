import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'core/network/auth_api.dart';
import 'core/network/dio_client.dart';
import 'core/network/parent_api.dart';
import 'core/network/socket_service.dart';
import 'core/network/token_storage.dart';
import 'core/theme/app_theme.dart';
import 'features/shared/role_hub_screen.dart';
import 'features/shared/splash_overlay.dart';

final GlobalKey<NavigatorState> appNavigatorKey = GlobalKey<NavigatorState>();
final GlobalKey<ScaffoldMessengerState> appMessengerKey =
    GlobalKey<ScaffoldMessengerState>();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Prime any persisted JWT so the Dio client can attach it synchronously.
  await TokenStorage.instance.load();
  // A session lasts until the user logs out, so a returning user goes straight
  // back to their portal instead of through the login screen again.
  final resumed = await AuthApi.instance.restoreSession();
  _wireSessionExpiry();
  SystemChrome.setPreferredOrientations(const [
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  runApp(SproutlyApp(resumedRole: resumed?.uiRole));
}

/// The one way a signed-in user is sent back to the hub without asking: the
/// backend rejected the refresh token (session revoked, account deactivated).
void _wireSessionExpiry() {
  DioClient.instance.onSessionExpired = () {
    SocketService.instance.disconnect();
    ParentApi.instance.reset();
    appNavigatorKey.currentState?.popUntil((r) => r.isFirst);
    appMessengerKey.currentState?.showSnackBar(
      const SnackBar(
        content: Text('Your session ended. Please sign in again.'),
      ),
    );
  };
}

/// Launches into the role hub — or straight into a resumed session's portal.
/// Tap a role to open its interface. Logout from any role returns to this hub.
///
/// The splash animation plays *over* the app rather than as a route of its own,
/// so the first screen loads behind it and is ready the moment it fades — and
/// the route stack stays clean, which is what lets logout pop back to the hub.
class SproutlyApp extends StatefulWidget {
  const SproutlyApp({super.key, this.resumedRole});

  /// The portal to reopen for an already-signed-in user; null when signed out.
  final UserRole? resumedRole;

  @override
  State<SproutlyApp> createState() => _SproutlyAppState();
}

class _SproutlyAppState extends State<SproutlyApp> {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Sproutly',
      debugShowCheckedModeBanner: false,
      navigatorKey: appNavigatorKey,
      scaffoldMessengerKey: appMessengerKey,
      theme: buildAppTheme(),
      // The splash rides above the navigator via the builder, so it plays over
      // the app without becoming a route — see SplashOverlay.
      builder: (context, child) =>
          SplashOverlay(child: child ?? const SizedBox.shrink()),
      home: RoleHubScreen(resumedRole: widget.resumedRole),
    );
  }
}

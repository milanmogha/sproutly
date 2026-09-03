import 'package:flutter/material.dart';
import 'app_services.dart';

/// Inherited holder for the app's service bundle. Mirrors the [RoleColors]
/// pattern: insert once near the root of [HomeShell] and descendants call
/// [ServicesScopeX.services] to get a typed reference.
class ServicesScope extends InheritedWidget {
  const ServicesScope({
    super.key,
    required this.services,
    required super.child,
  });

  final AppServices services;

  /// The bundle of the currently mounted [HomeShell]. Fallback for screens
  /// pushed as Navigator routes, which build above the shell's subtree and
  /// therefore can't see the InheritedWidget.
  static AppServices? current;

  @override
  bool updateShouldNotify(ServicesScope oldWidget) =>
      services != oldWidget.services;

  static AppServices of(BuildContext context) {
    final scope =
        context.dependOnInheritedWidgetOfExactType<ServicesScope>();
    final services = scope?.services ?? current;
    assert(
      services != null,
      'ServicesScope.of() called with no ServicesScope ancestor and no '
      'HomeShell mounted.',
    );
    return services!;
  }
}

extension ServicesScopeX on BuildContext {
  AppServices get services => ServicesScope.of(this);
}

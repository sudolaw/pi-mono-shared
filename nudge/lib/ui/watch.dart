import 'package:flutter/widgets.dart';

/// A [StreamBuilder] for database queries that opens its query once, not on
/// every rebuild. The query is re-opened only when [keyValue] changes (e.g. the
/// day being shown).
class Watch<T> extends StatefulWidget {
  const Watch({super.key, required this.query, this.keyValue, required this.builder});

  final Stream<T> Function() query;
  final Object? keyValue;
  final AsyncWidgetBuilder<T> builder;

  @override
  State<Watch<T>> createState() => _WatchState<T>();
}

class _WatchState<T> extends State<Watch<T>> {
  late Stream<T> _stream = widget.query();

  @override
  void didUpdateWidget(Watch<T> old) {
    super.didUpdateWidget(old);
    if (old.keyValue != widget.keyValue) _stream = widget.query();
  }

  @override
  Widget build(BuildContext context) => StreamBuilder<T>(stream: _stream, builder: widget.builder);
}

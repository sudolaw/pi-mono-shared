import 'package:drift/drift.dart' show Value;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/geo.dart';
import '../data/db.dart';
import '../services/app_services.dart';
import 'fields.dart';
import 'format.dart';
import 'permissions.dart';

/// Switches an alarm on or off, asking for permissions first when switching on.
Future<void> setLocationAlarmEnabled(BuildContext context, int id, bool on) async {
  if (on) {
    if (!await ensureLocationPermission(context)) return;
    await ensureNotificationPermission();
    await ensureBatteryExemption();
  }
  await services.setLocationAlarmEnabled(id, on);
}

class LocationAlarmEditor extends StatefulWidget {
  const LocationAlarmEditor({super.key, this.existing});

  final LocationAlarm? existing;

  @override
  State<LocationAlarmEditor> createState() => _LocationAlarmEditorState();
}

class _LocationAlarmEditorState extends State<LocationAlarmEditor> with EditorGuard {
  late final _name = TextEditingController(text: widget.existing?.name ?? '');
  late final _coords = TextEditingController(
    text: widget.existing == null ? '' : '${widget.existing!.lat}, ${widget.existing!.lng}',
  );
  late double _radius = (widget.existing?.radiusMeters ?? 150).toDouble();
  late int _rearm = widget.existing?.rearmMeters ?? defaultRearmMeters;

  static const _rearmChoices = [100, 1000, 10000, 100000];

  LatLng? get _parsed => parseCoordinates(_coords.text);

  @override
  void dispose() {
    _name.dispose();
    _coords.dispose();
    super.dispose();
  }

  Future<void> _paste() async {
    final data = await Clipboard.getData(Clipboard.kTextPlain);
    if (data?.text != null) setState(() => _coords.text = data!.text!.trim());
  }

  Future<void> _save() async {
    if (!validateForSave()) return;
    final at = _parsed!;
    final data = LocationAlarmsCompanion(
      name: Value(_name.text.trim()),
      lat: Value(at.lat),
      lng: Value(at.lng),
      radiusMeters: Value(_radius.round()),
      rearmMeters: Value(_rearm),
      // A moved or resized zone starts fresh: the next reading decides the side.
      inside: const Value(null),
    );
    final id = await services.saveLocationAlarm(data, id: widget.existing?.id);
    if (!mounted) return;
    // New alarms start switched on (after the permission checks).
    final turnOn = widget.existing?.enabled ?? true;
    if (turnOn) await setLocationAlarmEnabled(context, id, true);
    if (mounted) Navigator.pop(context);
  }

  Future<void> _delete() async {
    if (!await confirm(context, 'Delete "${widget.existing!.name}"?', 'Delete')) return;
    await services.deleteLocationAlarm(widget.existing!.id);
    if (mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final parsed = _parsed;
    return guardUnsaved(
      child: Scaffold(
        appBar: AppBar(
          title: Text(widget.existing == null ? 'New location alarm' : 'Edit location alarm'),
          actions: [
            if (widget.existing != null)
              IconButton(icon: const Icon(Icons.delete_outline), onPressed: _delete),
            TextButton(onPressed: _save, child: const Text('Save')),
          ],
        ),
        body: editorForm(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              TextFormField(
                controller: _name,
                autofocus: widget.existing == null,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(labelText: 'Name', hintText: 'My bus stop'),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Give it a name' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _coords,
                decoration: InputDecoration(
                  labelText: 'Coordinates',
                  hintText: '19.0760, 72.8777',
                  helperText: parsed == null
                      ? 'Paste from Google Maps (long-press a spot, copy from the search bar)'
                      : 'Latitude ${parsed.lat.toStringAsFixed(6)}, longitude ${parsed.lng.toStringAsFixed(6)}',
                  suffixIcon: IconButton(
                    tooltip: 'Paste',
                    icon: const Icon(Icons.content_paste),
                    onPressed: _paste,
                  ),
                ),
                onChanged: (_) => setState(() {}),
                validator: (_) => _parsed == null ? 'Could not read coordinates' : null,
              ),
              const SizedBox(height: 24),
              Text(
                'Ring within ${_radius.round()} m',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              Slider(
                value: _radius,
                min: 50,
                max: 2000,
                divisions: 39,
                label: '${_radius.round()} m',
                onChanged: (v) => setState(() => _radius = v),
              ),
              Text(
                '100 m works; 150 m is safer so you don\'t miss a stop. Use more for fast trains.',
                style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
              ),
              const SizedBox(height: 24),
              Text(
                'Rings again after you\'ve been away',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: [
                  for (final m in {..._rearmChoices, _rearm}.toList()..sort())
                    ChoiceChip(
                      label: Text(formatDistance(m)),
                      selected: m == _rearm,
                      onSelected: (_) => setState(() => _rearm = m),
                    ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                'After you stop it, it stays quiet until you have been at least this far '
                'past the radius, then rings when you arrive again.',
                style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

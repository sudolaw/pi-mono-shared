import 'dart:convert';

import 'package:drift/drift.dart';

import 'db.dart';

/// Version of the backup file layout. Bump it (and convert older files in
/// [importBackup]) when a table gains a column without a default in the file.
const backupFormat = 1;

/// Dates are written as readable ISO strings rather than milliseconds.
const _serializer = ValueSerializer.defaults(serializeDateTimeValuesAsString: true);

/// A backup file was unreadable or not from Nudge. [message] is shown to the user.
class BackupException implements Exception {
  BackupException(this.message);

  final String message;

  @override
  String toString() => message;
}

/// What an import restored.
typedef BackupCounts = ({int routines, int promises, int goals, int alarms});

/// The whole database as pretty-printed JSON.
Future<String> exportBackup(AppDb db, DateTime now) async {
  List<Map<String, dynamic>> rows<T extends DataClass>(List<T> data) => [
    for (final row in data) row.toJson(serializer: _serializer),
  ];
  final data = {
    'app': 'nudge',
    'format': backupFormat,
    'schema': db.schemaVersion,
    'exportedAt': now.toIso8601String(),
    'goals': rows(await db.select(db.goals).get()),
    'promises': rows(await db.select(db.promises).get()),
    'routines': rows(await db.select(db.routines).get()),
    'occurrences': rows(await db.select(db.occurrences).get()),
    'locationAlarms': rows(await db.select(db.locationAlarms).get()),
  };
  return const JsonEncoder.withIndent('  ').convert(data);
}

/// Replaces everything in the database with a backup made by [exportBackup].
///
/// The whole file is parsed before anything is touched, and the replace runs in
/// one transaction, so a bad file leaves the current data exactly as it was.
Future<BackupCounts> importBackup(AppDb db, String json) async {
  final Object? decoded;
  try {
    decoded = jsonDecode(json);
  } on FormatException {
    throw BackupException('That file isn\'t a Nudge backup (it isn\'t valid JSON).');
  }
  if (decoded is! Map || decoded['app'] != 'nudge') {
    throw BackupException('That file isn\'t a Nudge backup.');
  }
  final Map<Object?, Object?> root = decoded;
  final format = root['format'];
  if (format is! int || format > backupFormat) {
    throw BackupException('This backup was made by a newer Nudge. Update the app first.');
  }

  // Backups from before schema 6 hold the evening review, which no longer
  // exists; it and its occurrences are skipped. Routines are parsed before
  // occurrences, so its id is known by then.
  final dropped = <Object?>{};
  bool keep(String key, Map<String, dynamic> row) {
    if (key == 'routines' && row['systemKey'] == 'evening_review') {
      dropped.add(row['id']);
      return false;
    }
    return key != 'occurrences' || !dropped.contains(row['routineId']);
  }

  List<T> parse<T>(String key, T Function(Map<String, dynamic>, {ValueSerializer? serializer}) f) {
    final list = root[key];
    if (list is! List) throw BackupException('The backup is missing its "$key".');
    try {
      return [
        for (final row in list.map((r) => (r as Map).cast<String, dynamic>()))
          if (keep(key, row)) f(row, serializer: _serializer),
      ];
    } catch (_) {
      throw BackupException('The backup\'s "$key" are damaged.');
    }
  }

  final goals = parse('goals', Goal.fromJson);
  final promises = parse('promises', PromiseEntry.fromJson);
  final routines = parse('routines', Routine.fromJson);
  final occurrences = parse('occurrences', Occurrence.fromJson);
  final alarms = parse('locationAlarms', LocationAlarm.fromJson);

  await db.transaction(() async {
    // Children first; foreign keys are on.
    await db.delete(db.promises).go();
    await db.delete(db.occurrences).go();
    await db.delete(db.goals).go();
    await db.delete(db.routines).go();
    await db.delete(db.locationAlarms).go();
    await db.batch((b) {
      b.insertAll(db.goals, goals);
      b.insertAll(db.promises, promises);
      b.insertAll(db.routines, routines);
      b.insertAll(db.occurrences, occurrences);
      // Nothing rings on restore, and each alarm learns its side afresh.
      b.insertAll(db.locationAlarms, [
        for (final a in alarms) a.copyWith(ringing: false, inside: const Value(null)),
      ]);
    });
  });
  return (
    routines: routines.where((r) => r.systemKey == null).length,
    promises: promises.length,
    goals: goals.length,
    alarms: alarms.length,
  );
}

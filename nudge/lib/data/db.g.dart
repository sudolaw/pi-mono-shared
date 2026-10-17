// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'db.dart';

// ignore_for_file: type=lint
class $LocationAlarmsTable extends LocationAlarms
    with TableInfo<$LocationAlarmsTable, LocationAlarm> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $LocationAlarmsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
    'id',
    aliasedName,
    false,
    hasAutoIncrement: true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways('PRIMARY KEY AUTOINCREMENT'),
  );
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
    'name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _latMeta = const VerificationMeta('lat');
  @override
  late final GeneratedColumn<double> lat = GeneratedColumn<double>(
    'lat',
    aliasedName,
    false,
    type: DriftSqlType.double,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _lngMeta = const VerificationMeta('lng');
  @override
  late final GeneratedColumn<double> lng = GeneratedColumn<double>(
    'lng',
    aliasedName,
    false,
    type: DriftSqlType.double,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _radiusMetersMeta = const VerificationMeta('radiusMeters');
  @override
  late final GeneratedColumn<int> radiusMeters = GeneratedColumn<int>(
    'radius_meters',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(150),
  );
  static const VerificationMeta _enabledMeta = const VerificationMeta('enabled');
  @override
  late final GeneratedColumn<bool> enabled = GeneratedColumn<bool>(
    'enabled',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways('CHECK ("enabled" IN (0, 1))'),
    defaultValue: const Constant(true),
  );
  static const VerificationMeta _lastTriggeredAtMeta = const VerificationMeta('lastTriggeredAt');
  @override
  late final GeneratedColumn<DateTime> lastTriggeredAt = GeneratedColumn<DateTime>(
    'last_triggered_at',
    aliasedName,
    true,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _ringingMeta = const VerificationMeta('ringing');
  @override
  late final GeneratedColumn<bool> ringing = GeneratedColumn<bool>(
    'ringing',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways('CHECK ("ringing" IN (0, 1))'),
    defaultValue: const Constant(false),
  );
  static const VerificationMeta _insideMeta = const VerificationMeta('inside');
  @override
  late final GeneratedColumn<bool> inside = GeneratedColumn<bool>(
    'inside',
    aliasedName,
    true,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways('CHECK ("inside" IN (0, 1))'),
  );
  static const VerificationMeta _rearmMetersMeta = const VerificationMeta('rearmMeters');
  @override
  late final GeneratedColumn<int> rearmMeters = GeneratedColumn<int>(
    'rearm_meters',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(defaultRearmMeters),
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    name,
    lat,
    lng,
    radiusMeters,
    enabled,
    lastTriggeredAt,
    ringing,
    inside,
    rearmMeters,
    createdAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'location_alarms';
  @override
  VerificationContext validateIntegrity(
    Insertable<LocationAlarm> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('name')) {
      context.handle(_nameMeta, name.isAcceptableOrUnknown(data['name']!, _nameMeta));
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    if (data.containsKey('lat')) {
      context.handle(_latMeta, lat.isAcceptableOrUnknown(data['lat']!, _latMeta));
    } else if (isInserting) {
      context.missing(_latMeta);
    }
    if (data.containsKey('lng')) {
      context.handle(_lngMeta, lng.isAcceptableOrUnknown(data['lng']!, _lngMeta));
    } else if (isInserting) {
      context.missing(_lngMeta);
    }
    if (data.containsKey('radius_meters')) {
      context.handle(
        _radiusMetersMeta,
        radiusMeters.isAcceptableOrUnknown(data['radius_meters']!, _radiusMetersMeta),
      );
    }
    if (data.containsKey('enabled')) {
      context.handle(_enabledMeta, enabled.isAcceptableOrUnknown(data['enabled']!, _enabledMeta));
    }
    if (data.containsKey('last_triggered_at')) {
      context.handle(
        _lastTriggeredAtMeta,
        lastTriggeredAt.isAcceptableOrUnknown(data['last_triggered_at']!, _lastTriggeredAtMeta),
      );
    }
    if (data.containsKey('ringing')) {
      context.handle(_ringingMeta, ringing.isAcceptableOrUnknown(data['ringing']!, _ringingMeta));
    }
    if (data.containsKey('inside')) {
      context.handle(_insideMeta, inside.isAcceptableOrUnknown(data['inside']!, _insideMeta));
    }
    if (data.containsKey('rearm_meters')) {
      context.handle(
        _rearmMetersMeta,
        rearmMeters.isAcceptableOrUnknown(data['rearm_meters']!, _rearmMetersMeta),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  LocationAlarm map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return LocationAlarm(
      id: attachedDatabase.typeMapping.read(DriftSqlType.int, data['${effectivePrefix}id'])!,
      name: attachedDatabase.typeMapping.read(DriftSqlType.string, data['${effectivePrefix}name'])!,
      lat: attachedDatabase.typeMapping.read(DriftSqlType.double, data['${effectivePrefix}lat'])!,
      lng: attachedDatabase.typeMapping.read(DriftSqlType.double, data['${effectivePrefix}lng'])!,
      radiusMeters: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}radius_meters'],
      )!,
      enabled: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}enabled'],
      )!,
      lastTriggeredAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}last_triggered_at'],
      ),
      ringing: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}ringing'],
      )!,
      inside: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}inside'],
      ),
      rearmMeters: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}rearm_meters'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
    );
  }

  @override
  $LocationAlarmsTable createAlias(String alias) {
    return $LocationAlarmsTable(attachedDatabase, alias);
  }
}

class LocationAlarm extends DataClass implements Insertable<LocationAlarm> {
  final int id;
  final String name;
  final double lat;
  final double lng;
  final int radiusMeters;
  final bool enabled;
  final DateTime? lastTriggeredAt;

  /// True from the moment it triggers until the user stops the alarm.
  final bool ringing;

  /// Last known side of the zone: inside, outside, or null (not known yet).
  /// The alarm rings on going from outside to inside.
  final bool? inside;

  /// How far past the radius you must go before it can ring again.
  final int rearmMeters;
  final DateTime createdAt;
  const LocationAlarm({
    required this.id,
    required this.name,
    required this.lat,
    required this.lng,
    required this.radiusMeters,
    required this.enabled,
    this.lastTriggeredAt,
    required this.ringing,
    this.inside,
    required this.rearmMeters,
    required this.createdAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['name'] = Variable<String>(name);
    map['lat'] = Variable<double>(lat);
    map['lng'] = Variable<double>(lng);
    map['radius_meters'] = Variable<int>(radiusMeters);
    map['enabled'] = Variable<bool>(enabled);
    if (!nullToAbsent || lastTriggeredAt != null) {
      map['last_triggered_at'] = Variable<DateTime>(lastTriggeredAt);
    }
    map['ringing'] = Variable<bool>(ringing);
    if (!nullToAbsent || inside != null) {
      map['inside'] = Variable<bool>(inside);
    }
    map['rearm_meters'] = Variable<int>(rearmMeters);
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  LocationAlarmsCompanion toCompanion(bool nullToAbsent) {
    return LocationAlarmsCompanion(
      id: Value(id),
      name: Value(name),
      lat: Value(lat),
      lng: Value(lng),
      radiusMeters: Value(radiusMeters),
      enabled: Value(enabled),
      lastTriggeredAt: lastTriggeredAt == null && nullToAbsent
          ? const Value.absent()
          : Value(lastTriggeredAt),
      ringing: Value(ringing),
      inside: inside == null && nullToAbsent ? const Value.absent() : Value(inside),
      rearmMeters: Value(rearmMeters),
      createdAt: Value(createdAt),
    );
  }

  factory LocationAlarm.fromJson(Map<String, dynamic> json, {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return LocationAlarm(
      id: serializer.fromJson<int>(json['id']),
      name: serializer.fromJson<String>(json['name']),
      lat: serializer.fromJson<double>(json['lat']),
      lng: serializer.fromJson<double>(json['lng']),
      radiusMeters: serializer.fromJson<int>(json['radiusMeters']),
      enabled: serializer.fromJson<bool>(json['enabled']),
      lastTriggeredAt: serializer.fromJson<DateTime?>(json['lastTriggeredAt']),
      ringing: serializer.fromJson<bool>(json['ringing']),
      inside: serializer.fromJson<bool?>(json['inside']),
      rearmMeters: serializer.fromJson<int>(json['rearmMeters']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'name': serializer.toJson<String>(name),
      'lat': serializer.toJson<double>(lat),
      'lng': serializer.toJson<double>(lng),
      'radiusMeters': serializer.toJson<int>(radiusMeters),
      'enabled': serializer.toJson<bool>(enabled),
      'lastTriggeredAt': serializer.toJson<DateTime?>(lastTriggeredAt),
      'ringing': serializer.toJson<bool>(ringing),
      'inside': serializer.toJson<bool?>(inside),
      'rearmMeters': serializer.toJson<int>(rearmMeters),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  LocationAlarm copyWith({
    int? id,
    String? name,
    double? lat,
    double? lng,
    int? radiusMeters,
    bool? enabled,
    Value<DateTime?> lastTriggeredAt = const Value.absent(),
    bool? ringing,
    Value<bool?> inside = const Value.absent(),
    int? rearmMeters,
    DateTime? createdAt,
  }) => LocationAlarm(
    id: id ?? this.id,
    name: name ?? this.name,
    lat: lat ?? this.lat,
    lng: lng ?? this.lng,
    radiusMeters: radiusMeters ?? this.radiusMeters,
    enabled: enabled ?? this.enabled,
    lastTriggeredAt: lastTriggeredAt.present ? lastTriggeredAt.value : this.lastTriggeredAt,
    ringing: ringing ?? this.ringing,
    inside: inside.present ? inside.value : this.inside,
    rearmMeters: rearmMeters ?? this.rearmMeters,
    createdAt: createdAt ?? this.createdAt,
  );
  LocationAlarm copyWithCompanion(LocationAlarmsCompanion data) {
    return LocationAlarm(
      id: data.id.present ? data.id.value : this.id,
      name: data.name.present ? data.name.value : this.name,
      lat: data.lat.present ? data.lat.value : this.lat,
      lng: data.lng.present ? data.lng.value : this.lng,
      radiusMeters: data.radiusMeters.present ? data.radiusMeters.value : this.radiusMeters,
      enabled: data.enabled.present ? data.enabled.value : this.enabled,
      lastTriggeredAt: data.lastTriggeredAt.present
          ? data.lastTriggeredAt.value
          : this.lastTriggeredAt,
      ringing: data.ringing.present ? data.ringing.value : this.ringing,
      inside: data.inside.present ? data.inside.value : this.inside,
      rearmMeters: data.rearmMeters.present ? data.rearmMeters.value : this.rearmMeters,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('LocationAlarm(')
          ..write('id: $id, ')
          ..write('name: $name, ')
          ..write('lat: $lat, ')
          ..write('lng: $lng, ')
          ..write('radiusMeters: $radiusMeters, ')
          ..write('enabled: $enabled, ')
          ..write('lastTriggeredAt: $lastTriggeredAt, ')
          ..write('ringing: $ringing, ')
          ..write('inside: $inside, ')
          ..write('rearmMeters: $rearmMeters, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    name,
    lat,
    lng,
    radiusMeters,
    enabled,
    lastTriggeredAt,
    ringing,
    inside,
    rearmMeters,
    createdAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is LocationAlarm &&
          other.id == this.id &&
          other.name == this.name &&
          other.lat == this.lat &&
          other.lng == this.lng &&
          other.radiusMeters == this.radiusMeters &&
          other.enabled == this.enabled &&
          other.lastTriggeredAt == this.lastTriggeredAt &&
          other.ringing == this.ringing &&
          other.inside == this.inside &&
          other.rearmMeters == this.rearmMeters &&
          other.createdAt == this.createdAt);
}

class LocationAlarmsCompanion extends UpdateCompanion<LocationAlarm> {
  final Value<int> id;
  final Value<String> name;
  final Value<double> lat;
  final Value<double> lng;
  final Value<int> radiusMeters;
  final Value<bool> enabled;
  final Value<DateTime?> lastTriggeredAt;
  final Value<bool> ringing;
  final Value<bool?> inside;
  final Value<int> rearmMeters;
  final Value<DateTime> createdAt;
  const LocationAlarmsCompanion({
    this.id = const Value.absent(),
    this.name = const Value.absent(),
    this.lat = const Value.absent(),
    this.lng = const Value.absent(),
    this.radiusMeters = const Value.absent(),
    this.enabled = const Value.absent(),
    this.lastTriggeredAt = const Value.absent(),
    this.ringing = const Value.absent(),
    this.inside = const Value.absent(),
    this.rearmMeters = const Value.absent(),
    this.createdAt = const Value.absent(),
  });
  LocationAlarmsCompanion.insert({
    this.id = const Value.absent(),
    required String name,
    required double lat,
    required double lng,
    this.radiusMeters = const Value.absent(),
    this.enabled = const Value.absent(),
    this.lastTriggeredAt = const Value.absent(),
    this.ringing = const Value.absent(),
    this.inside = const Value.absent(),
    this.rearmMeters = const Value.absent(),
    this.createdAt = const Value.absent(),
  }) : name = Value(name),
       lat = Value(lat),
       lng = Value(lng);
  static Insertable<LocationAlarm> custom({
    Expression<int>? id,
    Expression<String>? name,
    Expression<double>? lat,
    Expression<double>? lng,
    Expression<int>? radiusMeters,
    Expression<bool>? enabled,
    Expression<DateTime>? lastTriggeredAt,
    Expression<bool>? ringing,
    Expression<bool>? inside,
    Expression<int>? rearmMeters,
    Expression<DateTime>? createdAt,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (name != null) 'name': name,
      if (lat != null) 'lat': lat,
      if (lng != null) 'lng': lng,
      if (radiusMeters != null) 'radius_meters': radiusMeters,
      if (enabled != null) 'enabled': enabled,
      if (lastTriggeredAt != null) 'last_triggered_at': lastTriggeredAt,
      if (ringing != null) 'ringing': ringing,
      if (inside != null) 'inside': inside,
      if (rearmMeters != null) 'rearm_meters': rearmMeters,
      if (createdAt != null) 'created_at': createdAt,
    });
  }

  LocationAlarmsCompanion copyWith({
    Value<int>? id,
    Value<String>? name,
    Value<double>? lat,
    Value<double>? lng,
    Value<int>? radiusMeters,
    Value<bool>? enabled,
    Value<DateTime?>? lastTriggeredAt,
    Value<bool>? ringing,
    Value<bool?>? inside,
    Value<int>? rearmMeters,
    Value<DateTime>? createdAt,
  }) {
    return LocationAlarmsCompanion(
      id: id ?? this.id,
      name: name ?? this.name,
      lat: lat ?? this.lat,
      lng: lng ?? this.lng,
      radiusMeters: radiusMeters ?? this.radiusMeters,
      enabled: enabled ?? this.enabled,
      lastTriggeredAt: lastTriggeredAt ?? this.lastTriggeredAt,
      ringing: ringing ?? this.ringing,
      inside: inside ?? this.inside,
      rearmMeters: rearmMeters ?? this.rearmMeters,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (lat.present) {
      map['lat'] = Variable<double>(lat.value);
    }
    if (lng.present) {
      map['lng'] = Variable<double>(lng.value);
    }
    if (radiusMeters.present) {
      map['radius_meters'] = Variable<int>(radiusMeters.value);
    }
    if (enabled.present) {
      map['enabled'] = Variable<bool>(enabled.value);
    }
    if (lastTriggeredAt.present) {
      map['last_triggered_at'] = Variable<DateTime>(lastTriggeredAt.value);
    }
    if (ringing.present) {
      map['ringing'] = Variable<bool>(ringing.value);
    }
    if (inside.present) {
      map['inside'] = Variable<bool>(inside.value);
    }
    if (rearmMeters.present) {
      map['rearm_meters'] = Variable<int>(rearmMeters.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('LocationAlarmsCompanion(')
          ..write('id: $id, ')
          ..write('name: $name, ')
          ..write('lat: $lat, ')
          ..write('lng: $lng, ')
          ..write('radiusMeters: $radiusMeters, ')
          ..write('enabled: $enabled, ')
          ..write('lastTriggeredAt: $lastTriggeredAt, ')
          ..write('ringing: $ringing, ')
          ..write('inside: $inside, ')
          ..write('rearmMeters: $rearmMeters, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }
}

class $RoutinesTable extends Routines with TableInfo<$RoutinesTable, Routine> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $RoutinesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
    'id',
    aliasedName,
    false,
    hasAutoIncrement: true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways('PRIMARY KEY AUTOINCREMENT'),
  );
  static const VerificationMeta _titleMeta = const VerificationMeta('title');
  @override
  late final GeneratedColumn<String> title = GeneratedColumn<String>(
    'title',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _notesMeta = const VerificationMeta('notes');
  @override
  late final GeneratedColumn<String> notes = GeneratedColumn<String>(
    'notes',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant(''),
  );
  @override
  late final GeneratedColumnWithTypeConverter<RoutineKind, int> kind = GeneratedColumn<int>(
    'kind',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  ).withConverter<RoutineKind>($RoutinesTable.$converterkind);
  static const VerificationMeta _timeMinutesMeta = const VerificationMeta('timeMinutes');
  @override
  late final GeneratedColumn<int> timeMinutes = GeneratedColumn<int>(
    'time_minutes',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _untilMinutesMeta = const VerificationMeta('untilMinutes');
  @override
  late final GeneratedColumn<int> untilMinutes = GeneratedColumn<int>(
    'until_minutes',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _deadlineMinutesMeta = const VerificationMeta('deadlineMinutes');
  @override
  late final GeneratedColumn<int> deadlineMinutes = GeneratedColumn<int>(
    'deadline_minutes',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _recurrenceMeta = const VerificationMeta('recurrence');
  @override
  late final GeneratedColumn<String> recurrence = GeneratedColumn<String>(
    'recurrence',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _startAtMeta = const VerificationMeta('startAt');
  @override
  late final GeneratedColumn<DateTime> startAt = GeneratedColumn<DateTime>(
    'start_at',
    aliasedName,
    true,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _endAtMeta = const VerificationMeta('endAt');
  @override
  late final GeneratedColumn<DateTime> endAt = GeneratedColumn<DateTime>(
    'end_at',
    aliasedName,
    true,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _regenDaysMeta = const VerificationMeta('regenDays');
  @override
  late final GeneratedColumn<int> regenDays = GeneratedColumn<int>(
    'regen_days',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _nagEnabledMeta = const VerificationMeta('nagEnabled');
  @override
  late final GeneratedColumn<bool> nagEnabled = GeneratedColumn<bool>(
    'nag_enabled',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways('CHECK ("nag_enabled" IN (0, 1))'),
    defaultValue: const Constant(true),
  );
  static const VerificationMeta _firstIntervalMinutesMeta = const VerificationMeta(
    'firstIntervalMinutes',
  );
  @override
  late final GeneratedColumn<int> firstIntervalMinutes = GeneratedColumn<int>(
    'first_interval_minutes',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(10),
  );
  static const VerificationMeta _halfLifeMinutesMeta = const VerificationMeta('halfLifeMinutes');
  @override
  late final GeneratedColumn<int> halfLifeMinutes = GeneratedColumn<int>(
    'half_life_minutes',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _autoHalfLifeMeta = const VerificationMeta('autoHalfLife');
  @override
  late final GeneratedColumn<bool> autoHalfLife = GeneratedColumn<bool>(
    'auto_half_life',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways('CHECK ("auto_half_life" IN (0, 1))'),
    defaultValue: const Constant(false),
  );
  static const VerificationMeta _factorMeta = const VerificationMeta('factor');
  @override
  late final GeneratedColumn<double> factor = GeneratedColumn<double>(
    'factor',
    aliasedName,
    false,
    type: DriftSqlType.double,
    requiredDuringInsert: false,
    defaultValue: const Constant(2),
  );
  static const VerificationMeta _minIntervalMinutesMeta = const VerificationMeta(
    'minIntervalMinutes',
  );
  @override
  late final GeneratedColumn<int> minIntervalMinutes = GeneratedColumn<int>(
    'min_interval_minutes',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(15),
  );
  @override
  late final GeneratedColumnWithTypeConverter<AlertStyle, int> alertStyle = GeneratedColumn<int>(
    'alert_style',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: Constant(AlertStyle.notification.index),
  ).withConverter<AlertStyle>($RoutinesTable.$converteralertStyle);
  static const VerificationMeta _activeMeta = const VerificationMeta('active');
  @override
  late final GeneratedColumn<bool> active = GeneratedColumn<bool>(
    'active',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways('CHECK ("active" IN (0, 1))'),
    defaultValue: const Constant(true),
  );
  static const VerificationMeta _generatedThroughMeta = const VerificationMeta('generatedThrough');
  @override
  late final GeneratedColumn<DateTime> generatedThrough = GeneratedColumn<DateTime>(
    'generated_through',
    aliasedName,
    true,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _systemKeyMeta = const VerificationMeta('systemKey');
  @override
  late final GeneratedColumn<String> systemKey = GeneratedColumn<String>(
    'system_key',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways('UNIQUE'),
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    title,
    notes,
    kind,
    timeMinutes,
    untilMinutes,
    deadlineMinutes,
    recurrence,
    startAt,
    endAt,
    regenDays,
    nagEnabled,
    firstIntervalMinutes,
    halfLifeMinutes,
    autoHalfLife,
    factor,
    minIntervalMinutes,
    alertStyle,
    active,
    generatedThrough,
    systemKey,
    createdAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'routines';
  @override
  VerificationContext validateIntegrity(Insertable<Routine> instance, {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('title')) {
      context.handle(_titleMeta, title.isAcceptableOrUnknown(data['title']!, _titleMeta));
    } else if (isInserting) {
      context.missing(_titleMeta);
    }
    if (data.containsKey('notes')) {
      context.handle(_notesMeta, notes.isAcceptableOrUnknown(data['notes']!, _notesMeta));
    }
    if (data.containsKey('time_minutes')) {
      context.handle(
        _timeMinutesMeta,
        timeMinutes.isAcceptableOrUnknown(data['time_minutes']!, _timeMinutesMeta),
      );
    }
    if (data.containsKey('until_minutes')) {
      context.handle(
        _untilMinutesMeta,
        untilMinutes.isAcceptableOrUnknown(data['until_minutes']!, _untilMinutesMeta),
      );
    }
    if (data.containsKey('deadline_minutes')) {
      context.handle(
        _deadlineMinutesMeta,
        deadlineMinutes.isAcceptableOrUnknown(data['deadline_minutes']!, _deadlineMinutesMeta),
      );
    }
    if (data.containsKey('recurrence')) {
      context.handle(
        _recurrenceMeta,
        recurrence.isAcceptableOrUnknown(data['recurrence']!, _recurrenceMeta),
      );
    }
    if (data.containsKey('start_at')) {
      context.handle(_startAtMeta, startAt.isAcceptableOrUnknown(data['start_at']!, _startAtMeta));
    }
    if (data.containsKey('end_at')) {
      context.handle(_endAtMeta, endAt.isAcceptableOrUnknown(data['end_at']!, _endAtMeta));
    }
    if (data.containsKey('regen_days')) {
      context.handle(
        _regenDaysMeta,
        regenDays.isAcceptableOrUnknown(data['regen_days']!, _regenDaysMeta),
      );
    }
    if (data.containsKey('nag_enabled')) {
      context.handle(
        _nagEnabledMeta,
        nagEnabled.isAcceptableOrUnknown(data['nag_enabled']!, _nagEnabledMeta),
      );
    }
    if (data.containsKey('first_interval_minutes')) {
      context.handle(
        _firstIntervalMinutesMeta,
        firstIntervalMinutes.isAcceptableOrUnknown(
          data['first_interval_minutes']!,
          _firstIntervalMinutesMeta,
        ),
      );
    }
    if (data.containsKey('half_life_minutes')) {
      context.handle(
        _halfLifeMinutesMeta,
        halfLifeMinutes.isAcceptableOrUnknown(data['half_life_minutes']!, _halfLifeMinutesMeta),
      );
    }
    if (data.containsKey('auto_half_life')) {
      context.handle(
        _autoHalfLifeMeta,
        autoHalfLife.isAcceptableOrUnknown(data['auto_half_life']!, _autoHalfLifeMeta),
      );
    }
    if (data.containsKey('factor')) {
      context.handle(_factorMeta, factor.isAcceptableOrUnknown(data['factor']!, _factorMeta));
    }
    if (data.containsKey('min_interval_minutes')) {
      context.handle(
        _minIntervalMinutesMeta,
        minIntervalMinutes.isAcceptableOrUnknown(
          data['min_interval_minutes']!,
          _minIntervalMinutesMeta,
        ),
      );
    }
    if (data.containsKey('active')) {
      context.handle(_activeMeta, active.isAcceptableOrUnknown(data['active']!, _activeMeta));
    }
    if (data.containsKey('generated_through')) {
      context.handle(
        _generatedThroughMeta,
        generatedThrough.isAcceptableOrUnknown(data['generated_through']!, _generatedThroughMeta),
      );
    }
    if (data.containsKey('system_key')) {
      context.handle(
        _systemKeyMeta,
        systemKey.isAcceptableOrUnknown(data['system_key']!, _systemKeyMeta),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  Routine map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return Routine(
      id: attachedDatabase.typeMapping.read(DriftSqlType.int, data['${effectivePrefix}id'])!,
      title: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}title'],
      )!,
      notes: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}notes'],
      )!,
      kind: $RoutinesTable.$converterkind.fromSql(
        attachedDatabase.typeMapping.read(DriftSqlType.int, data['${effectivePrefix}kind'])!,
      ),
      timeMinutes: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}time_minutes'],
      ),
      untilMinutes: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}until_minutes'],
      ),
      deadlineMinutes: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}deadline_minutes'],
      ),
      recurrence: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}recurrence'],
      ),
      startAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}start_at'],
      ),
      endAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}end_at'],
      ),
      regenDays: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}regen_days'],
      ),
      nagEnabled: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}nag_enabled'],
      )!,
      firstIntervalMinutes: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}first_interval_minutes'],
      )!,
      halfLifeMinutes: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}half_life_minutes'],
      ),
      autoHalfLife: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}auto_half_life'],
      )!,
      factor: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}factor'],
      )!,
      minIntervalMinutes: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}min_interval_minutes'],
      )!,
      alertStyle: $RoutinesTable.$converteralertStyle.fromSql(
        attachedDatabase.typeMapping.read(DriftSqlType.int, data['${effectivePrefix}alert_style'])!,
      ),
      active: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}active'],
      )!,
      generatedThrough: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}generated_through'],
      ),
      systemKey: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}system_key'],
      ),
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
    );
  }

  @override
  $RoutinesTable createAlias(String alias) {
    return $RoutinesTable(attachedDatabase, alias);
  }

  static JsonTypeConverter2<RoutineKind, int, int> $converterkind =
      const EnumIndexConverter<RoutineKind>(RoutineKind.values);
  static JsonTypeConverter2<AlertStyle, int, int> $converteralertStyle =
      const EnumIndexConverter<AlertStyle>(AlertStyle.values);
}

class Routine extends DataClass implements Insertable<Routine> {
  final int id;
  final String title;
  final String notes;
  final RoutineKind kind;

  /// Daily/repeated/review: minutes after midnight it starts.
  final int? timeMinutes;

  /// Unused since schema 3 (replaced by [deadlineMinutes]).
  final int? untilMinutes;

  /// Daily/repeated/review: deadline as minutes after the start (may span
  /// days). Without one the occurrence runs to midnight and never nags.
  final int? deadlineMinutes;

  /// Daily/repeated: the encoded [Recurrence].
  final String? recurrence;

  /// To-do: when it starts and its optional deadline.
  final DateTime? startAt;
  final DateTime? endAt;

  /// To-do: comes back this many days after it is done (null: one-time).
  final int? regenDays;
  final bool nagEnabled;
  final int firstIntervalMinutes;

  /// Custom half-life; null with [autoHalfLife] off means a fixed interval.
  final int? halfLifeMinutes;
  final bool autoHalfLife;
  final double factor;
  final int minIntervalMinutes;
  final AlertStyle alertStyle;
  final bool active;

  /// Last day occurrences were created for (daily/repeated/review).
  final DateTime? generatedThrough;

  /// Set for built-in routines, see [SystemRoutine].
  final String? systemKey;
  final DateTime createdAt;
  const Routine({
    required this.id,
    required this.title,
    required this.notes,
    required this.kind,
    this.timeMinutes,
    this.untilMinutes,
    this.deadlineMinutes,
    this.recurrence,
    this.startAt,
    this.endAt,
    this.regenDays,
    required this.nagEnabled,
    required this.firstIntervalMinutes,
    this.halfLifeMinutes,
    required this.autoHalfLife,
    required this.factor,
    required this.minIntervalMinutes,
    required this.alertStyle,
    required this.active,
    this.generatedThrough,
    this.systemKey,
    required this.createdAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['title'] = Variable<String>(title);
    map['notes'] = Variable<String>(notes);
    {
      map['kind'] = Variable<int>($RoutinesTable.$converterkind.toSql(kind));
    }
    if (!nullToAbsent || timeMinutes != null) {
      map['time_minutes'] = Variable<int>(timeMinutes);
    }
    if (!nullToAbsent || untilMinutes != null) {
      map['until_minutes'] = Variable<int>(untilMinutes);
    }
    if (!nullToAbsent || deadlineMinutes != null) {
      map['deadline_minutes'] = Variable<int>(deadlineMinutes);
    }
    if (!nullToAbsent || recurrence != null) {
      map['recurrence'] = Variable<String>(recurrence);
    }
    if (!nullToAbsent || startAt != null) {
      map['start_at'] = Variable<DateTime>(startAt);
    }
    if (!nullToAbsent || endAt != null) {
      map['end_at'] = Variable<DateTime>(endAt);
    }
    if (!nullToAbsent || regenDays != null) {
      map['regen_days'] = Variable<int>(regenDays);
    }
    map['nag_enabled'] = Variable<bool>(nagEnabled);
    map['first_interval_minutes'] = Variable<int>(firstIntervalMinutes);
    if (!nullToAbsent || halfLifeMinutes != null) {
      map['half_life_minutes'] = Variable<int>(halfLifeMinutes);
    }
    map['auto_half_life'] = Variable<bool>(autoHalfLife);
    map['factor'] = Variable<double>(factor);
    map['min_interval_minutes'] = Variable<int>(minIntervalMinutes);
    {
      map['alert_style'] = Variable<int>($RoutinesTable.$converteralertStyle.toSql(alertStyle));
    }
    map['active'] = Variable<bool>(active);
    if (!nullToAbsent || generatedThrough != null) {
      map['generated_through'] = Variable<DateTime>(generatedThrough);
    }
    if (!nullToAbsent || systemKey != null) {
      map['system_key'] = Variable<String>(systemKey);
    }
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  RoutinesCompanion toCompanion(bool nullToAbsent) {
    return RoutinesCompanion(
      id: Value(id),
      title: Value(title),
      notes: Value(notes),
      kind: Value(kind),
      timeMinutes: timeMinutes == null && nullToAbsent ? const Value.absent() : Value(timeMinutes),
      untilMinutes: untilMinutes == null && nullToAbsent
          ? const Value.absent()
          : Value(untilMinutes),
      deadlineMinutes: deadlineMinutes == null && nullToAbsent
          ? const Value.absent()
          : Value(deadlineMinutes),
      recurrence: recurrence == null && nullToAbsent ? const Value.absent() : Value(recurrence),
      startAt: startAt == null && nullToAbsent ? const Value.absent() : Value(startAt),
      endAt: endAt == null && nullToAbsent ? const Value.absent() : Value(endAt),
      regenDays: regenDays == null && nullToAbsent ? const Value.absent() : Value(regenDays),
      nagEnabled: Value(nagEnabled),
      firstIntervalMinutes: Value(firstIntervalMinutes),
      halfLifeMinutes: halfLifeMinutes == null && nullToAbsent
          ? const Value.absent()
          : Value(halfLifeMinutes),
      autoHalfLife: Value(autoHalfLife),
      factor: Value(factor),
      minIntervalMinutes: Value(minIntervalMinutes),
      alertStyle: Value(alertStyle),
      active: Value(active),
      generatedThrough: generatedThrough == null && nullToAbsent
          ? const Value.absent()
          : Value(generatedThrough),
      systemKey: systemKey == null && nullToAbsent ? const Value.absent() : Value(systemKey),
      createdAt: Value(createdAt),
    );
  }

  factory Routine.fromJson(Map<String, dynamic> json, {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return Routine(
      id: serializer.fromJson<int>(json['id']),
      title: serializer.fromJson<String>(json['title']),
      notes: serializer.fromJson<String>(json['notes']),
      kind: $RoutinesTable.$converterkind.fromJson(serializer.fromJson<int>(json['kind'])),
      timeMinutes: serializer.fromJson<int?>(json['timeMinutes']),
      untilMinutes: serializer.fromJson<int?>(json['untilMinutes']),
      deadlineMinutes: serializer.fromJson<int?>(json['deadlineMinutes']),
      recurrence: serializer.fromJson<String?>(json['recurrence']),
      startAt: serializer.fromJson<DateTime?>(json['startAt']),
      endAt: serializer.fromJson<DateTime?>(json['endAt']),
      regenDays: serializer.fromJson<int?>(json['regenDays']),
      nagEnabled: serializer.fromJson<bool>(json['nagEnabled']),
      firstIntervalMinutes: serializer.fromJson<int>(json['firstIntervalMinutes']),
      halfLifeMinutes: serializer.fromJson<int?>(json['halfLifeMinutes']),
      autoHalfLife: serializer.fromJson<bool>(json['autoHalfLife']),
      factor: serializer.fromJson<double>(json['factor']),
      minIntervalMinutes: serializer.fromJson<int>(json['minIntervalMinutes']),
      alertStyle: $RoutinesTable.$converteralertStyle.fromJson(
        serializer.fromJson<int>(json['alertStyle']),
      ),
      active: serializer.fromJson<bool>(json['active']),
      generatedThrough: serializer.fromJson<DateTime?>(json['generatedThrough']),
      systemKey: serializer.fromJson<String?>(json['systemKey']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'title': serializer.toJson<String>(title),
      'notes': serializer.toJson<String>(notes),
      'kind': serializer.toJson<int>($RoutinesTable.$converterkind.toJson(kind)),
      'timeMinutes': serializer.toJson<int?>(timeMinutes),
      'untilMinutes': serializer.toJson<int?>(untilMinutes),
      'deadlineMinutes': serializer.toJson<int?>(deadlineMinutes),
      'recurrence': serializer.toJson<String?>(recurrence),
      'startAt': serializer.toJson<DateTime?>(startAt),
      'endAt': serializer.toJson<DateTime?>(endAt),
      'regenDays': serializer.toJson<int?>(regenDays),
      'nagEnabled': serializer.toJson<bool>(nagEnabled),
      'firstIntervalMinutes': serializer.toJson<int>(firstIntervalMinutes),
      'halfLifeMinutes': serializer.toJson<int?>(halfLifeMinutes),
      'autoHalfLife': serializer.toJson<bool>(autoHalfLife),
      'factor': serializer.toJson<double>(factor),
      'minIntervalMinutes': serializer.toJson<int>(minIntervalMinutes),
      'alertStyle': serializer.toJson<int>($RoutinesTable.$converteralertStyle.toJson(alertStyle)),
      'active': serializer.toJson<bool>(active),
      'generatedThrough': serializer.toJson<DateTime?>(generatedThrough),
      'systemKey': serializer.toJson<String?>(systemKey),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  Routine copyWith({
    int? id,
    String? title,
    String? notes,
    RoutineKind? kind,
    Value<int?> timeMinutes = const Value.absent(),
    Value<int?> untilMinutes = const Value.absent(),
    Value<int?> deadlineMinutes = const Value.absent(),
    Value<String?> recurrence = const Value.absent(),
    Value<DateTime?> startAt = const Value.absent(),
    Value<DateTime?> endAt = const Value.absent(),
    Value<int?> regenDays = const Value.absent(),
    bool? nagEnabled,
    int? firstIntervalMinutes,
    Value<int?> halfLifeMinutes = const Value.absent(),
    bool? autoHalfLife,
    double? factor,
    int? minIntervalMinutes,
    AlertStyle? alertStyle,
    bool? active,
    Value<DateTime?> generatedThrough = const Value.absent(),
    Value<String?> systemKey = const Value.absent(),
    DateTime? createdAt,
  }) => Routine(
    id: id ?? this.id,
    title: title ?? this.title,
    notes: notes ?? this.notes,
    kind: kind ?? this.kind,
    timeMinutes: timeMinutes.present ? timeMinutes.value : this.timeMinutes,
    untilMinutes: untilMinutes.present ? untilMinutes.value : this.untilMinutes,
    deadlineMinutes: deadlineMinutes.present ? deadlineMinutes.value : this.deadlineMinutes,
    recurrence: recurrence.present ? recurrence.value : this.recurrence,
    startAt: startAt.present ? startAt.value : this.startAt,
    endAt: endAt.present ? endAt.value : this.endAt,
    regenDays: regenDays.present ? regenDays.value : this.regenDays,
    nagEnabled: nagEnabled ?? this.nagEnabled,
    firstIntervalMinutes: firstIntervalMinutes ?? this.firstIntervalMinutes,
    halfLifeMinutes: halfLifeMinutes.present ? halfLifeMinutes.value : this.halfLifeMinutes,
    autoHalfLife: autoHalfLife ?? this.autoHalfLife,
    factor: factor ?? this.factor,
    minIntervalMinutes: minIntervalMinutes ?? this.minIntervalMinutes,
    alertStyle: alertStyle ?? this.alertStyle,
    active: active ?? this.active,
    generatedThrough: generatedThrough.present ? generatedThrough.value : this.generatedThrough,
    systemKey: systemKey.present ? systemKey.value : this.systemKey,
    createdAt: createdAt ?? this.createdAt,
  );
  Routine copyWithCompanion(RoutinesCompanion data) {
    return Routine(
      id: data.id.present ? data.id.value : this.id,
      title: data.title.present ? data.title.value : this.title,
      notes: data.notes.present ? data.notes.value : this.notes,
      kind: data.kind.present ? data.kind.value : this.kind,
      timeMinutes: data.timeMinutes.present ? data.timeMinutes.value : this.timeMinutes,
      untilMinutes: data.untilMinutes.present ? data.untilMinutes.value : this.untilMinutes,
      deadlineMinutes: data.deadlineMinutes.present
          ? data.deadlineMinutes.value
          : this.deadlineMinutes,
      recurrence: data.recurrence.present ? data.recurrence.value : this.recurrence,
      startAt: data.startAt.present ? data.startAt.value : this.startAt,
      endAt: data.endAt.present ? data.endAt.value : this.endAt,
      regenDays: data.regenDays.present ? data.regenDays.value : this.regenDays,
      nagEnabled: data.nagEnabled.present ? data.nagEnabled.value : this.nagEnabled,
      firstIntervalMinutes: data.firstIntervalMinutes.present
          ? data.firstIntervalMinutes.value
          : this.firstIntervalMinutes,
      halfLifeMinutes: data.halfLifeMinutes.present
          ? data.halfLifeMinutes.value
          : this.halfLifeMinutes,
      autoHalfLife: data.autoHalfLife.present ? data.autoHalfLife.value : this.autoHalfLife,
      factor: data.factor.present ? data.factor.value : this.factor,
      minIntervalMinutes: data.minIntervalMinutes.present
          ? data.minIntervalMinutes.value
          : this.minIntervalMinutes,
      alertStyle: data.alertStyle.present ? data.alertStyle.value : this.alertStyle,
      active: data.active.present ? data.active.value : this.active,
      generatedThrough: data.generatedThrough.present
          ? data.generatedThrough.value
          : this.generatedThrough,
      systemKey: data.systemKey.present ? data.systemKey.value : this.systemKey,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('Routine(')
          ..write('id: $id, ')
          ..write('title: $title, ')
          ..write('notes: $notes, ')
          ..write('kind: $kind, ')
          ..write('timeMinutes: $timeMinutes, ')
          ..write('untilMinutes: $untilMinutes, ')
          ..write('deadlineMinutes: $deadlineMinutes, ')
          ..write('recurrence: $recurrence, ')
          ..write('startAt: $startAt, ')
          ..write('endAt: $endAt, ')
          ..write('regenDays: $regenDays, ')
          ..write('nagEnabled: $nagEnabled, ')
          ..write('firstIntervalMinutes: $firstIntervalMinutes, ')
          ..write('halfLifeMinutes: $halfLifeMinutes, ')
          ..write('autoHalfLife: $autoHalfLife, ')
          ..write('factor: $factor, ')
          ..write('minIntervalMinutes: $minIntervalMinutes, ')
          ..write('alertStyle: $alertStyle, ')
          ..write('active: $active, ')
          ..write('generatedThrough: $generatedThrough, ')
          ..write('systemKey: $systemKey, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hashAll([
    id,
    title,
    notes,
    kind,
    timeMinutes,
    untilMinutes,
    deadlineMinutes,
    recurrence,
    startAt,
    endAt,
    regenDays,
    nagEnabled,
    firstIntervalMinutes,
    halfLifeMinutes,
    autoHalfLife,
    factor,
    minIntervalMinutes,
    alertStyle,
    active,
    generatedThrough,
    systemKey,
    createdAt,
  ]);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is Routine &&
          other.id == this.id &&
          other.title == this.title &&
          other.notes == this.notes &&
          other.kind == this.kind &&
          other.timeMinutes == this.timeMinutes &&
          other.untilMinutes == this.untilMinutes &&
          other.deadlineMinutes == this.deadlineMinutes &&
          other.recurrence == this.recurrence &&
          other.startAt == this.startAt &&
          other.endAt == this.endAt &&
          other.regenDays == this.regenDays &&
          other.nagEnabled == this.nagEnabled &&
          other.firstIntervalMinutes == this.firstIntervalMinutes &&
          other.halfLifeMinutes == this.halfLifeMinutes &&
          other.autoHalfLife == this.autoHalfLife &&
          other.factor == this.factor &&
          other.minIntervalMinutes == this.minIntervalMinutes &&
          other.alertStyle == this.alertStyle &&
          other.active == this.active &&
          other.generatedThrough == this.generatedThrough &&
          other.systemKey == this.systemKey &&
          other.createdAt == this.createdAt);
}

class RoutinesCompanion extends UpdateCompanion<Routine> {
  final Value<int> id;
  final Value<String> title;
  final Value<String> notes;
  final Value<RoutineKind> kind;
  final Value<int?> timeMinutes;
  final Value<int?> untilMinutes;
  final Value<int?> deadlineMinutes;
  final Value<String?> recurrence;
  final Value<DateTime?> startAt;
  final Value<DateTime?> endAt;
  final Value<int?> regenDays;
  final Value<bool> nagEnabled;
  final Value<int> firstIntervalMinutes;
  final Value<int?> halfLifeMinutes;
  final Value<bool> autoHalfLife;
  final Value<double> factor;
  final Value<int> minIntervalMinutes;
  final Value<AlertStyle> alertStyle;
  final Value<bool> active;
  final Value<DateTime?> generatedThrough;
  final Value<String?> systemKey;
  final Value<DateTime> createdAt;
  const RoutinesCompanion({
    this.id = const Value.absent(),
    this.title = const Value.absent(),
    this.notes = const Value.absent(),
    this.kind = const Value.absent(),
    this.timeMinutes = const Value.absent(),
    this.untilMinutes = const Value.absent(),
    this.deadlineMinutes = const Value.absent(),
    this.recurrence = const Value.absent(),
    this.startAt = const Value.absent(),
    this.endAt = const Value.absent(),
    this.regenDays = const Value.absent(),
    this.nagEnabled = const Value.absent(),
    this.firstIntervalMinutes = const Value.absent(),
    this.halfLifeMinutes = const Value.absent(),
    this.autoHalfLife = const Value.absent(),
    this.factor = const Value.absent(),
    this.minIntervalMinutes = const Value.absent(),
    this.alertStyle = const Value.absent(),
    this.active = const Value.absent(),
    this.generatedThrough = const Value.absent(),
    this.systemKey = const Value.absent(),
    this.createdAt = const Value.absent(),
  });
  RoutinesCompanion.insert({
    this.id = const Value.absent(),
    required String title,
    this.notes = const Value.absent(),
    required RoutineKind kind,
    this.timeMinutes = const Value.absent(),
    this.untilMinutes = const Value.absent(),
    this.deadlineMinutes = const Value.absent(),
    this.recurrence = const Value.absent(),
    this.startAt = const Value.absent(),
    this.endAt = const Value.absent(),
    this.regenDays = const Value.absent(),
    this.nagEnabled = const Value.absent(),
    this.firstIntervalMinutes = const Value.absent(),
    this.halfLifeMinutes = const Value.absent(),
    this.autoHalfLife = const Value.absent(),
    this.factor = const Value.absent(),
    this.minIntervalMinutes = const Value.absent(),
    this.alertStyle = const Value.absent(),
    this.active = const Value.absent(),
    this.generatedThrough = const Value.absent(),
    this.systemKey = const Value.absent(),
    this.createdAt = const Value.absent(),
  }) : title = Value(title),
       kind = Value(kind);
  static Insertable<Routine> custom({
    Expression<int>? id,
    Expression<String>? title,
    Expression<String>? notes,
    Expression<int>? kind,
    Expression<int>? timeMinutes,
    Expression<int>? untilMinutes,
    Expression<int>? deadlineMinutes,
    Expression<String>? recurrence,
    Expression<DateTime>? startAt,
    Expression<DateTime>? endAt,
    Expression<int>? regenDays,
    Expression<bool>? nagEnabled,
    Expression<int>? firstIntervalMinutes,
    Expression<int>? halfLifeMinutes,
    Expression<bool>? autoHalfLife,
    Expression<double>? factor,
    Expression<int>? minIntervalMinutes,
    Expression<int>? alertStyle,
    Expression<bool>? active,
    Expression<DateTime>? generatedThrough,
    Expression<String>? systemKey,
    Expression<DateTime>? createdAt,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (title != null) 'title': title,
      if (notes != null) 'notes': notes,
      if (kind != null) 'kind': kind,
      if (timeMinutes != null) 'time_minutes': timeMinutes,
      if (untilMinutes != null) 'until_minutes': untilMinutes,
      if (deadlineMinutes != null) 'deadline_minutes': deadlineMinutes,
      if (recurrence != null) 'recurrence': recurrence,
      if (startAt != null) 'start_at': startAt,
      if (endAt != null) 'end_at': endAt,
      if (regenDays != null) 'regen_days': regenDays,
      if (nagEnabled != null) 'nag_enabled': nagEnabled,
      if (firstIntervalMinutes != null) 'first_interval_minutes': firstIntervalMinutes,
      if (halfLifeMinutes != null) 'half_life_minutes': halfLifeMinutes,
      if (autoHalfLife != null) 'auto_half_life': autoHalfLife,
      if (factor != null) 'factor': factor,
      if (minIntervalMinutes != null) 'min_interval_minutes': minIntervalMinutes,
      if (alertStyle != null) 'alert_style': alertStyle,
      if (active != null) 'active': active,
      if (generatedThrough != null) 'generated_through': generatedThrough,
      if (systemKey != null) 'system_key': systemKey,
      if (createdAt != null) 'created_at': createdAt,
    });
  }

  RoutinesCompanion copyWith({
    Value<int>? id,
    Value<String>? title,
    Value<String>? notes,
    Value<RoutineKind>? kind,
    Value<int?>? timeMinutes,
    Value<int?>? untilMinutes,
    Value<int?>? deadlineMinutes,
    Value<String?>? recurrence,
    Value<DateTime?>? startAt,
    Value<DateTime?>? endAt,
    Value<int?>? regenDays,
    Value<bool>? nagEnabled,
    Value<int>? firstIntervalMinutes,
    Value<int?>? halfLifeMinutes,
    Value<bool>? autoHalfLife,
    Value<double>? factor,
    Value<int>? minIntervalMinutes,
    Value<AlertStyle>? alertStyle,
    Value<bool>? active,
    Value<DateTime?>? generatedThrough,
    Value<String?>? systemKey,
    Value<DateTime>? createdAt,
  }) {
    return RoutinesCompanion(
      id: id ?? this.id,
      title: title ?? this.title,
      notes: notes ?? this.notes,
      kind: kind ?? this.kind,
      timeMinutes: timeMinutes ?? this.timeMinutes,
      untilMinutes: untilMinutes ?? this.untilMinutes,
      deadlineMinutes: deadlineMinutes ?? this.deadlineMinutes,
      recurrence: recurrence ?? this.recurrence,
      startAt: startAt ?? this.startAt,
      endAt: endAt ?? this.endAt,
      regenDays: regenDays ?? this.regenDays,
      nagEnabled: nagEnabled ?? this.nagEnabled,
      firstIntervalMinutes: firstIntervalMinutes ?? this.firstIntervalMinutes,
      halfLifeMinutes: halfLifeMinutes ?? this.halfLifeMinutes,
      autoHalfLife: autoHalfLife ?? this.autoHalfLife,
      factor: factor ?? this.factor,
      minIntervalMinutes: minIntervalMinutes ?? this.minIntervalMinutes,
      alertStyle: alertStyle ?? this.alertStyle,
      active: active ?? this.active,
      generatedThrough: generatedThrough ?? this.generatedThrough,
      systemKey: systemKey ?? this.systemKey,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (title.present) {
      map['title'] = Variable<String>(title.value);
    }
    if (notes.present) {
      map['notes'] = Variable<String>(notes.value);
    }
    if (kind.present) {
      map['kind'] = Variable<int>($RoutinesTable.$converterkind.toSql(kind.value));
    }
    if (timeMinutes.present) {
      map['time_minutes'] = Variable<int>(timeMinutes.value);
    }
    if (untilMinutes.present) {
      map['until_minutes'] = Variable<int>(untilMinutes.value);
    }
    if (deadlineMinutes.present) {
      map['deadline_minutes'] = Variable<int>(deadlineMinutes.value);
    }
    if (recurrence.present) {
      map['recurrence'] = Variable<String>(recurrence.value);
    }
    if (startAt.present) {
      map['start_at'] = Variable<DateTime>(startAt.value);
    }
    if (endAt.present) {
      map['end_at'] = Variable<DateTime>(endAt.value);
    }
    if (regenDays.present) {
      map['regen_days'] = Variable<int>(regenDays.value);
    }
    if (nagEnabled.present) {
      map['nag_enabled'] = Variable<bool>(nagEnabled.value);
    }
    if (firstIntervalMinutes.present) {
      map['first_interval_minutes'] = Variable<int>(firstIntervalMinutes.value);
    }
    if (halfLifeMinutes.present) {
      map['half_life_minutes'] = Variable<int>(halfLifeMinutes.value);
    }
    if (autoHalfLife.present) {
      map['auto_half_life'] = Variable<bool>(autoHalfLife.value);
    }
    if (factor.present) {
      map['factor'] = Variable<double>(factor.value);
    }
    if (minIntervalMinutes.present) {
      map['min_interval_minutes'] = Variable<int>(minIntervalMinutes.value);
    }
    if (alertStyle.present) {
      map['alert_style'] = Variable<int>(
        $RoutinesTable.$converteralertStyle.toSql(alertStyle.value),
      );
    }
    if (active.present) {
      map['active'] = Variable<bool>(active.value);
    }
    if (generatedThrough.present) {
      map['generated_through'] = Variable<DateTime>(generatedThrough.value);
    }
    if (systemKey.present) {
      map['system_key'] = Variable<String>(systemKey.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('RoutinesCompanion(')
          ..write('id: $id, ')
          ..write('title: $title, ')
          ..write('notes: $notes, ')
          ..write('kind: $kind, ')
          ..write('timeMinutes: $timeMinutes, ')
          ..write('untilMinutes: $untilMinutes, ')
          ..write('deadlineMinutes: $deadlineMinutes, ')
          ..write('recurrence: $recurrence, ')
          ..write('startAt: $startAt, ')
          ..write('endAt: $endAt, ')
          ..write('regenDays: $regenDays, ')
          ..write('nagEnabled: $nagEnabled, ')
          ..write('firstIntervalMinutes: $firstIntervalMinutes, ')
          ..write('halfLifeMinutes: $halfLifeMinutes, ')
          ..write('autoHalfLife: $autoHalfLife, ')
          ..write('factor: $factor, ')
          ..write('minIntervalMinutes: $minIntervalMinutes, ')
          ..write('alertStyle: $alertStyle, ')
          ..write('active: $active, ')
          ..write('generatedThrough: $generatedThrough, ')
          ..write('systemKey: $systemKey, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }
}

class $OccurrencesTable extends Occurrences with TableInfo<$OccurrencesTable, Occurrence> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $OccurrencesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
    'id',
    aliasedName,
    false,
    hasAutoIncrement: true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways('PRIMARY KEY AUTOINCREMENT'),
  );
  static const VerificationMeta _routineIdMeta = const VerificationMeta('routineId');
  @override
  late final GeneratedColumn<int> routineId = GeneratedColumn<int>(
    'routine_id',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES routines (id) ON DELETE CASCADE',
    ),
  );
  static const VerificationMeta _dayMeta = const VerificationMeta('day');
  @override
  late final GeneratedColumn<DateTime> day = GeneratedColumn<DateTime>(
    'day',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _startAtMeta = const VerificationMeta('startAt');
  @override
  late final GeneratedColumn<DateTime> startAt = GeneratedColumn<DateTime>(
    'start_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _windowEndMeta = const VerificationMeta('windowEnd');
  @override
  late final GeneratedColumn<DateTime> windowEnd = GeneratedColumn<DateTime>(
    'window_end',
    aliasedName,
    true,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
  );
  @override
  late final GeneratedColumnWithTypeConverter<OccurrenceStatus, int> status = GeneratedColumn<int>(
    'status',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: Constant(OccurrenceStatus.pending.index),
  ).withConverter<OccurrenceStatus>($OccurrencesTable.$converterstatus);
  static const VerificationMeta _doneAtMeta = const VerificationMeta('doneAt');
  @override
  late final GeneratedColumn<DateTime> doneAt = GeneratedColumn<DateTime>(
    'done_at',
    aliasedName,
    true,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _snoozedUntilMeta = const VerificationMeta('snoozedUntil');
  @override
  late final GeneratedColumn<DateTime> snoozedUntil = GeneratedColumn<DateTime>(
    'snoozed_until',
    aliasedName,
    true,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _lastFiredAtMeta = const VerificationMeta('lastFiredAt');
  @override
  late final GeneratedColumn<DateTime> lastFiredAt = GeneratedColumn<DateTime>(
    'last_fired_at',
    aliasedName,
    true,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _missedAlertSentMeta = const VerificationMeta('missedAlertSent');
  @override
  late final GeneratedColumn<bool> missedAlertSent = GeneratedColumn<bool>(
    'missed_alert_sent',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways('CHECK ("missed_alert_sent" IN (0, 1))'),
    defaultValue: const Constant(false),
  );
  static const VerificationMeta _quietMeta = const VerificationMeta('quiet');
  @override
  late final GeneratedColumn<bool> quiet = GeneratedColumn<bool>(
    'quiet',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways('CHECK ("quiet" IN (0, 1))'),
    defaultValue: const Constant(false),
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    routineId,
    day,
    startAt,
    windowEnd,
    status,
    doneAt,
    snoozedUntil,
    lastFiredAt,
    missedAlertSent,
    quiet,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'occurrences';
  @override
  VerificationContext validateIntegrity(
    Insertable<Occurrence> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('routine_id')) {
      context.handle(
        _routineIdMeta,
        routineId.isAcceptableOrUnknown(data['routine_id']!, _routineIdMeta),
      );
    } else if (isInserting) {
      context.missing(_routineIdMeta);
    }
    if (data.containsKey('day')) {
      context.handle(_dayMeta, day.isAcceptableOrUnknown(data['day']!, _dayMeta));
    } else if (isInserting) {
      context.missing(_dayMeta);
    }
    if (data.containsKey('start_at')) {
      context.handle(_startAtMeta, startAt.isAcceptableOrUnknown(data['start_at']!, _startAtMeta));
    } else if (isInserting) {
      context.missing(_startAtMeta);
    }
    if (data.containsKey('window_end')) {
      context.handle(
        _windowEndMeta,
        windowEnd.isAcceptableOrUnknown(data['window_end']!, _windowEndMeta),
      );
    }
    if (data.containsKey('done_at')) {
      context.handle(_doneAtMeta, doneAt.isAcceptableOrUnknown(data['done_at']!, _doneAtMeta));
    }
    if (data.containsKey('snoozed_until')) {
      context.handle(
        _snoozedUntilMeta,
        snoozedUntil.isAcceptableOrUnknown(data['snoozed_until']!, _snoozedUntilMeta),
      );
    }
    if (data.containsKey('last_fired_at')) {
      context.handle(
        _lastFiredAtMeta,
        lastFiredAt.isAcceptableOrUnknown(data['last_fired_at']!, _lastFiredAtMeta),
      );
    }
    if (data.containsKey('missed_alert_sent')) {
      context.handle(
        _missedAlertSentMeta,
        missedAlertSent.isAcceptableOrUnknown(data['missed_alert_sent']!, _missedAlertSentMeta),
      );
    }
    if (data.containsKey('quiet')) {
      context.handle(_quietMeta, quiet.isAcceptableOrUnknown(data['quiet']!, _quietMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  List<Set<GeneratedColumn>> get uniqueKeys => [
    {routineId, day},
  ];
  @override
  Occurrence map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return Occurrence(
      id: attachedDatabase.typeMapping.read(DriftSqlType.int, data['${effectivePrefix}id'])!,
      routineId: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}routine_id'],
      )!,
      day: attachedDatabase.typeMapping.read(DriftSqlType.dateTime, data['${effectivePrefix}day'])!,
      startAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}start_at'],
      )!,
      windowEnd: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}window_end'],
      ),
      status: $OccurrencesTable.$converterstatus.fromSql(
        attachedDatabase.typeMapping.read(DriftSqlType.int, data['${effectivePrefix}status'])!,
      ),
      doneAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}done_at'],
      ),
      snoozedUntil: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}snoozed_until'],
      ),
      lastFiredAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}last_fired_at'],
      ),
      missedAlertSent: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}missed_alert_sent'],
      )!,
      quiet: attachedDatabase.typeMapping.read(DriftSqlType.bool, data['${effectivePrefix}quiet'])!,
    );
  }

  @override
  $OccurrencesTable createAlias(String alias) {
    return $OccurrencesTable(attachedDatabase, alias);
  }

  static JsonTypeConverter2<OccurrenceStatus, int, int> $converterstatus =
      const EnumIndexConverter<OccurrenceStatus>(OccurrenceStatus.values);
}

class Occurrence extends DataClass implements Insertable<Occurrence> {
  final int id;
  final int routineId;
  final DateTime day;
  final DateTime startAt;

  /// Null: no end (a to-do without an end date).
  final DateTime? windowEnd;
  final OccurrenceStatus status;
  final DateTime? doneAt;
  final DateTime? snoozedUntil;
  final DateTime? lastFiredAt;
  final bool missedAlertSent;

  /// Created after its start time (the routine was added late in the day): it
  /// can be ticked but never nags, and disappears instead of counting as missed.
  final bool quiet;
  const Occurrence({
    required this.id,
    required this.routineId,
    required this.day,
    required this.startAt,
    this.windowEnd,
    required this.status,
    this.doneAt,
    this.snoozedUntil,
    this.lastFiredAt,
    required this.missedAlertSent,
    required this.quiet,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['routine_id'] = Variable<int>(routineId);
    map['day'] = Variable<DateTime>(day);
    map['start_at'] = Variable<DateTime>(startAt);
    if (!nullToAbsent || windowEnd != null) {
      map['window_end'] = Variable<DateTime>(windowEnd);
    }
    {
      map['status'] = Variable<int>($OccurrencesTable.$converterstatus.toSql(status));
    }
    if (!nullToAbsent || doneAt != null) {
      map['done_at'] = Variable<DateTime>(doneAt);
    }
    if (!nullToAbsent || snoozedUntil != null) {
      map['snoozed_until'] = Variable<DateTime>(snoozedUntil);
    }
    if (!nullToAbsent || lastFiredAt != null) {
      map['last_fired_at'] = Variable<DateTime>(lastFiredAt);
    }
    map['missed_alert_sent'] = Variable<bool>(missedAlertSent);
    map['quiet'] = Variable<bool>(quiet);
    return map;
  }

  OccurrencesCompanion toCompanion(bool nullToAbsent) {
    return OccurrencesCompanion(
      id: Value(id),
      routineId: Value(routineId),
      day: Value(day),
      startAt: Value(startAt),
      windowEnd: windowEnd == null && nullToAbsent ? const Value.absent() : Value(windowEnd),
      status: Value(status),
      doneAt: doneAt == null && nullToAbsent ? const Value.absent() : Value(doneAt),
      snoozedUntil: snoozedUntil == null && nullToAbsent
          ? const Value.absent()
          : Value(snoozedUntil),
      lastFiredAt: lastFiredAt == null && nullToAbsent ? const Value.absent() : Value(lastFiredAt),
      missedAlertSent: Value(missedAlertSent),
      quiet: Value(quiet),
    );
  }

  factory Occurrence.fromJson(Map<String, dynamic> json, {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return Occurrence(
      id: serializer.fromJson<int>(json['id']),
      routineId: serializer.fromJson<int>(json['routineId']),
      day: serializer.fromJson<DateTime>(json['day']),
      startAt: serializer.fromJson<DateTime>(json['startAt']),
      windowEnd: serializer.fromJson<DateTime?>(json['windowEnd']),
      status: $OccurrencesTable.$converterstatus.fromJson(serializer.fromJson<int>(json['status'])),
      doneAt: serializer.fromJson<DateTime?>(json['doneAt']),
      snoozedUntil: serializer.fromJson<DateTime?>(json['snoozedUntil']),
      lastFiredAt: serializer.fromJson<DateTime?>(json['lastFiredAt']),
      missedAlertSent: serializer.fromJson<bool>(json['missedAlertSent']),
      quiet: serializer.fromJson<bool>(json['quiet']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'routineId': serializer.toJson<int>(routineId),
      'day': serializer.toJson<DateTime>(day),
      'startAt': serializer.toJson<DateTime>(startAt),
      'windowEnd': serializer.toJson<DateTime?>(windowEnd),
      'status': serializer.toJson<int>($OccurrencesTable.$converterstatus.toJson(status)),
      'doneAt': serializer.toJson<DateTime?>(doneAt),
      'snoozedUntil': serializer.toJson<DateTime?>(snoozedUntil),
      'lastFiredAt': serializer.toJson<DateTime?>(lastFiredAt),
      'missedAlertSent': serializer.toJson<bool>(missedAlertSent),
      'quiet': serializer.toJson<bool>(quiet),
    };
  }

  Occurrence copyWith({
    int? id,
    int? routineId,
    DateTime? day,
    DateTime? startAt,
    Value<DateTime?> windowEnd = const Value.absent(),
    OccurrenceStatus? status,
    Value<DateTime?> doneAt = const Value.absent(),
    Value<DateTime?> snoozedUntil = const Value.absent(),
    Value<DateTime?> lastFiredAt = const Value.absent(),
    bool? missedAlertSent,
    bool? quiet,
  }) => Occurrence(
    id: id ?? this.id,
    routineId: routineId ?? this.routineId,
    day: day ?? this.day,
    startAt: startAt ?? this.startAt,
    windowEnd: windowEnd.present ? windowEnd.value : this.windowEnd,
    status: status ?? this.status,
    doneAt: doneAt.present ? doneAt.value : this.doneAt,
    snoozedUntil: snoozedUntil.present ? snoozedUntil.value : this.snoozedUntil,
    lastFiredAt: lastFiredAt.present ? lastFiredAt.value : this.lastFiredAt,
    missedAlertSent: missedAlertSent ?? this.missedAlertSent,
    quiet: quiet ?? this.quiet,
  );
  Occurrence copyWithCompanion(OccurrencesCompanion data) {
    return Occurrence(
      id: data.id.present ? data.id.value : this.id,
      routineId: data.routineId.present ? data.routineId.value : this.routineId,
      day: data.day.present ? data.day.value : this.day,
      startAt: data.startAt.present ? data.startAt.value : this.startAt,
      windowEnd: data.windowEnd.present ? data.windowEnd.value : this.windowEnd,
      status: data.status.present ? data.status.value : this.status,
      doneAt: data.doneAt.present ? data.doneAt.value : this.doneAt,
      snoozedUntil: data.snoozedUntil.present ? data.snoozedUntil.value : this.snoozedUntil,
      lastFiredAt: data.lastFiredAt.present ? data.lastFiredAt.value : this.lastFiredAt,
      missedAlertSent: data.missedAlertSent.present
          ? data.missedAlertSent.value
          : this.missedAlertSent,
      quiet: data.quiet.present ? data.quiet.value : this.quiet,
    );
  }

  @override
  String toString() {
    return (StringBuffer('Occurrence(')
          ..write('id: $id, ')
          ..write('routineId: $routineId, ')
          ..write('day: $day, ')
          ..write('startAt: $startAt, ')
          ..write('windowEnd: $windowEnd, ')
          ..write('status: $status, ')
          ..write('doneAt: $doneAt, ')
          ..write('snoozedUntil: $snoozedUntil, ')
          ..write('lastFiredAt: $lastFiredAt, ')
          ..write('missedAlertSent: $missedAlertSent, ')
          ..write('quiet: $quiet')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    routineId,
    day,
    startAt,
    windowEnd,
    status,
    doneAt,
    snoozedUntil,
    lastFiredAt,
    missedAlertSent,
    quiet,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is Occurrence &&
          other.id == this.id &&
          other.routineId == this.routineId &&
          other.day == this.day &&
          other.startAt == this.startAt &&
          other.windowEnd == this.windowEnd &&
          other.status == this.status &&
          other.doneAt == this.doneAt &&
          other.snoozedUntil == this.snoozedUntil &&
          other.lastFiredAt == this.lastFiredAt &&
          other.missedAlertSent == this.missedAlertSent &&
          other.quiet == this.quiet);
}

class OccurrencesCompanion extends UpdateCompanion<Occurrence> {
  final Value<int> id;
  final Value<int> routineId;
  final Value<DateTime> day;
  final Value<DateTime> startAt;
  final Value<DateTime?> windowEnd;
  final Value<OccurrenceStatus> status;
  final Value<DateTime?> doneAt;
  final Value<DateTime?> snoozedUntil;
  final Value<DateTime?> lastFiredAt;
  final Value<bool> missedAlertSent;
  final Value<bool> quiet;
  const OccurrencesCompanion({
    this.id = const Value.absent(),
    this.routineId = const Value.absent(),
    this.day = const Value.absent(),
    this.startAt = const Value.absent(),
    this.windowEnd = const Value.absent(),
    this.status = const Value.absent(),
    this.doneAt = const Value.absent(),
    this.snoozedUntil = const Value.absent(),
    this.lastFiredAt = const Value.absent(),
    this.missedAlertSent = const Value.absent(),
    this.quiet = const Value.absent(),
  });
  OccurrencesCompanion.insert({
    this.id = const Value.absent(),
    required int routineId,
    required DateTime day,
    required DateTime startAt,
    this.windowEnd = const Value.absent(),
    this.status = const Value.absent(),
    this.doneAt = const Value.absent(),
    this.snoozedUntil = const Value.absent(),
    this.lastFiredAt = const Value.absent(),
    this.missedAlertSent = const Value.absent(),
    this.quiet = const Value.absent(),
  }) : routineId = Value(routineId),
       day = Value(day),
       startAt = Value(startAt);
  static Insertable<Occurrence> custom({
    Expression<int>? id,
    Expression<int>? routineId,
    Expression<DateTime>? day,
    Expression<DateTime>? startAt,
    Expression<DateTime>? windowEnd,
    Expression<int>? status,
    Expression<DateTime>? doneAt,
    Expression<DateTime>? snoozedUntil,
    Expression<DateTime>? lastFiredAt,
    Expression<bool>? missedAlertSent,
    Expression<bool>? quiet,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (routineId != null) 'routine_id': routineId,
      if (day != null) 'day': day,
      if (startAt != null) 'start_at': startAt,
      if (windowEnd != null) 'window_end': windowEnd,
      if (status != null) 'status': status,
      if (doneAt != null) 'done_at': doneAt,
      if (snoozedUntil != null) 'snoozed_until': snoozedUntil,
      if (lastFiredAt != null) 'last_fired_at': lastFiredAt,
      if (missedAlertSent != null) 'missed_alert_sent': missedAlertSent,
      if (quiet != null) 'quiet': quiet,
    });
  }

  OccurrencesCompanion copyWith({
    Value<int>? id,
    Value<int>? routineId,
    Value<DateTime>? day,
    Value<DateTime>? startAt,
    Value<DateTime?>? windowEnd,
    Value<OccurrenceStatus>? status,
    Value<DateTime?>? doneAt,
    Value<DateTime?>? snoozedUntil,
    Value<DateTime?>? lastFiredAt,
    Value<bool>? missedAlertSent,
    Value<bool>? quiet,
  }) {
    return OccurrencesCompanion(
      id: id ?? this.id,
      routineId: routineId ?? this.routineId,
      day: day ?? this.day,
      startAt: startAt ?? this.startAt,
      windowEnd: windowEnd ?? this.windowEnd,
      status: status ?? this.status,
      doneAt: doneAt ?? this.doneAt,
      snoozedUntil: snoozedUntil ?? this.snoozedUntil,
      lastFiredAt: lastFiredAt ?? this.lastFiredAt,
      missedAlertSent: missedAlertSent ?? this.missedAlertSent,
      quiet: quiet ?? this.quiet,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (routineId.present) {
      map['routine_id'] = Variable<int>(routineId.value);
    }
    if (day.present) {
      map['day'] = Variable<DateTime>(day.value);
    }
    if (startAt.present) {
      map['start_at'] = Variable<DateTime>(startAt.value);
    }
    if (windowEnd.present) {
      map['window_end'] = Variable<DateTime>(windowEnd.value);
    }
    if (status.present) {
      map['status'] = Variable<int>($OccurrencesTable.$converterstatus.toSql(status.value));
    }
    if (doneAt.present) {
      map['done_at'] = Variable<DateTime>(doneAt.value);
    }
    if (snoozedUntil.present) {
      map['snoozed_until'] = Variable<DateTime>(snoozedUntil.value);
    }
    if (lastFiredAt.present) {
      map['last_fired_at'] = Variable<DateTime>(lastFiredAt.value);
    }
    if (missedAlertSent.present) {
      map['missed_alert_sent'] = Variable<bool>(missedAlertSent.value);
    }
    if (quiet.present) {
      map['quiet'] = Variable<bool>(quiet.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('OccurrencesCompanion(')
          ..write('id: $id, ')
          ..write('routineId: $routineId, ')
          ..write('day: $day, ')
          ..write('startAt: $startAt, ')
          ..write('windowEnd: $windowEnd, ')
          ..write('status: $status, ')
          ..write('doneAt: $doneAt, ')
          ..write('snoozedUntil: $snoozedUntil, ')
          ..write('lastFiredAt: $lastFiredAt, ')
          ..write('missedAlertSent: $missedAlertSent, ')
          ..write('quiet: $quiet')
          ..write(')'))
        .toString();
  }
}

class $GoalsTable extends Goals with TableInfo<$GoalsTable, Goal> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $GoalsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
    'id',
    aliasedName,
    false,
    hasAutoIncrement: true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways('PRIMARY KEY AUTOINCREMENT'),
  );
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
    'name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _targetMinutesMeta = const VerificationMeta('targetMinutes');
  @override
  late final GeneratedColumn<int> targetMinutes = GeneratedColumn<int>(
    'target_minutes',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _startDateMeta = const VerificationMeta('startDate');
  @override
  late final GeneratedColumn<DateTime> startDate = GeneratedColumn<DateTime>(
    'start_date',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _totalDaysMeta = const VerificationMeta('totalDays');
  @override
  late final GeneratedColumn<int> totalDays = GeneratedColumn<int>(
    'total_days',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _archivedMeta = const VerificationMeta('archived');
  @override
  late final GeneratedColumn<bool> archived = GeneratedColumn<bool>(
    'archived',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways('CHECK ("archived" IN (0, 1))'),
    defaultValue: const Constant(false),
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    name,
    targetMinutes,
    startDate,
    totalDays,
    archived,
    createdAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'goals';
  @override
  VerificationContext validateIntegrity(Insertable<Goal> instance, {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('name')) {
      context.handle(_nameMeta, name.isAcceptableOrUnknown(data['name']!, _nameMeta));
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    if (data.containsKey('target_minutes')) {
      context.handle(
        _targetMinutesMeta,
        targetMinutes.isAcceptableOrUnknown(data['target_minutes']!, _targetMinutesMeta),
      );
    } else if (isInserting) {
      context.missing(_targetMinutesMeta);
    }
    if (data.containsKey('start_date')) {
      context.handle(
        _startDateMeta,
        startDate.isAcceptableOrUnknown(data['start_date']!, _startDateMeta),
      );
    } else if (isInserting) {
      context.missing(_startDateMeta);
    }
    if (data.containsKey('total_days')) {
      context.handle(
        _totalDaysMeta,
        totalDays.isAcceptableOrUnknown(data['total_days']!, _totalDaysMeta),
      );
    } else if (isInserting) {
      context.missing(_totalDaysMeta);
    }
    if (data.containsKey('archived')) {
      context.handle(
        _archivedMeta,
        archived.isAcceptableOrUnknown(data['archived']!, _archivedMeta),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  Goal map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return Goal(
      id: attachedDatabase.typeMapping.read(DriftSqlType.int, data['${effectivePrefix}id'])!,
      name: attachedDatabase.typeMapping.read(DriftSqlType.string, data['${effectivePrefix}name'])!,
      targetMinutes: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}target_minutes'],
      )!,
      startDate: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}start_date'],
      )!,
      totalDays: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}total_days'],
      )!,
      archived: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}archived'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
    );
  }

  @override
  $GoalsTable createAlias(String alias) {
    return $GoalsTable(attachedDatabase, alias);
  }
}

class Goal extends DataClass implements Insertable<Goal> {
  final int id;
  final String name;
  final int targetMinutes;
  final DateTime startDate;
  final int totalDays;
  final bool archived;
  final DateTime createdAt;
  const Goal({
    required this.id,
    required this.name,
    required this.targetMinutes,
    required this.startDate,
    required this.totalDays,
    required this.archived,
    required this.createdAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['name'] = Variable<String>(name);
    map['target_minutes'] = Variable<int>(targetMinutes);
    map['start_date'] = Variable<DateTime>(startDate);
    map['total_days'] = Variable<int>(totalDays);
    map['archived'] = Variable<bool>(archived);
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  GoalsCompanion toCompanion(bool nullToAbsent) {
    return GoalsCompanion(
      id: Value(id),
      name: Value(name),
      targetMinutes: Value(targetMinutes),
      startDate: Value(startDate),
      totalDays: Value(totalDays),
      archived: Value(archived),
      createdAt: Value(createdAt),
    );
  }

  factory Goal.fromJson(Map<String, dynamic> json, {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return Goal(
      id: serializer.fromJson<int>(json['id']),
      name: serializer.fromJson<String>(json['name']),
      targetMinutes: serializer.fromJson<int>(json['targetMinutes']),
      startDate: serializer.fromJson<DateTime>(json['startDate']),
      totalDays: serializer.fromJson<int>(json['totalDays']),
      archived: serializer.fromJson<bool>(json['archived']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'name': serializer.toJson<String>(name),
      'targetMinutes': serializer.toJson<int>(targetMinutes),
      'startDate': serializer.toJson<DateTime>(startDate),
      'totalDays': serializer.toJson<int>(totalDays),
      'archived': serializer.toJson<bool>(archived),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  Goal copyWith({
    int? id,
    String? name,
    int? targetMinutes,
    DateTime? startDate,
    int? totalDays,
    bool? archived,
    DateTime? createdAt,
  }) => Goal(
    id: id ?? this.id,
    name: name ?? this.name,
    targetMinutes: targetMinutes ?? this.targetMinutes,
    startDate: startDate ?? this.startDate,
    totalDays: totalDays ?? this.totalDays,
    archived: archived ?? this.archived,
    createdAt: createdAt ?? this.createdAt,
  );
  Goal copyWithCompanion(GoalsCompanion data) {
    return Goal(
      id: data.id.present ? data.id.value : this.id,
      name: data.name.present ? data.name.value : this.name,
      targetMinutes: data.targetMinutes.present ? data.targetMinutes.value : this.targetMinutes,
      startDate: data.startDate.present ? data.startDate.value : this.startDate,
      totalDays: data.totalDays.present ? data.totalDays.value : this.totalDays,
      archived: data.archived.present ? data.archived.value : this.archived,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('Goal(')
          ..write('id: $id, ')
          ..write('name: $name, ')
          ..write('targetMinutes: $targetMinutes, ')
          ..write('startDate: $startDate, ')
          ..write('totalDays: $totalDays, ')
          ..write('archived: $archived, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(id, name, targetMinutes, startDate, totalDays, archived, createdAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is Goal &&
          other.id == this.id &&
          other.name == this.name &&
          other.targetMinutes == this.targetMinutes &&
          other.startDate == this.startDate &&
          other.totalDays == this.totalDays &&
          other.archived == this.archived &&
          other.createdAt == this.createdAt);
}

class GoalsCompanion extends UpdateCompanion<Goal> {
  final Value<int> id;
  final Value<String> name;
  final Value<int> targetMinutes;
  final Value<DateTime> startDate;
  final Value<int> totalDays;
  final Value<bool> archived;
  final Value<DateTime> createdAt;
  const GoalsCompanion({
    this.id = const Value.absent(),
    this.name = const Value.absent(),
    this.targetMinutes = const Value.absent(),
    this.startDate = const Value.absent(),
    this.totalDays = const Value.absent(),
    this.archived = const Value.absent(),
    this.createdAt = const Value.absent(),
  });
  GoalsCompanion.insert({
    this.id = const Value.absent(),
    required String name,
    required int targetMinutes,
    required DateTime startDate,
    required int totalDays,
    this.archived = const Value.absent(),
    this.createdAt = const Value.absent(),
  }) : name = Value(name),
       targetMinutes = Value(targetMinutes),
       startDate = Value(startDate),
       totalDays = Value(totalDays);
  static Insertable<Goal> custom({
    Expression<int>? id,
    Expression<String>? name,
    Expression<int>? targetMinutes,
    Expression<DateTime>? startDate,
    Expression<int>? totalDays,
    Expression<bool>? archived,
    Expression<DateTime>? createdAt,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (name != null) 'name': name,
      if (targetMinutes != null) 'target_minutes': targetMinutes,
      if (startDate != null) 'start_date': startDate,
      if (totalDays != null) 'total_days': totalDays,
      if (archived != null) 'archived': archived,
      if (createdAt != null) 'created_at': createdAt,
    });
  }

  GoalsCompanion copyWith({
    Value<int>? id,
    Value<String>? name,
    Value<int>? targetMinutes,
    Value<DateTime>? startDate,
    Value<int>? totalDays,
    Value<bool>? archived,
    Value<DateTime>? createdAt,
  }) {
    return GoalsCompanion(
      id: id ?? this.id,
      name: name ?? this.name,
      targetMinutes: targetMinutes ?? this.targetMinutes,
      startDate: startDate ?? this.startDate,
      totalDays: totalDays ?? this.totalDays,
      archived: archived ?? this.archived,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (targetMinutes.present) {
      map['target_minutes'] = Variable<int>(targetMinutes.value);
    }
    if (startDate.present) {
      map['start_date'] = Variable<DateTime>(startDate.value);
    }
    if (totalDays.present) {
      map['total_days'] = Variable<int>(totalDays.value);
    }
    if (archived.present) {
      map['archived'] = Variable<bool>(archived.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('GoalsCompanion(')
          ..write('id: $id, ')
          ..write('name: $name, ')
          ..write('targetMinutes: $targetMinutes, ')
          ..write('startDate: $startDate, ')
          ..write('totalDays: $totalDays, ')
          ..write('archived: $archived, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }
}

class $PromisesTable extends Promises with TableInfo<$PromisesTable, PromiseEntry> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $PromisesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
    'id',
    aliasedName,
    false,
    hasAutoIncrement: true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways('PRIMARY KEY AUTOINCREMENT'),
  );
  static const VerificationMeta _dayMeta = const VerificationMeta('day');
  @override
  late final GeneratedColumn<DateTime> day = GeneratedColumn<DateTime>(
    'day',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _titleMeta = const VerificationMeta('title');
  @override
  late final GeneratedColumn<String> title = GeneratedColumn<String>(
    'title',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _goalIdMeta = const VerificationMeta('goalId');
  @override
  late final GeneratedColumn<int> goalId = GeneratedColumn<int>(
    'goal_id',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES goals (id) ON DELETE SET NULL',
    ),
  );
  static const VerificationMeta _promisedMinutesMeta = const VerificationMeta('promisedMinutes');
  @override
  late final GeneratedColumn<int> promisedMinutes = GeneratedColumn<int>(
    'promised_minutes',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _actualMinutesMeta = const VerificationMeta('actualMinutes');
  @override
  late final GeneratedColumn<int> actualMinutes = GeneratedColumn<int>(
    'actual_minutes',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  @override
  late final GeneratedColumnWithTypeConverter<PromiseStatus, int> status = GeneratedColumn<int>(
    'status',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: Constant(PromiseStatus.open.index),
  ).withConverter<PromiseStatus>($PromisesTable.$converterstatus);
  static const VerificationMeta _createdAtMeta = const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
    defaultValue: currentDateAndTime,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    day,
    title,
    goalId,
    promisedMinutes,
    actualMinutes,
    status,
    createdAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'promises';
  @override
  VerificationContext validateIntegrity(
    Insertable<PromiseEntry> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('day')) {
      context.handle(_dayMeta, day.isAcceptableOrUnknown(data['day']!, _dayMeta));
    } else if (isInserting) {
      context.missing(_dayMeta);
    }
    if (data.containsKey('title')) {
      context.handle(_titleMeta, title.isAcceptableOrUnknown(data['title']!, _titleMeta));
    } else if (isInserting) {
      context.missing(_titleMeta);
    }
    if (data.containsKey('goal_id')) {
      context.handle(_goalIdMeta, goalId.isAcceptableOrUnknown(data['goal_id']!, _goalIdMeta));
    }
    if (data.containsKey('promised_minutes')) {
      context.handle(
        _promisedMinutesMeta,
        promisedMinutes.isAcceptableOrUnknown(data['promised_minutes']!, _promisedMinutesMeta),
      );
    } else if (isInserting) {
      context.missing(_promisedMinutesMeta);
    }
    if (data.containsKey('actual_minutes')) {
      context.handle(
        _actualMinutesMeta,
        actualMinutes.isAcceptableOrUnknown(data['actual_minutes']!, _actualMinutesMeta),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  PromiseEntry map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return PromiseEntry(
      id: attachedDatabase.typeMapping.read(DriftSqlType.int, data['${effectivePrefix}id'])!,
      day: attachedDatabase.typeMapping.read(DriftSqlType.dateTime, data['${effectivePrefix}day'])!,
      title: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}title'],
      )!,
      goalId: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}goal_id'],
      ),
      promisedMinutes: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}promised_minutes'],
      )!,
      actualMinutes: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}actual_minutes'],
      ),
      status: $PromisesTable.$converterstatus.fromSql(
        attachedDatabase.typeMapping.read(DriftSqlType.int, data['${effectivePrefix}status'])!,
      ),
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
    );
  }

  @override
  $PromisesTable createAlias(String alias) {
    return $PromisesTable(attachedDatabase, alias);
  }

  static JsonTypeConverter2<PromiseStatus, int, int> $converterstatus =
      const EnumIndexConverter<PromiseStatus>(PromiseStatus.values);
}

class PromiseEntry extends DataClass implements Insertable<PromiseEntry> {
  final int id;
  final DateTime day;
  final String title;
  final int? goalId;
  final int promisedMinutes;

  /// Time actually spent, when it differs from the promise.
  final int? actualMinutes;
  final PromiseStatus status;
  final DateTime createdAt;
  const PromiseEntry({
    required this.id,
    required this.day,
    required this.title,
    this.goalId,
    required this.promisedMinutes,
    this.actualMinutes,
    required this.status,
    required this.createdAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['day'] = Variable<DateTime>(day);
    map['title'] = Variable<String>(title);
    if (!nullToAbsent || goalId != null) {
      map['goal_id'] = Variable<int>(goalId);
    }
    map['promised_minutes'] = Variable<int>(promisedMinutes);
    if (!nullToAbsent || actualMinutes != null) {
      map['actual_minutes'] = Variable<int>(actualMinutes);
    }
    {
      map['status'] = Variable<int>($PromisesTable.$converterstatus.toSql(status));
    }
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  PromisesCompanion toCompanion(bool nullToAbsent) {
    return PromisesCompanion(
      id: Value(id),
      day: Value(day),
      title: Value(title),
      goalId: goalId == null && nullToAbsent ? const Value.absent() : Value(goalId),
      promisedMinutes: Value(promisedMinutes),
      actualMinutes: actualMinutes == null && nullToAbsent
          ? const Value.absent()
          : Value(actualMinutes),
      status: Value(status),
      createdAt: Value(createdAt),
    );
  }

  factory PromiseEntry.fromJson(Map<String, dynamic> json, {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return PromiseEntry(
      id: serializer.fromJson<int>(json['id']),
      day: serializer.fromJson<DateTime>(json['day']),
      title: serializer.fromJson<String>(json['title']),
      goalId: serializer.fromJson<int?>(json['goalId']),
      promisedMinutes: serializer.fromJson<int>(json['promisedMinutes']),
      actualMinutes: serializer.fromJson<int?>(json['actualMinutes']),
      status: $PromisesTable.$converterstatus.fromJson(serializer.fromJson<int>(json['status'])),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'day': serializer.toJson<DateTime>(day),
      'title': serializer.toJson<String>(title),
      'goalId': serializer.toJson<int?>(goalId),
      'promisedMinutes': serializer.toJson<int>(promisedMinutes),
      'actualMinutes': serializer.toJson<int?>(actualMinutes),
      'status': serializer.toJson<int>($PromisesTable.$converterstatus.toJson(status)),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  PromiseEntry copyWith({
    int? id,
    DateTime? day,
    String? title,
    Value<int?> goalId = const Value.absent(),
    int? promisedMinutes,
    Value<int?> actualMinutes = const Value.absent(),
    PromiseStatus? status,
    DateTime? createdAt,
  }) => PromiseEntry(
    id: id ?? this.id,
    day: day ?? this.day,
    title: title ?? this.title,
    goalId: goalId.present ? goalId.value : this.goalId,
    promisedMinutes: promisedMinutes ?? this.promisedMinutes,
    actualMinutes: actualMinutes.present ? actualMinutes.value : this.actualMinutes,
    status: status ?? this.status,
    createdAt: createdAt ?? this.createdAt,
  );
  PromiseEntry copyWithCompanion(PromisesCompanion data) {
    return PromiseEntry(
      id: data.id.present ? data.id.value : this.id,
      day: data.day.present ? data.day.value : this.day,
      title: data.title.present ? data.title.value : this.title,
      goalId: data.goalId.present ? data.goalId.value : this.goalId,
      promisedMinutes: data.promisedMinutes.present
          ? data.promisedMinutes.value
          : this.promisedMinutes,
      actualMinutes: data.actualMinutes.present ? data.actualMinutes.value : this.actualMinutes,
      status: data.status.present ? data.status.value : this.status,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('PromiseEntry(')
          ..write('id: $id, ')
          ..write('day: $day, ')
          ..write('title: $title, ')
          ..write('goalId: $goalId, ')
          ..write('promisedMinutes: $promisedMinutes, ')
          ..write('actualMinutes: $actualMinutes, ')
          ..write('status: $status, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(id, day, title, goalId, promisedMinutes, actualMinutes, status, createdAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is PromiseEntry &&
          other.id == this.id &&
          other.day == this.day &&
          other.title == this.title &&
          other.goalId == this.goalId &&
          other.promisedMinutes == this.promisedMinutes &&
          other.actualMinutes == this.actualMinutes &&
          other.status == this.status &&
          other.createdAt == this.createdAt);
}

class PromisesCompanion extends UpdateCompanion<PromiseEntry> {
  final Value<int> id;
  final Value<DateTime> day;
  final Value<String> title;
  final Value<int?> goalId;
  final Value<int> promisedMinutes;
  final Value<int?> actualMinutes;
  final Value<PromiseStatus> status;
  final Value<DateTime> createdAt;
  const PromisesCompanion({
    this.id = const Value.absent(),
    this.day = const Value.absent(),
    this.title = const Value.absent(),
    this.goalId = const Value.absent(),
    this.promisedMinutes = const Value.absent(),
    this.actualMinutes = const Value.absent(),
    this.status = const Value.absent(),
    this.createdAt = const Value.absent(),
  });
  PromisesCompanion.insert({
    this.id = const Value.absent(),
    required DateTime day,
    required String title,
    this.goalId = const Value.absent(),
    required int promisedMinutes,
    this.actualMinutes = const Value.absent(),
    this.status = const Value.absent(),
    this.createdAt = const Value.absent(),
  }) : day = Value(day),
       title = Value(title),
       promisedMinutes = Value(promisedMinutes);
  static Insertable<PromiseEntry> custom({
    Expression<int>? id,
    Expression<DateTime>? day,
    Expression<String>? title,
    Expression<int>? goalId,
    Expression<int>? promisedMinutes,
    Expression<int>? actualMinutes,
    Expression<int>? status,
    Expression<DateTime>? createdAt,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (day != null) 'day': day,
      if (title != null) 'title': title,
      if (goalId != null) 'goal_id': goalId,
      if (promisedMinutes != null) 'promised_minutes': promisedMinutes,
      if (actualMinutes != null) 'actual_minutes': actualMinutes,
      if (status != null) 'status': status,
      if (createdAt != null) 'created_at': createdAt,
    });
  }

  PromisesCompanion copyWith({
    Value<int>? id,
    Value<DateTime>? day,
    Value<String>? title,
    Value<int?>? goalId,
    Value<int>? promisedMinutes,
    Value<int?>? actualMinutes,
    Value<PromiseStatus>? status,
    Value<DateTime>? createdAt,
  }) {
    return PromisesCompanion(
      id: id ?? this.id,
      day: day ?? this.day,
      title: title ?? this.title,
      goalId: goalId ?? this.goalId,
      promisedMinutes: promisedMinutes ?? this.promisedMinutes,
      actualMinutes: actualMinutes ?? this.actualMinutes,
      status: status ?? this.status,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (day.present) {
      map['day'] = Variable<DateTime>(day.value);
    }
    if (title.present) {
      map['title'] = Variable<String>(title.value);
    }
    if (goalId.present) {
      map['goal_id'] = Variable<int>(goalId.value);
    }
    if (promisedMinutes.present) {
      map['promised_minutes'] = Variable<int>(promisedMinutes.value);
    }
    if (actualMinutes.present) {
      map['actual_minutes'] = Variable<int>(actualMinutes.value);
    }
    if (status.present) {
      map['status'] = Variable<int>($PromisesTable.$converterstatus.toSql(status.value));
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('PromisesCompanion(')
          ..write('id: $id, ')
          ..write('day: $day, ')
          ..write('title: $title, ')
          ..write('goalId: $goalId, ')
          ..write('promisedMinutes: $promisedMinutes, ')
          ..write('actualMinutes: $actualMinutes, ')
          ..write('status: $status, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }
}

abstract class _$AppDb extends GeneratedDatabase {
  _$AppDb(QueryExecutor e) : super(e);
  $AppDbManager get managers => $AppDbManager(this);
  late final $LocationAlarmsTable locationAlarms = $LocationAlarmsTable(this);
  late final $RoutinesTable routines = $RoutinesTable(this);
  late final $OccurrencesTable occurrences = $OccurrencesTable(this);
  late final $GoalsTable goals = $GoalsTable(this);
  late final $PromisesTable promises = $PromisesTable(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [
    locationAlarms,
    routines,
    occurrences,
    goals,
    promises,
  ];
  @override
  StreamQueryUpdateRules get streamUpdateRules => const StreamQueryUpdateRules([
    WritePropagation(
      on: TableUpdateQuery.onTableName('routines', limitUpdateKind: UpdateKind.delete),
      result: [TableUpdate('occurrences', kind: UpdateKind.delete)],
    ),
    WritePropagation(
      on: TableUpdateQuery.onTableName('goals', limitUpdateKind: UpdateKind.delete),
      result: [TableUpdate('promises', kind: UpdateKind.update)],
    ),
  ]);
}

typedef $$LocationAlarmsTableCreateCompanionBuilder = LocationAlarmsCompanion Function({
  Value<int> id,
  required String name,
  required double lat,
  required double lng,
  Value<int> radiusMeters,
  Value<bool> enabled,
  Value<DateTime?> lastTriggeredAt,
  Value<bool> ringing,
  Value<bool?> inside,
  Value<int> rearmMeters,
  Value<DateTime> createdAt,
});
typedef $$LocationAlarmsTableUpdateCompanionBuilder = LocationAlarmsCompanion Function({
  Value<int> id,
  Value<String> name,
  Value<double> lat,
  Value<double> lng,
  Value<int> radiusMeters,
  Value<bool> enabled,
  Value<DateTime?> lastTriggeredAt,
  Value<bool> ringing,
  Value<bool?> inside,
  Value<int> rearmMeters,
  Value<DateTime> createdAt,
});

class $$LocationAlarmsTableFilterComposer extends Composer<_$AppDb, $LocationAlarmsTable> {
  $$LocationAlarmsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get lat =>
      $composableBuilder(column: $table.lat, builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get lng =>
      $composableBuilder(column: $table.lng, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get radiusMeters =>
      $composableBuilder(column: $table.radiusMeters, builder: (column) => ColumnFilters(column));

  ColumnFilters<bool> get enabled =>
      $composableBuilder(column: $table.enabled, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get lastTriggeredAt => $composableBuilder(
    column: $table.lastTriggeredAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get ringing =>
      $composableBuilder(column: $table.ringing, builder: (column) => ColumnFilters(column));

  ColumnFilters<bool> get inside =>
      $composableBuilder(column: $table.inside, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get rearmMeters =>
      $composableBuilder(column: $table.rearmMeters, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => ColumnFilters(column));
}

class $$LocationAlarmsTableOrderingComposer extends Composer<_$AppDb, $LocationAlarmsTable> {
  $$LocationAlarmsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get lat =>
      $composableBuilder(column: $table.lat, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get lng =>
      $composableBuilder(column: $table.lng, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get radiusMeters =>
      $composableBuilder(column: $table.radiusMeters, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<bool> get enabled =>
      $composableBuilder(column: $table.enabled, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get lastTriggeredAt => $composableBuilder(
    column: $table.lastTriggeredAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get ringing =>
      $composableBuilder(column: $table.ringing, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<bool> get inside =>
      $composableBuilder(column: $table.inside, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get rearmMeters =>
      $composableBuilder(column: $table.rearmMeters, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => ColumnOrderings(column));
}

class $$LocationAlarmsTableAnnotationComposer extends Composer<_$AppDb, $LocationAlarmsTable> {
  $$LocationAlarmsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id => $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<double> get lat =>
      $composableBuilder(column: $table.lat, builder: (column) => column);

  GeneratedColumn<double> get lng =>
      $composableBuilder(column: $table.lng, builder: (column) => column);

  GeneratedColumn<int> get radiusMeters =>
      $composableBuilder(column: $table.radiusMeters, builder: (column) => column);

  GeneratedColumn<bool> get enabled =>
      $composableBuilder(column: $table.enabled, builder: (column) => column);

  GeneratedColumn<DateTime> get lastTriggeredAt =>
      $composableBuilder(column: $table.lastTriggeredAt, builder: (column) => column);

  GeneratedColumn<bool> get ringing =>
      $composableBuilder(column: $table.ringing, builder: (column) => column);

  GeneratedColumn<bool> get inside =>
      $composableBuilder(column: $table.inside, builder: (column) => column);

  GeneratedColumn<int> get rearmMeters =>
      $composableBuilder(column: $table.rearmMeters, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$LocationAlarmsTableTableManager
    extends
        RootTableManager<
          _$AppDb,
          $LocationAlarmsTable,
          LocationAlarm,
          $$LocationAlarmsTableFilterComposer,
          $$LocationAlarmsTableOrderingComposer,
          $$LocationAlarmsTableAnnotationComposer,
          $$LocationAlarmsTableCreateCompanionBuilder,
          $$LocationAlarmsTableUpdateCompanionBuilder,
          (LocationAlarm, BaseReferences<_$AppDb, $LocationAlarmsTable, LocationAlarm>),
          LocationAlarm,
          PrefetchHooks Function()
        > {
  $$LocationAlarmsTableTableManager(_$AppDb db, $LocationAlarmsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$LocationAlarmsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$LocationAlarmsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$LocationAlarmsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                Value<String> name = const Value.absent(),
                Value<double> lat = const Value.absent(),
                Value<double> lng = const Value.absent(),
                Value<int> radiusMeters = const Value.absent(),
                Value<bool> enabled = const Value.absent(),
                Value<DateTime?> lastTriggeredAt = const Value.absent(),
                Value<bool> ringing = const Value.absent(),
                Value<bool?> inside = const Value.absent(),
                Value<int> rearmMeters = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
              }) => LocationAlarmsCompanion(
                id: id,
                name: name,
                lat: lat,
                lng: lng,
                radiusMeters: radiusMeters,
                enabled: enabled,
                lastTriggeredAt: lastTriggeredAt,
                ringing: ringing,
                inside: inside,
                rearmMeters: rearmMeters,
                createdAt: createdAt,
              ),
          createCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                required String name,
                required double lat,
                required double lng,
                Value<int> radiusMeters = const Value.absent(),
                Value<bool> enabled = const Value.absent(),
                Value<DateTime?> lastTriggeredAt = const Value.absent(),
                Value<bool> ringing = const Value.absent(),
                Value<bool?> inside = const Value.absent(),
                Value<int> rearmMeters = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
              }) => LocationAlarmsCompanion.insert(
                id: id,
                name: name,
                lat: lat,
                lng: lng,
                radiusMeters: radiusMeters,
                enabled: enabled,
                lastTriggeredAt: lastTriggeredAt,
                ringing: ringing,
                inside: inside,
                rearmMeters: rearmMeters,
                createdAt: createdAt,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$LocationAlarmsTable, LocationAlarm>(table),
                  BaseReferences<_$AppDb, $LocationAlarmsTable, LocationAlarm>(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$LocationAlarmsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDb,
      $LocationAlarmsTable,
      LocationAlarm,
      $$LocationAlarmsTableFilterComposer,
      $$LocationAlarmsTableOrderingComposer,
      $$LocationAlarmsTableAnnotationComposer,
      $$LocationAlarmsTableCreateCompanionBuilder,
      $$LocationAlarmsTableUpdateCompanionBuilder,
      (LocationAlarm, BaseReferences<_$AppDb, $LocationAlarmsTable, LocationAlarm>),
      LocationAlarm,
      PrefetchHooks Function()
    >;
typedef $$RoutinesTableCreateCompanionBuilder = RoutinesCompanion Function({
  Value<int> id,
  required String title,
  Value<String> notes,
  required RoutineKind kind,
  Value<int?> timeMinutes,
  Value<int?> untilMinutes,
  Value<int?> deadlineMinutes,
  Value<String?> recurrence,
  Value<DateTime?> startAt,
  Value<DateTime?> endAt,
  Value<int?> regenDays,
  Value<bool> nagEnabled,
  Value<int> firstIntervalMinutes,
  Value<int?> halfLifeMinutes,
  Value<bool> autoHalfLife,
  Value<double> factor,
  Value<int> minIntervalMinutes,
  Value<AlertStyle> alertStyle,
  Value<bool> active,
  Value<DateTime?> generatedThrough,
  Value<String?> systemKey,
  Value<DateTime> createdAt,
});
typedef $$RoutinesTableUpdateCompanionBuilder = RoutinesCompanion Function({
  Value<int> id,
  Value<String> title,
  Value<String> notes,
  Value<RoutineKind> kind,
  Value<int?> timeMinutes,
  Value<int?> untilMinutes,
  Value<int?> deadlineMinutes,
  Value<String?> recurrence,
  Value<DateTime?> startAt,
  Value<DateTime?> endAt,
  Value<int?> regenDays,
  Value<bool> nagEnabled,
  Value<int> firstIntervalMinutes,
  Value<int?> halfLifeMinutes,
  Value<bool> autoHalfLife,
  Value<double> factor,
  Value<int> minIntervalMinutes,
  Value<AlertStyle> alertStyle,
  Value<bool> active,
  Value<DateTime?> generatedThrough,
  Value<String?> systemKey,
  Value<DateTime> createdAt,
});

final class $$RoutinesTableReferences extends BaseReferences<_$AppDb, $RoutinesTable, Routine> {
  $$RoutinesTableReferences(super.$_db, super.$_table, super.$_typedResult);

  static MultiTypedResultKey<$OccurrencesTable, List<Occurrence>> _occurrencesRefsTable(
    _$AppDb db,
  ) => MultiTypedResultKey.fromTable(
    db.occurrences,
    aliasName: 'routines__id__occurrences__routine_id',
  );

  $$OccurrencesTableProcessedTableManager get occurrencesRefs {
    final manager = $$OccurrencesTableTableManager(
      $_db,
      $_db.occurrences,
    ).filter((f) => f.routineId.id.sqlEquals($_itemColumn<int>('id')!));

    final cache = $_typedResult.readTableOrNull(_occurrencesRefsTable($_db));
    return ProcessedTableManager(manager.$state.copyWith(prefetchedData: cache));
  }
}

class $$RoutinesTableFilterComposer extends Composer<_$AppDb, $RoutinesTable> {
  $$RoutinesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get title =>
      $composableBuilder(column: $table.title, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get notes =>
      $composableBuilder(column: $table.notes, builder: (column) => ColumnFilters(column));

  ColumnWithTypeConverterFilters<RoutineKind, RoutineKind, int> get kind => $composableBuilder(
    column: $table.kind,
    builder: (column) => ColumnWithTypeConverterFilters(column),
  );

  ColumnFilters<int> get timeMinutes =>
      $composableBuilder(column: $table.timeMinutes, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get untilMinutes =>
      $composableBuilder(column: $table.untilMinutes, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get deadlineMinutes => $composableBuilder(
    column: $table.deadlineMinutes,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get recurrence =>
      $composableBuilder(column: $table.recurrence, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get startAt =>
      $composableBuilder(column: $table.startAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get endAt =>
      $composableBuilder(column: $table.endAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get regenDays =>
      $composableBuilder(column: $table.regenDays, builder: (column) => ColumnFilters(column));

  ColumnFilters<bool> get nagEnabled =>
      $composableBuilder(column: $table.nagEnabled, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get firstIntervalMinutes => $composableBuilder(
    column: $table.firstIntervalMinutes,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get halfLifeMinutes => $composableBuilder(
    column: $table.halfLifeMinutes,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get autoHalfLife =>
      $composableBuilder(column: $table.autoHalfLife, builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get factor =>
      $composableBuilder(column: $table.factor, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get minIntervalMinutes => $composableBuilder(
    column: $table.minIntervalMinutes,
    builder: (column) => ColumnFilters(column),
  );

  ColumnWithTypeConverterFilters<AlertStyle, AlertStyle, int> get alertStyle => $composableBuilder(
    column: $table.alertStyle,
    builder: (column) => ColumnWithTypeConverterFilters(column),
  );

  ColumnFilters<bool> get active =>
      $composableBuilder(column: $table.active, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get generatedThrough => $composableBuilder(
    column: $table.generatedThrough,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get systemKey =>
      $composableBuilder(column: $table.systemKey, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => ColumnFilters(column));

  Expression<bool> occurrencesRefs(
    Expression<bool> Function($$OccurrencesTableFilterComposer f) f,
  ) {
    final $$OccurrencesTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.occurrences,
      getReferencedColumn: (t) => t.routineId,
      builder: (joinBuilder, {$addJoinBuilderToRootComposer, $removeJoinBuilderFromRootComposer}) =>
          $$OccurrencesTableFilterComposer(
            $db: $db,
            $table: $db.occurrences,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer: $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$RoutinesTableOrderingComposer extends Composer<_$AppDb, $RoutinesTable> {
  $$RoutinesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get title =>
      $composableBuilder(column: $table.title, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get notes =>
      $composableBuilder(column: $table.notes, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get kind =>
      $composableBuilder(column: $table.kind, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get timeMinutes =>
      $composableBuilder(column: $table.timeMinutes, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get untilMinutes =>
      $composableBuilder(column: $table.untilMinutes, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get deadlineMinutes => $composableBuilder(
    column: $table.deadlineMinutes,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get recurrence =>
      $composableBuilder(column: $table.recurrence, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get startAt =>
      $composableBuilder(column: $table.startAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get endAt =>
      $composableBuilder(column: $table.endAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get regenDays =>
      $composableBuilder(column: $table.regenDays, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<bool> get nagEnabled =>
      $composableBuilder(column: $table.nagEnabled, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get firstIntervalMinutes => $composableBuilder(
    column: $table.firstIntervalMinutes,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get halfLifeMinutes => $composableBuilder(
    column: $table.halfLifeMinutes,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get autoHalfLife =>
      $composableBuilder(column: $table.autoHalfLife, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get factor =>
      $composableBuilder(column: $table.factor, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get minIntervalMinutes => $composableBuilder(
    column: $table.minIntervalMinutes,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get alertStyle =>
      $composableBuilder(column: $table.alertStyle, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<bool> get active =>
      $composableBuilder(column: $table.active, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get generatedThrough => $composableBuilder(
    column: $table.generatedThrough,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get systemKey =>
      $composableBuilder(column: $table.systemKey, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => ColumnOrderings(column));
}

class $$RoutinesTableAnnotationComposer extends Composer<_$AppDb, $RoutinesTable> {
  $$RoutinesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id => $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get title =>
      $composableBuilder(column: $table.title, builder: (column) => column);

  GeneratedColumn<String> get notes =>
      $composableBuilder(column: $table.notes, builder: (column) => column);

  GeneratedColumnWithTypeConverter<RoutineKind, int> get kind =>
      $composableBuilder(column: $table.kind, builder: (column) => column);

  GeneratedColumn<int> get timeMinutes =>
      $composableBuilder(column: $table.timeMinutes, builder: (column) => column);

  GeneratedColumn<int> get untilMinutes =>
      $composableBuilder(column: $table.untilMinutes, builder: (column) => column);

  GeneratedColumn<int> get deadlineMinutes =>
      $composableBuilder(column: $table.deadlineMinutes, builder: (column) => column);

  GeneratedColumn<String> get recurrence =>
      $composableBuilder(column: $table.recurrence, builder: (column) => column);

  GeneratedColumn<DateTime> get startAt =>
      $composableBuilder(column: $table.startAt, builder: (column) => column);

  GeneratedColumn<DateTime> get endAt =>
      $composableBuilder(column: $table.endAt, builder: (column) => column);

  GeneratedColumn<int> get regenDays =>
      $composableBuilder(column: $table.regenDays, builder: (column) => column);

  GeneratedColumn<bool> get nagEnabled =>
      $composableBuilder(column: $table.nagEnabled, builder: (column) => column);

  GeneratedColumn<int> get firstIntervalMinutes =>
      $composableBuilder(column: $table.firstIntervalMinutes, builder: (column) => column);

  GeneratedColumn<int> get halfLifeMinutes =>
      $composableBuilder(column: $table.halfLifeMinutes, builder: (column) => column);

  GeneratedColumn<bool> get autoHalfLife =>
      $composableBuilder(column: $table.autoHalfLife, builder: (column) => column);

  GeneratedColumn<double> get factor =>
      $composableBuilder(column: $table.factor, builder: (column) => column);

  GeneratedColumn<int> get minIntervalMinutes =>
      $composableBuilder(column: $table.minIntervalMinutes, builder: (column) => column);

  GeneratedColumnWithTypeConverter<AlertStyle, int> get alertStyle =>
      $composableBuilder(column: $table.alertStyle, builder: (column) => column);

  GeneratedColumn<bool> get active =>
      $composableBuilder(column: $table.active, builder: (column) => column);

  GeneratedColumn<DateTime> get generatedThrough =>
      $composableBuilder(column: $table.generatedThrough, builder: (column) => column);

  GeneratedColumn<String> get systemKey =>
      $composableBuilder(column: $table.systemKey, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  Expression<T> occurrencesRefs<T extends Object>(
    Expression<T> Function($$OccurrencesTableAnnotationComposer a) f,
  ) {
    final $$OccurrencesTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.occurrences,
      getReferencedColumn: (t) => t.routineId,
      builder: (joinBuilder, {$addJoinBuilderToRootComposer, $removeJoinBuilderFromRootComposer}) =>
          $$OccurrencesTableAnnotationComposer(
            $db: $db,
            $table: $db.occurrences,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer: $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$RoutinesTableTableManager
    extends
        RootTableManager<
          _$AppDb,
          $RoutinesTable,
          Routine,
          $$RoutinesTableFilterComposer,
          $$RoutinesTableOrderingComposer,
          $$RoutinesTableAnnotationComposer,
          $$RoutinesTableCreateCompanionBuilder,
          $$RoutinesTableUpdateCompanionBuilder,
          (Routine, $$RoutinesTableReferences),
          Routine,
          PrefetchHooks Function({bool occurrencesRefs})
        > {
  $$RoutinesTableTableManager(_$AppDb db, $RoutinesTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () => $$RoutinesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () => $$RoutinesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$RoutinesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                Value<String> title = const Value.absent(),
                Value<String> notes = const Value.absent(),
                Value<RoutineKind> kind = const Value.absent(),
                Value<int?> timeMinutes = const Value.absent(),
                Value<int?> untilMinutes = const Value.absent(),
                Value<int?> deadlineMinutes = const Value.absent(),
                Value<String?> recurrence = const Value.absent(),
                Value<DateTime?> startAt = const Value.absent(),
                Value<DateTime?> endAt = const Value.absent(),
                Value<int?> regenDays = const Value.absent(),
                Value<bool> nagEnabled = const Value.absent(),
                Value<int> firstIntervalMinutes = const Value.absent(),
                Value<int?> halfLifeMinutes = const Value.absent(),
                Value<bool> autoHalfLife = const Value.absent(),
                Value<double> factor = const Value.absent(),
                Value<int> minIntervalMinutes = const Value.absent(),
                Value<AlertStyle> alertStyle = const Value.absent(),
                Value<bool> active = const Value.absent(),
                Value<DateTime?> generatedThrough = const Value.absent(),
                Value<String?> systemKey = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
              }) => RoutinesCompanion(
                id: id,
                title: title,
                notes: notes,
                kind: kind,
                timeMinutes: timeMinutes,
                untilMinutes: untilMinutes,
                deadlineMinutes: deadlineMinutes,
                recurrence: recurrence,
                startAt: startAt,
                endAt: endAt,
                regenDays: regenDays,
                nagEnabled: nagEnabled,
                firstIntervalMinutes: firstIntervalMinutes,
                halfLifeMinutes: halfLifeMinutes,
                autoHalfLife: autoHalfLife,
                factor: factor,
                minIntervalMinutes: minIntervalMinutes,
                alertStyle: alertStyle,
                active: active,
                generatedThrough: generatedThrough,
                systemKey: systemKey,
                createdAt: createdAt,
              ),
          createCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                required String title,
                Value<String> notes = const Value.absent(),
                required RoutineKind kind,
                Value<int?> timeMinutes = const Value.absent(),
                Value<int?> untilMinutes = const Value.absent(),
                Value<int?> deadlineMinutes = const Value.absent(),
                Value<String?> recurrence = const Value.absent(),
                Value<DateTime?> startAt = const Value.absent(),
                Value<DateTime?> endAt = const Value.absent(),
                Value<int?> regenDays = const Value.absent(),
                Value<bool> nagEnabled = const Value.absent(),
                Value<int> firstIntervalMinutes = const Value.absent(),
                Value<int?> halfLifeMinutes = const Value.absent(),
                Value<bool> autoHalfLife = const Value.absent(),
                Value<double> factor = const Value.absent(),
                Value<int> minIntervalMinutes = const Value.absent(),
                Value<AlertStyle> alertStyle = const Value.absent(),
                Value<bool> active = const Value.absent(),
                Value<DateTime?> generatedThrough = const Value.absent(),
                Value<String?> systemKey = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
              }) => RoutinesCompanion.insert(
                id: id,
                title: title,
                notes: notes,
                kind: kind,
                timeMinutes: timeMinutes,
                untilMinutes: untilMinutes,
                deadlineMinutes: deadlineMinutes,
                recurrence: recurrence,
                startAt: startAt,
                endAt: endAt,
                regenDays: regenDays,
                nagEnabled: nagEnabled,
                firstIntervalMinutes: firstIntervalMinutes,
                halfLifeMinutes: halfLifeMinutes,
                autoHalfLife: autoHalfLife,
                factor: factor,
                minIntervalMinutes: minIntervalMinutes,
                alertStyle: alertStyle,
                active: active,
                generatedThrough: generatedThrough,
                systemKey: systemKey,
                createdAt: createdAt,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$RoutinesTable, Routine>(table),
                  $$RoutinesTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: ({occurrencesRefs = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [if (occurrencesRefs) db.occurrences],
              addJoins: null,
              getPrefetchedDataCallback: (items) async {
                return [
                  if (occurrencesRefs)
                    await $_getPrefetchedData<Routine, $RoutinesTable, Occurrence>(
                      currentTable: table,
                      referencedTable: $$RoutinesTableReferences._occurrencesRefsTable(db),
                      managerFromTypedResult: (p0) =>
                          $$RoutinesTableReferences(db, table, p0).occurrencesRefs,
                      referencedItemsForCurrentItem: (item, referencedItems) =>
                          referencedItems.where((e) => e.routineId == item.id),
                      typedResults: items,
                    ),
                ];
              },
            );
          },
        ),
      );
}

typedef $$RoutinesTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDb,
      $RoutinesTable,
      Routine,
      $$RoutinesTableFilterComposer,
      $$RoutinesTableOrderingComposer,
      $$RoutinesTableAnnotationComposer,
      $$RoutinesTableCreateCompanionBuilder,
      $$RoutinesTableUpdateCompanionBuilder,
      (Routine, $$RoutinesTableReferences),
      Routine,
      PrefetchHooks Function({bool occurrencesRefs})
    >;
typedef $$OccurrencesTableCreateCompanionBuilder = OccurrencesCompanion Function({
  Value<int> id,
  required int routineId,
  required DateTime day,
  required DateTime startAt,
  Value<DateTime?> windowEnd,
  Value<OccurrenceStatus> status,
  Value<DateTime?> doneAt,
  Value<DateTime?> snoozedUntil,
  Value<DateTime?> lastFiredAt,
  Value<bool> missedAlertSent,
  Value<bool> quiet,
});
typedef $$OccurrencesTableUpdateCompanionBuilder = OccurrencesCompanion Function({
  Value<int> id,
  Value<int> routineId,
  Value<DateTime> day,
  Value<DateTime> startAt,
  Value<DateTime?> windowEnd,
  Value<OccurrenceStatus> status,
  Value<DateTime?> doneAt,
  Value<DateTime?> snoozedUntil,
  Value<DateTime?> lastFiredAt,
  Value<bool> missedAlertSent,
  Value<bool> quiet,
});

final class $$OccurrencesTableReferences
    extends BaseReferences<_$AppDb, $OccurrencesTable, Occurrence> {
  $$OccurrencesTableReferences(super.$_db, super.$_table, super.$_typedResult);

  static $RoutinesTable _routineIdTable(_$AppDb db) =>
      db.routines.createAlias('occurrences__routine_id__routines__id');

  $$RoutinesTableProcessedTableManager get routineId {
    final $_column = $_itemColumn<int>('routine_id')!;

    final manager = $$RoutinesTableTableManager(
      $_db,
      $_db.routines,
    ).filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_routineIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(manager.$state.copyWith(prefetchedData: [item]));
  }
}

class $$OccurrencesTableFilterComposer extends Composer<_$AppDb, $OccurrencesTable> {
  $$OccurrencesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get day =>
      $composableBuilder(column: $table.day, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get startAt =>
      $composableBuilder(column: $table.startAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get windowEnd =>
      $composableBuilder(column: $table.windowEnd, builder: (column) => ColumnFilters(column));

  ColumnWithTypeConverterFilters<OccurrenceStatus, OccurrenceStatus, int> get status =>
      $composableBuilder(
        column: $table.status,
        builder: (column) => ColumnWithTypeConverterFilters(column),
      );

  ColumnFilters<DateTime> get doneAt =>
      $composableBuilder(column: $table.doneAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get snoozedUntil =>
      $composableBuilder(column: $table.snoozedUntil, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get lastFiredAt =>
      $composableBuilder(column: $table.lastFiredAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<bool> get missedAlertSent => $composableBuilder(
    column: $table.missedAlertSent,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get quiet =>
      $composableBuilder(column: $table.quiet, builder: (column) => ColumnFilters(column));

  $$RoutinesTableFilterComposer get routineId {
    final $$RoutinesTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.routineId,
      referencedTable: $db.routines,
      getReferencedColumn: (t) => t.id,
      builder: (joinBuilder, {$addJoinBuilderToRootComposer, $removeJoinBuilderFromRootComposer}) =>
          $$RoutinesTableFilterComposer(
            $db: $db,
            $table: $db.routines,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer: $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$OccurrencesTableOrderingComposer extends Composer<_$AppDb, $OccurrencesTable> {
  $$OccurrencesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get day =>
      $composableBuilder(column: $table.day, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get startAt =>
      $composableBuilder(column: $table.startAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get windowEnd =>
      $composableBuilder(column: $table.windowEnd, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get status =>
      $composableBuilder(column: $table.status, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get doneAt =>
      $composableBuilder(column: $table.doneAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get snoozedUntil =>
      $composableBuilder(column: $table.snoozedUntil, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get lastFiredAt =>
      $composableBuilder(column: $table.lastFiredAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<bool> get missedAlertSent => $composableBuilder(
    column: $table.missedAlertSent,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get quiet =>
      $composableBuilder(column: $table.quiet, builder: (column) => ColumnOrderings(column));

  $$RoutinesTableOrderingComposer get routineId {
    final $$RoutinesTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.routineId,
      referencedTable: $db.routines,
      getReferencedColumn: (t) => t.id,
      builder: (joinBuilder, {$addJoinBuilderToRootComposer, $removeJoinBuilderFromRootComposer}) =>
          $$RoutinesTableOrderingComposer(
            $db: $db,
            $table: $db.routines,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer: $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$OccurrencesTableAnnotationComposer extends Composer<_$AppDb, $OccurrencesTable> {
  $$OccurrencesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id => $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<DateTime> get day =>
      $composableBuilder(column: $table.day, builder: (column) => column);

  GeneratedColumn<DateTime> get startAt =>
      $composableBuilder(column: $table.startAt, builder: (column) => column);

  GeneratedColumn<DateTime> get windowEnd =>
      $composableBuilder(column: $table.windowEnd, builder: (column) => column);

  GeneratedColumnWithTypeConverter<OccurrenceStatus, int> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<DateTime> get doneAt =>
      $composableBuilder(column: $table.doneAt, builder: (column) => column);

  GeneratedColumn<DateTime> get snoozedUntil =>
      $composableBuilder(column: $table.snoozedUntil, builder: (column) => column);

  GeneratedColumn<DateTime> get lastFiredAt =>
      $composableBuilder(column: $table.lastFiredAt, builder: (column) => column);

  GeneratedColumn<bool> get missedAlertSent =>
      $composableBuilder(column: $table.missedAlertSent, builder: (column) => column);

  GeneratedColumn<bool> get quiet =>
      $composableBuilder(column: $table.quiet, builder: (column) => column);

  $$RoutinesTableAnnotationComposer get routineId {
    final $$RoutinesTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.routineId,
      referencedTable: $db.routines,
      getReferencedColumn: (t) => t.id,
      builder: (joinBuilder, {$addJoinBuilderToRootComposer, $removeJoinBuilderFromRootComposer}) =>
          $$RoutinesTableAnnotationComposer(
            $db: $db,
            $table: $db.routines,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer: $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$OccurrencesTableTableManager
    extends
        RootTableManager<
          _$AppDb,
          $OccurrencesTable,
          Occurrence,
          $$OccurrencesTableFilterComposer,
          $$OccurrencesTableOrderingComposer,
          $$OccurrencesTableAnnotationComposer,
          $$OccurrencesTableCreateCompanionBuilder,
          $$OccurrencesTableUpdateCompanionBuilder,
          (Occurrence, $$OccurrencesTableReferences),
          Occurrence,
          PrefetchHooks Function({bool routineId})
        > {
  $$OccurrencesTableTableManager(_$AppDb db, $OccurrencesTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () => $$OccurrencesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () => $$OccurrencesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$OccurrencesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                Value<int> routineId = const Value.absent(),
                Value<DateTime> day = const Value.absent(),
                Value<DateTime> startAt = const Value.absent(),
                Value<DateTime?> windowEnd = const Value.absent(),
                Value<OccurrenceStatus> status = const Value.absent(),
                Value<DateTime?> doneAt = const Value.absent(),
                Value<DateTime?> snoozedUntil = const Value.absent(),
                Value<DateTime?> lastFiredAt = const Value.absent(),
                Value<bool> missedAlertSent = const Value.absent(),
                Value<bool> quiet = const Value.absent(),
              }) => OccurrencesCompanion(
                id: id,
                routineId: routineId,
                day: day,
                startAt: startAt,
                windowEnd: windowEnd,
                status: status,
                doneAt: doneAt,
                snoozedUntil: snoozedUntil,
                lastFiredAt: lastFiredAt,
                missedAlertSent: missedAlertSent,
                quiet: quiet,
              ),
          createCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                required int routineId,
                required DateTime day,
                required DateTime startAt,
                Value<DateTime?> windowEnd = const Value.absent(),
                Value<OccurrenceStatus> status = const Value.absent(),
                Value<DateTime?> doneAt = const Value.absent(),
                Value<DateTime?> snoozedUntil = const Value.absent(),
                Value<DateTime?> lastFiredAt = const Value.absent(),
                Value<bool> missedAlertSent = const Value.absent(),
                Value<bool> quiet = const Value.absent(),
              }) => OccurrencesCompanion.insert(
                id: id,
                routineId: routineId,
                day: day,
                startAt: startAt,
                windowEnd: windowEnd,
                status: status,
                doneAt: doneAt,
                snoozedUntil: snoozedUntil,
                lastFiredAt: lastFiredAt,
                missedAlertSent: missedAlertSent,
                quiet: quiet,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$OccurrencesTable, Occurrence>(table),
                  $$OccurrencesTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: ({routineId = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [],
              addJoins:
                  <
                    T extends TableManagerState<
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic
                    >
                  >(state) {
                    if (routineId) {
                      state = state.withJoin(
                        currentTable: table,
                        currentColumn: table.routineId,
                        referencedTable: $$OccurrencesTableReferences._routineIdTable(db),
                        referencedColumn: $$OccurrencesTableReferences._routineIdTable(db).id,
                      ) as T;
                    }

                    return state;
                  },
              getPrefetchedDataCallback: (items) async {
                return [];
              },
            );
          },
        ),
      );
}

typedef $$OccurrencesTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDb,
      $OccurrencesTable,
      Occurrence,
      $$OccurrencesTableFilterComposer,
      $$OccurrencesTableOrderingComposer,
      $$OccurrencesTableAnnotationComposer,
      $$OccurrencesTableCreateCompanionBuilder,
      $$OccurrencesTableUpdateCompanionBuilder,
      (Occurrence, $$OccurrencesTableReferences),
      Occurrence,
      PrefetchHooks Function({bool routineId})
    >;
typedef $$GoalsTableCreateCompanionBuilder = GoalsCompanion Function({
  Value<int> id,
  required String name,
  required int targetMinutes,
  required DateTime startDate,
  required int totalDays,
  Value<bool> archived,
  Value<DateTime> createdAt,
});
typedef $$GoalsTableUpdateCompanionBuilder = GoalsCompanion Function({
  Value<int> id,
  Value<String> name,
  Value<int> targetMinutes,
  Value<DateTime> startDate,
  Value<int> totalDays,
  Value<bool> archived,
  Value<DateTime> createdAt,
});

final class $$GoalsTableReferences extends BaseReferences<_$AppDb, $GoalsTable, Goal> {
  $$GoalsTableReferences(super.$_db, super.$_table, super.$_typedResult);

  static MultiTypedResultKey<$PromisesTable, List<PromiseEntry>> _promisesRefsTable(_$AppDb db) =>
      MultiTypedResultKey.fromTable(db.promises, aliasName: 'goals__id__promises__goal_id');

  $$PromisesTableProcessedTableManager get promisesRefs {
    final manager = $$PromisesTableTableManager(
      $_db,
      $_db.promises,
    ).filter((f) => f.goalId.id.sqlEquals($_itemColumn<int>('id')!));

    final cache = $_typedResult.readTableOrNull(_promisesRefsTable($_db));
    return ProcessedTableManager(manager.$state.copyWith(prefetchedData: cache));
  }
}

class $$GoalsTableFilterComposer extends Composer<_$AppDb, $GoalsTable> {
  $$GoalsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get targetMinutes =>
      $composableBuilder(column: $table.targetMinutes, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get startDate =>
      $composableBuilder(column: $table.startDate, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get totalDays =>
      $composableBuilder(column: $table.totalDays, builder: (column) => ColumnFilters(column));

  ColumnFilters<bool> get archived =>
      $composableBuilder(column: $table.archived, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => ColumnFilters(column));

  Expression<bool> promisesRefs(Expression<bool> Function($$PromisesTableFilterComposer f) f) {
    final $$PromisesTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.promises,
      getReferencedColumn: (t) => t.goalId,
      builder: (joinBuilder, {$addJoinBuilderToRootComposer, $removeJoinBuilderFromRootComposer}) =>
          $$PromisesTableFilterComposer(
            $db: $db,
            $table: $db.promises,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer: $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$GoalsTableOrderingComposer extends Composer<_$AppDb, $GoalsTable> {
  $$GoalsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get targetMinutes => $composableBuilder(
    column: $table.targetMinutes,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get startDate =>
      $composableBuilder(column: $table.startDate, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get totalDays =>
      $composableBuilder(column: $table.totalDays, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<bool> get archived =>
      $composableBuilder(column: $table.archived, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => ColumnOrderings(column));
}

class $$GoalsTableAnnotationComposer extends Composer<_$AppDb, $GoalsTable> {
  $$GoalsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id => $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<int> get targetMinutes =>
      $composableBuilder(column: $table.targetMinutes, builder: (column) => column);

  GeneratedColumn<DateTime> get startDate =>
      $composableBuilder(column: $table.startDate, builder: (column) => column);

  GeneratedColumn<int> get totalDays =>
      $composableBuilder(column: $table.totalDays, builder: (column) => column);

  GeneratedColumn<bool> get archived =>
      $composableBuilder(column: $table.archived, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  Expression<T> promisesRefs<T extends Object>(
    Expression<T> Function($$PromisesTableAnnotationComposer a) f,
  ) {
    final $$PromisesTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.promises,
      getReferencedColumn: (t) => t.goalId,
      builder: (joinBuilder, {$addJoinBuilderToRootComposer, $removeJoinBuilderFromRootComposer}) =>
          $$PromisesTableAnnotationComposer(
            $db: $db,
            $table: $db.promises,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer: $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$GoalsTableTableManager
    extends
        RootTableManager<
          _$AppDb,
          $GoalsTable,
          Goal,
          $$GoalsTableFilterComposer,
          $$GoalsTableOrderingComposer,
          $$GoalsTableAnnotationComposer,
          $$GoalsTableCreateCompanionBuilder,
          $$GoalsTableUpdateCompanionBuilder,
          (Goal, $$GoalsTableReferences),
          Goal,
          PrefetchHooks Function({bool promisesRefs})
        > {
  $$GoalsTableTableManager(_$AppDb db, $GoalsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () => $$GoalsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () => $$GoalsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () => $$GoalsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                Value<String> name = const Value.absent(),
                Value<int> targetMinutes = const Value.absent(),
                Value<DateTime> startDate = const Value.absent(),
                Value<int> totalDays = const Value.absent(),
                Value<bool> archived = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
              }) => GoalsCompanion(
                id: id,
                name: name,
                targetMinutes: targetMinutes,
                startDate: startDate,
                totalDays: totalDays,
                archived: archived,
                createdAt: createdAt,
              ),
          createCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                required String name,
                required int targetMinutes,
                required DateTime startDate,
                required int totalDays,
                Value<bool> archived = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
              }) => GoalsCompanion.insert(
                id: id,
                name: name,
                targetMinutes: targetMinutes,
                startDate: startDate,
                totalDays: totalDays,
                archived: archived,
                createdAt: createdAt,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) =>
                    (e.readTable<$GoalsTable, Goal>(table), $$GoalsTableReferences(db, table, e)),
              )
              .toList(),
          prefetchHooksCallback: ({promisesRefs = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [if (promisesRefs) db.promises],
              addJoins: null,
              getPrefetchedDataCallback: (items) async {
                return [
                  if (promisesRefs)
                    await $_getPrefetchedData<Goal, $GoalsTable, PromiseEntry>(
                      currentTable: table,
                      referencedTable: $$GoalsTableReferences._promisesRefsTable(db),
                      managerFromTypedResult: (p0) =>
                          $$GoalsTableReferences(db, table, p0).promisesRefs,
                      referencedItemsForCurrentItem: (item, referencedItems) =>
                          referencedItems.where((e) => e.goalId == item.id),
                      typedResults: items,
                    ),
                ];
              },
            );
          },
        ),
      );
}

typedef $$GoalsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDb,
      $GoalsTable,
      Goal,
      $$GoalsTableFilterComposer,
      $$GoalsTableOrderingComposer,
      $$GoalsTableAnnotationComposer,
      $$GoalsTableCreateCompanionBuilder,
      $$GoalsTableUpdateCompanionBuilder,
      (Goal, $$GoalsTableReferences),
      Goal,
      PrefetchHooks Function({bool promisesRefs})
    >;
typedef $$PromisesTableCreateCompanionBuilder = PromisesCompanion Function({
  Value<int> id,
  required DateTime day,
  required String title,
  Value<int?> goalId,
  required int promisedMinutes,
  Value<int?> actualMinutes,
  Value<PromiseStatus> status,
  Value<DateTime> createdAt,
});
typedef $$PromisesTableUpdateCompanionBuilder = PromisesCompanion Function({
  Value<int> id,
  Value<DateTime> day,
  Value<String> title,
  Value<int?> goalId,
  Value<int> promisedMinutes,
  Value<int?> actualMinutes,
  Value<PromiseStatus> status,
  Value<DateTime> createdAt,
});

final class $$PromisesTableReferences
    extends BaseReferences<_$AppDb, $PromisesTable, PromiseEntry> {
  $$PromisesTableReferences(super.$_db, super.$_table, super.$_typedResult);

  static $GoalsTable _goalIdTable(_$AppDb db) =>
      db.goals.createAlias('promises__goal_id__goals__id');

  $$GoalsTableProcessedTableManager? get goalId {
    final $_column = $_itemColumn<int>('goal_id');
    if ($_column == null) return null;
    final manager = $$GoalsTableTableManager(
      $_db,
      $_db.goals,
    ).filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_goalIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(manager.$state.copyWith(prefetchedData: [item]));
  }
}

class $$PromisesTableFilterComposer extends Composer<_$AppDb, $PromisesTable> {
  $$PromisesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get day =>
      $composableBuilder(column: $table.day, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get title =>
      $composableBuilder(column: $table.title, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get promisedMinutes => $composableBuilder(
    column: $table.promisedMinutes,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get actualMinutes =>
      $composableBuilder(column: $table.actualMinutes, builder: (column) => ColumnFilters(column));

  ColumnWithTypeConverterFilters<PromiseStatus, PromiseStatus, int> get status =>
      $composableBuilder(
        column: $table.status,
        builder: (column) => ColumnWithTypeConverterFilters(column),
      );

  ColumnFilters<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => ColumnFilters(column));

  $$GoalsTableFilterComposer get goalId {
    final $$GoalsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.goalId,
      referencedTable: $db.goals,
      getReferencedColumn: (t) => t.id,
      builder: (joinBuilder, {$addJoinBuilderToRootComposer, $removeJoinBuilderFromRootComposer}) =>
          $$GoalsTableFilterComposer(
            $db: $db,
            $table: $db.goals,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer: $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$PromisesTableOrderingComposer extends Composer<_$AppDb, $PromisesTable> {
  $$PromisesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get day =>
      $composableBuilder(column: $table.day, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get title =>
      $composableBuilder(column: $table.title, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get promisedMinutes => $composableBuilder(
    column: $table.promisedMinutes,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get actualMinutes => $composableBuilder(
    column: $table.actualMinutes,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get status =>
      $composableBuilder(column: $table.status, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => ColumnOrderings(column));

  $$GoalsTableOrderingComposer get goalId {
    final $$GoalsTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.goalId,
      referencedTable: $db.goals,
      getReferencedColumn: (t) => t.id,
      builder: (joinBuilder, {$addJoinBuilderToRootComposer, $removeJoinBuilderFromRootComposer}) =>
          $$GoalsTableOrderingComposer(
            $db: $db,
            $table: $db.goals,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer: $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$PromisesTableAnnotationComposer extends Composer<_$AppDb, $PromisesTable> {
  $$PromisesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id => $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<DateTime> get day =>
      $composableBuilder(column: $table.day, builder: (column) => column);

  GeneratedColumn<String> get title =>
      $composableBuilder(column: $table.title, builder: (column) => column);

  GeneratedColumn<int> get promisedMinutes =>
      $composableBuilder(column: $table.promisedMinutes, builder: (column) => column);

  GeneratedColumn<int> get actualMinutes =>
      $composableBuilder(column: $table.actualMinutes, builder: (column) => column);

  GeneratedColumnWithTypeConverter<PromiseStatus, int> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  $$GoalsTableAnnotationComposer get goalId {
    final $$GoalsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.goalId,
      referencedTable: $db.goals,
      getReferencedColumn: (t) => t.id,
      builder: (joinBuilder, {$addJoinBuilderToRootComposer, $removeJoinBuilderFromRootComposer}) =>
          $$GoalsTableAnnotationComposer(
            $db: $db,
            $table: $db.goals,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer: $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$PromisesTableTableManager
    extends
        RootTableManager<
          _$AppDb,
          $PromisesTable,
          PromiseEntry,
          $$PromisesTableFilterComposer,
          $$PromisesTableOrderingComposer,
          $$PromisesTableAnnotationComposer,
          $$PromisesTableCreateCompanionBuilder,
          $$PromisesTableUpdateCompanionBuilder,
          (PromiseEntry, $$PromisesTableReferences),
          PromiseEntry,
          PrefetchHooks Function({bool goalId})
        > {
  $$PromisesTableTableManager(_$AppDb db, $PromisesTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () => $$PromisesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () => $$PromisesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$PromisesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                Value<DateTime> day = const Value.absent(),
                Value<String> title = const Value.absent(),
                Value<int?> goalId = const Value.absent(),
                Value<int> promisedMinutes = const Value.absent(),
                Value<int?> actualMinutes = const Value.absent(),
                Value<PromiseStatus> status = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
              }) => PromisesCompanion(
                id: id,
                day: day,
                title: title,
                goalId: goalId,
                promisedMinutes: promisedMinutes,
                actualMinutes: actualMinutes,
                status: status,
                createdAt: createdAt,
              ),
          createCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                required DateTime day,
                required String title,
                Value<int?> goalId = const Value.absent(),
                required int promisedMinutes,
                Value<int?> actualMinutes = const Value.absent(),
                Value<PromiseStatus> status = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
              }) => PromisesCompanion.insert(
                id: id,
                day: day,
                title: title,
                goalId: goalId,
                promisedMinutes: promisedMinutes,
                actualMinutes: actualMinutes,
                status: status,
                createdAt: createdAt,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$PromisesTable, PromiseEntry>(table),
                  $$PromisesTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: ({goalId = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [],
              addJoins:
                  <
                    T extends TableManagerState<
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic
                    >
                  >(state) {
                    if (goalId) {
                      state = state.withJoin(
                        currentTable: table,
                        currentColumn: table.goalId,
                        referencedTable: $$PromisesTableReferences._goalIdTable(db),
                        referencedColumn: $$PromisesTableReferences._goalIdTable(db).id,
                      ) as T;
                    }

                    return state;
                  },
              getPrefetchedDataCallback: (items) async {
                return [];
              },
            );
          },
        ),
      );
}

typedef $$PromisesTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDb,
      $PromisesTable,
      PromiseEntry,
      $$PromisesTableFilterComposer,
      $$PromisesTableOrderingComposer,
      $$PromisesTableAnnotationComposer,
      $$PromisesTableCreateCompanionBuilder,
      $$PromisesTableUpdateCompanionBuilder,
      (PromiseEntry, $$PromisesTableReferences),
      PromiseEntry,
      PrefetchHooks Function({bool goalId})
    >;

class $AppDbManager {
  final _$AppDb _db;
  $AppDbManager(this._db);
  $$LocationAlarmsTableTableManager get locationAlarms =>
      $$LocationAlarmsTableTableManager(_db, _db.locationAlarms);
  $$RoutinesTableTableManager get routines => $$RoutinesTableTableManager(_db, _db.routines);
  $$OccurrencesTableTableManager get occurrences =>
      $$OccurrencesTableTableManager(_db, _db.occurrences);
  $$GoalsTableTableManager get goals => $$GoalsTableTableManager(_db, _db.goals);
  $$PromisesTableTableManager get promises => $$PromisesTableTableManager(_db, _db.promises);
}

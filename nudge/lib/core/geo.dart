import 'dart:math' as math;

/// A latitude/longitude pair in decimal degrees.
class LatLng {
  const LatLng(this.lat, this.lng);

  final double lat;
  final double lng;

  @override
  bool operator ==(Object other) => other is LatLng && other.lat == lat && other.lng == lng;

  @override
  int get hashCode => Object.hash(lat, lng);

  @override
  String toString() => '${lat.toStringAsFixed(6)}, ${lng.toStringAsFixed(6)}';
}

const double _earthRadiusMeters = 6371008.8;

/// Great-circle distance between two points, in meters.
double distanceMeters(LatLng a, LatLng b) {
  double rad(double deg) => deg * math.pi / 180;
  final dLat = rad(b.lat - a.lat);
  final dLng = rad(b.lng - a.lng);
  final h =
      math.pow(math.sin(dLat / 2), 2) +
      math.cos(rad(a.lat)) * math.cos(rad(b.lat)) * math.pow(math.sin(dLng / 2), 2);
  return 2 * _earthRadiusMeters * math.asin(math.min(1, math.sqrt(h)));
}

final _number = RegExp(r'[-+]?\d+(?:\.\d+)?');

/// Parses coordinates as pasted from Google Maps.
///
/// Accepts `19.0760, 72.8777`, `19.0760 72.8777`, `19.0760° N, 72.8777° E` and
/// Maps links containing `@lat,lng` or `q=lat,lng`. Returns null when the text
/// does not hold a valid pair.
LatLng? parseCoordinates(String text) {
  var s = text.trim();
  if (s.isEmpty) return null;

  final link = RegExp(r'(?:@|[?&](?:q|query|ll)=)([-+]?\d+(?:\.\d+)?),\s*([-+]?\d+(?:\.\d+)?)')
      .firstMatch(s);
  if (link != null) {
    return _validated(double.parse(link.group(1)!), double.parse(link.group(2)!));
  }

  final upper = s.toUpperCase();
  final numbers = _number.allMatches(s).toList();
  if (numbers.length != 2) return null;
  var lat = double.parse(numbers[0].group(0)!);
  var lng = double.parse(numbers[1].group(0)!);

  // Hemisphere letters after a number flip its sign (S and W are negative).
  String suffixAfter(RegExpMatch m) {
    final rest = upper.substring(m.end).replaceAll(RegExp(r'[°\s]'), '');
    return rest.isEmpty ? '' : rest[0];
  }

  final latSuffix = suffixAfter(numbers[0]);
  final lngSuffix = suffixAfter(numbers[1]);
  if (latSuffix == 'S') lat = -lat.abs();
  if (lngSuffix == 'W') lng = -lng.abs();
  return _validated(lat, lng);
}

LatLng? _validated(double lat, double lng) {
  if (lat.abs() > 90 || lng.abs() > 180) return null;
  return LatLng(lat, lng);
}

/// Fastest travel speed planned for, in meters per second (about 180 km/h).
const double _maxSpeedMps = 50;

/// How long the location service may wait before the next position check.
///
/// Waits half the time it would take to reach the alarm radius at top speed, so
/// it never overshoots: rare checks far away, every few seconds near the edge.
Duration nextCheckInterval(
  double metersToEdge, {
  Duration min = const Duration(seconds: 5),
  Duration max = const Duration(minutes: 2),
}) {
  if (metersToEdge <= 0) return min;
  final seconds = metersToEdge / _maxSpeedMps / 2;
  final ms = (seconds * 1000).round().clamp(min.inMilliseconds, max.inMilliseconds);
  return Duration(milliseconds: ms);
}

/// Default distance you must go past the radius before an alarm can ring again.
const defaultRearmMeters = 100000;

/// Never less than this, so GPS wobble at the edge can't re-arm an alarm.
const _minRearmMeters = 50;

int _rearm(int meters) => meters < _minRearmMeters ? _minRearmMeters : meters;

/// One position reading applied to a location alarm.
///
/// [inside] is what the alarm last knew: true (inside the zone), false
/// (outside) or null (not known yet: just switched on or edited). It rings only
/// when it goes from outside to inside; a first reading inside just records
/// that, so switching an alarm on where you already are stays quiet. You count
/// as outside again only beyond the radius plus [rearmMeters]; in between
/// nothing changes.
({bool? inside, bool ring}) zoneStep({
  required bool? inside,
  required double distance,
  required int radiusMeters,
  int rearmMeters = defaultRearmMeters,
}) {
  if (distance <= radiusMeters) return (inside: true, ring: inside == false);
  if (distance > radiusMeters + _rearm(rearmMeters)) return (inside: false, ring: false);
  return (inside: inside, ring: false);
}

/// Meters until a reading could change the alarm's state: to the radius from
/// outside, or to the re-arm distance from inside.
double metersToNextChange({
  required bool? inside,
  required double distance,
  required int radiusMeters,
  int rearmMeters = defaultRearmMeters,
}) => inside == true ? radiusMeters + _rearm(rearmMeters) - distance : distance - radiusMeters;

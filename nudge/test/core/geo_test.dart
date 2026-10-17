import 'package:flutter_test/flutter_test.dart';
import 'package:nudge/core/geo.dart';

void main() {
  group('parseCoordinates', () {
    test('comma-separated pair from Google Maps', () {
      expect(parseCoordinates('19.0760, 72.8777'), const LatLng(19.0760, 72.8777));
    });

    test('space-separated and negative values', () {
      expect(parseCoordinates(' -33.8688 151.2093 '), const LatLng(-33.8688, 151.2093));
    });

    test('degree format with hemisphere letters', () {
      expect(parseCoordinates('33.8688° S, 70.1° W'), const LatLng(-33.8688, -70.1));
      expect(parseCoordinates('19.0760° N, 72.8777° E'), const LatLng(19.0760, 72.8777));
    });

    test('maps links', () {
      expect(
        parseCoordinates('https://www.google.com/maps/@19.0760,72.8777,15z'),
        const LatLng(19.0760, 72.8777),
      );
      expect(
        parseCoordinates('https://maps.google.com/?q=12.9716,77.5946'),
        const LatLng(12.9716, 77.5946),
      );
    });

    test('rejects garbage and out-of-range values', () {
      expect(parseCoordinates(''), isNull);
      expect(parseCoordinates('hello'), isNull);
      expect(parseCoordinates('12.5'), isNull);
      expect(parseCoordinates('1, 2, 3'), isNull);
      expect(parseCoordinates('95.0, 10.0'), isNull);
      expect(parseCoordinates('10.0, 190.0'), isNull);
    });
  });

  group('distanceMeters', () {
    test('zero for the same point', () {
      expect(distanceMeters(const LatLng(19, 72), const LatLng(19, 72)), 0);
    });

    test('one thousandth of a degree of latitude is about 111 m', () {
      final d = distanceMeters(const LatLng(19.0, 72.0), const LatLng(19.001, 72.0));
      expect(d, closeTo(111.2, 0.5));
    });

    test('Mumbai to Pune is about 120 km', () {
      final d = distanceMeters(const LatLng(19.0760, 72.8777), const LatLng(18.5204, 73.8567));
      expect(d / 1000, closeTo(120, 3));
    });
  });

  group('nextCheckInterval', () {
    test('checks every few seconds near the edge', () {
      expect(nextCheckInterval(0), const Duration(seconds: 5));
      expect(nextCheckInterval(100), const Duration(seconds: 5));
    });

    test('scales with distance in between', () {
      expect(nextCheckInterval(1000), const Duration(seconds: 10));
    });

    test('caps the wait far away', () {
      expect(nextCheckInterval(50000), const Duration(minutes: 2));
    });
  });

  test('zone alarm rings on entering, then only after leaving and coming back', () {
    ({bool? inside, bool ring}) step(bool? inside, double d) =>
        zoneStep(inside: inside, distance: d, radiusMeters: 150, rearmMeters: 100);

    expect(step(null, 2000), (inside: false, ring: false), reason: 'switched on far away');
    expect(step(false, 140), (inside: true, ring: true), reason: 'arrives: rings');
    expect(step(true, 100), (inside: true, ring: false), reason: 'stopped, still inside');
    expect(step(true, 180), (inside: true, ring: false), reason: 'edge wobble: still inside');
    expect(step(true, 300), (inside: false, ring: false), reason: 'left the zone');
    expect(step(false, 120), (inside: true, ring: true), reason: 'came back: rings again');
    expect(step(null, 50), (inside: true, ring: false), reason: 'switched on inside: quiet');
  });
}

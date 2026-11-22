// School bus arrival alerts (Guardian App Spec §1I "Bus Arrival Notification", Workflow §5).
//
// Route stops are stored on transport_routes.stops as [{ name, time, fare, lat, lng, radius }].
// When a GPS point puts the route's bus within `radius` metres (default 250) of a stop that has
// coordinates, the guardians of children who board (morning) or leave (afternoon) at that stop
// get one in-app + push alert per stop, trip and day.
const { query } = require("../db/pool");
const { notifyStudentGuardians } = require("./notifications");
const { localDate, localHour } = require("../utils/dates");

const DEFAULT_RADIUS_M = Number(process.env.BUS_ARRIVAL_RADIUS_M || 250);

function distanceMetres(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Morning trip picks children up; afternoon trip drops them off (local school time).
function tripFor(date = new Date()) {
  return localHour(date) < 12 ? "morning" : "afternoon";
}

// Records the arrival once and notifies the guardians of children using that stop on this trip.
async function announceArrival({ routeId, stopName, trip = tripFor(), vehicleId = null }) {
  const inserted = await query(
    `INSERT INTO bus_arrival_alerts (route_id, stop_name, alert_date, trip, vehicle_id) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT DO NOTHING RETURNING route_id`,
    [routeId, stopName, localDate(), trip, vehicleId],
  );
  if (!inserted.rowCount) return { notified: 0, duplicate: true };
  const students = (await query(
    `SELECT s.id, s.name FROM transport_assignments ta JOIN students s ON s.id = ta.student_id
     WHERE ta.route_id = $1 AND ta.status = 'Active' AND s.status = 'Active'
       AND (CASE WHEN $3 = 'afternoon' THEN COALESCE(NULLIF(ta.dropoff_stop, ''), ta.stop_name) ELSE ta.stop_name END) = $2`,
    [routeId, stopName, trip],
  )).rows;
  let notified = 0;
  for (const s of students) {
    notified += await notifyStudentGuardians(s.id, {
      eventType: "BusArrival",
      subject: "School bus arrived",
      body: `${s.name}-এর স্কুল বাস নির্ধারিত স্থানে (${stopName}) পৌঁছেছে।`,
      channels: ["Portal"],
      primaryOnly: false,
      relatedType: "bus_arrival",
      relatedId: `${routeId}:${stopName}:${trip}`,
    });
  }
  return { notified, students: students.length };
}

// Called for every GPS point of a vehicle.
async function checkArrivals(vehicleId, lat, lng, at = new Date()) {
  const routes = (await query("SELECT id, stops FROM transport_routes WHERE vehicle_id = $1 AND status = 'Active'", [vehicleId])).rows;
  const results = [];
  for (const route of routes) {
    for (const stop of Array.isArray(route.stops) ? route.stops : []) {
      const sLat = Number(stop?.lat);
      const sLng = Number(stop?.lng);
      if (!stop?.name || !Number.isFinite(sLat) || !Number.isFinite(sLng)) continue;
      const radius = Number(stop.radius) > 0 ? Number(stop.radius) : DEFAULT_RADIUS_M;
      if (distanceMetres(Number(lat), Number(lng), sLat, sLng) <= radius) {
        results.push({ stop: stop.name, ...(await announceArrival({ routeId: route.id, stopName: stop.name, trip: tripFor(at), vehicleId })) });
      }
    }
  }
  return results;
}

module.exports = { distanceMetres, tripFor, announceArrival, checkArrivals };

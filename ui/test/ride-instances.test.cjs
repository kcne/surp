const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')

// Exercise the real TS utilities with the installed compiler and Node runner;
// no browser, bundler or additional test dependency is needed.
const root = path.resolve(__dirname, '..')
const uiRequire = Module.createRequire(path.join(root, 'package.json'))
function load(relativePath) {
  const filename = path.join(root, relativePath)
  const module = new Module(filename)
  module.filename = filename
  module.require = (id) => id.startsWith('@/') ? load(`${id.slice(2)}.ts`) : uiRequire(id)
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename)
  return module.exports
}

const { cancellingDeletesRide, generateRideInstances } = load('utils/rideInstanceHelpers.ts')
const { generateRideInstancesForRide } = load('utils/rideInstanceGenerators.ts')
const { toRideInstance } = load('infrastructure/mappers/rideMappers.ts')
const date = new Date()
date.setDate(date.getDate() + 7)
const day = date.getDay()
const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const ride = {
  id: 'ride-1', type: 'recurring', status: 'scheduled', busCapacity: 48,
  startDate: dateString, endDate: dateString, daysOfWeek: [day], line: { name: 'Test line' },
  daySchedules: { [day]: [{ orderIndex: 0, time: '09:00' }, { orderIndex: 1, time: '11:00' }] },
}
const skip = { date: dateString, type: 'skip' }
const extra = { date: dateString, type: 'additional', departureTime: '15:00', arrivalTime: '17:00' }

for (const [name, generate] of Object.entries({ generateRideInstances, generateRideInstancesForRide })) {
  test(`${name}: SKIP cancels only the base, in either exception order`, () => {
    for (const exceptions of [[skip, extra], [extra, skip]]) {
      const instances = generate({ ...ride, exceptions })
      assert.equal(instances.length, 1)
      assert.equal(instances[0].departureTime, '15:00')
      assert.equal(instances[0].id, `ride-1:${dateString}:15:00:ADDITIONAL`)
    }
  })
  test(`${name}: base and multiple extras keep separate IDs and times`, () => {
    const instances = generate({ ...ride, exceptions: [extra, { ...extra, departureTime: '18:00' }] })
    assert.deepEqual(instances.map((x) => x.departureTime), ['09:00', '15:00', '18:00'])
    assert.equal(new Set(instances.map((x) => x.id)).size, 3)
  })
  test(`${name}: extras run on unscheduled dates`, () => {
    const instances = generate({ ...ride, daysOfWeek: [(day + 1) % 7], exceptions: [extra] })
    assert.deepEqual(instances.map((x) => x.departureTime), ['15:00'])
  })
  test(`${name}: one-time rides apply SKIP and ADDITIONAL too`, () => {
    const oneTime = { ...ride, type: 'one-time', date: dateString, oneTimeDepartureTime: '09:00', oneTimeArrivalTime: '11:00' }
    assert.deepEqual(generate({ ...oneTime, exceptions: [skip] }), [])
    assert.deepEqual(generate({ ...oneTime, exceptions: [skip, extra] }).map((x) => x.departureTime), ['15:00'])
  })
  test(`${name}: an extra shows its own capacity, and one without it the ride's`, () => {
    const instances = generate({
      ...ride,
      exceptions: [{ ...extra, capacity: 60 }, { ...extra, departureTime: '18:00', arrivalTime: '20:00' }],
    })
    const byTime = Object.fromEntries(instances.map((x) => [x.departureTime, x]))
    assert.equal(byTime['15:00'].ride.busCapacity, 60)
    assert.equal(byTime['15:00'].availableSeats, 60)
    assert.equal(byTime['18:00'].ride.busCapacity, 48)
    assert.equal(byTime['09:00'].availableSeats, 48)
    assert.equal(ride.busCapacity, 48)
  })
}

test('cancelling a one-time ride deletes it only when it has no extra bus', () => {
  const oneTime = { ...ride, type: 'one-time', date: dateString, oneTimeDepartureTime: '09:00', oneTimeArrivalTime: '11:00' }
  assert.equal(cancellingDeletesRide(oneTime), true)
  assert.equal(cancellingDeletesRide({ ...oneTime, exceptions: [skip] }), true)
  assert.equal(cancellingDeletesRide({ ...oneTime, exceptions: [extra] }), false)
  assert.equal(cancellingDeletesRide({ ...ride, exceptions: [] }), false)
})

test('instance mapper uses operator capacity without modifying the ride template', () => {
  const instance = toRideInstance({
    id: `ride-1:${dateString}:15:00:ADDITIONAL`, rideId: ride.id, date: dateString,
    departureTime: '15:00', arrivalTime: '17:00', status: 'ACTIVE', rideType: 'RECURRING',
    line: { id: 'line-1', name: 'Test line', departureStationId: 'a', arrivalStationId: 'b' },
    availability: { capacity: 60, availableSeats: 12 }, reservationCount: 48,
  }, ride)
  assert.equal(instance.ride.busCapacity, 60)
  assert.equal(instance.availableSeats, 12)
  assert.equal(ride.busCapacity, 48)
})

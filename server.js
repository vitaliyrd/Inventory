var _ = require('underscore')
var co = require('co')
var config = require('config')
var hapi = require('hapi')
var mysql = require('promise-mysql')

var server = new hapi.Server({
  debug: {
    request: ['error']
  }
})
server.connection(config.get('connection'))

var db
mysql.createConnection(config.get('db')).then(function (conn) {
  db = conn
})

// Lets us use generators with Hapi
// Based on https://gist.github.com/grabbou/ead3e217a5e445929f14
var wg = function (gen) {
  var handler = co.wrap(gen)
  return function (request, reply) {
    handler.bind(this)(request, reply)
  }
}

// Prepares returned database data for reply
var prepareEntries = function *(data) {
  var isArray = _.isArray(data)
  if (!isArray) {
    data = [data]
  }

  for (var i = 0; i < data.length; i++) {
    var entry = data[i]

    convertBooleans(entry)

    entry.location = yield getLocation(entry.locationId)
    delete entry.locationId

    entry.category = yield getCategory(entry.categoryId)
    delete entry.categoryId
  }

  if (!isArray) {
    data = data[0]
  }
  return data
}

// Converts status flags from integers to booleans
var convertBooleans = function (entry) {
  entry.checkedIn = entry.checkedIn == 1
  entry.needsService = entry.needsService == 1
  entry.lost = entry.lost == 1
}

var getLocation = function *(locationId) {
  return (yield db.query(
    'SELECT * FROM Locations WHERE id = ?',
    [locationId]
  ))[0]
}

var getCategory = function *(categoryId) {
  return (yield db.query(
    'SELECT * FROM Categories WHERE id = ?',
    [categoryId]
  ))[0]
}

// Get a list of entries in the inventory
server.route({
  method: 'GET',
  path: '/entries',
  handler: wg(function *(request, reply) {
    var results = yield db.query(
      'SELECT * FROM Entries INNER JOIN Items ON Entries.itemId = Items.id'
    )

    reply(yield prepareEntries(results))
  })
})

// Get a list of entries in a certain category
server.route({
  method: 'GET',
  path: '/entries/by-category/{categoryId}',
  handler: wg(function *(request, reply) {
    var results = yield db.query(
      'SELECT * FROM Entries INNER JOIN Items ON Entries.itemId = Items.id WHERE categoryId = ?',
      [request.params.categoryId]
    )

    reply(yield prepareEntries(results))
  })
})

// Get a list of entries in a certain category
server.route({
  method: 'GET',
  path: '/entries/by-location/{locationId}',
  handler: wg(function *(request, reply) {
    var results = yield db.query(
      'SELECT * FROM Entries INNER JOIN Items ON Entries.itemId = Items.id WHERE locationId = ?',
      [request.params.locationId]
    )

    reply(yield prepareEntries(results))
  })
})

// Get a list of available categories
server.route({
  method: 'GET',
  path: '/categories',
  handler: wg(function *(request, reply) {
    var results = yield db.query(
      'SELECT * FROM Categories'
    )

    reply(results)
  })
})

// Get all available locations
server.route({
  method: 'GET',
  path: '/locations',
  handler: wg(function *(request, reply) {
    var results = yield db.query(
      'SELECT * FROM Locations'
    )

    reply(results)
  })
})

server.start(() => {
  console.log('Server running at:', server.info.uri)
})

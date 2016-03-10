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
      .catch(reply)
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

// Create a new inventory entry
server.route({
  method: 'POST',
  path: '/entries',
  handler: wg(function *(request, reply) {
    var entry = request.payload

    var item = (yield db.query(
      'SELECT * FROM Items WHERE categoryId = ? AND brand = ? AND model = ?',
      [entry.category.id, entry.brand, entry.model]
    ))[0]

    if (!item) {
      var item = yield db.query(
        'INSERT INTO Items VALUES (NULL, ?, ?, ?)',
        [entry.category.id, entry.brand, entry.model]
      )

      entry.itemId = item.insertId
    } else {
      entry.itemId = item.id
    }

    entry = {
      itemId: entry.itemId,
      serialNo: entry.serialNo,
      name: entry.name,
      locationId: entry.location.id,
      checkedIn: entry.checkedIn,
      needsService: entry.needsService,
      lost: entry.lost,
      notes: entry.notes
    }

    entryArray = [
      entry.itemId,
      entry.serialNo,
      entry.name,
      entry.locationId,
      entry.checkedIn,
      entry.needsService,
      entry.lost,
      entry.notes
    ]

    yield db.query(
      'INSERT INTO Entries VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      entryArray
    )

    reply(entry)
  })
})

server.route({
  method: 'DELETE',
  path: '/entries/{itemId}/{serialNo}',
  handler: wg(function *(request, reply) {
    var result = (yield db.query(
      'SELECT * FROM Entries WHERE itemId = ? AND serialNo = ?',
      [request.params.itemId, request.params.serialNo]
    ))[0]

    yield db.query(
      'DELETE FROM Entries WHERE itemId = ? AND serialNo = ?',
      [request.params.itemId, request.params.serialNo]
    )

    reply(result)
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

// Get a list of available Items
server.route({
  method: 'GET',
  path: '/items',
  handler: wg(function *(request, reply) {
    var results = yield db.query(
      'SELECT * FROM Items'
    )

    reply(results)
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

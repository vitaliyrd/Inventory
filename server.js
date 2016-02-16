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

// Build a where query from an array of conditions
var buildWhere = function (conditions) {
  if (conditions.length == 0) {
    return null
  }
  var where = ' WHERE '
  _.each(conditions, function (cur, i, list) {
    where += cur
    if (i < list.length - 1) {
      // Not on the last one yet, keep adding 'AND'
      where += ' AND '
    }
  })
  return where
}

// Converts a sql bit to boolean
var convertBit = function (bit) {
  var bool = null
  if (bit) { bool = bit.data == 1 }
  return bool
}

// Loads location, category
// Converts checkedIn, needsService, and lost bit columns to boolean
var populateItems = function *(items) {
  var converted

  if (_.isArray(items)) {
    converted = []
    for (var i = 0; i < items.length; i++) {
      var cur = items[i]

      var item = _.extend({}, cur, {
        checkedIn: convertBit(cur.checkedIn),
        needsService: convertBit(cur.needsService),
        lost: convertBit(cur.lost)
      })

      item.category = (yield db.query(
        'SELECT * FROM Category WHERE id = ?',
        [item.categoryId]
      ))[0]
      item.location = (yield db.query(
        'SELECT * FROM Location WHERE id = ?',
        [item.locationId]
      ))[0]

      converted.push(item)
    }
  } else {
    converted = _.extend({}, items, {
      checkedIn: convertBit(cur.checkedIn),
      needsService: convertBit(cur.needsService),
      lost: convertBit(cur.lost)
    })

    converted.category = (yield db.query(
      'SELECT * FROM Category WHERE id = ?',
      [item.categoryId]
    ))[0]
    converted.location = (yield db.query(
      'SELECT * FROM Location WHERE id = ?',
      [item.locationId]
    ))[0]
  }

  return converted
}


// Get a list of available categories
server.route({
  method: 'GET',
  path: '/categories',
  handler: wg(function *(request, reply) {
    var results = yield db.query(
      'SELECT * FROM Category'
    )

    reply(results)
  })
})

// Get a single item by its id
server.route({
  method: 'GET',
  path: '/item/{id}',
  handler: wg(function *(request, reply) {
    var results = yield db.query(
      'SELECT * FROM Item WHERE id = ?',
      [request.params.id]
    )

    if (results.length > 0) {
      var items = yield populateItems(results)
      reply(items[0])
    } else {
      reply({
        error: "not found"
      }).code(404)
    }
  })
})

// Get all items
server.route({
  method: 'GET',
  path: '/items',
  handler: wg(function *(request, reply) {
    var conditions = []
    var params = []

    if (request.query.categoryId) {
      conditions.push('categoryId = ?')
      params.push(request.query.categoryId)
    }
    if (request.query.locationId) {
      conditions.push('locationId = ?')
      params.push(request.query.locationId)
    }
    if (request.query.checkedIn) {
      conditions.push('checkedIn = ?')
      params.push(request.query.checkedIn)
    }
    if (request.query.needsService) {
      conditions.push('needsService = ?')
      params.push(request.query.needService)
    }

    // If buildWhere() returns null, it'll be an empty string
    var where = buildWhere(conditions) || ''

    var results = yield db.query(
      'SELECT * FROM Item' + where,
      params
    )

    reply(yield populateItems(results))
  })
})

// Get all available locations
server.route({
  method: 'GET',
  path: '/locations',
  handler: wg(function *(request, reply) {
    var results = yield db.query(
      'SELECT * FROM Location'
    )

    reply(results)
  })
})

server.start(() => {
  console.log('Server running at:', server.info.uri)
})

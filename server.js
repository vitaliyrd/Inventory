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
      reply(results)
    } else {
      reply({
        error: "not found"
      }).code(404)
    }
  })
})

// Get all items in a category, by category id
server.route({
  method: 'GET',
  path: '/items/by-category-id/{categoryId}',
  handler: wg(function *(request, reply) {
    var results = yield db.query(
      'SELECT * FROM Item WHERE categoryId = ?',
      [request.params.categoryId]
    )

    reply(results)
  })
})

server.start(() => {
  console.log('Server running at:', server.info.uri)
})

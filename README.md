# Inventory

### Setup

#### Requirements
- General:
  - Node with generators
  - MySQL
- Arch Linux: `sudo pacman -S nodejs npm mariadb`
- Ubuntu: `sudo apt-get install nodejs npm mysql-server`

#### Running
Set up and start MySQL. Look at `config/example.json` and create your own under `config/default.json` or see https://github.com/lorenwest/node-config for the various things you can do with the config.
```
git clone https://github.com/vitaliyrd/inventory-backend
npm install
npm start
```

### Usage

#### Entries
The database is centered on Entries. These are the physical things in your inventory.
- `GET /entries` `application/json`
```json
  [
    {
      "brand": "Ibanez",
      "category": {
        "id": 1,
        "name": "Guitars",
        "notes": "Guitars and their accessories"
      },
      "checkedIn": true,
      "id": 1,
      "itemId": 1,
      "location": {
        "buildingNo": "Main Building",
        "floorNo": "3",
        "id": 1,
        "name": "Drum Room",
        "notes": "Off the side of the youth room stage",
        "roomNo": null
      },
      "lost": false,
      "model": "RG",
      "name": "Andrey's Guitar",
      "needsService": false,
      "notes": "Blue color",
      "serialNo": "abc"
    },
    {
      "brand": "Shure",
      "category": {
        "id": 2,
        "name": "Microphones",
        "notes": "Microphones and their cables\/accessories"
      },
      "checkedIn": true,
      "id": 2,
      "itemId": 2,
      "location": {
        "buildingNo": "Main Building",
        "floorNo": "3",
        "id": 2,
        "name": "Youth Room",
        "notes": null,
        "roomNo": null
      },
      "lost": false,
      "model": "SM58",
      "name": "Youth Mic",
      "needsService": false,
      "notes": null,
      "serialNo": "def"
    }
  ]
```
- `GET /entries/by-category/{categoryId}` Filter entries to those in the specified category
- `GET /entries/by-location/{locationId}` Filter entries to those in the specified location
- `POST /entries` `application/json` Not implemented yet.
  Automatically detects if you are using an existing Item template. If you are, we simply use that itemId. If not, we create a new Item template from the data you gave. Will also create category and location if you do not specify an id for them.
```json
  {
    "brand": "Ibanez",
    "category": {
      "id": 1,
      "name": "Guitars",
      "notes": "Guitars are cool"
    },
    "checkedIn": true,
    "location": {
      "id": 1,
      "name": "Some Storage Room",
      "buildingNo": "Main",
      "floorNo": "2",
      "roomNo": "208",
      "notes": "IDK"
    },
    "lost": false,
    "model": "RG",
    "name": "Andrey's Guitar",
    "needsService": false,
    "notes": "Blue color",
    "serialNo": "abc"
  }
```
- `DELETE /entries/{itemId}/{serialNo}` Delete an entry.

#### Items
Items are templates that are common to multiple entries. For example, suppose there are 5 Fulltone OCDs in your inventory. Rather than duplicating that information 5 times, there is an item that the 5 OCD entries are linked to.
  - `POST /items/autocomplete` Not implemented yet.
  Autocompletes items based on data the user is entering into a create screen. This will return a list of item templates you could show in a dropdown. If they select one of the templates, the client should fill in the rest of the fields from the template. Then `POST /entries` will recognize that you are using an existing Item, unless the user changes some fields, in which case, a new entry will be created.

#### Categories
- `GET /categories`
```json
  [
    {
      "id": 1,
      "name": "Guitars",
      "notes": "Guitars and their accessories"
    },
    {
      "id": 2,
      "name": "Microphones",
      "notes": "Microphones and their cables\/accessories"
    }
  ]
```

#### Locations
- `GET /locations`
```json
  [
    {
      "buildingNo": "Main Building",
      "floorNo": "3",
      "id": 1,
      "name": "Drum Room",
      "notes": "Off the side of the youth room stage",
      "roomNo": null
    },
    {
      "buildingNo": "Main Building",
      "floorNo": "3",
      "id": 2,
      "name": "Youth Room",
      "notes": null,
      "roomNo": null
    }
  ]
```

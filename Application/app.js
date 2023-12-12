const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const port = 3000;

const mongoose = require("mongoose");
const { name } = require('ejs');
const { model } = mongoose;
//  mongoose connection

const { createClient } = require("redis");

let clientRedis

mongoose.connect("mongodb://127.0.0.1/Project3");
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {
  console.log("we're connected!")
});
const restaurantSchema = new mongoose.Schema({
  RestaurantID: Number,
  Name: String,
  Location: String,
  CuisineType: String,
  PriceRange: String,
  ContactInfo: String,
  Menus: Array,
  Reservations: Array,
  Reviews: Array
});

const customerSchema = new mongoose.Schema({
  CustomerID: Number,
  Name: String,
  Email: String,
  PhoneNumber: String
});

var Restaurants = mongoose.model('Restaurant', restaurantSchema);
var Customers = mongoose.model('Customer', customerSchema);

// Set up EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.render('index');
});

app.listen(port, () => {
  console.log(`App running at http://localhost:${port}`);
});

app.get('/reservations', async (req, res) => {

  const rests = await Restaurants.find({});

  // console.log(rests);

  clientRedis = await createClient({
    url: "redis://127.0.0.1:6379",
  })
    .on("error", (err) => console.log("Redis Client Error", err))
    .connect();

    await clientRedis.del('mostBooked');

    for (const r of rests) {
      for (const t of r.Reservations) {
        // console.log(r);
        await clientRedis.zIncrBy('mostBooked', 1, r.RestaurantID+"");
      }
    }
  

  const reservations = await clientRedis.zRangeWithScores('mostBooked', 0, 9, {
    REV: true
  });
  console.log(reservations);

  res.render('list-reservations', { reservations: reservations });
});



app.get('/book-restaurant', (req, res) => {
  res.render('book-restaurant');
});

app.get('/list-restaurant/:id', async (req, res) => {
  const restrowaurant = await Restaurants.findOne({
    RestaurantID: req.params.id});

  var reservations = restrowaurant.Reservations;
  reservations.forEach(t => t.RestaurantID = req.params.id)

  res.render('list-restaurants', {
    reservations: reservations
  });
})

app.post('/add-reservation', async (req, res) => {
  const { RestaurantID, Date, Time, CustomerID, ReservationID } = req.body;

  var reservation = {
    ReservationID: parseInt(ReservationID),
    Date: Date,
    Time: Time,
    Customer: {
      CustomerID: parseInt(CustomerID)
    }
  }
  await Restaurants.findOneAndUpdate(
    { RestaurantID: RestaurantID },
    {
      $push: {
        Reservations: reservation
      }
    }
  )

  clientRedis = await createClient({
    url: "redis://127.0.0.1:6379",
  })
    .on("error", (err) => console.log("Redis Client Error", err))
    .connect();

  await clientRedis.zIncrBy('mostBooked', 1, RestaurantID);

  res.redirect('/reservations');
}

);

app.get('/delete-reservation/:restaurantid/:reservationid', async (req, res) => {

  console.log(req.params)
  await Restaurants.findOneAndUpdate(
    { RestaurantID: parseInt(req.params.restaurantid) },
    {
      $pull: {
        Reservations: {
          
            ReservationID: parseInt(req.params.reservationid)
          
        }
      }
    }
  );

  // console.log(err);
  res.redirect('/reservations');

});

app.get('/update-reservation/:restaurantid/:reservationid', async (req, res) => {

  const restrowaurant = await Restaurants.findOne({
    RestaurantID: parseInt(req.params.restaurantid),
    Reservations: {
      $elemMatch: {
        ReservationID: parseInt(req.params.reservationid)
      }
    }
  })
  console.log(req.params)
  var temp;

  restrowaurant.Reservations.forEach(t => {
    if (t.ReservationID == parseInt(req.params.reservationid)) {
      temp = t
    }
  })
  temp.RestaurantID = restrowaurant.RestaurantID
  res.render('update-reservation', { reservation: temp });

});

app.post('/update-reservation/:restaurantid/:reservationid', async (req, res) => {
  const { RestaurantID, Date, Time, CustomerID, ReservationID } = req.body;

  await Restaurants.findOneAndUpdate(
    { RestaurantID: RestaurantID, "Reservations.ReservationID": ReservationID},
    {
      "Date": Date,
      "Time": Time,
      "Customer.CustomerID": CustomerID
    }
  )

  res.redirect('/reservations');
});

import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import "dotenv/config";

const app = express();
const port = process.env.PORT || 8000;

const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

const mongoClient = await connectToMongoDB();
const database = mongoClient.db("salonbook");
const users = database.collection("user");
const serviceCollection = database.collection("services");
const categoryCollection = database.collection("categories");

app.use(cors());

app.get("/", (req, res) => {
  res.send("Saloon Book server is running!");
});
// services
app.get("/services", async (req, res) => {
  const query = {};
  if (req.query) {
    // Status filter
    if (req.query.status === "active") {
      query.status = req.query.status;
    }
    // Category filter
    if (req.query.category) {
      query.category = req.query.category;
    }
    // Search by service name
    if (req.query.search) {
      query.serviceName = {
        $regex: req.query.search,
        $options: "i",
      };
    }
    // Price filter
    if (req.query.minPrice || req.query.maxPrice) {
      query.price = {};

      if (req.query.minPrice) {
        query.price.$gte = Number(req.query.minPrice);
      }

      if (req.query.maxPrice) {
        query.price.$lte = Number(req.query.maxPrice);
      }
    }

    // Duration filter
    if (req.query.duration) {
      const durations = req.query.duration.split(",");
      const durationQuery = [];

      if (durations.includes("short")) {
        durationQuery.push({ duration: { $lte: 30 } });
      }

      if (durations.includes("medium")) {
        durationQuery.push({
          duration: { $gte: 31, $lte: 60 },
        });
      }

      if (durations.includes("long")) {
        durationQuery.push({
          duration: { $gte: 61, $lte: 90 },
        });
      }

      if (durations.includes("extended")) {
        durationQuery.push({ duration: { $gt: 90 } });
      }

      if (durationQuery.length > 0) {
        query.$or = durationQuery;
      }
    }
  }

  let cursor = serviceCollection.find(query);

  // Sort by price
  if (req.query.sortBy === "price") {
    if (req.query.order === "desc") {
      cursor = cursor.sort({ price: -1 });
    } else {
      cursor = cursor.sort({ price: 1 });
    }
  }

  if (req.query.limit === "6") {
    cursor = cursor.limit(6);
  }

  console.log(`status: ${req.query.status} and limit: ${req.query.limit}`);
  const result = await cursor.toArray();
  res.send(result);
});

app.get("/services/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  query.status = "active";
  const result = await serviceCollection.findOne(query);
  res.send(result);
});

app.get("/categories", async (req, res) => {
  const result = await categoryCollection.find().toArray();
  res.send(result);
});
// appointments
app.get("/appointments", async (req, res) => {
  const result = await categoryCollection.find().toArray();
  res.send(result);
});

app.listen(port, () => {
  console.log(`Saloon Book is running on port ${port}`);
});

import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import "dotenv/config";

const app = express();
const port = process.env.PORT || 8000;

// middleware
app.use(express.json());
app.use(cors());

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

const verifyToken = async (req, res, next) => {
  console.log("token", req.body);
  next();
};

const verifyAdmin = async (req, res, next) => {
  console.log("admin", req.body);
  //   if (req.user.role !== "admin") {
  //     res.status(403).send({ message: "Forbidden" });
  //     return;
  //   }
  next();
};

const verifyCustomer = async (req, res, next) => {
  //   if (req.user.role !== "customer") {
  //     res.status(403).send({ message: "Forbidden" });
  //     return;
  //   }
  next();
};

app.get("/", (req, res) => {
  res.send("Saloon Book server is running!");
});
// services
app.get("/services", async (req, res) => {
  const query = {};
  if (req.query) {
    // Status filter
    if (req.query.status) {
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

app.get("/services/:id", verifyToken, async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  query.status = "active";
  const result = await serviceCollection.findOne(query);
  res.send(result);
});

app.get("/admin/services", verifyToken, verifyAdmin, async (req, res) => {
  const result = await serviceCollection.find().sort({ _id: -1 }).toArray();
  res.send(result);
});

app.get("/admin/service/:id", verifyToken, async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await serviceCollection.findOne(query);
  res.send(result);
});

app.post("/services", verifyToken, verifyAdmin, async (req, res) => {
  const service = req.body;
  const result = await serviceCollection.insertOne(service);
  res.send(result);
});

app.patch("/services/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid service id" });
    }

    if (!data || Object.keys(data).length === 0) {
      return res.status(400).send({ message: "Request body cannot be empty" });
    }

    const filter = { _id: new ObjectId(id) };

    const result = await serviceCollection.updateOne(filter, { $set: data });

    if (result.matchedCount === 0) {
      return res.status(404).send({ message: "Service not found" });
    }
    res.send(result);
  } catch (error) {
    console.error("Error updating service:", error);
    res.status(500).send({
      message: "Failed to update service",
      error: error.message,
    });
  }
});

// categories

app.get("/categories", async (req, res) => {
  const result = await categoryCollection.find().toArray();
  res.send(result);
});
// appointments
app.get("/appointments", verifyToken, async (req, res) => {
  const result = await categoryCollection.find().toArray();
  res.send(result);
});

app.listen(port, () => {
  console.log(`Saloon Book is running on port ${port}`);
});

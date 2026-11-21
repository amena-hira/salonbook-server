import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
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
const database = mongoClient.db(process.env.DB);
const users = database.collection("user");
const serviceCollection = database.collection("services");
const categoryCollection = database.collection("categories");

app.use(cors());

app.get("/", (req, res) => {
  res.send("Saloon Book server is running!");
});

app.get("/services", async (req, res) => {
  const query = {};
  if (req.query) {
    if (req.query.status === "active") {
      query.status = req.query.status;
    }
  }

  let cursor = serviceCollection.find(query);

  if (req.query.limit === "6") {
    cursor = cursor.limit(6);
  }

  console.log(`status: ${req.query.status} and limit: ${req.query.limit}`);
  const result = await cursor.toArray();
  res.send(result);
});

app.get("/categories", async (req, res) => {
  const result = await categoryCollection.find().toArray();
  res.send(result);
});

app.listen(port, () => {
  console.log(`Saloon Book is running on port ${port}`);
});

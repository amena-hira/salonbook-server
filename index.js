import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import "dotenv/config";
import Stripe from "stripe";

const app = express();
const port = process.env.PORT || 8000;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const DB_USER = encodeURIComponent(process.env.DB_USER || "");
const DB_PASSWORD = encodeURIComponent(process.env.DB_PASSWORD || "");
const BASE_URL = process.env.BASE_URL;

const client = new MongoClient(
  `mongodb+srv://${DB_USER}:${DB_PASSWORD}@cluster0.nvjlqis.mongodb.net/`,
);

// middleware
app.use(express.json());
app.use(cors());

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
const userCollection = database.collection("user");
const serviceCollection = database.collection("services");
const categoryCollection = database.collection("categories");
const appointmentCollection = database.collection("appointments");
const transactionCollection = database.collection("transactions");
const sessions = database.collection("session");

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).send({ message: "Unauthorized" });
    return;
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    res.status(401).send({ message: "Unauthorized" });
    return;
  }

  const query = { token };
  const session = await sessions.findOne(query);
  if (!session) {
    res.status(401).send({ message: "Unauthorized" });
    return;
  }

  const userId = session.userId;

  const userQuery = { _id: new ObjectId(userId) };
  const user = await userCollection.findOne(userQuery);
  if (!user) {
    res.status(401).send({ message: "Unauthorized" });
    return;
  }

  req.user = user;
  next();
};

const verifyAdmin = async (req, res, next) => {
  if (req.user.role !== "admin") {
    res.status(403).send({ message: "Forbidden" });
    return;
  }
  next();
};

const verifyCustomer = async (req, res, next) => {
  if (req.user.role !== "customer") {
    res.status(403).send({ message: "Forbidden" });
    return;
  }
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

// admin part
app.get("/admin/services", verifyToken, verifyAdmin, async (req, res) => {
  const result = await serviceCollection.find().sort({ _id: -1 }).toArray();
  res.send(result);
});

app.get("/admin/service/:id", verifyToken, verifyAdmin, async (req, res) => {
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

app.delete("/services/:id", verifyToken, verifyAdmin, async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await serviceCollection.deleteOne(query);
  res.send(result);
});

// categories

app.get("/categories", async (req, res) => {
  const result = await categoryCollection.find().toArray();
  res.send(result);
});

// appointments
// customer part
app.get("/appointments/availability",verifyToken,verifyCustomer, async (req, res) => {
  try {
    const { serviceId, appointmentDate } = req.query;

    if (!serviceId || !appointmentDate) {
      return res.status(400).send({
        message: "serviceId and appointmentDate are required",
      });
    }

    const appointments = await appointmentCollection
      .find(
        {
          serviceId,
          appointmentDate,
          status: { $in: ["Pending", "Confirmed"] },
        },
        {
          projection: {
            _id: 0,
            timeSlot: 1,
          },
        },
      )
      .toArray();

    const bookedSlots = appointments.map((appointment) => appointment.timeSlot);

    res.send({ bookedSlots });
  } catch (error) {
    res.status(500).send({
      message: error.message,
    });
  }
});

// create appointment by customer
app.post("/appointments", verifyToken, verifyCustomer, async (req, res) => {
  const appointment = req.body;

  const { serviceId, appointmentDate, timeSlot } = appointment;

  const existingAppointment = await appointmentCollection.findOne({
    serviceId,
    appointmentDate,
    timeSlot,
    status: { $in: ["Pending", "Confirmed"] },
  });

  if (existingAppointment) {
    return res.status(409).send({
      message: "This time slot is already booked",
    });
  }

  const result = await appointmentCollection.insertOne(appointment);
  res.send(result);
});

app.get("/my-appointments/:customerId",verifyToken,verifyCustomer, async (req, res) => {
  const customerId = req.params.customerId;

  const result = await appointmentCollection
    .aggregate([
      {
        $match: { customerId },
      },
      {
        $addFields: {
          serviceObjectId: { $toObjectId: "$serviceId" },
        },
      },
      {
        $lookup: {
          from: "services",
          localField: "serviceObjectId",
          foreignField: "_id",
          as: "service",
        },
      },
      {
        $unwind: "$service",
      },
      {
        $sort: { createdAt: -1 },
      },
    ])
    .toArray();

  res.send(result);
});

// update appointment from customer
app.patch("/my-appointments/:appointmentId",verifyToken,verifyCustomer, async (req, res) => {
  const id = req.params.appointmentId;
  const { customerId } = req.body;

  console.log(id);

  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ message: "Invalid ID" });
  }

  const query = {
    _id: new ObjectId(id),
    customerId,
    status: "Pending",
  };

  const updatedDoc = {
    $set: {
      status: "Cancelled",
      updatedAt: new Date(),
    },
  };

  const result = await appointmentCollection.updateOne(query, updatedDoc);

  if (result.matchedCount === 0) {
    return res.status(404).send({
      message: "Appointment not found or cannot be cancelled",
    });
  }

  res.send(result);
});

// admin part
app.get("/appointments", verifyToken,verifyAdmin, async (req, res) => {
  const result = await appointmentCollection
    .aggregate([
      {
        $addFields: {
          serviceObjectId: { $toObjectId: "$serviceId" },
          customerObjectId: { $toObjectId: "$customerId" },
        },
      },
      {
        $lookup: {
          from: "services",
          localField: "serviceObjectId",
          foreignField: "_id",
          as: "service",
        },
      },
      {
        $unwind: "$service",
      },
      {
        $lookup: {
          from: "user",
          localField: "customerObjectId",
          foreignField: "_id",
          as: "customer",
        },
      },
      {
        $unwind: {
          path: "$customer",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $sort: { createdAt: -1 },
      },
    ])
    .toArray();

  res.send(result);
});

// update appointment
app.patch("/appointments/:id", verifyToken,verifyAdmin, async (req, res) => {
  const id = req.params.id;
  const { status } = req.body;
  console.log(status, id);

  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ message: "Invalid ID" });
  }

  if (!["Confirmed", "Cancelled"].includes(status)) {
    return res.status(400).send({ message: "Invalid status" });
  }

  const query = {
    _id: new ObjectId(id),
    status:
      status === "Confirmed" ? "Pending" : { $in: ["Pending", "Confirmed"] },
  };

  const updatedDoc = {
    $set: {
      status: status,
      updatedAt: new Date(),
    },
  };

  const result = await appointmentCollection.updateOne(query, updatedDoc);

  res.send(result);
});

// appointment & service & transaction & user
app.get("/appointments/:id",verifyToken, async (req, res) => {
  try {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        message: "Invalid appointment ID",
      });
    }

    const result = await appointmentCollection
      .aggregate([
        {
          $match: {
            _id: new ObjectId(id),
          },
        },
        {
          $addFields: {
            serviceObjectId: {
              $toObjectId: "$serviceId",
            },
            customerObjectId: {
              $toObjectId: "$customerId",
            },
          },
        },
        {
          $lookup: {
            from: "services",
            localField: "serviceObjectId",
            foreignField: "_id",
            as: "service",
          },
        },
        {
          $unwind: {
            path: "$service",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "user",
            localField: "customerObjectId",
            foreignField: "_id",
            as: "customer",
          },
        },
        {
          $unwind: {
            path: "$customer",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "transactions",
            let: {
              appointmentId: {
                $toString: "$_id",
              },
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$appointmentId", "$$appointmentId"],
                  },
                },
              },
              {
                $sort: {
                  createdAt: -1,
                },
              },
              {
                $limit: 1,
              },
            ],
            as: "transaction",
          },
        },
        {
          $unwind: {
            path: "$transaction",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            serviceObjectId: 0,
            customerObjectId: 0,
            "customer.password": 0,
          },
        },
      ])
      .toArray();

    if (!result.length) {
      return res.status(404).send({
        message: "Appointment not found",
      });
    }

    res.send(result[0]);
  } catch (error) {
    res.status(500).send({
      message: error.message,
    });
  }
});

// transactions

app.post("/payments/checkout-verify",verifyToken,verifyCustomer, async (req, res) => {
  try {
    const { sessionId } = req.body;
    console.log(sessionId);

    if (!sessionId) {
      return res.status(400).send({
        success: false,
        message: "Session ID is required",
      });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const {
      status,
      payment_status,
      metadata,
      amount_total,
      currency,
      payment_intent,
    } = session;

    // Check duplicate transaction
    const existingTransaction = await transactionCollection.findOne({
      stripeSessionId: sessionId,
    });

    if (existingTransaction) {
      return res.send({
        success: false,
        message: "Payment already verified",
      });
    }

    if (status === "complete" && payment_status === "paid") {
      const { appointmentId, customerId } = metadata;

      if (!ObjectId.isValid(appointmentId)) {
        return res.status(400).send({
          success: false,
          message: "Invalid appointment ID",
        });
      }

      // Check appointment
      const appointment = await appointmentCollection.findOne({
        _id: new ObjectId(appointmentId),
        customerId,
        status: "Confirmed",
        paymentStatus: "Unpaid",
      });

      if (!appointment) {
        return res.status(400).send({
          success: false,
          message: "Appointment not found or already paid",
        });
      }

      // Create transaction
      const transaction = {
        appointmentId,
        customerId,
        amount: amount_total / 100,
        currency,
        stripeSessionId: sessionId,
        transactionId: payment_intent,
        status: "Paid",
        createdAt: new Date(),
      };

      const result = await transactionCollection.insertOne(transaction);

      // Update appointment payment status
      const updateResult = await appointmentCollection.updateOne(
        { _id: new ObjectId(appointmentId) },
        {
          $set: {
            paymentStatus: "Paid",
            updatedAt: new Date(),
          },
        },
      );

      return res.send({
        success: true,
        result,
        updateResult,
      });
    }

    res.send({
      success: false,
      message: "Payment verification failed",
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
});

// admin part - transactions
app.get("/transactions",verifyToken,verifyAdmin, async (req, res) => {
  try {
    const transactions = await transactionCollection
      .aggregate([
        {
          $addFields: {
            customerObjectId: {
              $toObjectId: "$customerId",
            },
            appointmentObjectId: {
              $toObjectId: "$appointmentId",
            },
          },
        },
        {
          $lookup: {
            from: "user",
            localField: "customerObjectId",
            foreignField: "_id",
            as: "customer",
          },
        },
        {
          $unwind: {
            path: "$customer",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "appointments",
            localField: "appointmentObjectId",
            foreignField: "_id",
            as: "appointment",
          },
        },
        {
          $unwind: {
            path: "$appointment",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            serviceObjectId: {
              $convert: {
                input: "$appointment.serviceId",
                to: "objectId",
                onError: null,
                onNull: null,
              },
            },
          },
        },
        {
          $lookup: {
            from: "services",
            localField: "serviceObjectId",
            foreignField: "_id",
            as: "service",
          },
        },
        {
          $unwind: {
            path: "$service",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $set: {
            customer: {
              name: "$customer.name",
              email: "$customer.email",
              image: "$customer.image",
              phone: "$customer.phone",
            },
          },
        },
        {
          $project: {
            customerObjectId: 0,
            appointmentObjectId: 0,
            serviceObjectId: 0,
          },
        },
        {
          $sort: {
            createdAt: -1,
          },
        },
      ])
      .toArray();

    res.send(transactions);
  } catch (error) {
    res.status(500).send({
      message: error.message,
    });
  }
});

// Dashboard KPI for admin
app.get("/admin/dashboard-stats",verifyToken,verifyAdmin, async (req, res) => {
  try {
    const totalCustomers = await userCollection.countDocuments({
      role: "customer",
    });

    const totalActiveServices = await serviceCollection.countDocuments({
      status: "active",
    });

    const totalAppointments = await appointmentCollection.countDocuments();

    const pendingAppointments = await appointmentCollection.countDocuments({
      status: "Pending",
    });

    const confirmedAppointments = await appointmentCollection.countDocuments({
      status: "Confirmed",
    });

    const successfulPayments = await transactionCollection.countDocuments({
      status: "Paid",
    });

    res.send({
      totalCustomers,
      totalActiveServices,
      totalAppointments,
      pendingAppointments,
      confirmedAppointments,
      successfulPayments,
    });
  } catch (error) {
    res.status(500).send({
      message: error.message,
    });
  }
});

// Users
// update user profile
app.patch("/update-profile",verifyToken, async (req, res) => {
  const email = req.query.email;
  const { name, image, phone } = req.body;

  if (!email) {
    return res.status(400).send({
      message: "Email is required",
    });
  }

  const query = { email };

  const updatedDoc = {
    $set: {
      name,
      image,
      phone,
    },
  };

  const result = await userCollection.updateOne(query, updatedDoc);

  res.send(result);
});

// admin part
app.get("/users",verifyToken,verifyAdmin, async (req, res) => {
  const result = await userCollection.find().toArray();
  res.send(result);
});

app.patch("/users/:id/block",verifyToken,verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { isBlocked } = req.body;

  if (typeof isBlocked !== "boolean") {
    return res.status(400).send({
      message: "isBlocked must be true or false",
    });
  }

  const result = await userCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: { isBlocked } },
  );

  res.send(result);
});

app.listen(port, () => {
  console.log(`Saloon Book is running on port ${port}`);
});

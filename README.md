# SalonBook Server

SalonBook Server is the REST API for the SalonBook appointment-booking platform. It supports salon service discovery, appointment scheduling, role-based administration, payment verification, and dashboard data.

## Important Features

- Browse, search, filter, and sort salon services and categories.
- Check appointment availability and prevent duplicate time-slot bookings.
- Create appointments, view customer appointments, and cancel pending appointments.
- Role-based access control for customers and administrators.
- Admin tools to manage services, appointments, users, transactions, and dashboard statistics.
- Verify Stripe Checkout payments and record successful transactions.
- Update user profile information.

## Technology Stack

- Node.js
- Express.js
- MongoDB Node.js Driver / MongoDB Atlas
- Stripe
- CORS
- dotenv
- Vercel (deployment)

## Installation Instructions

1. Clone the repository:

   ```bash
   git clone https://github.com/amena-hira/salonbook-server.git
   ```

2. Open the project directory:

   ```bash
   cd salonbook-server
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Create a `.env` file in the project root and add the required environment-variable names listed below.

## How to Run the Project Locally

Start the development server:

```bash
npm run dev
```

Or start it with Node.js:

```bash
npm start
```

The API runs at `http://localhost:8000` by default. Set `PORT` to use a different port.

## Required Environment Variables

Add the following variable names to `.env`. Do not commit this file or any secret values.

```env
PORT
DB_USER
DB_PASSWORD
STRIPE_SECRET_KEY
```

## Live Website Link

- Client: https://salonbook-client-tau.vercel.app
- Server API: https://salonbook-server-kappa.vercel.app

## Repository Links

- Client: https://github.com/amena-hira/salonbook-client
- Server: https://github.com/amena-hira/salonbook-server

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
require('./cron/emailScanner');
require('./cron/replyProcessor');
const app = express();
app.use(cors());
app.use(express.json());
app.get('/', (req, res) => {
  res.send('RecruiterOS Running');
});
async function startServer() {
  await connectDB();

  app.listen(
    process.env.PORT || 3001,
    () => {
      console.log(
        'Server running on http://localhost:3001'
      );
    }
  );
}

startServer();
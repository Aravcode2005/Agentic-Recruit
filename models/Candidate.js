const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
  name: String,
  email: String,
  location: String,
  visaStatus: String,
  usArrivalDate: String,
  qualified: Boolean,
  stage: String,
  threadId: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Candidate', candidateSchema);
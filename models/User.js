const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  friends: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  solvedProblems: [{
    problem: String,  // Problem slug/name
    submissionId: String,  // Latest submission ID
    status: {
      type: String,
      default: "Accepted"  // Default value, typically all solved problems are "Accepted"
    }
  }]
});

const User = mongoose.model('User', userSchema);

module.exports = User;

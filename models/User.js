const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  avatar: {
    type: String,
    default: "https://secure.gravatar.com/avatar?d=mp",
  },
  friends: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  solvedProblems: [
    {
      problem: String,
      submissionId: String,
      status: {
        type: String,
        default: "Accepted",
      },
    },
  ],
  lastScrapedSubmissionId: String,
});

const User = mongoose.model("User", userSchema);

module.exports = User;

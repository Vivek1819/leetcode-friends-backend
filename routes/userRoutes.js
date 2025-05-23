const express = require("express");
const router = express.Router();
const User = require("../models/User");

router.post("/register", async (req, res) => {
  const { username } = req.body;
  try {
    const user = new User({ username });
    await user.save();
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ message: "Error creating user", error });
  }
});

router.get("/:username/solved/:slug", async (req, res) => {
  const { username, slug } = req.params;
  try {
    const user = await User.findOne({ username }).populate("friends");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const friendsSolved = user.friends.filter((friend) =>
      friend.solvedProblems.includes(slug)
    );
    res.json(friendsSolved.map((friend) => friend.username));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:username/add-friend", async (req, res) => {
  try {
    const { friendUsername } = req.body;
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ message: "User not found" });

    const friend = await User.findOne({ username: friendUsername });
    if (!friend)
      return res.status(404).json({ message: "Friend user not found" });

    if (user.friends.includes(friend._id)) {
      return res.status(400).json({ message: "Already friends" });
    }

    user.friends.push(friend._id);
    await user.save();

    res.json({ message: `You are now friends with ${friendUsername}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:username/friends", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username }).populate(
      "friends",
      "username"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ friends: user.friends });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

module.exports = router;
